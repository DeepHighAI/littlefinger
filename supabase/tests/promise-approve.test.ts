import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  REMINDER_OFFSETS_DAYS,
  REMINDER_SEND_HOUR_KST,
} from '../../packages/shared/src/config.ts';
import { ERROR_CODES } from '../../packages/shared/src/errors.ts';
import {
  createInvitation,
  createPromise,
  createTestDb,
  createUser,
  type TestDb,
} from './harness.ts';

/**
 * `lf_promise_approve` — 02 §4-3-5 승인 트랜잭션 10단계.
 *
 * 이 함수가 이 서비스에서 **가장 비싼 실패 지점**이다. 부분 확정이 한 번이라도 일어나면
 * 두 사람의 기록이 어긋난 채로 영구히 남는다 — approvals 와 promise_versions 는
 * append-only 라 사후 정정이 불가능하다. 그래서 EC-C02 는 "하나라도 실패하면 전체 롤백"을
 * 요구하고, 이 파일의 롤백 테스트가 그걸 지킨다.
 *
 * **PGlite 한계를 분명히 해 둔다.** 인프로세스 단일 커넥션이라 동시 트랜잭션을 만들 수 없다.
 * EC-B06(동시 수락)·EC-C01(연속 탭)·EC-C03(무효화 경합)의 **진짜 병렬 검증은 여기서 불가능**하고,
 * 아래 테스트는 순차 재현 + 구조 단언(부분 유니크 인덱스·기본키 존재)으로 대신한다.
 * 실제 병렬 테스트는 db push 이후 pg 클라이언트 2개로 별도 파일에서 해야 한다.
 */

let db: TestDb;

const ENDPOINT_KEYS = [
  'activated_at',
  'approvals',
  'creator_id',
  'fingerprint',
  'partner',
  'promise_id',
  'status',
  'title',
  'version_no',
] as const;

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

async function approve(
  f: Fixture,
  options: { userId?: string; key?: string } = {},
): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(
    `select public.lf_promise_approve($1, $2, $3, 'WEB'::public.surface, $4, $5) as r`,
    [
      options.key ?? randomUUID(),
      f.tokenHash,
      options.userId ?? f.partnerId,
      'a'.repeat(64),
      'b'.repeat(64),
    ],
  );
  return (rows[0] as { r: Record<string, unknown> }).r;
}

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.asAdmin(sql, params);
  return rows[0] as T;
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('성공 경로 — 열 단계가 실제로 일어난다', () => {
  test('약속이 ACTIVE 가 되고 확정 시각·현재 버전이 채워진다', async () => {
    const f = await seed();
    await approve(f);

    const row = await one<{
      status: string;
      activated_at: Date | null;
      current_version_id: string | null;
    }>(
      `select status, activated_at, current_version_id from public.promises where id = $1`,
      [f.promiseId],
    );
    expect(row.status).toBe('ACTIVE');
    expect(row.activated_at).not.toBeNull();
    expect(row.current_version_id).not.toBeNull();
  });

  test('버전 행이 확정되고 content_hash 가 재계산된 값과 같다', async () => {
    const f = await seed();
    await approve(f);

    const row = await one<{ activated_at: Date | null; matches: boolean }>(
      `select v.activated_at,
              v.content_hash = public.lf_content_hash(v.title, v.body, v.category, v.end_date,
                                                     v.keeper, v.reward, v.penalty, v.version_no)
                as matches
         from public.promise_versions v where v.promise_id = $1`,
      [f.promiseId],
    );
    expect(row.activated_at).not.toBeNull();
    expect(row.matches).toBe(true);
  });

  test('상대방이 PARTNER 참여자로 JOINED 된다', async () => {
    const f = await seed();
    await approve(f);

    const row = await one<{ user_id: string; status: string; joined_at: Date | null }>(
      `select user_id, status, joined_at from public.promise_participants
        where promise_id = $1 and role = 'PARTNER'`,
      [f.promiseId],
    );
    expect(row).toMatchObject({ user_id: f.partnerId, status: 'JOINED' });
    expect(row.joined_at).not.toBeNull();
  });

  test('approvals 에 정확히 2행이 남는다', async () => {
    const f = await seed();
    await approve(f);

    const { rows } = await db.asAdmin(
      `select role, action, user_id from public.approvals
        where promise_id = $1 order by role`,
      [f.promiseId],
    );
    expect(rows).toEqual([
      { role: 'CREATOR', action: 'APPROVE', user_id: f.creatorId },
      { role: 'PARTNER', action: 'APPROVE', user_id: f.partnerId },
    ]);
  });

  test('작성자의 승인 시각은 **초대 발송 시각**이다 — §4-3-6', async () => {
    // 작성자가 확정 시점에 한 번 더 승인하는 절차는 없다. 초대를 보낸 행위가 곧 승인이고,
    // 확정 화면은 두 시각을 나란히 인쇄한다. 여기서 now() 를 쓰면 두 시각이 같아져
    // "작성자 승인 / 상대방 승인" 표시가 의미를 잃는다.
    const f = await seed();
    await approve(f);

    const row = await one<{ same: boolean }>(
      `select a.acted_at = i.created_at as same
         from public.approvals a
         join public.invitations i on i.promise_id = a.promise_id
        where a.promise_id = $1 and a.role = 'CREATOR'`,
      [f.promiseId],
    );
    expect(row.same).toBe(true);
  });

  test('두 approvals 행 모두 version_id 와 content_hash 를 갖는다', async () => {
    // append-only 라 나중에 채울 수 없다. 지금 비면 영원히 빈다.
    const f = await seed();
    await approve(f);

    const row = await one<{ n: number }>(
      `select count(*)::int as n from public.approvals
        where promise_id = $1 and version_id is not null and content_hash is not null`,
      [f.promiseId],
    );
    expect(row.n).toBe(2);
  });

  test('초대가 USED 로 소모된다', async () => {
    const f = await seed();
    await approve(f);

    const row = await one<{ status: string; used_by: string; used_at: Date | null }>(
      `select status, used_by, used_at from public.invitations where token_hash = $1`,
      [f.tokenHash],
    );
    expect(row).toMatchObject({ status: 'USED', used_by: f.partnerId });
    expect(row.used_at).not.toBeNull();
  });

  test('알림은 만들지 않는다 — 9단계는 트랜잭션 밖이다', async () => {
    const f = await seed();
    await approve(f);

    const row = await one<{ n: number }>(
      `select count(*)::int as n from public.notifications where promise_id = $1`,
      [f.promiseId],
    );
    expect(row.n).toBe(0);
  });

  test('반환 payload 의 키 집합이 정확히 일치한다', async () => {
    const f = await seed();
    expect(Object.keys(await approve(f)).sort()).toEqual([...ENDPOINT_KEYS]);
  });

  test('title 은 promises 캐시가 아니라 버전 행에서 온다', async () => {
    // 알림 본문이 이 값이다. promises 의 내용 컬럼은 목록 조회용 캐시일 뿐이고 원본은
    // promise_versions 다(§6-2). 둘을 갈라 놓고 어느 쪽을 읽는지 본다 —
    // 같은 값이면 캐시를 읽어도 테스트가 통과해 버린다.
    const f = await seed();
    await db.asAdmin(`update public.promises set title = '캐시 쪽 제목' where id = $1`, [
      f.promiseId,
    ]);

    expect((await approve(f)).title).toBe('매일 걷기');
  });

  test('payload 가 NT-01 을 만들 재료를 담고 있다', async () => {
    // 9단계가 함수 밖이므로, 껍데기가 두 번째 조회 없이 알림을 만들 수 있어야 한다.
    // EC-B04 는 작성자에게 상대 닉네임·프로필을 즉시 보여 오수락을 잡게 한다.
    const f = await seed();
    const result = await approve(f);

    expect(result.creator_id).toBe(f.creatorId);
    expect(result.status).toBe('ACTIVE');
    expect(result.partner).toMatchObject({ user_id: f.partnerId });
    expect(String(result.fingerprint)).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-\d{2,}$/u);
    expect(result.approvals).toHaveLength(2);
  });
});

describe('리마인드 — §4-3-5 8단계 · §8-2', () => {
  test('양측에게 D-7/D-3/D-1/D-Day 가 생긴다', async () => {
    const f = await seed({ endDateOffsetDays: 10 });
    await approve(f);

    const { rows } = await db.asAdmin(
      `select user_id, kind from public.reminder_schedules where promise_id = $1`,
      [f.promiseId],
    );
    expect(rows).toHaveLength(REMINDER_OFFSETS_DAYS.length * 2);
    expect(new Set(rows.map((r) => (r as { user_id: string }).user_id))).toEqual(
      new Set([f.creatorId, f.partnerId]),
    );
  });

  test('이미 지난 시점의 리마인드는 만들지 않는다', async () => {
    // 종료일이 이틀 뒤면 D-7·D-3 은 과거다. 만들면 J-01 이 확정 직후 지난 알림을 쏟아낸다.
    const f = await seed({ endDateOffsetDays: 2 });
    await approve(f);

    const { rows } = await db.asAdmin(
      `select distinct kind from public.reminder_schedules where promise_id = $1 order by kind`,
      [f.promiseId],
    );
    expect(rows.map((r) => (r as { kind: string }).kind)).toEqual(['D1', 'DDAY']);
  });

  test('발송 시각은 KST 09:00 이다', async () => {
    const f = await seed({ endDateOffsetDays: 10 });
    await approve(f);

    const { rows } = await db.asAdmin(
      `select distinct extract(hour from fire_at at time zone 'Asia/Seoul')::int as h
         from public.reminder_schedules where promise_id = $1`,
      [f.promiseId],
    );
    expect(rows).toEqual([{ h: REMINDER_SEND_HOUR_KST }]);
  });

  test('증인은 리마인드를 받지 않는다', async () => {
    // F-05 는 PENDING 에서도 증인 참여를 허용하므로 확정 시점에 JOINED 증인이 있을 수 있다.
    // participants 를 그냥 조인하면 증인이 딸려 들어온다.
    const f = await seed({ endDateOffsetDays: 10 });
    const witnessId = await createUser(db, `w${randomUUID().slice(0, 8)}`);
    await db.asAdmin(
      `insert into public.promise_participants (promise_id, user_id, role, status, joined_at)
       values ($1, $2, 'WITNESS', 'JOINED', now())`,
      [f.promiseId, witnessId],
    );

    await approve(f);

    const row = await one<{ n: number }>(
      `select count(*)::int as n from public.reminder_schedules
        where promise_id = $1 and user_id = $2`,
      [f.promiseId, witnessId],
    );
    expect(row.n).toBe(0);
  });

  test('정책 수치가 config.ts 와 일치한다', async () => {
    const row = await one<{ offsets: number[]; hour: number }>(
      `select public.lf_reminder_offsets_days() as offsets,
              public.lf_reminder_send_hour_kst() as hour`,
    );
    expect(row.offsets).toEqual([...REMINDER_OFFSETS_DAYS]);
    expect(row.hour).toBe(REMINDER_SEND_HOUR_KST);
  });
});

describe('일 지표 — §4-3-5 10단계', () => {
  test('확정 건수가 1 올라간다', async () => {
    const before = await one<{ n: number }>(
      `select coalesce(sum(activated_count), 0)::int as n from public.daily_metrics`,
    );
    await approve(await seed());
    const after = await one<{ n: number }>(
      `select coalesce(sum(activated_count), 0)::int as n from public.daily_metrics`,
    );
    expect(after.n).toBe(before.n + 1);
  });

  test('날짜 키가 KST 기준이다', async () => {
    // UTC 로 잡으면 00:00~09:00 KST 의 확정이 전부 전날로 들어간다.
    await approve(await seed());
    const row = await one<{ n: number }>(
      `select count(*)::int as n from public.daily_metrics
        where date = (now() at time zone 'Asia/Seoul')::date`,
    );
    expect(row.n).toBe(1);
  });

  test('날짜를 UTC 로 뽑는 표현이 함수 안에 없다', async () => {
    // 위 테스트만으로는 부족하다. UTC 날짜와 KST 날짜는 하루 중 9시간만 서로 다르므로,
    // KST 변환을 빼먹어도 나머지 15시간에는 테스트가 통과한다 — 변이 테스트로 확인했다.
    // 날짜 파생은 예외 없이 Asia/Seoul 변환을 거쳐야 한다.
    const row = await one<{ body: string }>(
      `select pg_get_functiondef(oid) as body from pg_proc where proname = 'lf_promise_approve'`,
    );
    // 주석에는 "current_date 를 쓰면 안 된다"는 설명이 들어 있다. 문장만 본다.
    const statements = row.body
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');

    expect(statements).not.toMatch(/current_date/iu);
    expect(statements).not.toMatch(/now\(\)\s*::\s*date/iu);
  });
});

describe('가드 — §4-3-5 1·2단계', () => {
  test('없는 토큰은 E_NOT_FOUND', async () => {
    const f = await seed();
    await expect(approve({ ...f, tokenHash: 'f'.repeat(64) })).rejects.toThrow('E_NOT_FOUND');
  });

  test.each([
    ['REVOKED', 'E_INVITE_REVOKED'],
    ['USED', 'E_INVITE_USED'],
    ['EXPIRED', 'E_INVITE_EXPIRED'],
  ] as const)('%s 토큰은 %s', async (status, code) => {
    await expect(approve(await seed({ status }))).rejects.toThrow(code);
  });

  test('PENDING 이지만 만료 시각이 지난 토큰은 E_INVITE_EXPIRED', async () => {
    // lf_invite_resolve 와 같은 판정이어야 한다. 랜딩은 만료라 했는데 승인은 통과하면
    // 사용자는 같은 토큰에 대해 서로 다른 답을 받는다.
    await expect(approve(await seed({ expiresInSeconds: -60 }))).rejects.toThrow(
      'E_INVITE_EXPIRED',
    );
  });

  test('증인 토큰은 이 함수가 받지 않는다 — E_FORBIDDEN', async () => {
    await expect(approve(await seed({ targetRole: 'WITNESS' }))).rejects.toThrow('E_FORBIDDEN');
  });

  test('거절된 증인 토큰은 그대로 살아 있다', async () => {
    // 롤백되므로 초대가 소모되지 않는다. M3 에서 증인 경로가 생기면 그대로 쓸 수 있어야 한다.
    const f = await seed({ targetRole: 'WITNESS' });
    await expect(approve(f)).rejects.toThrow();

    const row = await one<{ status: string }>(
      `select status from public.invitations where token_hash = $1`,
      [f.tokenHash],
    );
    expect(row.status).toBe('PENDING');
  });

  test('작성자가 자기 링크로 수락하면 E_SELF_INVITE', async () => {
    const f = await seed();
    await expect(approve(f, { userId: f.creatorId })).rejects.toThrow('E_SELF_INVITE');
  });

  test('이미 다른 역할로 참여 중이면 E_DUPLICATE_ROLE', async () => {
    const f = await seed();
    await db.asAdmin(
      `insert into public.promise_participants (promise_id, user_id, role, status, joined_at)
       values ($1, $2, 'WITNESS', 'JOINED', now())`,
      [f.promiseId, f.partnerId],
    );
    await expect(approve(f)).rejects.toThrow('E_DUPLICATE_ROLE');
  });

  test.each([
    ['작성자가 수락자를 차단', true],
    ['수락자가 작성자를 차단', false],
  ] as const)('%s 한 경우 E_BLOCKED', async (_label, creatorBlocks) => {
    const f = await seed();
    await db.asAdmin(
      `insert into public.blocks (blocker_id, blocked_user_id) values ($1, $2)`,
      creatorBlocks ? [f.creatorId, f.partnerId] : [f.partnerId, f.creatorId],
    );
    await expect(approve(f)).rejects.toThrow('E_BLOCKED');
  });

  test('종료일이 지났으면 승인할 수 없다 — EC-B10', async () => {
    await expect(approve(await seed({ endDateOffsetDays: -1 }))).rejects.toThrow('E_VALIDATION');
  });

  test('오늘이 종료일인 약속은 승인할 수 있다', async () => {
    // §2-2 는 CHECKING 이 종료일 **익일** 00:00 KST 에 시작한다고 못박는다.
    // 즉 종료일 당일은 아직 지키는 날이고, 승인을 막을 근거가 없다.
    const f = await seed({ endDateOffsetDays: 0 });
    expect(await approve(f)).toMatchObject({ status: 'ACTIVE' });
  });

  test('약속이 PENDING 이 아니면 E_STATE_CONFLICT', async () => {
    const f = await seed({ promiseStatus: 'DRAFT' });
    await expect(approve(f)).rejects.toThrow('E_STATE_CONFLICT');
  });

  test('던지는 코드가 전부 ERROR_CODES 의 원소다', async () => {
    const thrown: string[] = [];
    const cases = [
      async () => approve({ ...(await seed()), tokenHash: 'f'.repeat(64) }),
      async () => approve(await seed({ status: 'REVOKED' })),
      async () => approve(await seed({ targetRole: 'WITNESS' })),
      async () => approve(await seed({ endDateOffsetDays: -1 })),
      async () => approve(await seed({ promiseStatus: 'DRAFT' })),
    ];
    for (const run of cases) {
      await Promise.resolve(run())
        .then(() => undefined)
        .catch((error: Error) => thrown.push(error.message.trim()));
    }

    expect(thrown).toHaveLength(cases.length);
    for (const code of thrown) {
      expect(ERROR_CODES as readonly string[]).toContain(code);
    }
  });
});

describe('실패는 전부 롤백된다 — EC-C02', () => {
  /**
   * 부분 확정은 이 서비스에서 가장 비싼 사고다. approvals·promise_versions 가
   * append-only 라 잘못 남은 행을 지울 방법이 없다.
   */
  test.each([
    ['차단 관계', 'blocked'],
    ['종료일 경과', 'end-date'],
    ['증인 토큰', 'witness'],
  ] as const)('%s 로 실패하면 아무 흔적도 남지 않는다', async (_label, kind) => {
    const f =
      kind === 'end-date'
        ? await seed({ endDateOffsetDays: -1 })
        : kind === 'witness'
          ? await seed({ targetRole: 'WITNESS' })
          : await seed();
    if (kind === 'blocked') {
      await db.asAdmin(`insert into public.blocks (blocker_id, blocked_user_id) values ($1, $2)`, [
        f.creatorId,
        f.partnerId,
      ]);
    }

    await expect(approve(f)).rejects.toThrow();

    const row = await one<{
      promise_status: string;
      invite_status: string;
      approvals: number;
      partners: number;
      reminders: number;
      versions_activated: number;
    }>(
      `select (select status from public.promises where id = $1) as promise_status,
              (select status from public.invitations where token_hash = $2) as invite_status,
              (select count(*) from public.approvals where promise_id = $1)::int as approvals,
              (select count(*) from public.promise_participants
                 where promise_id = $1 and role = 'PARTNER')::int as partners,
              (select count(*) from public.reminder_schedules where promise_id = $1)::int as reminders,
              (select count(*) from public.promise_versions
                 where promise_id = $1 and activated_at is not null)::int as versions_activated`,
      [f.promiseId, f.tokenHash],
    );

    expect(row).toMatchObject({
      promise_status: 'PENDING',
      invite_status: 'PENDING',
      approvals: 0,
      partners: 0,
      reminders: 0,
      versions_activated: 0,
    });
  });

  test('실패한 요청은 멱등 캐시에도 남지 않는다', async () => {
    // 실패가 10분간 캐시되면 재시도 자체가 막힌다.
    const f = await seed({ endDateOffsetDays: -1 });
    const key = randomUUID();
    await expect(approve(f, { key })).rejects.toThrow();

    const row = await one<{ n: number }>(
      `select count(*)::int as n from public.idempotency_keys where key = $1`,
      [key],
    );
    expect(row.n).toBe(0);
  });
});

describe('멱등 — EC-C01 (PGlite 에서는 순차 재현)', () => {
  test('같은 키로 다섯 번 불러도 한 번만 실행된다', async () => {
    // 종료일을 넉넉히 잡는다. 기본값(+7)이면 D-7 이 오늘 09:00 KST 라 실행 시각에 따라
    // 만들어지기도, 걸러지기도 한다 — 리마인드 개수를 세는 단언이 하루 중 언제 돌리느냐에
    // 좌우되면 안 된다.
    const f = await seed({ endDateOffsetDays: 10 });
    const key = randomUUID();
    const first = await approve(f, { key });

    for (let i = 0; i < 4; i += 1) {
      expect(await approve(f, { key })).toEqual(first);
    }

    const row = await one<{ approvals: number; reminders: number }>(
      `select (select count(*) from public.approvals where promise_id = $1)::int as approvals,
              (select count(*) from public.reminder_schedules where promise_id = $1)::int as reminders`,
      [f.promiseId],
    );
    expect(row.approvals).toBe(2);
    expect(row.reminders).toBe(REMINDER_OFFSETS_DAYS.length * 2);
  });

  test('다른 키로 같은 토큰을 다시 쓰면 E_INVITE_USED', async () => {
    // 캐시가 아니라 초대 소모가 막는다. 두 번째 사람이 같은 링크를 열었을 때의 결말이기도 하다.
    const f = await seed();
    await approve(f);
    await expect(approve(f)).rejects.toThrow('E_INVITE_USED');
  });

  test('직렬화 장치가 스키마에 실제로 존재한다', async () => {
    // 진짜 동시 요청은 PGlite 에서 재현할 수 없다. 잠금이 전부 사라져도 두 사람이
    // 동시에 PARTNER 가 될 수는 없다는 것만은 구조로 보장돼야 한다.
    const { rows } = await db.asAdmin(
      `select indexname from pg_indexes
        where schemaname = 'public'
          and indexname in ('promise_participants_single_partner',
                            'promise_participants_unique_user')
        order by indexname`,
    );
    expect(rows.map((r) => (r as { indexname: string }).indexname)).toEqual([
      'promise_participants_single_partner',
      'promise_participants_unique_user',
    ]);
  });

  test('초대 행을 잠그고 읽는다 — §7-3.3', async () => {
    // 잠금 동작 자체는 단일 커넥션에서 관찰할 수 없으므로 소스를 본다.
    const row = await one<{ locks: boolean }>(
      `select pg_get_functiondef(oid) ~* 'for update of' as locks
         from pg_proc where proname = 'lf_promise_approve'`,
    );
    expect(row.locks).toBe(true);
  });

  test('초대 소모가 조건부 UPDATE 다 — EC-B06', async () => {
    // 2단계에서 이미 잠그고 분기하므로 순차 실행에서는 이 조건이 관찰되지 않는다.
    // 그래도 EC-B06 이 지정한 마지막 방어선이라, 사라지면 알아야 한다.
    const row = await one<{ guarded: boolean }>(
      `select pg_get_functiondef(oid) ~* 'used_at is null' as guarded
         from pg_proc where proname = 'lf_promise_approve'`,
    );
    expect(row.guarded).toBe(true);
  });
});

describe('서버 전용 — 04 §7-2', () => {
  // 이 마이그레이션이 만드는 함수 **전부**를 건다. 한두 개만 검사하면 옆 함수의 revoke 가
  // 빠져도 통과한다 — B1-2 에서 실제로 겪은 구멍이다.
  const SERVER_ONLY = [
    'public.lf_promise_approve(uuid, char(64), uuid, public.surface, char(64), char(64))',
    'public.lf_reminder_offsets_days()',
    'public.lf_reminder_send_hour_kst()',
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

  test('로그인한 사용자가 직접 부르면 거절된다', async () => {
    const f = await seed();
    await expect(
      db.asUser(
        f.partnerId,
        `select public.lf_promise_approve($1, $2, $3, 'WEB'::public.surface, null, null)`,
        [randomUUID(), f.tokenHash, f.partnerId],
      ),
    ).rejects.toThrow(/permission denied/iu);
  });
});
