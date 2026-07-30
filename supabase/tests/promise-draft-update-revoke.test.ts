import { createHash, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

/**
 * DRAFT 수정 · 초대 무효화 — 02 §4-2-2.4 · §4-3-2.
 *
 * 두 경로 모두 화면의 편의 기능이 아니라 서버 무결성 경계다. DRAFT 수정은 버전 원본과
 * 조회 캐시가 한 트랜잭션에서 함께 바뀌어야 하고, [상대에게 보내기]는 그 수정과 T-02가
 * 갈라지면 안 된다. 무효화는 약속을 취소하지 않고 현재 PARTNER 초대만 닫아야 한다.
 */

const UPDATE_SQL = `select public.lf_promise_draft_update(
  $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11::boolean,
  $12::char(64)) as payload`;

const REVOKE_SQL = `select public.lf_invite_revoke(
  $1::uuid, $2::uuid, $3::uuid) as payload`;

const INVITE_SQL = `select public.lf_promise_invite(
  $1::uuid, $2::uuid, $3::uuid, $4::char(64)) as payload`;

let db: TestDb;

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function kstToday(offsetDays: number): string {
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  kstNow.setUTCDate(kstNow.getUTCDate() + offsetDays);
  return kstNow.toISOString().slice(0, 10);
}

async function codeOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

interface DraftOverrides {
  key?: string;
  title?: string;
  body?: string;
  category?: string;
  endDate?: string;
  keeper?: string | null;
  reward?: string | null;
  penalty?: string | null;
  witnessEnabled?: boolean;
  tokenHash?: string | null;
}

function updateArgs(
  userId: string,
  promiseId: string,
  overrides: DraftOverrides = {},
): unknown[] {
  return [
    overrides.key ?? randomUUID(),
    userId,
    promiseId,
    overrides.title ?? '주 3회 달리기',
    overrides.body ?? '월요일 수요일 금요일에 함께 달린다',
    overrides.category ?? 'HABIT',
    overrides.endDate ?? kstToday(30),
    overrides.keeper === undefined ? 'BOTH' : overrides.keeper,
    overrides.reward === undefined ? '좋아하는 커피' : overrides.reward,
    overrides.penalty === undefined ? '다음 모임 준비' : overrides.penalty,
    overrides.witnessEnabled ?? false,
    overrides.tokenHash === undefined ? null : overrides.tokenHash,
  ];
}

async function updateDraft(
  userId: string,
  promiseId: string,
  overrides: DraftOverrides = {},
): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(UPDATE_SQL, updateArgs(userId, promiseId, overrides));
  return (rows[0] as { payload: Record<string, unknown> }).payload;
}

async function issueInvite(
  userId: string,
  promiseId: string,
  tokenHash: string,
): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(INVITE_SQL, [
    randomUUID(),
    userId,
    promiseId,
    tokenHash,
  ]);
  return (rows[0] as { payload: Record<string, unknown> }).payload;
}

async function revokeInvite(
  userId: string,
  promiseId: string,
  key = randomUUID(),
): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(REVOKE_SQL, [key, userId, promiseId]);
  return (rows[0] as { payload: Record<string, unknown> }).payload;
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('DRAFT 수정 (§4-2-2.4)', () => {
  test('버전 1과 조회 캐시를 NFC 정규화된 같은 값으로 덮어쓴다', async () => {
    const creator = await createUser(db, '초안수정');
    const promiseId = await createPromise(db, { creatorId: creator });

    const payload = await updateDraft(creator, promiseId, {
      title: `  \u1100\u1161\u1109\u1169\u11A8 약속  `,
      body: `  첫째 줄\r\n둘째 줄\u0001  `,
      category: 'BET',
      keeper: 'PARTNER',
      reward: '  영화 보기  ',
      penalty: '',
      witnessEnabled: true,
    });

    expect(payload).toEqual({ promise_id: promiseId, status: 'DRAFT' });

    const { rows } = await db.asAdmin(
      `select p.title as cache_title, p.body as cache_body, p.category as cache_category,
              p.keeper as cache_keeper, p.reward as cache_reward, p.penalty as cache_penalty,
              p.witness_enabled, p.lock_version,
              v.version_no, v.title, v.body, v.category, v.keeper, v.reward, v.penalty,
              v.content_hash = public.lf_content_hash(
                v.title, v.body, v.category, v.end_date, v.keeper, v.reward, v.penalty, v.version_no
              ) as hash_ok,
              (select count(*)::int from public.promise_versions where promise_id = p.id) as versions
         from public.promises p
         join public.promise_versions v on v.promise_id = p.id
        where p.id = $1`,
      [promiseId],
    );
    const row = rows[0] as Record<string, unknown>;

    expect(row).toMatchObject({
      cache_title: '가속 약속',
      title: '가속 약속',
      cache_body: '첫째 줄\n둘째 줄',
      body: '첫째 줄\n둘째 줄',
      cache_category: 'BET',
      category: 'BET',
      cache_keeper: 'PARTNER',
      keeper: 'PARTNER',
      cache_reward: '영화 보기',
      reward: '영화 보기',
      cache_penalty: null,
      penalty: null,
      witness_enabled: true,
      version_no: 1,
      hash_ok: true,
      versions: 1,
      lock_version: 1,
    });
  });

  test('남의 DRAFT 와 없는 DRAFT 는 같은 E_NOT_FOUND 다', async () => {
    const creator = await createUser(db, '초안주인');
    const stranger = await createUser(db, '초안타인');
    const promiseId = await createPromise(db, { creatorId: creator });

    expect(await codeOf(() => updateDraft(stranger, promiseId))).toBe('E_NOT_FOUND');
    expect(await codeOf(() => updateDraft(creator, randomUUID()))).toBe('E_NOT_FOUND');
  });

  test.each([['PENDING'], ['ACTIVE'], ['DECLINED']])(
    '%s 약속은 수정할 수 없다',
    async (status) => {
      const creator = await createUser(db, `초안상태${status}`);
      const promiseId = await createPromise(db, { creatorId: creator, status });
      expect(await codeOf(() => updateDraft(creator, promiseId))).toBe('E_STATE_CONFLICT');
    },
  );

  test('잘못된 종료일이면 원본과 캐시 어느 쪽도 일부 갱신되지 않는다', async () => {
    const creator = await createUser(db, '초안검증');
    const promiseId = await createPromise(db, { creatorId: creator });

    expect(
      await codeOf(() =>
        updateDraft(creator, promiseId, { title: '바뀌면 안 됨', endDate: kstToday(0) }),
      ),
    ).toBe('E_VALIDATION');

    const { rows } = await db.asAdmin(
      `select p.title as cache_title, v.title
         from public.promises p
         join public.promise_versions v on v.promise_id = p.id
        where p.id = $1`,
      [promiseId],
    );
    expect(rows[0]).toMatchObject({ cache_title: '매일 걷기', title: '매일 걷기' });
  });

  test('send=true이면 수정과 T-02가 한 트랜잭션에서 PENDING까지 간다', async () => {
    const creator = await createUser(db, '초안발송');
    const promiseId = await createPromise(db, { creatorId: creator });
    const tokenHash = hash('draft-send-token');

    const payload = await updateDraft(creator, promiseId, {
      title: '수정 후 바로 발송',
      tokenHash,
    });

    expect(payload).toMatchObject({
      promise_id: promiseId,
      status: 'PENDING',
      token_hash: tokenHash,
      title: '수정 후 바로 발송',
      resend_count: 0,
    });

    const { rows } = await db.asAdmin(
      `select p.status, p.title, v.title as version_title, i.token_hash
         from public.promises p
         join public.promise_versions v on v.promise_id = p.id
         join public.invitations i on i.promise_id = p.id
        where p.id = $1`,
      [promiseId],
    );
    expect(rows[0]).toMatchObject({
      status: 'PENDING',
      title: '수정 후 바로 발송',
      version_title: '수정 후 바로 발송',
      token_hash: tokenHash,
    });
  });

  test('발송이 실패하면 앞선 DRAFT 수정도 롤백된다', async () => {
    const creator = await createUser(db, '초안발송롤백');
    const other = await createUser(db, '초안발송롤백타인');
    const promiseId = await createPromise(db, { creatorId: creator });
    const otherPromiseId = await createPromise(db, { creatorId: other });
    const duplicateHash = hash('already-issued');
    await issueInvite(other, otherPromiseId, duplicateHash);

    expect(
      await codeOf(() =>
        updateDraft(creator, promiseId, {
          title: '롤백되어야 하는 제목',
          tokenHash: duplicateHash,
        }),
      ),
    ).toContain('duplicate key');

    const { rows } = await db.asAdmin(
      `select p.status, p.title as cache_title, v.title
         from public.promises p
         join public.promise_versions v on v.promise_id = p.id
        where p.id = $1`,
      [promiseId],
    );
    expect(rows[0]).toMatchObject({
      status: 'DRAFT',
      cache_title: '매일 걷기',
      title: '매일 걷기',
    });
  });

  test('같은 멱등 키의 재시도는 첫 응답과 첫 내용만 유지한다', async () => {
    const creator = await createUser(db, '초안멱등');
    const promiseId = await createPromise(db, { creatorId: creator });
    const key = randomUUID();
    const firstHash = hash('first-update-token');

    const first = await updateDraft(creator, promiseId, {
      key,
      title: '첫 수정',
      tokenHash: firstHash,
    });
    const second = await updateDraft(creator, promiseId, {
      key,
      title: '두 번째 수정',
      tokenHash: hash('second-update-token'),
    });

    expect(second).toEqual(first);
    const { rows } = await db.asAdmin(
      `select p.title,
              (select count(*)::int from public.invitations where promise_id = p.id) as invitations
         from public.promises p where p.id = $1`,
      [promiseId],
    );
    expect(rows[0]).toMatchObject({ title: '첫 수정', invitations: 1 });
  });
});

describe('현재 PARTNER 초대 무효화 (§4-3-2)', () => {
  test('초대와 만료 예정 알림만 닫고 약속은 PENDING으로 유지한다', async () => {
    const creator = await createUser(db, '초대무효화');
    const promiseId = await createPromise(db, { creatorId: creator });
    await issueInvite(creator, promiseId, hash('revoke-me'));

    const payload = await revokeInvite(creator, promiseId);
    expect(payload).toEqual({
      promise_id: promiseId,
      status: 'PENDING',
      invitation_status: 'REVOKED',
    });

    const { rows } = await db.asAdmin(
      `select p.status as promise_status, i.status as invitation_status,
              r.status as reminder_status
         from public.promises p
         join public.invitations i on i.promise_id = p.id
         join public.reminder_schedules r on r.promise_id = p.id
        where p.id = $1 and i.target_role = 'PARTNER'
          and r.kind = 'INVITE_EXPIRE_SOON'`,
      [promiseId],
    );
    expect(rows[0]).toMatchObject({
      promise_status: 'PENDING',
      invitation_status: 'REVOKED',
      reminder_status: 'CANCELED',
    });
  });

  test('증인 초대는 건드리지 않는다', async () => {
    const creator = await createUser(db, '무효화증인');
    const promiseId = await createPromise(db, { creatorId: creator });
    await issueInvite(creator, promiseId, hash('partner-token'));
    await db.asAdmin(
      `insert into public.invitations
         (promise_id, target_role, token_hash, created_by, expires_at)
       values ($1, 'WITNESS', $2, $3, now() + interval '72 hours')`,
      [promiseId, hash('witness-token'), creator],
    );

    await revokeInvite(creator, promiseId);

    const { rows } = await db.asAdmin(
      `select target_role, status from public.invitations
        where promise_id = $1 order by target_role::text`,
      [promiseId],
    );
    expect(rows).toEqual([
      { target_role: 'PARTNER', status: 'REVOKED' },
      { target_role: 'WITNESS', status: 'PENDING' },
    ]);
  });

  test('남의 약속과 없는 약속은 같은 E_NOT_FOUND 다', async () => {
    const creator = await createUser(db, '무효화주인');
    const stranger = await createUser(db, '무효화타인');
    const promiseId = await createPromise(db, { creatorId: creator });
    await issueInvite(creator, promiseId, hash('owner-token'));

    expect(await codeOf(() => revokeInvite(stranger, promiseId))).toBe('E_NOT_FOUND');
    expect(await codeOf(() => revokeInvite(creator, randomUUID()))).toBe('E_NOT_FOUND');
  });

  test('PENDING이 아니거나 살아 있는 PARTNER 초대가 없으면 E_STATE_CONFLICT다', async () => {
    const creator = await createUser(db, '무효화상태');
    const draftId = await createPromise(db, { creatorId: creator });
    const pendingWithoutInviteId = await createPromise(db, {
      creatorId: creator,
      status: 'PENDING',
    });

    expect(await codeOf(() => revokeInvite(creator, draftId))).toBe('E_STATE_CONFLICT');
    expect(await codeOf(() => revokeInvite(creator, pendingWithoutInviteId))).toBe(
      'E_STATE_CONFLICT',
    );
  });

  test('같은 멱등 키 재시도는 같은 성공 응답을 돌려준다', async () => {
    const creator = await createUser(db, '무효화멱등');
    const promiseId = await createPromise(db, { creatorId: creator });
    await issueInvite(creator, promiseId, hash('idempotent-revoke'));
    const key = randomUUID();

    const first = await revokeInvite(creator, promiseId, key);
    const second = await revokeInvite(creator, promiseId, key);

    expect(second).toEqual(first);
  });
});

describe('실행 권한 — 서버 전용', () => {
  test.each([
    ['lf_promise_draft_update(uuid, uuid, uuid, text, text, text, text, text, text, text, boolean, char)'],
    ['lf_invite_revoke(uuid, uuid, uuid)'],
  ])('%s 는 anon·authenticated·public 모두에게 닫혀 있다', async (signature) => {
    for (const role of ['anon', 'authenticated', 'public']) {
      const { rows } = await db.asAdmin(`select has_function_privilege($1, $2, 'execute') as ok`, [
        role,
        `public.${signature}`,
      ]);
      expect((rows[0] as { ok: boolean }).ok, `${role} → ${signature}`).toBe(false);
    }
  });

  test('service_role은 두 진입점을 실행할 수 있다', async () => {
    for (const signature of [
      'lf_promise_draft_update(uuid, uuid, uuid, text, text, text, text, text, text, text, boolean, char)',
      'lf_invite_revoke(uuid, uuid, uuid)',
    ]) {
      const { rows } = await db.asAdmin(
        `select has_function_privilege('service_role', $1, 'execute') as ok`,
        [`public.${signature}`],
      );
      expect((rows[0] as { ok: boolean }).ok, signature).toBe(true);
    }
  });
});
