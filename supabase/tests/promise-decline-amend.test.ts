import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { ERROR_CODES } from '../../packages/shared/src/errors.ts';
import { codepointLength, normalizeInput } from '../../packages/shared/src/text.ts';
import {
  validateAmendSuggestion,
  validateDeclineReason,
} from '../../packages/shared/src/validation.ts';
import {
  createInvitation,
  createPromise,
  createTestDb,
  createUser,
  type TestDb,
} from './harness.ts';

/**
 * `lf_promise_decline` (T-04) · `lf_promise_amend_suggest` (T-05) — 02 §4-3-4.
 *
 * 승인과 같은 토큰을 쓰는 나머지 두 갈래다. 그래서 이 파일의 절반은 **승인과 같은지**를 묻고,
 * 나머지 절반은 **승인과 다른 한 곳**(종료일)을 묻는다. EC-B10 은 종료일이 지난 약속의
 * 유일한 출구로 수정 제안을 지정하므로, 여기에 종료일 가드가 생기면 약속이 PENDING 에
 * 영구히 갇힌다 — 그 회귀를 잡는 것이 이 파일의 존재 이유 중 하나다.
 *
 * PGlite 한계는 promise-approve.test.ts 와 같다. 단일 커넥션이라 진짜 동시 트랜잭션을
 * 만들 수 없고, 경합은 순차 재현 + 소스 단언으로 대신한다.
 */

let db: TestDb;

// 제어문자·불가시 공백은 소스에 리터럴로 박지 않는다. 편집기가 건드리면 조용히 다른 테스트가 된다.
const TAB = String.fromCodePoint(0x09);
const CR = String.fromCodePoint(0x0d);
const LF = String.fromCodePoint(0x0a);
const DEL = String.fromCodePoint(0x7f);
const NBSP = String.fromCodePoint(0x00a0);
const BOM = String.fromCodePoint(0xfeff);
const IDEOGRAPHIC_SPACE = String.fromCodePoint(0x3000);

/** 한글 조합형 자모 ᄀ + ᅡ. NFC 를 거치면 '가' 한 글자가 된다. */
const JAMO_GA = String.fromCodePoint(0x1100, 0x1161);
/** 코드포인트 1개짜리 이모지. UTF-16 으로는 2단위라 String.length 는 2로 센다. */
const EMOJI = String.fromCodePoint(0x1f642);

type Rpc = 'decline' | 'amend';

const RPC_SQL: Record<Rpc, string> = {
  decline: 'public.lf_promise_decline($1, $2, $3, $4, $5::public.surface, $6, $7)',
  amend: 'public.lf_promise_amend_suggest($1, $2, $3, $4, $5::public.surface, $6, $7)',
};

/** 가드를 시험할 때 쓰는 기본 입력. 둘 다 §5-3 을 통과하는 값이어야 가드가 원인이 된다. */
const DEFAULT_TEXT: Record<Rpc, string> = {
  decline: '지금은 어려울 것 같아요',
  amend: '기간을 조금만 늘려주세요',
};

interface Fixture {
  creatorId: string;
  partnerId: string;
  promiseId: string;
  tokenHash: string;
}

async function seed(
  options: {
    targetRole?: 'PARTNER' | 'WITNESS';
    status?: 'PENDING' | 'USED' | 'EXPIRED' | 'REVOKED';
    expiresInSeconds?: number;
    promiseStatus?: string;
    endDateOffsetDays?: number;
  } = {},
): Promise<Fixture> {
  const creatorId = await createUser(db, `c${randomUUID().slice(0, 8)}`);
  const partnerId = await createUser(db, `p${randomUUID().slice(0, 8)}`);
  const promiseId = await createPromise(db, {
    creatorId,
    status: options.promiseStatus ?? 'PENDING',
    ...(options.endDateOffsetDays !== undefined
      ? { endDateOffsetDays: options.endDateOffsetDays }
      : {}),
  });
  const tokenHash = await createInvitation(db, {
    promiseId,
    createdBy: creatorId,
    ...(options.targetRole !== undefined ? { targetRole: options.targetRole } : {}),
    ...(options.status !== undefined ? { status: options.status } : {}),
    ...(options.expiresInSeconds !== undefined
      ? { expiresInSeconds: options.expiresInSeconds }
      : {}),
  });
  return { creatorId, partnerId, promiseId, tokenHash };
}

/** T-02 가 초대 발송 시 예약해 두는 스케줄. 응답이 이걸 꺼야 한다. */
async function seedInviteExpireSoon(f: Fixture): Promise<void> {
  await db.asAdmin(
    `insert into public.reminder_schedules (promise_id, user_id, kind, fire_at)
     values ($1, $2, 'INVITE_EXPIRE_SOON', now() + interval '60 hours')`,
    [f.promiseId, f.creatorId],
  );
}

async function respond(
  kind: Rpc,
  f: Fixture,
  options: { userId?: string; key?: string; text?: string | null } = {},
): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(`select ${RPC_SQL[kind]} as r`, [
    options.key ?? randomUUID(),
    f.tokenHash,
    options.userId ?? f.partnerId,
    options.text === undefined ? DEFAULT_TEXT[kind] : options.text,
    'WEB',
    'a'.repeat(64),
    'b'.repeat(64),
  ]);
  return (rows[0] as { r: Record<string, unknown> }).r;
}

async function approve(f: Fixture): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(
    `select public.lf_promise_approve($1, $2, $3, 'WEB'::public.surface, $4, $5) as r`,
    [randomUUID(), f.tokenHash, f.partnerId, 'a'.repeat(64), 'b'.repeat(64)],
  );
  return (rows[0] as { r: Record<string, unknown> }).r;
}

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.asAdmin(sql, params);
  return rows[0] as T;
}

/** 실패 코드만 뽑아낸다. 성공하면 null 이다. */
async function codeOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return (error as Error).message.trim();
  }
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('lf_normalize_input — packages/shared 의 normalizeInput 과 같은 규칙 (§2-3)', () => {
  // 두 구현이 갈라지면 글자 수 판정이 갈라지고, 화면에서 통과한 의견이 서버에서 반려된다.
  // NUL 은 뺀다 — Postgres text 에 담을 수 없어 애초에 이 경로로 들어올 수 없다.
  const CASES: [label: string, input: string][] = [
    ['앞뒤 공백', '  기간을 늘려주세요  '],
    ['개행 4줄', `앞${LF}${LF}${LF}${LF}뒤`],
    ['개행 2줄은 유지', `앞${LF}${LF}뒤`],
    ['탭', `앞${TAB}뒤`],
    ['CRLF', `앞${CR}${LF}뒤`],
    ['DEL', `약${DEL}속`],
    ['자모 사이 제어문자', `${String.fromCodePoint(0x1100)}${DEL}${String.fromCodePoint(0x1161)}`],
    ['조합형 자모', JAMO_GA.repeat(3)],
    ['이모지', `${EMOJI}${EMOJI}`],
    ['NBSP 로만 둘러싼 값', `${NBSP}약속${NBSP}`],
    ['BOM', `${BOM}약속${BOM}`],
    ['전각 공백', `${IDEOGRAPHIC_SPACE}약속${IDEOGRAPHIC_SPACE}`],
    ['앞뒤 개행', `${LF}약속${LF}`],
    ['공백뿐', `  ${NBSP}${LF}  `],
    ['빈 문자열', ''],
  ];

  test.each(CASES)('%s', async (_label, input) => {
    const row = await one<{ out: string; len: number }>(
      `select public.lf_normalize_input($1) as out,
              char_length(public.lf_normalize_input($1)) as len`,
      [input],
    );
    const expected = normalizeInput(input);
    expect(row.out).toBe(expected);
    // 코드포인트 기준 길이도 같아야 한다. char_length 가 UTF-16 단위로 세면 여기서 갈린다.
    expect(row.len).toBe(codepointLength(expected));
  });

  test('null 은 빈 문자열이 된다', async () => {
    const row = await one<{ out: string }>(`select public.lf_normalize_input(null) as out`);
    expect(row.out).toBe('');
  });
});

describe('거절 — T-04 (PENDING → DECLINED)', () => {
  test('약속이 DECLINED 로 종결되고 종결 시각이 남는다', async () => {
    const f = await seed();
    const payload = await respond('decline', f);

    const row = await one<{
      status: string;
      closed_at: Date | null;
      activated_at: Date | null;
      current_version_id: string | null;
    }>(
      `select status, closed_at, activated_at, current_version_id
         from public.promises where id = $1`,
      [f.promiseId],
    );

    expect(row.status).toBe('DECLINED');
    expect(row.closed_at).not.toBeNull();
    // 확정된 적이 없으므로 확정 흔적은 비어 있어야 한다.
    expect(row.activated_at).toBeNull();
    expect(row.current_version_id).toBeNull();
    expect(payload).toMatchObject({ promise_id: f.promiseId, status: 'DECLINED' });
  });

  test('승인 로그는 한 행이다 — 작성자 행을 만들지 않는다', async () => {
    // §4-3-6 의 "발송 = 작성자 승인"은 확정 경로의 규칙이다. 거절된 약속에 작성자의
    // APPROVE 를 남기면 성립하지 않은 합의를 기록하는 셈이 된다.
    const f = await seed();
    await respond('decline', f, { text: '지금은 어려울 것 같아요' });

    const { rows } = await db.asAdmin(
      `select user_id, role, action, comment, surface, ip_hash, user_agent_hash, content_hash,
              version_id
         from public.approvals where promise_id = $1`,
      [f.promiseId],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: f.partnerId,
      role: 'PARTNER',
      action: 'DECLINE',
      comment: '지금은 어려울 것 같아요',
      surface: 'WEB',
      ip_hash: 'a'.repeat(64),
      user_agent_hash: 'b'.repeat(64),
    });

    // 무엇을 거절했는지 고정한다. 재발송 후 DRAFT 가 덮어써지면 이 값만 남는다.
    const ver = await one<{ id: string; hash: string }>(
      `select v.id,
              public.lf_content_hash(v.title, v.body, v.category, v.end_date, v.keeper,
                                     v.reward, v.penalty, v.version_no) as hash
         from public.promise_versions v where v.promise_id = $1`,
      [f.promiseId],
    );
    expect(rows[0]).toMatchObject({ content_hash: ver.hash, version_id: ver.id });
  });

  test('상대는 PARTNER · DECLINED 로 기록되고 참여 시각은 비어 있다', async () => {
    const f = await seed();
    await respond('decline', f);

    const { rows } = await db.asAdmin(
      `select user_id, role, status, joined_at from public.promise_participants
        where promise_id = $1 and role = 'PARTNER'`,
      [f.promiseId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: f.partnerId,
      role: 'PARTNER',
      status: 'DECLINED',
      joined_at: null,
    });
  });

  test('초대가 소모된다', async () => {
    const f = await seed();
    await respond('decline', f);

    const row = await one<{ status: string; used_by: string; used_at: Date | null }>(
      `select status, used_by, used_at from public.invitations where token_hash = $1`,
      [f.tokenHash],
    );
    expect(row).toMatchObject({ status: 'USED', used_by: f.partnerId });
    expect(row.used_at).not.toBeNull();
  });

  test('미발송 스케줄이 전부 취소된다 — §8-2 종결 규칙', async () => {
    const f = await seed();
    await seedInviteExpireSoon(f);
    // 종류를 가리지 않는다. INVITE_EXPIRE_SOON 만 끄면 나머지가 조용히 새어 나간다.
    await db.asAdmin(
      `insert into public.reminder_schedules (promise_id, user_id, kind, fire_at)
       values ($1, $2, 'D7', now() + interval '3 days')`,
      [f.promiseId, f.creatorId],
    );
    await respond('decline', f);

    const row = await one<{ pending: number; canceled: number }>(
      `select count(*) filter (where status = 'PENDING')::int as pending,
              count(*) filter (where status = 'CANCELED')::int as canceled
         from public.reminder_schedules where promise_id = $1`,
      [f.promiseId],
    );
    expect(row).toEqual({ pending: 0, canceled: 2 });
  });

  test('리마인드를 새로 만들지 않는다', async () => {
    // D-7/D-3/D-1/D-Day 는 ACTIVE 전환의 부수 효과다(§8-2). 거절된 약속에 만들면
    // 종결된 약속으로 알림이 나간다.
    const f = await seed({ endDateOffsetDays: 30 });
    await respond('decline', f);

    const row = await one<{ n: number }>(
      `select count(*)::int as n from public.reminder_schedules where promise_id = $1`,
      [f.promiseId],
    );
    expect(row.n).toBe(0);
  });

  test('일 지표를 건드리지 않는다', async () => {
    // activated_count 는 §4-3-5 10단계, 확정 전용이다.
    const before = await one<{ n: number }>(
      `select coalesce(sum(activated_count), 0)::int as n from public.daily_metrics`,
    );
    await respond('decline', await seed());
    const after = await one<{ n: number }>(
      `select coalesce(sum(activated_count), 0)::int as n from public.daily_metrics`,
    );
    expect(after.n).toBe(before.n);
  });

  test.each([
    ['null', null],
    ['빈 문자열', ''],
    ['공백뿐', `  ${LF} `],
  ] as const)('사유가 %s 이면 저장하지 않는다 — §5-3 선택 항목', async (_label, text) => {
    const f = await seed();
    const payload = await respond('decline', f, { text });

    const row = await one<{ comment: string | null }>(
      `select comment from public.approvals where promise_id = $1`,
      [f.promiseId],
    );
    expect(row.comment).toBeNull();
    expect(payload['reason']).toBeNull();
  });

  test('사유는 정규화해서 저장한다', async () => {
    const f = await seed();
    const raw = `  ${JAMO_GA}속이 안 돼요${TAB}  `;
    await respond('decline', f, { text: raw });

    const row = await one<{ comment: string }>(
      `select comment from public.approvals where promise_id = $1`,
      [f.promiseId],
    );
    expect(row.comment).toBe(normalizeInput(raw));
  });

  test('payload 가 NT-02 를 만들 수 있다', async () => {
    const f = await seed();
    const payload = await respond('decline', f, { text: '이번엔 어렵겠어요' });

    const partner = payload['partner'] as Record<string, unknown>;
    expect(payload['creator_id']).toBe(f.creatorId);
    expect(payload['reason']).toBe('이번엔 어렵겠어요');
    expect(payload['closed_at']).not.toBeNull();
    expect(partner['user_id']).toBe(f.partnerId);
    // "{상대}님이 약속을 거절했어요" — 껍데기가 두 번째 조회 없이 제목을 만들 수 있어야 한다.
    expect(typeof partner['nickname']).toBe('string');
    expect(Object.keys(partner).sort()).toEqual(['nickname', 'profile_image_url', 'user_id']);
  });
});

describe('알림 본문용 title — 두 응답 공통', () => {
  // 알림 행의 body 가 이 값이다. promises 의 내용 컬럼은 캐시이고 원본은 promise_versions 라
  // (§6-2) 둘을 갈라 놓고 어느 쪽을 읽는지 본다. 같은 값이면 캐시를 읽어도 통과해 버린다.
  test.each(['decline', 'amend'] as const)(
    '%s 의 title 은 promises 캐시가 아니라 버전 행에서 온다',
    async (rpc) => {
      const f = await seed();
      await db.asAdmin(`update public.promises set title = '캐시 쪽 제목' where id = $1`, [
        f.promiseId,
      ]);

      expect((await respond(rpc, f))['title']).toBe('매일 걷기');
    },
  );
});

describe('수정 제안 — T-05 (PENDING → DRAFT)', () => {
  test('약속이 DRAFT 로 돌아가고 종결되지 않는다', async () => {
    const f = await seed();
    const payload = await respond('amend', f);

    const row = await one<{ status: string; closed_at: Date | null }>(
      `select status, closed_at from public.promises where id = $1`,
      [f.promiseId],
    );
    expect(row.status).toBe('DRAFT');
    // DRAFT 는 종결이 아니다. closed_at 이 채워지면 목록·집계가 종결로 오인한다.
    expect(row.closed_at).toBeNull();
    expect(payload).toMatchObject({ promise_id: f.promiseId, status: 'DRAFT' });
  });

  test('상대 user_id 가 participants 에 남는다 — 재발송 시 직접 알림용', async () => {
    const f = await seed();
    await respond('amend', f);

    const { rows } = await db.asAdmin(
      `select user_id, status, joined_at from public.promise_participants
        where promise_id = $1 and role = 'PARTNER'`,
      [f.promiseId],
    );
    expect(rows).toHaveLength(1);
    // 아직 참여한 것이 아니다. JOINED 로 남기면 DRAFT 약속에 상대가 이미 있는 것처럼 보인다.
    expect(rows[0]).toMatchObject({ user_id: f.partnerId, status: 'INVITED', joined_at: null });
  });

  test('의견이 AMEND_SUGGEST 로 한 행 남는다', async () => {
    const f = await seed();
    await respond('amend', f, { text: '종료일을 다음 달로 미뤄주세요' });

    const { rows } = await db.asAdmin(
      `select role, action, comment, content_hash, version_id
         from public.approvals where promise_id = $1`,
      [f.promiseId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      role: 'PARTNER',
      action: 'AMEND_SUGGEST',
      comment: '종료일을 다음 달로 미뤄주세요',
    });

    // 여기가 해시가 가장 중요한 자리다. 작성자가 재작성하면 v1 이 덮어써지므로,
    // 이 행이 "어떤 내용에 대한 의견이었는지"에 대한 유일한 기록이 된다.
    const ver = await one<{ id: string; hash: string }>(
      `select v.id,
              public.lf_content_hash(v.title, v.body, v.category, v.end_date, v.keeper,
                                     v.reward, v.penalty, v.version_no) as hash
         from public.promise_versions v where v.promise_id = $1`,
      [f.promiseId],
    );
    expect(rows[0]).toMatchObject({ content_hash: ver.hash, version_id: ver.id });
  });

  test('초대가 소모되고 만료 임박 알림이 꺼진다', async () => {
    const f = await seed();
    await seedInviteExpireSoon(f);
    await respond('amend', f);

    const row = await one<{ invite: string; pending: number }>(
      `select (select status from public.invitations where token_hash = $2) as invite,
              (select count(*) from public.reminder_schedules
                 where promise_id = $1 and status = 'PENDING')::int as pending`,
      [f.promiseId, f.tokenHash],
    );
    // 초대는 이미 소모됐으므로 "초대가 곧 만료돼요"(NT-04)는 거짓말이 된다.
    expect(row).toEqual({ invite: 'USED', pending: 0 });
  });

  test('버전 내용은 그대로 둔다', async () => {
    // 무엇을 고칠지는 작성자가 SCR-A03 에서 정한다. 이 함수는 상태만 되돌린다.
    const f = await seed();
    const before = await one<{ title: string; hash: string }>(
      `select title, content_hash as hash from public.promise_versions where promise_id = $1`,
      [f.promiseId],
    );
    await respond('amend', f);
    const after = await one<{ title: string; hash: string; activated: Date | null }>(
      `select title, content_hash as hash, activated_at as activated
         from public.promise_versions where promise_id = $1`,
      [f.promiseId],
    );
    expect(after.title).toBe(before.title);
    expect(after.hash).toBe(before.hash);
    expect(after.activated).toBeNull();
  });

  test('payload 가 NT-03 을 만들 수 있다', async () => {
    const f = await seed();
    const payload = await respond('amend', f, { text: '보상을 바꾸고 싶어요' });

    const partner = payload['partner'] as Record<string, unknown>;
    expect(payload['creator_id']).toBe(f.creatorId);
    expect(payload['comment']).toBe('보상을 바꾸고 싶어요');
    expect(partner['user_id']).toBe(f.partnerId);
    expect(typeof partner['nickname']).toBe('string');
  });
});

describe('종료일 — 승인과 갈리는 유일한 지점 (EC-B10)', () => {
  test('종료일이 지나도 수정 제안은 된다 — EC-B10 의 유일한 출구', async () => {
    // 여기에 종료일 가드가 생기면 약속이 PENDING 에 영구히 갇힌다.
    const f = await seed({ endDateOffsetDays: -1 });
    expect(await respond('amend', f)).toMatchObject({ status: 'DRAFT' });
  });

  test('종료일이 지나도 거절은 된다', async () => {
    const f = await seed({ endDateOffsetDays: -1 });
    expect(await respond('decline', f)).toMatchObject({ status: 'DECLINED' });
  });

  test('같은 상황에서 승인만 막힌다', async () => {
    const f = await seed({ endDateOffsetDays: -1 });
    expect(await codeOf(() => approve(f))).toBe('E_VALIDATION');
    // 승인이 롤백된 뒤에도 출구는 그대로 열려 있어야 한다.
    expect(await respond('amend', f)).toMatchObject({ status: 'DRAFT' });
  });
});

describe('§5-3 길이 — 정규화 뒤 코드포인트로 센다', () => {
  test.each([
    ['4자', '가'.repeat(4), false],
    ['5자', '가'.repeat(5), true],
    ['300자', '가'.repeat(300), true],
    ['301자', '가'.repeat(301), false],
  ] as const)('수정 제안 %s → %s', async (_label, text, ok) => {
    const f = await seed();
    const code = await codeOf(() => respond('amend', f, { text }));
    expect(code).toBe(ok ? null : 'E_VALIDATION');
    // TS 검증기와 판정이 같아야 한다. 화면이 통과시킨 값을 서버가 반려하면 사용자는 갇힌다.
    expect(validateAmendSuggestion(text).valid).toBe(ok);
  });

  test.each([
    ['200자', '가'.repeat(200), true],
    ['201자', '가'.repeat(201), false],
  ] as const)('거절 사유 %s → %s', async (_label, text, ok) => {
    const f = await seed();
    const code = await codeOf(() => respond('decline', f, { text }));
    expect(code).toBe(ok ? null : 'E_VALIDATION');
    expect(validateDeclineReason(text).valid).toBe(ok);
  });

  test.each([
    ['null', null],
    ['빈 문자열', ''],
    ['공백뿐', `  ${NBSP}${LF} `],
  ] as const)('수정 제안이 %s 이면 E_VALIDATION — 필수 항목', async (_label, text) => {
    const f = await seed();
    expect(await codeOf(() => respond('amend', f, { text }))).toBe('E_VALIDATION');
  });

  test('조합형 자모 3글자는 짧아서 반려된다', async () => {
    // 정규화 전에는 6 코드포인트라 5자 하한을 통과해 버린다. 순서가 바뀌면 여기서 걸린다.
    const text = JAMO_GA.repeat(3);
    expect(codepointLength(text)).toBe(6);
    const f = await seed();
    expect(await codeOf(() => respond('amend', f, { text }))).toBe('E_VALIDATION');
    expect(validateAmendSuggestion(text).valid).toBe(false);
  });

  test('조합형 자모 160글자는 통과한다', async () => {
    // 정규화 전에는 320 코드포인트라 300자 상한에 걸린다. 반대 방향의 같은 증명이다.
    const text = JAMO_GA.repeat(160);
    expect(codepointLength(text)).toBe(320);
    const f = await seed();
    expect(await respond('amend', f, { text })).toMatchObject({ status: 'DRAFT' });
  });

  test('이모지 300개는 통과한다 — 코드포인트로 센다', async () => {
    // UTF-16 단위로 세면 600 이라 반려된다(§2-3 "코드포인트 기준", 이모지 1자).
    const text = EMOJI.repeat(300);
    expect(text.length).toBe(600);
    expect(codepointLength(text)).toBe(300);
    const f = await seed();
    expect(await respond('amend', f, { text })).toMatchObject({ status: 'DRAFT' });
  });

  test('거절도 길이보다 토큰 가드가 먼저다', async () => {
    const f = await seed({ status: 'REVOKED' });
    expect(await codeOf(() => respond('decline', f, { text: '가'.repeat(400) }))).toBe(
      'E_INVITE_REVOKED',
    );
  });

  test('길이 판정은 토큰 가드보다 뒤다', async () => {
    // 만료된 링크에 너무 짧은 의견을 보낸 사람에게 알려야 할 것은 길이가 아니라 만료다.
    const f = await seed({ status: 'EXPIRED' });
    expect(await codeOf(() => respond('amend', f, { text: '짧음' }))).toBe('E_INVITE_EXPIRED');
  });
});

describe('가드 — 승인과 같은 판정 (§4-3-5 1·2단계)', () => {
  const KINDS: Rpc[] = ['decline', 'amend'];

  test.each(KINDS)('%s — 없는 토큰은 E_NOT_FOUND', async (kind) => {
    const f = await seed();
    expect(await codeOf(() => respond(kind, { ...f, tokenHash: 'f'.repeat(64) }))).toBe(
      'E_NOT_FOUND',
    );
  });

  test.each(
    KINDS.flatMap((kind) =>
      (
        [
          ['REVOKED', 'E_INVITE_REVOKED'],
          ['USED', 'E_INVITE_USED'],
          ['EXPIRED', 'E_INVITE_EXPIRED'],
        ] as const
      ).map(([status, code]) => [kind, status, code] as const),
    ),
  )('%s — %s 토큰은 %s', async (kind, status, code) => {
    const f = await seed({ status });
    expect(await codeOf(() => respond(kind, f))).toBe(code);
  });

  test.each(KINDS)('%s — 만료 시각이 지난 PENDING 토큰은 E_INVITE_EXPIRED', async (kind) => {
    // J-04 가 30분마다 도는 사이의 구간(§7-2). 랜딩 화면과 답이 같아야 한다.
    const f = await seed({ expiresInSeconds: -60 });
    expect(await codeOf(() => respond(kind, f))).toBe('E_INVITE_EXPIRED');
  });

  test.each(KINDS)('%s — 증인 토큰은 E_FORBIDDEN', async (kind) => {
    // §4-5-1: 증인은 상태 전이에 어떠한 영향도 주지 않는다. 증인이 거절로 약속을
    // 끝낼 수 있다면 그 문장이 무너진다.
    const f = await seed({ targetRole: 'WITNESS' });
    expect(await codeOf(() => respond(kind, f))).toBe('E_FORBIDDEN');
  });

  test.each(KINDS)('%s — 거절된 증인 토큰은 그대로 살아 있다', async (kind) => {
    const f = await seed({ targetRole: 'WITNESS' });
    await codeOf(() => respond(kind, f));
    const row = await one<{ status: string }>(
      `select status from public.invitations where token_hash = $1`,
      [f.tokenHash],
    );
    expect(row.status).toBe('PENDING');
  });

  test.each(KINDS)('%s — 작성자 본인이면 E_SELF_INVITE', async (kind) => {
    const f = await seed();
    expect(await codeOf(() => respond(kind, f, { userId: f.creatorId }))).toBe('E_SELF_INVITE');
  });

  test.each(KINDS)('%s — 이미 다른 역할이면 E_DUPLICATE_ROLE', async (kind) => {
    const f = await seed();
    await db.asAdmin(
      `insert into public.promise_participants (promise_id, user_id, role, status, joined_at)
       values ($1, $2, 'WITNESS', 'JOINED', now())`,
      [f.promiseId, f.partnerId],
    );
    expect(await codeOf(() => respond(kind, f))).toBe('E_DUPLICATE_ROLE');
  });

  test.each(
    KINDS.flatMap((kind) =>
      ([true, false] as const).map((creatorBlocks) => [kind, creatorBlocks] as const),
    ),
  )('%s — 차단 관계면 E_BLOCKED (작성자가 차단: %s)', async (kind, creatorBlocks) => {
    const f = await seed();
    await db.asAdmin(
      `insert into public.blocks (blocker_id, blocked_user_id) values ($1, $2)`,
      creatorBlocks ? [f.creatorId, f.partnerId] : [f.partnerId, f.creatorId],
    );
    expect(await codeOf(() => respond(kind, f))).toBe('E_BLOCKED');
  });

  test.each(KINDS)('%s — 없는 사용자면 E_AUTH_REQUIRED', async (kind) => {
    const f = await seed();
    expect(await codeOf(() => respond(kind, f, { userId: randomUUID() }))).toBe('E_AUTH_REQUIRED');
  });

  test.each(KINDS)('%s — 약속이 PENDING 이 아니면 E_STATE_CONFLICT', async (kind) => {
    const f = await seed({ promiseStatus: 'DRAFT' });
    expect(await codeOf(() => respond(kind, f))).toBe('E_STATE_CONFLICT');
  });

  test.each(KINDS)('%s — 자기 자신의 PARTNER 행은 막지 않는다', async (kind) => {
    // 수정 제안 → 재발송 → 응답의 두 번째 바퀴다. 막으면 상대는 영원히 응답할 수 없다.
    const f = await seed();
    await respond('amend', f);
    await db.asAdmin(`update public.promises set status = 'PENDING' where id = $1`, [f.promiseId]);
    const again = {
      ...f,
      tokenHash: await createInvitation(db, {
        promiseId: f.promiseId,
        createdBy: f.creatorId,
      }),
    };
    expect(await codeOf(() => respond(kind, again))).toBeNull();

    // 두 번째 응답은 남아 있던 행을 **갱신**한다. INSERT 로 가면 부분 유니크 인덱스에 걸리고,
    // 갱신하면서 상태를 안 바꾸면 이전 바퀴의 상태가 그대로 남는다.
    const { rows } = await db.asAdmin(
      `select user_id, status from public.promise_participants
        where promise_id = $1 and role = 'PARTNER'`,
      [f.promiseId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: f.partnerId,
      status: kind === 'decline' ? 'DECLINED' : 'INVITED',
    });
  });

  test.each(KINDS)('%s — 던지는 코드가 전부 ERROR_CODES 의 원소다', async (kind) => {
    const codes = [
      await codeOf(async () => respond(kind, { ...(await seed()), tokenHash: 'f'.repeat(64) })),
      await codeOf(async () => respond(kind, await seed({ status: 'REVOKED' }))),
      await codeOf(async () => respond(kind, await seed({ targetRole: 'WITNESS' }))),
      await codeOf(async () => respond(kind, await seed({ promiseStatus: 'DRAFT' }))),
      await codeOf(async () => respond(kind, await seed(), { text: 'x'.repeat(400) })),
    ];
    expect(codes.filter((c) => c !== null)).toHaveLength(codes.length);
    for (const code of codes) {
      expect(ERROR_CODES as readonly string[]).toContain(code);
    }
  });
});

describe('세 갈래가 같은 순서로 판정한다', () => {
  // 승인·거절·수정 제안이 같은 토큰에 다른 답을 내면, 사용자는 열리는 링크에 응답할 수 없다.
  // lf_promise_approve 는 아직 공유 헬퍼를 쓰지 않으므로, 그 사실을 여기서 직접 붙든다.
  const STATES: [label: string, prepare: (f: Fixture) => Promise<Fixture>, code: string][] = [
    ['없는 토큰', async (f) => ({ ...f, tokenHash: 'f'.repeat(64) }), 'E_NOT_FOUND'],
    [
      '무효화된 토큰',
      async (f) => {
        await db.asAdmin(`update public.invitations set status = 'REVOKED' where token_hash = $1`, [
          f.tokenHash,
        ]);
        return f;
      },
      'E_INVITE_REVOKED',
    ],
    [
      '사용된 토큰',
      async (f) => {
        await db.asAdmin(`update public.invitations set status = 'USED' where token_hash = $1`, [
          f.tokenHash,
        ]);
        return f;
      },
      'E_INVITE_USED',
    ],
    [
      '만료된 토큰',
      async (f) => {
        await db.asAdmin(`update public.invitations set status = 'EXPIRED' where token_hash = $1`, [
          f.tokenHash,
        ]);
        return f;
      },
      'E_INVITE_EXPIRED',
    ],
    [
      '시각만 지난 토큰',
      async (f) => {
        await db.asAdmin(
          `update public.invitations set expires_at = now() - interval '1 minute'
            where token_hash = $1`,
          [f.tokenHash],
        );
        return f;
      },
      'E_INVITE_EXPIRED',
    ],
    [
      // EC-B02 는 사용된 토큰과 만료된 토큰을 구분해야 한다. 시계를 먼저 보면
      // 소모된 링크가 전부 "만료"로 뭉개져 참여자 본인을 상세로 보낼 근거가 사라진다.
      '사용됐고 시각도 지난 토큰',
      async (f) => {
        await db.asAdmin(
          `update public.invitations
              set status = 'USED', expires_at = now() - interval '1 minute'
            where token_hash = $1`,
          [f.tokenHash],
        );
        return f;
      },
      'E_INVITE_USED',
    ],
    [
      '증인 토큰',
      async (f) => {
        await db.asAdmin(
          `update public.invitations set target_role = 'WITNESS' where token_hash = $1`,
          [f.tokenHash],
        );
        return f;
      },
      'E_FORBIDDEN',
    ],
    [
      '차단 관계',
      async (f) => {
        await db.asAdmin(`insert into public.blocks (blocker_id, blocked_user_id) values ($1, $2)`, [
          f.partnerId,
          f.creatorId,
        ]);
        return f;
      },
      'E_BLOCKED',
    ],
    [
      'PENDING 이 아닌 약속',
      async (f) => {
        await db.asAdmin(`update public.promises set status = 'DRAFT' where id = $1`, [f.promiseId]);
        return f;
      },
      'E_STATE_CONFLICT',
    ],
  ];

  test.each(STATES)('%s → 셋 다 %s', async (_label, prepare, code) => {
    for (const run of [
      (f: Fixture) => approve(f),
      (f: Fixture) => respond('decline', f),
      (f: Fixture) => respond('amend', f),
    ]) {
      const f = await prepare(await seed());
      expect(await codeOf(() => run(f))).toBe(code);
    }
  });

  test('자기 초대 수락은 셋 다 E_SELF_INVITE', async () => {
    // 작성자는 항상 CREATOR 참여자 행을 갖고 있어서, 순서가 뒤집히면 E_DUPLICATE_ROLE 이 된다.
    for (const run of [
      (f: Fixture) => approve({ ...f, partnerId: f.creatorId }),
      (f: Fixture) => respond('decline', f, { userId: f.creatorId }),
      (f: Fixture) => respond('amend', f, { userId: f.creatorId }),
    ]) {
      expect(await codeOf(async () => run(await seed()))).toBe('E_SELF_INVITE');
    }
  });
});

describe('실패는 전부 롤백된다 — EC-C02', () => {
  const KINDS: Rpc[] = ['decline', 'amend'];

  test.each(
    KINDS.flatMap((kind) =>
      (['blocked', 'witness', 'length'] as const).map((cause) => [kind, cause] as const),
    ),
  )('%s — %s 로 실패하면 아무 흔적도 남지 않는다', async (kind, cause) => {
    const f = await seed(cause === 'witness' ? { targetRole: 'WITNESS' } : {});
    await seedInviteExpireSoon(f);
    if (cause === 'blocked') {
      await db.asAdmin(`insert into public.blocks (blocker_id, blocked_user_id) values ($1, $2)`, [
        f.creatorId,
        f.partnerId,
      ]);
    }

    const key = randomUUID();
    const code = await codeOf(() =>
      respond(kind, f, { key, ...(cause === 'length' ? { text: 'x'.repeat(400) } : {}) }),
    );
    expect(code).not.toBeNull();

    const row = await one<{
      promise_status: string;
      closed_at: Date | null;
      invite_status: string;
      approvals: number;
      partners: number;
      pending_reminders: number;
      idempotency: number;
    }>(
      `select (select status from public.promises where id = $1) as promise_status,
              (select closed_at from public.promises where id = $1) as closed_at,
              (select status from public.invitations where token_hash = $2) as invite_status,
              (select count(*) from public.approvals where promise_id = $1)::int as approvals,
              (select count(*) from public.promise_participants
                 where promise_id = $1 and role = 'PARTNER')::int as partners,
              (select count(*) from public.reminder_schedules
                 where promise_id = $1 and status = 'PENDING')::int as pending_reminders,
              (select count(*) from public.idempotency_keys where key = $3)::int as idempotency`,
      [f.promiseId, f.tokenHash, key],
    );

    expect(row).toMatchObject({
      promise_status: 'PENDING',
      closed_at: null,
      invite_status: 'PENDING',
      approvals: 0,
      partners: 0,
      pending_reminders: 1,
      // 실패가 10분간 캐시되면 재시도 자체가 막힌다.
      idempotency: 0,
    });
  });
});

describe('멱등 — EC-C01 (PGlite 에서는 순차 재현)', () => {
  const KINDS: Rpc[] = ['decline', 'amend'];

  test.each(KINDS)('%s — 같은 키로 다섯 번 불러도 한 번만 실행된다', async (kind) => {
    const f = await seed();
    const key = randomUUID();
    const first = await respond(kind, f, { key });

    for (let i = 0; i < 4; i += 1) {
      expect(await respond(kind, f, { key })).toEqual(first);
    }

    const row = await one<{ approvals: number; participants: number }>(
      `select (select count(*) from public.approvals where promise_id = $1)::int as approvals,
              (select count(*) from public.promise_participants
                 where promise_id = $1 and role = 'PARTNER')::int as participants`,
      [f.promiseId],
    );
    expect(row).toEqual({ approvals: 1, participants: 1 });
  });

  test.each(KINDS)('%s — 다른 키로 같은 토큰을 다시 쓰면 E_INVITE_USED', async (kind) => {
    const f = await seed();
    await respond(kind, f);
    expect(await codeOf(() => respond(kind, f))).toBe('E_INVITE_USED');
  });

  test('같은 사람이 같은 키를 다른 엔드포인트에 쓰면 E_FORBIDDEN', async () => {
    // 사용자가 **같아야** 엔드포인트 검사를 시험할 수 있다. 다른 사용자로 부르면
    // 사용자 불일치만으로 E_FORBIDDEN 이 나서 엔드포인트 검사가 없어도 통과한다.
    // 검사가 빠지면 거절 응답이 수정 제안 요청에 그대로 새어 나간다.
    const f = await seed();
    const key = randomUUID();
    await respond('decline', f, { key });

    const creator = await createUser(db, `c${randomUUID().slice(0, 8)}`);
    const promiseId = await createPromise(db, { creatorId: creator, status: 'PENDING' });
    const other: Fixture = {
      creatorId: creator,
      partnerId: f.partnerId,
      promiseId,
      tokenHash: await createInvitation(db, { promiseId, createdBy: creator }),
    };
    expect(await codeOf(() => respond('amend', other, { key }))).toBe('E_FORBIDDEN');
  });

  test('초대 행을 잠그고 읽는다 — §7-3.3', async () => {
    // 잠금 동작 자체는 단일 커넥션에서 관찰할 수 없으므로 소스를 본다.
    const row = await one<{ locks: boolean }>(
      `select pg_get_functiondef(oid) ~* 'for update of' as locks
         from pg_proc where proname = 'lf_invite_lock_for_response'`,
    );
    expect(row.locks).toBe(true);
  });

  test.each(['lf_promise_decline', 'lf_promise_amend_suggest'] as const)(
    '%s 의 초대 소모가 조건부 UPDATE 다 — EC-B06',
    async (fn) => {
      const row = await one<{ guarded: boolean }>(
        `select pg_get_functiondef(oid) ~* 'used_at is null' as guarded
           from pg_proc where proname = $1`,
        [fn],
      );
      expect(row.guarded).toBe(true);
    },
  );

  test.each(['lf_promise_decline', 'lf_promise_amend_suggest'] as const)(
    '%s 가 공유 가드를 통과한다',
    async (fn) => {
      // 가드를 인라인으로 되돌리면 세 함수의 판정 순서가 다시 갈라질 수 있다.
      const row = await one<{ uses: boolean }>(
        `select pg_get_functiondef(oid) ~* 'lf_invite_lock_for_response' as uses
           from pg_proc where proname = $1`,
        [fn],
      );
      expect(row.uses).toBe(true);
    },
  );
});

describe('서버 전용 — 04 §7-2', () => {
  const SERVER_ONLY = [
    'public.lf_normalize_input(text)',
    'public.lf_invite_lock_for_response(char(64), uuid)',
    'public.lf_promise_decline(uuid, char(64), uuid, text, public.surface, char(64), char(64))',
    'public.lf_promise_amend_suggest(uuid, char(64), uuid, text, public.surface, char(64), char(64))',
  ] as const;

  test.each(
    SERVER_ONLY.flatMap((fn) =>
      (['anon', 'authenticated'] as const).map((role) => [fn, role] as const),
    ),
  )('%s 에 %s 는 execute 권한이 없다', async (fn, role) => {
    const row = await one<{ allowed: boolean }>(
      `select has_function_privilege($1, $2, 'execute') as allowed`,
      [role, fn],
    );
    expect(row.allowed).toBe(false);
  });

  test.each(SERVER_ONLY)('%s 는 service_role 이 부를 수 있다', async (fn) => {
    const row = await one<{ allowed: boolean }>(
      `select has_function_privilege('service_role', $1, 'execute') as allowed`,
      [fn],
    );
    expect(row.allowed).toBe(true);
  });

  test.each(['decline', 'amend'] as const)(
    '%s — 로그인한 사용자가 직접 부르면 거절된다',
    async (kind) => {
      const f = await seed();
      await expect(
        db.asUser(f.partnerId, `select ${RPC_SQL[kind]}`, [
          randomUUID(),
          f.tokenHash,
          f.partnerId,
          DEFAULT_TEXT[kind],
          'WEB',
          null,
          null,
        ]),
      ).rejects.toThrow(/permission denied/iu);
    },
  );
});
