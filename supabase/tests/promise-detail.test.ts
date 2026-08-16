import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  asPromiseDetailResponse,
  type PromiseDetailResponse,
} from '../../packages/shared/src/index.ts';
import { createTestDb, createUser, type TestDb } from './harness.ts';

let db: TestDb;

interface FixtureInput {
  id: string;
  creator: string;
  partner?: string;
  witness?: string;
  status: PromiseDetailResponse['status'];
}

interface FixtureResult {
  versionId: string;
}

const FULFILLMENT_STATUSES = [
  'CHECKING',
  'COMPLETED',
  'BROKEN',
  'DISPUTED',
  'UNRESOLVED',
] as const;

function isConfirmed(status: FixtureInput['status']): boolean {
  return status !== 'PENDING' && status !== 'DECLINED';
}

function isClosed(status: FixtureInput['status']): boolean {
  return ['COMPLETED', 'BROKEN', 'UNRESOLVED', 'DECLINED', 'CANCELED'].includes(status);
}

async function insertFixture(input: FixtureInput): Promise<FixtureResult> {
  const activatedAt = isConfirmed(input.status) ? '2026-07-12T12:04:00Z' : null;
  const checkingAt = FULFILLMENT_STATUSES.includes(
    input.status as (typeof FULFILLMENT_STATUSES)[number],
  )
    ? '2026-08-30T15:00:00Z'
    : null;
  const deadlineAt = checkingAt === null ? null : '2026-09-06T15:00:00Z';
  const closedAt = isClosed(input.status) ? '2026-09-01T00:00:00Z' : null;
  await db.asAdmin(
    `insert into public.promises
       (id, creator_id, status, title, body, category, end_date, keeper, reward, penalty,
        witness_enabled, activated_at, checking_started_at, check_deadline_at, closed_at)
     values ($1, $2, $3::public.promise_status, '함께 달리기', '매주 두 번 달린다.', 'HABIT',
             '2026-08-30', 'BOTH', '맛있는 저녁', '커피 사기', $4, $5, $6, $7, $8)`,
    [
      input.id,
      input.creator,
      input.status,
      input.witness !== undefined,
      activatedAt,
      checkingAt,
      deadlineAt,
      closedAt,
    ],
  );
  const { rows } = await db.asAdmin(
    `insert into public.promise_versions
       (promise_id, version_no, title, body, category, end_date, keeper, reward, penalty,
        content_hash, created_by, activated_at)
     values ($1, 1, '함께 달리기', '매주 두 번 달린다.', 'HABIT', '2026-08-30', 'BOTH',
             '맛있는 저녁', '커피 사기',
             public.lf_content_hash('함께 달리기', '매주 두 번 달린다.', 'HABIT',
                                    '2026-08-30', 'BOTH', '맛있는 저녁', '커피 사기', 1),
             $2, $3)
     returning id`,
    [input.id, input.creator, activatedAt],
  );
  const versionId = rows[0]?.['id'] as string;
  await db.asAdmin(`update public.promises set current_version_id = $1 where id = $2`, [
    versionId,
    input.id,
  ]);
  await db.asAdmin(
    `insert into public.promise_participants
       (promise_id, user_id, role, status, joined_at)
     values ($1, $2, 'CREATOR', 'JOINED', '2026-07-12T11:58:00Z')`,
    [input.id, input.creator],
  );
  if (input.partner !== undefined && input.status !== 'PENDING') {
    const participantStatus = input.status === 'DECLINED' ? 'DECLINED' : 'JOINED';
    await db.asAdmin(
      `insert into public.promise_participants
         (promise_id, user_id, role, status, joined_at)
       values ($1, $2, 'PARTNER', $3::public.participant_status, $4)`,
      [
        input.id,
        input.partner,
        participantStatus,
        participantStatus === 'JOINED' ? '2026-07-12T12:04:00Z' : null,
      ],
    );
  }
  if (input.witness !== undefined) {
    await db.asAdmin(
      `insert into public.promise_participants
         (promise_id, user_id, role, status, joined_at)
       values ($1, $2, 'WITNESS', 'JOINED', '2026-07-13T00:00:00Z')`,
      [input.id, input.witness],
    );
  }
  if (isConfirmed(input.status) && input.partner !== undefined) {
    await db.asAdmin(
      `insert into public.approvals
         (promise_id, version_id, user_id, role, action, content_hash, surface, acted_at)
       select $1, $2, actor.id, actor.role::public.participant_role, 'APPROVE', v.content_hash,
              'APP', actor.acted_at
         from public.promise_versions v
         cross join (
           values ($3::uuid, 'CREATOR'::text, '2026-07-12T11:58:00Z'::timestamptz),
                  ($4::uuid, 'PARTNER'::text, '2026-07-12T12:04:00Z'::timestamptz)
         ) actor(id, role, acted_at)
        where v.id = $2`,
      [input.id, versionId, input.creator, input.partner],
    );
  }
  return { versionId };
}

async function internalDetail(actor: string, promiseId: string): Promise<Record<string, unknown>> {
  const { rows } = await db.asService(
    `select public.lf_promise_detail($1, $2) as result`,
    [actor, promiseId],
  );
  return rows[0]?.['result'] as Record<string, unknown>;
}

async function detail(actor: string, promiseId: string): Promise<PromiseDetailResponse> {
  const { integrity_status: _internalIntegrity, ...publicValue } = await internalDetail(
    actor,
    promiseId,
  );
  const parsed = asPromiseDetailResponse(publicValue);
  if (parsed === null) throw new Error('INVALID_PROMISE_DETAIL');
  return parsed;
}

async function addChecks(input: {
  promiseId: string;
  versionId: string;
  creator: string;
  partner: string;
  creatorAnswer?: 'KEPT' | 'NOT_KEPT';
  partnerAnswer?: 'KEPT' | 'NOT_KEPT';
  evidence?: boolean;
}): Promise<void> {
  for (const [userId, answer, role] of [
    [input.creator, input.creatorAnswer, 'creator'],
    [input.partner, input.partnerAnswer, 'partner'],
  ] as const) {
    if (answer === undefined) continue;
    const { rows } = await db.asAdmin(
      `insert into public.fulfillment_checks
         (promise_id, version_id, user_id, round_no, answer, comment, surface, submitted_at)
       values ($1, $2, $3, 1, $4::public.fulfillment_answer, $5, 'APP',
               case when $6 = 'creator' then '2026-08-31T01:00:00Z'::timestamptz
                    else '2026-08-31T02:00:00Z'::timestamptz end)
       returning id`,
      [input.promiseId, input.versionId, userId, answer, `${role} 의견`, role],
    );
    if (input.evidence === true && role === 'partner') {
      await db.asAdmin(
        `insert into public.fulfillment_evidences
           (check_id, promise_id, uploaded_by, storage_key, thumb_key, mime, bytes, width, height)
         values ($1, $2, $3, 'private/full.jpg', 'private/thumb.jpg', 'image/jpeg', 2048, 640, 480)`,
        [rows[0]?.['id'], input.promiseId, userId],
      );
    }
  }
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('lf_promise_detail — SCR-A05 participant snapshot', () => {
  test('ACTIVE 당사자와 증인은 같은 확정 내용·참여자·승인 로그를 보고 private 필드는 보지 않는다', async () => {
    const creator = await createUser(db, '상세작성자');
    const partner = await createUser(db, '상세상대방');
    const witness = await createUser(db, '상세증인');
    await db.asAdmin(
      `update public.users set profile_image_url = 'https://example.com/partner.jpg' where id = $1`,
      [partner],
    );
    const promiseId = 'a2000000-0000-4000-8000-000000000001';
    await insertFixture({ id: promiseId, creator, partner, witness, status: 'ACTIVE' });

    const creatorView = await detail(creator, promiseId);
    const partnerView = await detail(partner, promiseId);
    const witnessView = await detail(witness, promiseId);

    expect(creatorView).toMatchObject({
      promise_id: promiseId,
      status: 'ACTIVE',
      my_role: 'CREATOR',
      partner: { nickname: '상세상대방', profile_image_url: 'https://example.com/partner.jpg' },
      witnesses: [{ nickname: '상세증인', role: 'WITNESS' }],
      current_version: { version_no: 1, fingerprint: expect.stringMatching(/^[0-9A-F-]{12}$/u) },
    });
    expect(creatorView).not.toHaveProperty('integrity_status');
    expect(creatorView.approvals.map((item) => item.role)).toEqual(['CREATOR', 'PARTNER']);
    expect(partnerView.my_role).toBe('PARTNER');
    expect(witnessView.my_role).toBe('WITNESS');
    expect(JSON.stringify(creatorView)).not.toMatch(/token_hash|ip_hash|user_agent_hash|storage_key/u);
  });

  test('외부인·hidden actor·DRAFT는 존재나 내용을 공개하지 않는다', async () => {
    const creator = await createUser(db, '보안작성자');
    const partner = await createUser(db, '보안상대방');
    const outsider = await createUser(db, '보안외부인');
    const activeId = 'a2000000-0000-4000-8000-000000000002';
    const draftId = 'a2000000-0000-4000-8000-000000000003';
    await insertFixture({ id: activeId, creator, partner, status: 'ACTIVE' });
    await insertFixture({ id: draftId, creator, status: 'PENDING' });
    await db.asAdmin(`update public.promises set status = 'DRAFT' where id = $1`, [draftId]);

    await expect(detail(outsider, activeId)).rejects.toThrow('E_NOT_FOUND');
    await db.asAdmin(
      `update public.promises set hidden_by = jsonb_build_array($1::text) where id = $2`,
      [creator, activeId],
    );
    await expect(detail(creator, activeId)).rejects.toThrow('E_NOT_FOUND');
    await expect(detail(creator, draftId)).rejects.toThrow('E_STATE_CONFLICT');
  });

  test('PENDING은 최신 초대 만료 snapshot을, DECLINED는 상대 사유만 반환한다', async () => {
    const creator = await createUser(db, '대기작성자');
    const partner = await createUser(db, '거절상대방');
    const pendingId = 'a2000000-0000-4000-8000-000000000004';
    const declinedId = 'a2000000-0000-4000-8000-000000000005';
    await insertFixture({ id: pendingId, creator, status: 'PENDING' });
    await db.asAdmin(
      `insert into public.invitations
         (promise_id, target_role, token_hash, created_by, expires_at, status, resend_count)
       values ($1, 'PARTNER', $2, $3, '2026-08-20T00:00:00Z', 'PENDING', 2)`,
      [pendingId, '1'.repeat(64), creator],
    );
    const { versionId } = await insertFixture({
      id: declinedId,
      creator,
      partner,
      status: 'DECLINED',
    });
    await db.asAdmin(
      `insert into public.approvals
         (promise_id, version_id, user_id, role, action, content_hash, comment, surface, acted_at)
       select $1, $2, $3, 'PARTNER', 'DECLINE', content_hash, '이번 달은 어려워요.', 'WEB',
              '2026-07-20T09:22:00Z'
         from public.promise_versions where id = $2`,
      [declinedId, versionId, partner],
    );

    await expect(detail(creator, pendingId)).resolves.toMatchObject({
      status: 'PENDING',
      invitation: { status: 'PENDING', resend_count: 2 },
      partner: null,
    });
    await expect(detail(partner, declinedId)).resolves.toMatchObject({
      status: 'DECLINED',
      my_role: 'PARTNER',
      approvals: [{ action: 'DECLINE', comment: '이번 달은 어려워요.' }],
    });
  });

  test('AMEND_PENDING은 현재·제안 버전을, CANCELED는 승인된 파기 사유를 반환한다', async () => {
    const creator = await createUser(db, '변경작성자');
    const partner = await createUser(db, '변경상대방');
    const amendId = 'a2000000-0000-4000-8000-000000000006';
    const canceledId = 'a2000000-0000-4000-8000-000000000007';
    await insertFixture({ id: amendId, creator, partner, status: 'AMEND_PENDING' });
    const { rows } = await db.asAdmin(
      `insert into public.promise_versions
         (promise_id, version_no, title, body, category, end_date, keeper, reward, penalty,
          content_hash, created_by, change_reason)
       values ($1, null, '함께 달리기', '휴가 뒤 다시 달린다.', 'HABIT', '2026-09-13', 'BOTH',
               '맛있는 저녁', '커피 사기',
               public.lf_content_hash('함께 달리기', '휴가 뒤 다시 달린다.', 'HABIT',
                                      '2026-09-13', 'BOTH', '맛있는 저녁', '커피 사기', 2),
               $2, '휴가 기간 반영') returning id`,
      [amendId, creator],
    );
    await db.asAdmin(
      `insert into public.amend_requests
         (promise_id, requester_id, type, proposed_version_id, reason, status, expires_at, created_at)
       values ($1, $2, 'AMEND', $3, '휴가 기간 반영', 'PENDING',
               '2026-08-08T00:00:00Z', '2026-08-01T00:00:00Z')`,
      [amendId, creator, rows[0]?.['id']],
    );
    await insertFixture({ id: canceledId, creator, partner, status: 'CANCELED' });
    await db.asAdmin(
      `insert into public.amend_requests
         (promise_id, requester_id, type, reason, status, expires_at, responded_by, responded_at,
          created_at)
       values ($1, $2, 'CANCEL', '서로 일정이 달라졌어요.', 'APPROVED',
               '2026-08-08T00:00:00Z', $3, '2026-08-02T00:00:00Z', '2026-08-01T00:00:00Z')`,
      [canceledId, creator, partner],
    );

    await expect(detail(partner, amendId)).resolves.toMatchObject({
      status: 'AMEND_PENDING',
      amend_request: {
        type: 'AMEND',
        status: 'PENDING',
        proposed_version: { version_no: 2, end_date: '2026-09-13' },
      },
    });
    await expect(detail(creator, canceledId)).resolves.toMatchObject({
      status: 'CANCELED',
      amend_request: { type: 'CANCEL', status: 'APPROVED', reason: '서로 일정이 달라졌어요.' },
    });
  });

  test('CHECKING은 미제출 상대와 증인에게 전략적 답변·증빙을 숨기고 제출 사실만 공개한다', async () => {
    const creator = await createUser(db, '확인작성자');
    const partner = await createUser(db, '확인상대방');
    const witness = await createUser(db, '확인증인');
    const promiseId = 'a2000000-0000-4000-8000-000000000008';
    const { versionId } = await insertFixture({
      id: promiseId,
      creator,
      partner,
      witness,
      status: 'CHECKING',
    });
    await addChecks({
      promiseId,
      versionId,
      creator,
      partner,
      partnerAnswer: 'KEPT',
      evidence: true,
    });

    const creatorView = await detail(creator, promiseId);
    const partnerView = await detail(partner, promiseId);
    const witnessView = await detail(witness, promiseId);
    expect(creatorView.fulfillment).toMatchObject({
      creator_has_submitted: false,
      partner_has_submitted: true,
      creator_check: null,
      partner_check: null,
    });
    expect(partnerView.fulfillment?.partner_check).toMatchObject({
      role: 'PARTNER',
      answer: 'KEPT',
      evidences: [{ availability: 'AVAILABLE' }],
    });
    expect(witnessView.fulfillment).toMatchObject({
      creator_has_submitted: false,
      partner_has_submitted: true,
      creator_check: null,
      partner_check: null,
    });
    expect(JSON.stringify(partnerView)).not.toContain('private/full.jpg');
  });

  test.each([
    ['COMPLETED', 'KEPT', 'KEPT'],
    ['BROKEN', 'NOT_KEPT', 'NOT_KEPT'],
    ['DISPUTED', 'KEPT', 'NOT_KEPT'],
    ['UNRESOLVED', 'KEPT', undefined],
  ] as const)('%s 결과에서 양측 주장을 중립 snapshot으로 반환한다', async (status, creatorAnswer, partnerAnswer) => {
    const creator = await createUser(db, `${status}작성자`);
    const partner = await createUser(db, `${status}상대방`);
    const promiseId = `b2000000-0000-4000-8000-00000000000${
      status === 'COMPLETED' ? '1' : status === 'BROKEN' ? '2' : status === 'DISPUTED' ? '3' : '4'
    }`;
    const { versionId } = await insertFixture({ id: promiseId, creator, partner, status });
    await addChecks({
      promiseId,
      versionId,
      creator,
      partner,
      creatorAnswer,
      ...(partnerAnswer === undefined ? {} : { partnerAnswer }),
    });

    const response = await detail(creator, promiseId);
    expect(response.status).toBe(status);
    expect(response.fulfillment?.creator_check?.answer).toBe(creatorAnswer);
    expect(response.fulfillment?.partner_check?.answer).toBe(partnerAnswer);
  });

  test('내부 RPC는 변조 결과를 감지하지만 공개 상세은 전문만 반환한다', async () => {
    const creator = await createUser(db, '무결성작성자');
    const partner = await createUser(db, '무결성상대방');
    const promiseId = 'a2000000-0000-4000-8000-000000000009';
    const { versionId } = await insertFixture({ id: promiseId, creator, partner, status: 'ACTIVE' });
    await db.asAdmin(`update public.promise_versions set body = '변조된 본문' where id = $1`, [versionId]);

    await expect(internalDetail(creator, promiseId)).resolves.toMatchObject({
      body: '변조된 본문',
      integrity_status: 'FAILED',
    });
    const publicDetail = await detail(creator, promiseId);
    expect(publicDetail.body).toBe('변조된 본문');
    expect(publicDetail).not.toHaveProperty('integrity_status');
  });

  test('RPC는 service_role 전용이며 authenticated·anon 직접 실행을 거부한다', async () => {
    const creator = await createUser(db, '권한작성자');
    const partner = await createUser(db, '권한상대방');
    const promiseId = 'a2000000-0000-4000-8000-000000000010';
    await insertFixture({ id: promiseId, creator, partner, status: 'ACTIVE' });

    await expect(
      db.asUser(creator, `select public.lf_promise_detail($1, $2)`, [creator, promiseId]),
    ).rejects.toThrow(/permission denied/u);
    await expect(
      db.asAnon(`select public.lf_promise_detail($1, $2)`, [creator, promiseId]),
    ).rejects.toThrow(/permission denied/u);
  });
});
