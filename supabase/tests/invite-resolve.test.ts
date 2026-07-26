import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { ERROR_CODES } from '../../packages/shared/src/errors.js';
import {
  createInvitation,
  createPromise,
  createTestDb,
  createUser,
  type TestDb,
} from './harness.js';

/**
 * `lf_invite_resolve` — 02 §4-3-3 (SCR-W01 초대 랜딩, 비로그인).
 *
 * 이 함수는 서비스에서 **로그인 이전에 DB 를 건드리는 유일한 경로**다. 카톡으로 퍼진
 * 링크를 아무나 열 수 있다는 전제 위에 서 있으므로, 반환하는 것보다 **반환하지 않는 것**이
 * 훨씬 중요하다. §4-3-3 이 그 이유를 명시한다 — "링크 유출 대비".
 *
 * 그래서 여기 테스트는 두 겹이다.
 * 1. 키 집합 **동등** 검사 — 나중에 누가 select 목록에 컬럼을 하나 더 얹으면 즉시 깨진다.
 * 2. 센티넬 값 검사 — 키 이름을 바꿔 가며 담아도 값이 새면 걸린다.
 *
 * 판정 순서도 명세 그대로 지킨다. 저장된 status 가 시계보다 **먼저**다 —
 * 이미 사용된 토큰이 72시간을 넘겼다고 해서 `E_INVITE_USED` 가 `E_INVITE_EXPIRED` 로
 * 바뀌면 EC-B02(참여자 본인은 상세로 이동)의 분기가 조용히 사라진다.
 */

let db: TestDb;

const MIGRATION = join(__dirname, '../migrations/20260726000005_invite_resolve.sql');

/** 응답에 허용된 키. 목록이 아니라 **전부**다 — 하나라도 더 있으면 실패한다. */
const ALLOWED_KEYS = ['creator_nickname', 'expires_at', 'target_role', 'title'] as const;

async function resolve(tokenHash: string): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(`select public.lf_invite_resolve($1) as r`, [tokenHash]);
  return (rows[0] as { r: Record<string, unknown> }).r;
}

/** 작성자 · 약속 · PENDING 초대 한 벌. 각 테스트가 서로 간섭하지 않도록 매번 새로 만든다. */
async function seed(
  options: {
    targetRole?: 'PARTNER' | 'WITNESS';
    status?: 'PENDING' | 'USED' | 'EXPIRED' | 'REVOKED';
    expiresInSeconds?: number;
    createdBy?: 'creator' | 'partner';
  } = {},
): Promise<{ creatorId: string; partnerId: string; promiseId: string; tokenHash: string }> {
  const creatorId = await createUser(db, `c${randomUUID().slice(0, 8)}`);
  const partnerId = await createUser(db, `p${randomUUID().slice(0, 8)}`);
  const promiseId = await createPromise(db, { creatorId, status: 'PENDING' });
  const tokenHash = await createInvitation(db, {
    promiseId,
    createdBy: options.createdBy === 'partner' ? partnerId : creatorId,
    ...(options.targetRole !== undefined ? { targetRole: options.targetRole } : {}),
    ...(options.status !== undefined ? { status: options.status } : {}),
    ...(options.expiresInSeconds !== undefined
      ? { expiresInSeconds: options.expiresInSeconds }
      : {}),
  });
  return { creatorId, partnerId, promiseId, tokenHash };
}

function fakeHash(seedText: string): string {
  return createHash('sha256').update(seedText).digest('hex');
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('유효한 토큰 — §4-3-3 최소 정보', () => {
  test('작성자 닉네임 · 제목 · 만료 시각 · 대상 역할을 돌려준다', async () => {
    const { creatorId, tokenHash } = await seed();
    const { rows } = await db.asAdmin(`select nickname from public.users where id = $1`, [
      creatorId,
    ]);
    const nickname = (rows[0] as { nickname: string }).nickname;

    const result = await resolve(tokenHash);

    expect(result.creator_nickname).toBe(nickname);
    expect(result.title).toBe('매일 걷기');
    expect(result.target_role).toBe('PARTNER');
    expect(result.expires_at).toBeTruthy();
  });

  test('응답 키 집합이 화이트리스트와 정확히 일치한다', async () => {
    // 부분집합이 아니라 **동등** 비교다. 나중에 select 목록에 컬럼이 하나라도 늘면 여기서 깨진다.
    const { tokenHash } = await seed();
    expect(Object.keys(await resolve(tokenHash)).sort()).toEqual([...ALLOWED_KEYS]);
  });

  test('본문·보상·벌칙이 응답 어디에도 없다', async () => {
    // 키 이름만 보면 부족하다 — 값이 다른 키에 실려 나가도 잡아야 한다.
    // createPromise 는 reward·penalty 를 비워 두므로 직접 채워 넣어야 검사가 헛돌지 않는다.
    const { promiseId, tokenHash } = await seed();
    await db.asAdmin(
      `update public.promises
          set body = 'SENTINEL_BODY', reward = 'SENTINEL_REWARD', penalty = 'SENTINEL_PENALTY'
        where id = $1`,
      [promiseId],
    );

    const serialized = JSON.stringify(await resolve(tokenHash));

    expect(serialized).not.toContain('SENTINEL_BODY');
    expect(serialized).not.toContain('SENTINEL_REWARD');
    expect(serialized).not.toContain('SENTINEL_PENALTY');
  });

  test('종료일·카테고리·지킬 사람·증인 여부도 노출하지 않는다', async () => {
    // §4-3-3 은 화이트리스트다. 이 넷은 전부 SCR-W02(로그인 후) 요소다.
    const { tokenHash } = await seed();
    const keys = Object.keys(await resolve(tokenHash));

    for (const forbidden of ['end_date', 'category', 'keeper', 'witness_enabled', 'body']) {
      expect(keys).not.toContain(forbidden);
    }
  });

  test('증인 토큰과 상대방 토큰의 응답 모양이 같다', async () => {
    // 역할에 따라 응답 구조가 갈리면 화이트리스트가 두 벌이 되고 한쪽만 검사받는다.
    const partner = await seed({ targetRole: 'PARTNER' });
    const witnessToken = await createInvitation(db, {
      promiseId: partner.promiseId,
      createdBy: partner.creatorId,
      targetRole: 'WITNESS',
    });

    const forPartner = await resolve(partner.tokenHash);
    const forWitness = await resolve(witnessToken);

    expect(Object.keys(forWitness).sort()).toEqual(Object.keys(forPartner).sort());
    expect(forWitness.title).toBe(forPartner.title);
    expect(forWitness.creator_nickname).toBe(forPartner.creator_nickname);
    expect(forWitness.target_role).toBe('WITNESS');
  });

  test('상대방이 보낸 증인 초대도 **작성자** 닉네임을 돌려준다', async () => {
    // §4-5-2: 증인 초대는 작성자와 상대방 **둘 다** 보낼 수 있다.
    // invitations.created_by 로 조인하면 이 경우에만 엉뚱한 사람 이름이 나간다 —
    // 상대방 링크만 테스트해서는 절대 드러나지 않는 종류의 버그다.
    const { creatorId, tokenHash } = await seed({ targetRole: 'WITNESS', createdBy: 'partner' });
    const { rows } = await db.asAdmin(`select nickname from public.users where id = $1`, [
      creatorId,
    ]);

    expect((await resolve(tokenHash)).creator_nickname).toBe(
      (rows[0] as { nickname: string }).nickname,
    );
  });
});

describe('토큰 상태 판정 — §4-3-3 · EC-B01~B03', () => {
  test('없는 토큰은 E_NOT_FOUND', async () => {
    await expect(resolve(fakeHash('nobody'))).rejects.toThrow('E_NOT_FOUND');
  });

  test('형식이 어긋난 토큰도 E_NOT_FOUND', async () => {
    // char(64) 는 함수 인자에서 길이를 강제하지 않는다. 그냥 아무 행에도 안 맞을 뿐이다.
    await expect(resolve('too-short')).rejects.toThrow('E_NOT_FOUND');
  });

  test('무효화된 토큰은 E_INVITE_REVOKED', async () => {
    const { tokenHash } = await seed({ status: 'REVOKED' });
    await expect(resolve(tokenHash)).rejects.toThrow('E_INVITE_REVOKED');
  });

  test('사용된 토큰은 E_INVITE_USED', async () => {
    const { tokenHash } = await seed({ status: 'USED' });
    await expect(resolve(tokenHash)).rejects.toThrow('E_INVITE_USED');
  });

  test('배치가 만료 처리한 토큰은 E_INVITE_EXPIRED', async () => {
    const { tokenHash } = await seed({ status: 'EXPIRED' });
    await expect(resolve(tokenHash)).rejects.toThrow('E_INVITE_EXPIRED');
  });
});

describe('만료는 status 가 아니라 시계로 판정한다 — §7-2 J-04 지연 구간', () => {
  /**
   * J-04 는 **30분마다** 돈다(§7-2). 그래서 `status='PENDING'` 인데 `expires_at` 은
   * 이미 지난 구간이 최대 30분 존재한다. status 만 보면 만료된 링크가 그동안 계속 열린다.
   */
  test('PENDING 이라도 만료 시각이 지났으면 E_INVITE_EXPIRED', async () => {
    const { tokenHash } = await seed({ status: 'PENDING', expiresInSeconds: -60 });
    await expect(resolve(tokenHash)).rejects.toThrow('E_INVITE_EXPIRED');
  });

  test('만료 1초 전은 성공한다', async () => {
    const { tokenHash } = await seed({ expiresInSeconds: 60 });
    expect(await resolve(tokenHash)).toMatchObject({ target_role: 'PARTNER' });
  });

  test('만료 1초 후는 실패한다', async () => {
    const { tokenHash } = await seed({ expiresInSeconds: -1 });
    await expect(resolve(tokenHash)).rejects.toThrow('E_INVITE_EXPIRED');
  });

  test('시계 만료 판정은 초대 행을 고치지 않는다', async () => {
    // 읽기 경로가 T-06 을 대신 수행해서는 안 된다. 만료 처리는 J-04 의 몫이다.
    const { tokenHash } = await seed({ status: 'PENDING', expiresInSeconds: -60 });
    await expect(resolve(tokenHash)).rejects.toThrow();

    const { rows } = await db.asAdmin(
      `select status from public.invitations where token_hash = $1`,
      [tokenHash],
    );
    expect((rows[0] as { status: string }).status).toBe('PENDING');
  });

  test('저장된 status 가 시계보다 우선한다', async () => {
    // 사용된 뒤 한참 지나 다시 열어도 E_INVITE_USED 여야 한다.
    // 여기서 EXPIRED 가 나오면 EC-B02(참여자는 상세로 이동)의 분기가 사라진다.
    const used = await seed({ status: 'USED', expiresInSeconds: -3600 });
    await expect(resolve(used.tokenHash)).rejects.toThrow('E_INVITE_USED');

    const revoked = await seed({ status: 'REVOKED', expiresInSeconds: -3600 });
    await expect(resolve(revoked.tokenHash)).rejects.toThrow('E_INVITE_REVOKED');
  });
});

describe('실패 응답은 아무것도 흘리지 않는다 — EC-B01', () => {
  test.each(['USED', 'EXPIRED', 'REVOKED'] as const)(
    '%s 토큰의 에러에 약속 내용이 섞이지 않는다',
    async (status) => {
      const { promiseId, tokenHash } = await seed({ status });
      await db.asAdmin(
        `update public.promises set title = 'SENTINEL_TITLE', body = 'SENTINEL_BODY' where id = $1`,
        [promiseId],
      );

      await expect(resolve(tokenHash)).rejects.toThrow(
        expect.not.stringContaining('SENTINEL') as unknown as string,
      );
    },
  );

  test('예외 메시지는 에러 코드 그 자체다 — 토큰 해시가 실려 나가지 않는다', async () => {
    const { tokenHash } = await seed({ status: 'REVOKED' });
    await expect(resolve(tokenHash)).rejects.toThrow(
      expect.not.stringContaining(tokenHash.slice(0, 16)) as unknown as string,
    );
  });

  test('던지는 코드가 전부 ERROR_CODES 의 원소다', async () => {
    const fixtures = [
      await seed({ status: 'USED' }),
      await seed({ status: 'EXPIRED' }),
      await seed({ status: 'REVOKED' }),
      await seed({ status: 'PENDING', expiresInSeconds: -60 }),
    ];

    const thrown: string[] = [];
    for (const f of fixtures) {
      await resolve(f.tokenHash).catch((error: Error) => thrown.push(error.message.trim()));
    }
    await resolve(fakeHash('nope')).catch((error: Error) => thrown.push(error.message.trim()));

    expect(thrown).toHaveLength(5);
    for (const code of thrown) {
      expect(ERROR_CODES as readonly string[]).toContain(code);
    }
  });
});

describe('resolve 는 순수한 읽기다 — EC-A01', () => {
  test('여러 번 열어도 초대가 소모되지 않는다', async () => {
    // 카카오 동의 화면을 취소하고 다시 들어오는 흐름이 실제로 흔하다.
    const { tokenHash } = await seed();
    const first = await resolve(tokenHash);

    for (let i = 0; i < 5; i += 1) {
      expect(await resolve(tokenHash)).toEqual(first);
    }

    const { rows } = await db.asAdmin(
      `select status, used_at, used_by from public.invitations where token_hash = $1`,
      [tokenHash],
    );
    expect(rows[0]).toMatchObject({ status: 'PENDING', used_at: null, used_by: null });
  });

  test('약속 상태를 바꾸지 않는다', async () => {
    const { promiseId, tokenHash } = await seed();
    await resolve(tokenHash);

    const { rows } = await db.asAdmin(`select status from public.promises where id = $1`, [
      promiseId,
    ]);
    expect((rows[0] as { status: string }).status).toBe('PENDING');
  });

  test('함수가 stable 로 선언돼 있다', async () => {
    // 위의 행위 테스트들은 "지금은 쓰지 않는다"까지만 보증한다. stable 은 나중에
    // 누가 UPDATE 를 넣는 것 자체를 Postgres 가 거부하게 만드는 장치다 —
    // volatile 로 바꿔도 어떤 행위 테스트도 깨지지 않는 것을 변이 테스트로 확인했다.
    const { rows } = await db.asAdmin(
      `select provolatile from pg_proc where oid = 'public.lf_invite_resolve(char(64))'::regprocedure`,
    );
    expect((rows[0] as { provolatile: string }).provolatile).toBe('s');
  });

  test('알림도 리마인드도 만들지 않는다', async () => {
    const before = await countQueues();
    const { tokenHash } = await seed({ status: 'PENDING', expiresInSeconds: -60 });
    await resolve(tokenHash).catch(() => undefined);
    await resolve((await seed()).tokenHash);

    expect(await countQueues()).toEqual(before);
  });
});

async function countQueues(): Promise<{ notifications: number; reminders: number }> {
  const { rows } = await db.asAdmin(
    `select (select count(*) from public.notifications)::int as notifications,
            (select count(*) from public.reminder_schedules)::int as reminders`,
  );
  return rows[0] as { notifications: number; reminders: number };
}

describe('서버 전용 — 04 §7-2', () => {
  const SIGNATURE = 'public.lf_invite_resolve(char(64))';

  test.each(['anon', 'authenticated'] as const)('%s 는 execute 권한이 없다', async (role) => {
    const { rows } = await db.asAdmin(`select has_function_privilege($1, $2, 'execute') as allowed`, [
      role,
      SIGNATURE,
    ]);
    expect((rows[0] as { allowed: boolean }).allowed).toBe(false);
  });

  test('service_role 만 부를 수 있다', async () => {
    const { rows } = await db.asAdmin(
      `select has_function_privilege('service_role', $1, 'execute') as allowed`,
      [SIGNATURE],
    );
    expect((rows[0] as { allowed: boolean }).allowed).toBe(true);
  });

  test('비로그인 방문자가 직접 부르면 거절된다', async () => {
    const { tokenHash } = await seed();
    await expect(
      db.asAnon(`select public.lf_invite_resolve($1)`, [tokenHash]),
    ).rejects.toThrow(/permission denied/iu);
  });

  test('로그인한 사용자가 직접 불러도 거절된다', async () => {
    const { creatorId, tokenHash } = await seed();
    await expect(
      db.asUser(creatorId, `select public.lf_invite_resolve($1)`, [tokenHash]),
    ).rejects.toThrow(/permission denied/iu);
  });
});

describe('정책 수치를 코드에 박지 않는다 — CLAUDE.md §5-3', () => {
  test('만료는 expires_at 에서만 나온다 — 72 가 마이그레이션에 없다', async () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    // 주석에 등장하는 "72시간"은 설명이므로 SQL 문장만 본다.
    const statements = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    expect(statements).not.toMatch(/\b72\b/u);
  });
});
