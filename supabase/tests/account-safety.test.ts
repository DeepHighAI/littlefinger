import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  asAccountWithdrawResponse,
  asProfileNicknameUpdateResponse,
  asPromiseHideResponse,
  asSafetyReportResponse,
  asUserBlockListResponse,
  asUserBlockResponse,
  asUserUnblockResponse,
} from '../../packages/shared/src/account-safety.ts';
import { createTestDb, createUser, type TestDb } from './harness.ts';

let db: TestDb;

async function insertPromise(input: {
  id: string;
  creator: string;
  partner?: string;
  status: 'DRAFT' | 'PENDING' | 'ACTIVE' | 'AMEND_PENDING' | 'CHECKING' | 'COMPLETED';
}): Promise<void> {
  await db.asAdmin(
    `insert into public.promises
       (id, creator_id, status, title, body, category, end_date, keeper, closed_at)
     values ($1, $2, $3::public.promise_status, '안전 테스트', '본문', 'HABIT', '2026-12-31',
             'BOTH', case when $3 = 'COMPLETED' then now() else null end)`,
    [input.id, input.creator, input.status],
  );
  await db.asAdmin(
    `insert into public.promise_versions
       (promise_id, version_no, title, body, category, end_date, keeper, content_hash,
        created_by, activated_at)
     values ($1, 1, '안전 테스트', '본문', 'HABIT', '2026-12-31', 'BOTH',
             public.lf_content_hash('안전 테스트', '본문', 'HABIT', '2026-12-31', 'BOTH', null, null, 1),
             $2, case when $3 = 'DRAFT' then null else now() end)`,
    [input.id, input.creator, input.status],
  );
  await db.asAdmin(
    `update public.promises p set current_version_id = v.id
       from public.promise_versions v where p.id = $1 and v.promise_id = p.id`,
    [input.id],
  );
  await db.asAdmin(
    `insert into public.promise_participants (promise_id, user_id, role, status, joined_at)
     values ($1, $2, 'CREATOR', 'JOINED', now())`,
    [input.id, input.creator],
  );
  if (input.partner !== undefined) {
    await db.asAdmin(
      `insert into public.promise_participants (promise_id, user_id, role, status, joined_at)
       values ($1, $2, 'PARTNER', 'JOINED', now())`,
      [input.id, input.partner],
    );
  }
}

let keyIndex = 1;

function idempotencyKey(): string {
  return `e0000000-0000-4000-8000-${String(keyIndex++).padStart(12, '0')}`;
}

async function rpc(name: string, args: unknown[], key = idempotencyKey()): Promise<unknown> {
  const rpcArgs = [key, ...args];
  const placeholders = rpcArgs.map((_, index) => `$${index + 1}`).join(', ');
  const { rows } = await db.asService(
    `select public.${name}(${placeholders}) as result`,
    rpcArgs,
  );
  return rows[0]?.['result'];
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('account lifecycle completion', () => {
  test('EC-H01·EC-H02 탈퇴는 초안·대기·변경 요청을 정리하고 확정 기록과 비식별 사용자를 보존한다', async () => {
    const actor = await createUser(db, '탈퇴자');
    const partner = await createUser(db, '기록상대');
    const draft = 'a0000000-0000-4000-8000-000000000001';
    const pending = 'a0000000-0000-4000-8000-000000000002';
    const active = 'a0000000-0000-4000-8000-000000000003';
    const checking = 'a0000000-0000-4000-8000-000000000004';
    const amend = 'a0000000-0000-4000-8000-000000000005';
    await insertPromise({ id: draft, creator: actor, status: 'DRAFT' });
    await insertPromise({ id: pending, creator: actor, partner, status: 'PENDING' });
    await insertPromise({ id: active, creator: actor, partner, status: 'ACTIVE' });
    await insertPromise({ id: checking, creator: actor, partner, status: 'CHECKING' });
    await insertPromise({ id: amend, creator: actor, partner, status: 'AMEND_PENDING' });
    await db.asAdmin(
      `insert into public.invitations
         (promise_id, target_role, token_hash, created_by, expires_at)
       values ($1, 'PARTNER', repeat('a', 64), $2, now() + interval '1 day')`,
      [pending, actor],
    );
    await db.asAdmin(
      `insert into public.amend_requests
         (promise_id, requester_id, type, reason, expires_at)
       values ($1, $2, 'CANCEL', '탈퇴 전 요청', now() + interval '1 day')`,
      [amend, actor],
    );
    await db.asAdmin(
      `insert into public.device_tokens (user_id, fcm_token) values ($1, 'ExponentPushToken[test]')`,
      [actor],
    );

    const anonymized = `withdrawn:${'a'.repeat(64)}`;
    const key = idempotencyKey();
    const first = await rpc('lf_account_withdraw', [actor, anonymized], key);
    const second = await rpc('lf_account_withdraw', [actor, anonymized], key);
    expect(asAccountWithdrawResponse(first)).toEqual({ status: 'WITHDRAWN' });
    expect(asAccountWithdrawResponse(second)).toEqual({ status: 'WITHDRAWN' });

    const { rows } = await db.asAdmin(
      `select id, status::text, provider_user_id, provider, nickname, profile_image_url,
              withdrawn_at is not null as withdrawn
         from public.users where id = $1`,
      [actor],
    );
    expect(rows[0]).toMatchObject({
      id: actor,
      status: 'WITHDRAWN',
      provider_user_id: anonymized,
      // 탈퇴해도 프로바이더는 남는다 — 같은 프로바이더 재가입 비승계 감지(EC-A07)용.
      provider: 'kakao',
      nickname: '탈퇴한 사용자',
      profile_image_url: null,
      withdrawn: true,
    });
    expect((await db.asAdmin(`select id from public.promises where id = $1`, [draft])).rows).toEqual([]);
    expect(
      (await db.asAdmin(`select status::text from public.promises where id = any($1::uuid[])`, [[pending, active, checking, amend]])).rows,
    ).toEqual(expect.arrayContaining([
      { status: 'DECLINED' },
      { status: 'ACTIVE' },
      { status: 'CHECKING' },
      { status: 'ACTIVE' },
    ]));
    expect((await db.asAdmin(`select status::text from public.invitations where promise_id = $1`, [pending])).rows).toEqual([{ status: 'REVOKED' }]);
    expect((await db.asAdmin(`select status::text from public.amend_requests where promise_id = $1`, [amend])).rows).toEqual([{ status: 'WITHDRAWN' }]);
    expect((await db.asAdmin(`select id from public.device_tokens where user_id = $1`, [actor])).rows).toEqual([]);

    await db.asAdmin(`delete from auth.users where id = $1`, [actor]);
    expect((await db.asAdmin(`select id from public.users where id = $1`, [actor])).rows).toHaveLength(1);
    expect((await db.asUser(actor, `select id from public.users where id = $1`, [actor])).rows).toEqual([]);
    await expect(db.asService(`select public.lf_assert_actor($1)`, [actor])).rejects.toThrow(/E_FORBIDDEN/u);
  });

  test('EC-A07 같은 카카오 계정 재가입은 새 user_id를 받고 이전 기록을 승계하지 않는다', async () => {
    const providerId = `rejoin-${Date.now()}`;
    const { rows: oldAuthRows } = await db.asAdmin(`insert into auth.users default values returning id`);
    const oldId = String(oldAuthRows[0]?.['id']);
    await db.asAdmin(
      `insert into auth.identities (user_id, provider, provider_id, last_sign_in_at)
       values ($1, 'kakao', $2, now())`,
      [oldId, providerId],
    );
    await db.asService(
      `select public.lf_user_provision($1, 'APP'::public.surface, '이전 사용자', null)`,
      [oldId],
    );
    const oldPromise = 'a7000000-0000-4000-8000-000000000001';
    await insertPromise({ id: oldPromise, creator: oldId, status: 'ACTIVE' });
    await rpc('lf_account_withdraw', [oldId, `withdrawn:${'7'.repeat(64)}`]);
    await db.asAdmin(`delete from auth.users where id = $1`, [oldId]);

    const { rows: newAuthRows } = await db.asAdmin(`insert into auth.users default values returning id`);
    const newId = String(newAuthRows[0]?.['id']);
    await db.asAdmin(
      `insert into auth.identities (user_id, provider, provider_id, last_sign_in_at)
       values ($1, 'kakao', $2, now())`,
      [newId, providerId],
    );
    await db.asService(
      `select public.lf_user_provision($1, 'APP'::public.surface, '새 사용자', null)`,
      [newId],
    );

    expect(newId).not.toBe(oldId);
    expect((await db.asAdmin(`select provider_user_id, status::text from public.users where id = $1`, [newId])).rows).toEqual([
      { provider_user_id: providerId, status: 'ACTIVE' },
    ]);
    expect((await db.asAdmin(
      `select count(*)::int as count from public.promise_participants where user_id = $1`,
      [newId],
    )).rows[0]?.['count']).toBe(0);
    expect((await db.asAdmin(`select creator_id from public.promises where id = $1`, [oldPromise])).rows).toEqual([
      { creator_id: oldId },
    ]);
  });

  test('임시 닉네임은 NFC 정규화 뒤 유효한 길이로만 갱신한다', async () => {
    const actor = await createUser(db, '사용자1234');
    const result = await rpc('lf_profile_nickname_update', [actor, '  가속  ']);
    expect(asProfileNicknameUpdateResponse(result)).toEqual({ nickname: '가속' });
    await expect(rpc('lf_profile_nickname_update', [actor, '   '])).rejects.toThrow(/E_VALIDATION/u);
  });
});

describe('record visibility and safety actions', () => {
  test('EC-H03 종결 약속만 본인 목록에서 멱등 숨김·복원이 가능하다', async () => {
    const actor = await createUser(db, '숨김사용자');
    const partner = await createUser(db, '숨김상대');
    const outsider = await createUser(db, '숨김외부');
    const terminal = 'b0000000-0000-4000-8000-000000000001';
    const active = 'b0000000-0000-4000-8000-000000000002';
    await insertPromise({ id: terminal, creator: actor, partner, status: 'COMPLETED' });
    await insertPromise({ id: active, creator: actor, partner, status: 'ACTIVE' });

    expect(asPromiseHideResponse(await rpc('lf_promise_hide', [actor, terminal, true]))).toEqual({ promise_id: terminal, hidden: true });
    expect(asPromiseHideResponse(await rpc('lf_promise_hide', [actor, terminal, true]))).toEqual({ promise_id: terminal, hidden: true });
    expect(asPromiseHideResponse(await rpc('lf_promise_hide', [actor, terminal, false]))).toEqual({ promise_id: terminal, hidden: false });
    await expect(rpc('lf_promise_hide', [actor, active, true])).rejects.toThrow(/E_STATE_CONFLICT/u);
    await expect(rpc('lf_promise_hide', [outsider, terminal, true])).rejects.toThrow(/E_NOT_FOUND/u);
  });

  test('공동 기록이 있는 사용자만 차단할 수 있고 기존 약속 상태는 바꾸지 않는다', async () => {
    const actor = await createUser(db, '차단사용자');
    const partner = await createUser(db, '차단상대');
    const outsider = await createUser(db, '차단외부');
    const promise = 'c0000000-0000-4000-8000-000000000001';
    await insertPromise({ id: promise, creator: actor, partner, status: 'ACTIVE' });

    expect(asUserBlockResponse(await rpc('lf_user_block', [actor, partner]))).toEqual({ target_user_id: partner, blocked: true });
    expect(asUserBlockResponse(await rpc('lf_user_block', [actor, partner]))).toEqual({ target_user_id: partner, blocked: true });
    await expect(rpc('lf_user_block', [actor, actor])).rejects.toThrow(/E_VALIDATION/u);
    await expect(rpc('lf_user_block', [actor, outsider])).rejects.toThrow(/E_NOT_FOUND/u);
    expect((await db.asAdmin(`select status::text from public.promises where id = $1`, [promise])).rows).toEqual([{ status: 'ACTIVE' }]);
  });

  test('F3 차단 목록은 닉네임과 함께 반환되고 해제는 본인 차단만 지운다', async () => {
    const actor = await createUser(db, '해제사용자');
    const partner = await createUser(db, '해제상대');
    const rival = await createUser(db, '해제제3자');
    await insertPromise({ id: 'c0000000-0000-4000-8000-000000000002', creator: actor, partner, status: 'ACTIVE' });
    await insertPromise({ id: 'c0000000-0000-4000-8000-000000000003', creator: rival, partner, status: 'ACTIVE' });
    await rpc('lf_user_block', [actor, partner]);
    await rpc('lf_user_block', [rival, partner]);

    const blockList = async (who: string) => asUserBlockListResponse(
      (await db.asService(`select public.lf_user_block_list($1) as result`, [who]))
        .rows[0]?.['result'],
    );
    const listed = await blockList(actor);
    expect(listed?.items).toHaveLength(1);
    expect(listed?.items[0]).toMatchObject({
      target_user_id: partner,
      nickname: '해제상대',
      profile_image_url: null,
    });

    expect(asUserUnblockResponse(await rpc('lf_user_unblock', [actor, partner])))
      .toEqual({ target_user_id: partner, blocked: false });
    // 이미 풀린 차단의 재해제도 성공으로 수렴한다 — 목록 재시도에서 되튀면 할 수 있는 일이 없다.
    expect(asUserUnblockResponse(await rpc('lf_user_unblock', [actor, partner])))
      .toEqual({ target_user_id: partner, blocked: false });
    await expect(rpc('lf_user_unblock', [actor, actor])).rejects.toThrow(/E_VALIDATION/u);

    // 남의 차단 행은 남는다 — blocker_id 필터가 곧 권한 검사다.
    const remaining = await db.asAdmin(
      `select blocker_id::text as blocker_id from public.blocks where blocked_user_id = $1`,
      [partner],
    );
    expect(remaining.rows).toEqual([{ blocker_id: rival }]);
    expect((await blockList(actor))?.items).toEqual([]);
  });

  test('EC-F06 증빙 신고는 참여 권한 검사와 블라인드를 한 트랜잭션에서 처리한다', async () => {
    const actor = await createUser(db, '신고사용자');
    const partner = await createUser(db, '신고상대');
    const outsider = await createUser(db, '신고외부');
    const promise = 'd0000000-0000-4000-8000-000000000001';
    await insertPromise({ id: promise, creator: actor, partner, status: 'CHECKING' });
    const { rows: versionRows } = await db.asAdmin(`select current_version_id from public.promises where id = $1`, [promise]);
    const versionId = versionRows[0]?.['current_version_id'];
    const { rows: checkRows } = await db.asAdmin(
      `insert into public.fulfillment_checks
         (promise_id, version_id, user_id, answer, surface)
       values ($1, $2, $3, 'KEPT', 'APP') returning id`,
      [promise, versionId, partner],
    );
    const { rows: evidenceRows } = await db.asAdmin(
      `insert into public.fulfillment_evidences
         (check_id, promise_id, uploaded_by, storage_key, mime, bytes)
       values ($1, $2, $3, 'evidence/test.webp', 'image/webp', 10) returning id`,
      [checkRows[0]?.['id'], promise, partner],
    );
    const evidenceId = String(evidenceRows[0]?.['id']);

    const reportKey = idempotencyKey();
    const result = await rpc(
      'lf_safety_report',
      [actor, promise, null, evidenceId, 'ABUSE', '부적절한 이미지'],
      reportKey,
    );
    expect(asSafetyReportResponse(result)).toMatchObject({ status: 'RECEIVED', evidence_blinded: true });
    expect(await rpc(
      'lf_safety_report',
      [actor, promise, null, evidenceId, 'ABUSE', '부적절한 이미지'],
      reportKey,
    )).toEqual(result);
    expect((await db.asAdmin(`select id from public.reports where reporter_id = $1 and evidence_id = $2`, [actor, evidenceId])).rows).toHaveLength(1);
    expect((await db.asAdmin(`select blinded_at is not null as blinded from public.fulfillment_evidences where id = $1`, [evidenceId])).rows).toEqual([{ blinded: true }]);
    await expect(
      rpc('lf_safety_report', [outsider, promise, null, evidenceId, 'ABUSE', null]),
    ).rejects.toThrow(/E_NOT_FOUND/u);
  });
});
