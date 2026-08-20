import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  DRAFT_MAX_CONCURRENT,
  END_DATE_MAX_DAYS,
  INVITE_EXPIRE_SOON_LEAD_HOURS,
  INVITE_RESEND_MAX,
  INVITE_TTL_HOURS,
  PROMISE_MAX_PER_DAY,
} from '../../packages/shared/src/config.ts';
import { inviteTokenHash } from '../functions/_shared/hash.ts';
import { createInviteToken } from '../functions/_shared/token.ts';
import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

/**
 * 약속 생성 · 초대 발급 — 02 §4-2-2 · §4-3-1 (T-01 · T-02).
 *
 * 이 파일에서 **가장 중요한 테스트는 하나**다: 발급한 토큰이 조회된다는 것(교차 경로).
 * 발급 쪽 해시 규칙이 조회 쪽과 어긋나면 멀쩡한 링크가 전부 E_NOT_FOUND 로 죽는데,
 * 토큰 원문은 어디에도 저장되지 않으므로 사후에 원인을 좁힐 단서가 남지 않는다.
 */

const PEPPER = 'test-invite-pepper';

let db: TestDb;

async function codeOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** 껍데기가 보낼 인자 그대로. 기본값은 §5-1 을 통과하는 값이다. */
function createArgs(
  userId: string,
  overrides: Partial<{
    key: string;
    title: string;
    body: string;
    category: string;
    endDate: string;
    keeper: string | null;
    reward: string | null;
    penalty: string | null;
    witnessEnabled: boolean;
    tokenHash: string | null;
  }> = {},
): unknown[] {
  return [
    overrides.key ?? randomUUID(),
    userId,
    overrides.title ?? '매일 걷기',
    overrides.body ?? '매일 30분 걷기로 했다',
    overrides.category ?? 'HABIT',
    overrides.endDate ?? kstToday(7),
    overrides.keeper === undefined ? 'BOTH' : overrides.keeper,
    overrides.reward === undefined ? '커피 한 잔' : overrides.reward,
    overrides.penalty === undefined ? '설거지 1주일' : overrides.penalty,
    overrides.witnessEnabled ?? false,
    overrides.tokenHash === undefined ? null : overrides.tokenHash,
  ];
}

const CREATE_SQL = `select public.lf_promise_create(
  $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::boolean, $11::char(64)) as payload`;

const INVITE_SQL = `select public.lf_promise_invite(
  $1::uuid, $2::uuid, $3::uuid, $4::char(64)) as payload`;

async function create(
  userId: string,
  overrides: Parameters<typeof createArgs>[1] = {},
): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(CREATE_SQL, createArgs(userId, overrides));
  return (rows[0] as { payload: Record<string, unknown> }).payload;
}

async function invite(
  userId: string,
  promiseId: string,
  tokenHash: string,
  key = randomUUID(),
): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(INVITE_SQL, [key, userId, promiseId, tokenHash]);
  return (rows[0] as { payload: Record<string, unknown> }).payload;
}

/** KST 오늘 + n 을 YYYY-MM-DD 로. 클라이언트가 보낼 형식 그대로다. */
function kstToday(offsetDays: number): string {
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  kstNow.setUTCDate(kstNow.getUTCDate() + offsetDays);
  return kstNow.toISOString().slice(0, 10);
}

async function statusOf(promiseId: string): Promise<string> {
  const { rows } = await db.asAdmin(`select status from public.promises where id = $1`, [
    promiseId,
  ]);
  return String((rows[0] as { status: string }).status);
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

// ══════════════════════════════════════════════════════════════
// 교차 경로 — pepper 계약
// ══════════════════════════════════════════════════════════════

describe('발급한 토큰이 조회된다 (pepper 계약)', () => {
  test('발급 → 조회가 같은 초대를 가리킨다', async () => {
    // 발급 쪽과 조회 쪽이 **같은 inviteTokenHash 를 쓴다**. 두 경로가 어긋나면 여기서만
    // 잡힌다 — 실제 증상은 E_NOT_FOUND 하나뿐이고 토큰 원문은 저장되지 않는다.
    const creator = await createUser(db, '작성자');
    const token = createInviteToken();

    const created = await create(creator, {
      title: '주 3회 달리기',
      tokenHash: await inviteTokenHash(token, PEPPER),
    });

    const { rows } = await db.asAdmin(`select public.lf_invite_resolve($1::char(64)) as payload`, [
      await inviteTokenHash(token, PEPPER),
    ]);
    const resolved = (rows[0] as { payload: Record<string, unknown> }).payload;

    expect(created['status']).toBe('PENDING');
    expect(resolved['title']).toBe('주 3회 달리기');
    expect(resolved['creator_nickname']).toBe('작성자');
    expect(resolved['target_role']).toBe('PARTNER');
  });

  test('pepper 가 다르면 조회되지 않는다 — 이 테스트가 실패하면 위 테스트가 무의미하다', async () => {
    const creator = await createUser(db, '작성자b');
    const token = createInviteToken();

    await create(creator, { tokenHash: await inviteTokenHash(token, PEPPER) });

    expect(
      await codeOf(async () =>
        db.asAdmin(`select public.lf_invite_resolve($1::char(64))`, [
          await inviteTokenHash(token, 'wrong-pepper'),
        ]),
      ),
    ).toBe('E_NOT_FOUND');
  });

  test('pepper 를 빼고 해시하면 조회되지 않는다', async () => {
    // 발급 경로가 pepper 를 잊는 것이 가장 그럴듯한 실수다.
    const creator = await createUser(db, '작성자c');
    const token = createInviteToken();

    await create(creator, { tokenHash: await inviteTokenHash(token, PEPPER) });

    expect(
      await codeOf(async () =>
        db.asAdmin(`select public.lf_invite_resolve($1::char(64))`, [
          await inviteTokenHash(token, ''),
        ]),
      ),
    ).toBe('E_NOT_FOUND');
  });

  test('토큰은 URL 경로에 그대로 넣을 수 있는 문자만 쓴다', async () => {
    // `/` 나 `+` 가 섞이면 https://{web}/i/{token} 이 갈라지거나 디코더에서 공백이 되어
    // 링크는 열리는데 해시만 달라진다.
    for (let i = 0; i < 50; i += 1) {
      expect(createInviteToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
    // 32바이트 → 패딩 없는 base64 43자.
    expect(createInviteToken()).toHaveLength(43);
    expect(new Set(Array.from({ length: 20 }, () => createInviteToken())).size).toBe(20);
  });
});

// ══════════════════════════════════════════════════════════════
// 정책 값
// ══════════════════════════════════════════════════════════════

describe('정책 값이 packages/shared 와 일치한다', () => {
  test.each([
    ['lf_draft_max_concurrent', DRAFT_MAX_CONCURRENT],
    ['lf_promise_max_per_day', PROMISE_MAX_PER_DAY],
    ['lf_end_date_max_days', END_DATE_MAX_DAYS],
    ['lf_invite_ttl_hours', INVITE_TTL_HOURS],
    ['lf_invite_resend_max', INVITE_RESEND_MAX],
    ['lf_invite_expire_soon_lead_hours', INVITE_EXPIRE_SOON_LEAD_HOURS],
  ])('%s', async (fn, expected) => {
    const { rows } = await db.asAdmin(`select public.${fn}() as n`);
    expect(Number((rows[0] as { n: number }).n)).toBe(expected);
  });
});

// ══════════════════════════════════════════════════════════════
// T-01
// ══════════════════════════════════════════════════════════════

describe('T-01 — DRAFT 생성 (§4-2-2)', () => {
  test('약속 1행 + 버전 v1 + CREATOR 참여자 1행을 함께 만든다', async () => {
    const creator = await createUser(db, 'T01기본');
    const payload = await create(creator, { title: '물 마시기', witnessEnabled: true });
    const promiseId = String(payload['promise_id']);

    expect(payload['status']).toBe('DRAFT');

    const { rows } = await db.asAdmin(
      `select p.status, p.title, p.witness_enabled, p.current_version_id,
              v.version_no, v.content_hash, v.activated_at,
              public.lf_content_hash(v.title, v.body, v.category, v.end_date, v.keeper,
                                     v.reward, v.penalty, v.version_no) as expected_hash,
              (select count(*)::int from public.promise_participants pp
                where pp.promise_id = p.id and pp.role = 'CREATOR'
                  and pp.user_id = p.creator_id and pp.status = 'JOINED') as creator_rows,
              (select count(*)::int from public.promise_versions x where x.promise_id = p.id) as versions
         from public.promises p
         join public.promise_versions v on v.promise_id = p.id
        where p.id = $1`,
      [promiseId],
    );
    const row = rows[0] as Record<string, unknown>;

    expect(row['status']).toBe('DRAFT');
    expect(row['title']).toBe('물 마시기');
    expect(row['witness_enabled']).toBe(true);
    expect(Number(row['version_no'])).toBe(1);
    expect(Number(row['versions'])).toBe(1);
    expect(Number(row['creator_rows'])).toBe(1);
    // 확정 전이라 활성 버전이 없다. 채우면 lf_invite_resolve 가 버전 테이블을 봐도 된다는
    // 착각이 생기는데, 그 함수는 확정 전 초대를 다루는 것이 존재 이유다.
    expect(row['current_version_id']).toBeNull();
    expect(row['activated_at']).toBeNull();
    expect(row['content_hash']).toBe(row['expected_hash']);
  });

  test('지킬 사람을 비우면 BOTH 다 (§5-1 기본값)', async () => {
    const creator = await createUser(db, 'T01기본값');
    const payload = await create(creator, { keeper: null });
    const { rows } = await db.asAdmin(`select keeper from public.promises where id = $1`, [
      payload['promise_id'],
    ]);
    expect((rows[0] as { keeper: string }).keeper).toBe('BOTH');
  });

  test('보상·벌칙을 비우면 NULL 로 저장한다', async () => {
    const creator = await createUser(db, 'T01빈보상');
    const payload = await create(creator, { reward: '   ', penalty: null });
    const { rows } = await db.asAdmin(
      `select reward, penalty from public.promises where id = $1`,
      [payload['promise_id']],
    );
    expect(rows[0]).toEqual({ reward: null, penalty: null });
  });

  test('조합형 자모로 입력한 제목이 정규화 뒤에 세어진다', async () => {
    // '가속' 을 조합형으로 쓰면 코드포인트 5개다. 정규화 없이 세면 통과하지만 저장된 값이
    // 완성형과 달라져 content_hash 가 갈라진다.
    const creator = await createUser(db, 'T01정규화');
    const payload = await create(creator, { title: '가속' });
    const { rows } = await db.asAdmin(
      `select title, char_length(title) as n from public.promises where id = $1`,
      [payload['promise_id']],
    );
    const row = rows[0] as { title: string; n: number };
    expect(row.title).toBe('가속');
    expect(Number(row.n)).toBe(2);
  });

  test.each([
    ['제목 1자', { title: '가' }],
    ['제목 41자', { title: '가'.repeat(41) }],
    ['제목 개행', { title: '두\n줄' }],
    ['본문 4자', { body: '네글자다' }],
    ['본문 1001자', { body: '가'.repeat(1001) }],
    ['본문 21줄', { body: Array.from({ length: 21 }, (_, i) => `줄${i}`).join('\n') }],
    ['없는 카테고리', { category: 'MARRIAGE' }],
    ['없는 지킬 사람', { keeper: 'WITNESS' }],
    ['보상 101자', { reward: '가'.repeat(101) }],
    ['벌칙 101자', { penalty: '가'.repeat(101) }],
  ])('%s 는 E_VALIDATION 이다', async (_label, overrides) => {
    const creator = await createUser(db, `T01검증${_label}`);
    expect(await codeOf(() => create(creator, overrides))).toBe('E_VALIDATION');
  });

  test('본문 20줄은 통과한다 — 경계가 한 칸 어긋나면 여기서 걸린다', async () => {
    const creator = await createUser(db, 'T01스무줄');
    const body = Array.from({ length: 20 }, (_, i) => `줄${i}`).join('\n');
    await expect(create(creator, { body })).resolves.toBeTruthy();
  });

  test.each([
    ['오늘', 0],
    ['어제', -1],
    ['오늘+366', END_DATE_MAX_DAYS + 1],
  ])('종료일 %s 는 E_VALIDATION 이다 (§5-1 내일~오늘+365)', async (_label, offset) => {
    const creator = await createUser(db, `T01날짜${_label}`);
    expect(await codeOf(() => create(creator, { endDate: kstToday(offset) }))).toBe('E_VALIDATION');
  });

  test.each([
    ['내일', 1],
    ['오늘+365', END_DATE_MAX_DAYS],
  ])('종료일 %s 는 통과한다', async (_label, offset) => {
    const creator = await createUser(db, `T01날짜통과${_label}`);
    await expect(create(creator, { endDate: kstToday(offset) })).resolves.toBeTruthy();
  });

  test.each([['2026-02-30'], ['내일'], ['2026-13-01'], ['']])(
    '날짜 아닌 값 %s 은 500 이 아니라 E_VALIDATION 이다',
    async (value) => {
      // 예외 블록 없이 캐스팅하면 22007 이 그대로 올라가 Postgres 메시지가 응답에 실린다.
      const creator = await createUser(db, `T01날짜형식${value}`);
      expect(await codeOf(() => create(creator, { endDate: value }))).toBe('E_VALIDATION');
    },
  );

  test('검증 실패는 아무 행도 남기지 않는다', async () => {
    const creator = await createUser(db, 'T01롤백');
    await codeOf(() => create(creator, { title: '가' }));
    const { rows } = await db.asAdmin(
      `select (select count(*)::int from public.promises where creator_id = $1) as promises,
              (select count(*)::int from public.idempotency_keys where user_id = $1) as keys`,
      [creator],
    );
    // 클레임까지 롤백돼야 같은 키로 다시 시도할 수 있다.
    expect(rows[0]).toEqual({ promises: 0, keys: 0 });
  });
});

// ══════════════════════════════════════════════════════════════
// EC-H05
// ══════════════════════════════════════════════════════════════

describe('EC-H05 남용 방지', () => {
  test(`DRAFT 를 ${DRAFT_MAX_CONCURRENT}건까지 만들고 그다음은 E_RATE_LIMIT 이다`, async () => {
    const creator = await createUser(db, 'ECH05초안');
    for (let i = 0; i < DRAFT_MAX_CONCURRENT; i += 1) {
      await create(creator);
    }
    expect(await codeOf(() => create(creator))).toBe('E_RATE_LIMIT');
  });

  test('DRAFT 를 보내고 나면 동시 보유 한도에서 빠진다', async () => {
    // 한도는 **DRAFT 동시 보유**다. PENDING 을 세면 정상 사용자가 21번째 약속을 못 만든다.
    const creator = await createUser(db, 'ECH05발송후');
    for (let i = 0; i < DRAFT_MAX_CONCURRENT; i += 1) {
      await create(creator, { tokenHash: await inviteTokenHash(createInviteToken(), PEPPER) });
    }
    await expect(create(creator)).resolves.toBeTruthy();
  });

  test(`일 ${PROMISE_MAX_PER_DAY}건을 넘으면 E_RATE_LIMIT 이다`, async () => {
    const creator = await createUser(db, 'ECH05일일');
    // 동시 보유 한도에 먼저 걸리지 않도록 전부 보낸다.
    for (let i = 0; i < PROMISE_MAX_PER_DAY; i += 1) {
      await create(creator, { tokenHash: await inviteTokenHash(createInviteToken(), PEPPER) });
    }
    expect(await codeOf(() => create(creator))).toBe('E_RATE_LIMIT');
  });

  test('어제 만든 약속은 오늘 한도에 들어가지 않는다 — 기준은 KST 캘린더 일이다', async () => {
    const creator = await createUser(db, 'ECH05어제');
    for (let i = 0; i < PROMISE_MAX_PER_DAY; i += 1) {
      await create(creator, { tokenHash: await inviteTokenHash(createInviteToken(), PEPPER) });
    }
    await db.asAdmin(
      `update public.promises set created_at = created_at - interval '1 day' where creator_id = $1`,
      [creator],
    );
    await expect(create(creator)).resolves.toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════
// 멱등
// ══════════════════════════════════════════════════════════════

describe('멱등 (§7-3.6, EC-C01)', () => {
  test('같은 키를 두 번 보내면 약속은 하나다', async () => {
    const creator = await createUser(db, '멱등생성');
    const key = randomUUID();
    const first = await create(creator, { key });
    const second = await create(creator, { key });

    expect(second).toEqual(first);
    const { rows } = await db.asAdmin(
      `select count(*)::int as n from public.promises where creator_id = $1`,
      [creator],
    );
    expect(Number((rows[0] as { n: number }).n)).toBe(1);
  });

  test('같은 키로 재발송하면 초대는 하나고 payload 의 해시는 첫 토큰의 것이다', async () => {
    // 껍데기는 이 해시를 보고 "이번 호출이 발급했는가"를 판정한다. 두 번째 토큰을 응답에
    // 실으면 DB 에 없는 토큰으로 만든 링크가 사용자에게 간다.
    const creator = await createUser(db, '멱등발송');
    const { promise_id: promiseId } = await create(creator);
    const key = randomUUID();

    const firstToken = createInviteToken();
    const firstHash = await inviteTokenHash(firstToken, PEPPER);
    const first = await invite(creator, String(promiseId), firstHash, key);

    const secondHash = await inviteTokenHash(createInviteToken(), PEPPER);
    const second = await invite(creator, String(promiseId), secondHash, key);

    expect(second).toEqual(first);
    expect(second['token_hash']).toBe(firstHash);
    expect(second['token_hash']).not.toBe(secondHash);

    const { rows } = await db.asAdmin(
      `select count(*)::int as n from public.invitations where promise_id = $1`,
      [promiseId],
    );
    expect(Number((rows[0] as { n: number }).n)).toBe(1);
  });

  test('키가 다른 엔드포인트에서 재사용되면 E_FORBIDDEN 이다', async () => {
    const creator = await createUser(db, '멱등교차');
    const key = randomUUID();
    const { promise_id: promiseId } = await create(creator, { key });
    expect(
      await codeOf(async () =>
        invite(creator, String(promiseId), await inviteTokenHash(createInviteToken(), PEPPER), key),
      ),
    ).toBe('E_FORBIDDEN');
  });
});

// ══════════════════════════════════════════════════════════════
// T-02
// ══════════════════════════════════════════════════════════════

describe('T-02 — DRAFT → PENDING (§4-3-1)', () => {
  test('초대 1행 + NT-04 예약 + PENDING 전이', async () => {
    const creator = await createUser(db, 'T02기본');
    const { promise_id: promiseId } = await create(creator);
    const tokenHash = await inviteTokenHash(createInviteToken(), PEPPER);
    const payload = await invite(creator, String(promiseId), tokenHash);

    expect(payload['status']).toBe('PENDING');
    expect(payload['token_hash']).toBe(tokenHash);
    expect(Number(payload['resend_count'])).toBe(0);
    expect(await statusOf(String(promiseId))).toBe('PENDING');

    const { rows } = await db.asAdmin(
      `select i.status, i.target_role, i.created_by, i.resend_count, i.parent_invitation_id,
              i.used_by, i.used_at,
              -- 만료는 발급 + INVITE_TTL_HOURS. 초 단위 오차만 허용한다.
              abs(extract(epoch from (i.expires_at - (i.created_at + make_interval(hours => $2))))) < 2
                as ttl_ok,
              r.kind, r.status as reminder_status, r.user_id as reminder_user,
              abs(extract(epoch from (r.fire_at - (i.expires_at - make_interval(hours => $3))))) < 2
                as lead_ok
         from public.invitations i
         join public.reminder_schedules r on r.promise_id = i.promise_id
        where i.promise_id = $1`,
      [promiseId, INVITE_TTL_HOURS, INVITE_EXPIRE_SOON_LEAD_HOURS],
    );
    expect(rows).toHaveLength(1);
    const row = rows[0] as Record<string, unknown>;

    expect(row['status']).toBe('PENDING');
    expect(row['target_role']).toBe('PARTNER');
    expect(row['created_by']).toBe(creator);
    expect(Number(row['resend_count'])).toBe(0);
    expect(row['parent_invitation_id']).toBeNull();
    expect(row['used_by']).toBeNull();
    expect(row['used_at']).toBeNull();
    expect(row['ttl_ok']).toBe(true);
    expect(row['kind']).toBe('INVITE_EXPIRE_SOON');
    expect(row['reminder_status']).toBe('PENDING');
    expect(row['reminder_user']).toBe(creator);
    expect(row['lead_ok']).toBe(true);
  });

  test('작성자의 approvals 행을 남기지 않는다 (§4-3-5 5단계가 승인 시점에 2행을 쓴다)', async () => {
    // 여기서 한 행을 미리 쓰면 확정 후 approvals 가 3행이 되고, append-only 라 지울 수 없다.
    const creator = await createUser(db, 'T02승인로그');
    const { promise_id: promiseId } = await create(creator, {
      tokenHash: await inviteTokenHash(createInviteToken(), PEPPER),
    });
    const { rows } = await db.asAdmin(
      `select count(*)::int as n from public.approvals where promise_id = $1`,
      [promiseId],
    );
    expect(Number((rows[0] as { n: number }).n)).toBe(0);
  });

  test('재발송은 기존 토큰을 REVOKED 로 바꾸고 체인을 잇는다 (§4-3-1)', async () => {
    const creator = await createUser(db, 'T02재발송');
    const { promise_id: promiseId } = await create(creator);
    const firstToken = createInviteToken();
    const first = await invite(creator, String(promiseId), await inviteTokenHash(firstToken, PEPPER));
    const second = await invite(
      creator,
      String(promiseId),
      await inviteTokenHash(createInviteToken(), PEPPER),
    );

    expect(Number(second['resend_count'])).toBe(1);
    expect(await statusOf(String(promiseId))).toBe('PENDING');

    const { rows } = await db.asAdmin(
      `select id, status, resend_count, parent_invitation_id
         from public.invitations where promise_id = $1 order by resend_count`,
      [promiseId],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.['status']).toBe('REVOKED');
    expect(rows[1]?.['status']).toBe('PENDING');
    expect(rows[1]?.['parent_invitation_id']).toBe(first['invitation_id']);

    // 무효화된 토큰의 "곧 만료" 예약이 남으면 작성자에게 헛 알림이 간다.
    const { rows: schedules } = await db.asAdmin(
      // enum 은 선언 순으로 정렬되므로(PENDING → SENT → CANCELED) 텍스트로 캐스팅해 정렬한다.
      `select status::text as status, count(*)::int as n from public.reminder_schedules
        where promise_id = $1 and kind = 'INVITE_EXPIRE_SOON' group by status order by 1`,
      [promiseId],
    );
    expect(schedules).toEqual([
      { status: 'CANCELED', n: 1 },
      { status: 'PENDING', n: 1 },
    ]);
  });

  test('이전 토큰은 즉시 조회 불가다', async () => {
    const creator = await createUser(db, 'T02구토큰');
    const { promise_id: promiseId } = await create(creator);
    const oldToken = createInviteToken();
    await invite(creator, String(promiseId), await inviteTokenHash(oldToken, PEPPER));
    await invite(creator, String(promiseId), await inviteTokenHash(createInviteToken(), PEPPER));

    expect(
      await codeOf(async () =>
        db.asAdmin(`select public.lf_invite_resolve($1::char(64))`, [
          await inviteTokenHash(oldToken, PEPPER),
        ]),
      ),
    ).toBe('E_INVITE_REVOKED');
  });

  test(`EC-B08 — 재발송 ${INVITE_RESEND_MAX}회까지 허용하고 그다음은 E_RATE_LIMIT 이다`, async () => {
    const creator = await createUser(db, 'ECB08');
    const { promise_id: promiseId } = await create(creator);
    for (let i = 0; i <= INVITE_RESEND_MAX; i += 1) {
      const payload = await invite(
        creator,
        String(promiseId),
        await inviteTokenHash(createInviteToken(), PEPPER),
      );
      expect(Number(payload['resend_count'])).toBe(i);
    }
    expect(
      await codeOf(async () =>
        invite(creator, String(promiseId), await inviteTokenHash(createInviteToken(), PEPPER)),
      ),
    ).toBe('E_RATE_LIMIT');
  });

  test('증인 초대는 상대 초대를 건드리지 않는다 (target_role 필터)', async () => {
    // 빠뜨리면 F-05 로 증인을 부를 때마다 상대의 링크가 죽는다.
    const creator = await createUser(db, 'T02증인');
    const { promise_id: promiseId } = await create(creator);
    await invite(creator, String(promiseId), await inviteTokenHash(createInviteToken(), PEPPER));

    await db.asAdmin(
      `insert into public.invitations (promise_id, target_role, token_hash, created_by, expires_at)
       values ($1, 'WITNESS', repeat('a', 64), $2, now() + interval '72 hours')`,
      [promiseId, creator],
    );
    await invite(creator, String(promiseId), await inviteTokenHash(createInviteToken(), PEPPER));

    const { rows } = await db.asAdmin(
      `select status from public.invitations where promise_id = $1 and target_role = 'WITNESS'`,
      [promiseId],
    );
    expect(rows[0]?.['status']).toBe('PENDING');
  });

  test('남의 약속과 없는 약속은 같은 답이다 — E_NOT_FOUND (§9 원칙 1)', async () => {
    const creator = await createUser(db, 'T02주인');
    const stranger = await createUser(db, 'T02남');
    const { promise_id: promiseId } = await create(creator);
    const hash = await inviteTokenHash(createInviteToken(), PEPPER);

    expect(await codeOf(() => invite(stranger, String(promiseId), hash))).toBe('E_NOT_FOUND');
    expect(await codeOf(() => invite(creator, randomUUID(), hash))).toBe('E_NOT_FOUND');
  });

  test.each([['ACTIVE'], ['DECLINED'], ['COMPLETED']])(
    '%s 인 약속에는 초대를 보낼 수 없다 — E_STATE_CONFLICT',
    async (status) => {
      const creator = await createUser(db, `T02상태${status}`);
      const promiseId = await createPromise(db, { creatorId: creator, status });
      expect(
        await codeOf(async () =>
          invite(creator, promiseId, await inviteTokenHash(createInviteToken(), PEPPER)),
        ),
      ).toBe('E_STATE_CONFLICT');
    },
  );
});

// ══════════════════════════════════════════════════════════════
// 종료일 — EC-B10 출구 보존
// ══════════════════════════════════════════════════════════════

describe('T-02 종료일 규칙', () => {
  test('DRAFT 는 종료일이 지났으면 보낼 수 없다 (§7-1 T-02 선행 조건)', async () => {
    const creator = await createUser(db, 'T02만료초안');
    const promiseId = await createPromise(db, {
      creatorId: creator,
      status: 'DRAFT',
      endDateOffsetDays: -1,
    });
    expect(
      await codeOf(async () =>
        invite(creator, promiseId, await inviteTokenHash(createInviteToken(), PEPPER)),
      ),
    ).toBe('E_VALIDATION');
  });

  test('DRAFT 의 종료일이 오늘이면 보낼 수 있다 — 승인 기준(EC-B10)과 같다', async () => {
    const creator = await createUser(db, 'T02오늘초안');
    const promiseId = await createPromise(db, {
      creatorId: creator,
      status: 'DRAFT',
      endDateOffsetDays: 0,
    });
    await expect(
      invite(creator, promiseId, await inviteTokenHash(createInviteToken(), PEPPER)),
    ).resolves.toBeTruthy();
  });

  test('PENDING 은 종료일이 지나도 재발송할 수 있다 — 이걸 막으면 약속이 갇힌다', async () => {
    // EC-B10 이 지정한 유일한 출구는 상대방의 [종료일 변경 요청하기](= 수정 제안, T-05)이고,
    // 그건 **유효한 링크가 있어야** 쓸 수 있다. PENDING 이면 작성자는 내용을 고칠 수 없으므로
    // 여기서 막으면 만료된 초대 + 지난 종료일 조합이 영구히 PENDING 에 갇힌다.
    const creator = await createUser(db, 'T02만료대기');
    const promiseId = await createPromise(db, {
      creatorId: creator,
      status: 'PENDING',
      endDateOffsetDays: -3,
    });
    const token = createInviteToken();
    await expect(
      invite(creator, promiseId, await inviteTokenHash(token, PEPPER)),
    ).resolves.toBeTruthy();

    // 상대가 실제로 그 링크로 도착할 수 있어야 출구가 성립한다.
    const { rows } = await db.asAdmin(`select public.lf_invite_resolve($1::char(64)) as payload`, [
      await inviteTokenHash(token, PEPPER),
    ]);
    expect((rows[0] as { payload: Record<string, unknown> }).payload['target_role']).toBe('PARTNER');
  });
});

// ══════════════════════════════════════════════════════════════
// 합성 경로
// ══════════════════════════════════════════════════════════════

describe('생성 + 발송 합성 (§4-2-1 [상대에게 보내기])', () => {
  test('한 번의 호출로 PENDING 까지 간다', async () => {
    const creator = await createUser(db, '합성기본');
    const payload = await create(creator, {
      tokenHash: await inviteTokenHash(createInviteToken(), PEPPER),
    });
    expect(payload['status']).toBe('PENDING');
    expect(payload['invitation_id']).toBeTruthy();
    expect(await statusOf(String(payload['promise_id']))).toBe('PENDING');
  });

  test('발송 단계가 실패하면 약속도 남지 않는다 — 고아 DRAFT 금지', async () => {
    // 두 RPC 를 클라이언트가 이어 부르는 설계를 버린 이유가 이 성질이다.
    const creator = await createUser(db, '합성롤백');
    const other = await createUser(db, '합성롤백타인');
    const hash = await inviteTokenHash(createInviteToken(), PEPPER);
    await create(other, { tokenHash: hash });

    // token_hash 는 unique 라 같은 값을 다시 쓰면 초대 삽입이 터진다.
    expect(await codeOf(() => create(creator, { tokenHash: hash }))).not.toBeNull();

    const { rows } = await db.asAdmin(
      `select count(*)::int as n from public.promises where creator_id = $1`,
      [creator],
    );
    expect(Number((rows[0] as { n: number }).n)).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// 행위자
// ══════════════════════════════════════════════════════════════

describe('행위자 검증', () => {
  test('없는 사용자는 E_AUTH_REQUIRED 다', async () => {
    expect(await codeOf(() => create(randomUUID()))).toBe('E_AUTH_REQUIRED');
  });

  test.each([['SUSPENDED'], ['WITHDRAWN']])(
    '%s 계정은 E_FORBIDDEN 이다 (§4-2 선행 조건 users.status = ACTIVE)',
    async (status) => {
      const creator = await createUser(db, `행위자${status}`);
      await db.asAdmin(`update public.users set status = $2::public.user_status where id = $1`, [
        creator,
        status,
      ]);
      expect(await codeOf(() => create(creator))).toBe('E_FORBIDDEN');
    },
  );

  test('정지된 계정은 이미 만든 DRAFT 도 보낼 수 없다', async () => {
    const creator = await createUser(db, '행위자정지발송');
    const { promise_id: promiseId } = await create(creator);
    await db.asAdmin(`update public.users set status = 'SUSPENDED' where id = $1`, [creator]);
    expect(
      await codeOf(async () =>
        invite(creator, String(promiseId), await inviteTokenHash(createInviteToken(), PEPPER)),
      ),
    ).toBe('E_FORBIDDEN');
  });
});

// ══════════════════════════════════════════════════════════════
// 권한
// ══════════════════════════════════════════════════════════════

describe('권한 — 서버 전용', () => {
  test.each([
    ['lf_promise_create(uuid, uuid, text, text, text, text, text, text, text, boolean, char)'],
    ['lf_promise_invite(uuid, uuid, uuid, char)'],
    ['lf_promise_create_draft(uuid, text, text, text, text, text, text, text, boolean)'],
    ['lf_invite_issue_row(uuid, uuid, char)'],
    ['lf_assert_actor(uuid)'],
    ['lf_assert_promise_content(text, text, text, text, text, text)'],
    ['lf_draft_max_concurrent()'],
    ['lf_promise_max_per_day()'],
    ['lf_end_date_max_days()'],
    ['lf_invite_ttl_hours()'],
    ['lf_invite_resend_max()'],
    ['lf_invite_expire_soon_lead_hours()'],
  ])('%s 는 anon·authenticated·public 모두에게 닫혀 있다', async (signature) => {
    // `from public` 만으로는 닫히지 않는다 — Supabase 가 anon·authenticated 에게 직접 부여한다.
    for (const role of ['anon', 'authenticated', 'public']) {
      const { rows } = await db.asAdmin(`select has_function_privilege($1, $2, 'execute') as ok`, [
        role,
        `public.${signature}`,
      ]);
      expect((rows[0] as { ok: boolean }).ok, `${role} → ${signature}`).toBe(false);
    }
  });

  test('service_role 은 진입점 둘을 부를 수 있다', async () => {
    for (const signature of [
      'lf_promise_create(uuid, uuid, text, text, text, text, text, text, text, boolean, char)',
      'lf_promise_invite(uuid, uuid, uuid, char)',
    ]) {
      const { rows } = await db.asAdmin(
        `select has_function_privilege('service_role', $1, 'execute') as ok`,
        [`public.${signature}`],
      );
      expect((rows[0] as { ok: boolean }).ok, signature).toBe(true);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// RLS 회수
// ══════════════════════════════════════════════════════════════

describe('클라이언트 쓰기 경로가 닫혔다', () => {
  test('promises에는 읽기·DRAFT 삭제와 탈퇴 계정 차단 경계만 남는다', async () => {
    const { rows } = await db.asAdmin(
      `select policyname, permissive, cmd from pg_policies
        where schemaname = 'public' and tablename = 'promises' order by policyname`,
    );
    expect(rows).toEqual([
      { policyname: 'active account boundary', permissive: 'RESTRICTIVE', cmd: 'ALL' },
      { policyname: 'promises delete own draft', permissive: 'PERMISSIVE', cmd: 'DELETE' },
      { policyname: 'promises read participants', permissive: 'PERMISSIVE', cmd: 'SELECT' },
    ]);
  });

  test('promise_versions에는 읽기와 탈퇴 계정 차단 경계만 남는다', async () => {
    const { rows } = await db.asAdmin(
      `select policyname, permissive, cmd from pg_policies
        where schemaname = 'public' and tablename = 'promise_versions' order by policyname`,
    );
    expect(rows).toEqual([
      { policyname: 'active account boundary', permissive: 'RESTRICTIVE', cmd: 'ALL' },
      { policyname: 'promise versions read participants', permissive: 'PERMISSIVE', cmd: 'SELECT' },
    ]);
  });

  test('작성자도 약속을 직접 INSERT 할 수 없다 — EC-H05 한도를 우회할 경로가 없어야 한다', async () => {
    const creator = await createUser(db, 'RLS삽입');
    expect(
      await codeOf(() =>
        db.asUser(
          creator,
          `insert into public.promises (creator_id, status, title, body, category, end_date, keeper)
           values ($1, 'DRAFT', '직접', '직접 만든 약속이다', 'ETC',
                   (now() at time zone 'Asia/Seoul')::date + 7, 'BOTH')`,
          [creator],
        ),
      ),
      // 0004 가 grant 까지 회수해 RLS 위반이 아니라 권한 거절이 먼저 온다.
    ).toMatch(/permission denied/i);
  });

  test('작성자도 버전 행을 직접 INSERT 할 수 없다 — content_hash 는 서버 생산이다', async () => {
    const creator = await createUser(db, 'RLS버전');
    const { promise_id: promiseId } = await create(creator);
    expect(
      await codeOf(() =>
        db.asUser(
          creator,
          `insert into public.promise_versions
             (promise_id, version_no, title, body, category, end_date, keeper, content_hash, created_by)
           values ($1, 2, '위조', '위조된 내용이다', 'ETC',
                   (now() at time zone 'Asia/Seoul')::date + 7, 'BOTH', repeat('0', 64), $2)`,
          [promiseId, creator],
        ),
      ),
    ).toMatch(/permission denied/i);
  });

  test('작성자도 DRAFT 내용을 직접 UPDATE 할 수 없다', async () => {
    const creator = await createUser(db, 'RLS수정');
    const { promise_id: promiseId } = await create(creator);
    expect(
      await codeOf(() =>
        db.asUser(
          creator,
          `update public.promises set title = '몰래 바꾼 제목' where id = $1 returning id`,
          [promiseId],
        ),
      ),
    ).toMatch(/permission denied/i);
  });

  test('자기 DRAFT 삭제는 남긴다 (§4-2-2.5)', async () => {
    const creator = await createUser(db, 'RLS삭제');
    const { promise_id: promiseId } = await create(creator);
    const { rows } = await db.asUser(
      creator,
      `delete from public.promises where id = $1 returning id`,
      [promiseId],
    );
    expect(rows).toHaveLength(1);
  });
});
