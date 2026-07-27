import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { INVITE_RESOLVE_RATE_LIMIT } from '../../packages/shared/src/config.ts';
import { createTestDb, type TestDb } from './harness.ts';

/**
 * 빈도 제한 — 02 §2-3 `E_RATE_LIMIT`.
 *
 * 값은 명세 밖이라 PO 가 정했다(2026-07-27, IP 당 10분 60회). SQL 은 `packages/shared` 를
 * import 할 수 없으므로 두 정의가 어긋나지 않는지 여기서 대조한다.
 */

let db: TestDb;

async function hit(bucket: string): Promise<number> {
  const { rows } = await db.asAdmin(`select public.lf_rate_limit_hit($1) as n`, [bucket]);
  return Number((rows[0] as { n: number }).n);
}

async function codeOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('정책 값이 packages/shared 와 일치한다', () => {
  test('창 길이', async () => {
    const { rows } = await db.asAdmin(`select public.lf_rate_limit_window_seconds() as n`);
    expect(Number((rows[0] as { n: number }).n)).toBe(INVITE_RESOLVE_RATE_LIMIT.windowSeconds);
  });

  test('한도', async () => {
    const { rows } = await db.asAdmin(`select public.lf_rate_limit_max_hits() as n`);
    expect(Number((rows[0] as { n: number }).n)).toBe(INVITE_RESOLVE_RATE_LIMIT.maxHits);
  });
});

describe('카운트와 판정', () => {
  test('호출마다 1씩 오른다', async () => {
    const bucket = `t:${Math.random().toString(36).slice(2)}`;
    expect(await hit(bucket)).toBe(1);
    expect(await hit(bucket)).toBe(2);
    expect(await hit(bucket)).toBe(3);
  });

  test('한도까지는 통과하고 넘으면 E_RATE_LIMIT 이다', async () => {
    const bucket = `t:${Math.random().toString(36).slice(2)}`;
    const max = INVITE_RESOLVE_RATE_LIMIT.maxHits;

    for (let i = 1; i <= max; i += 1) {
      expect(await hit(bucket)).toBe(i);
    }
    // 경계가 한 칸 어긋나 있으면(> 대신 >=) 마지막 정상 호출이 막힌다.
    expect(await codeOf(() => hit(bucket))).toBe('E_RATE_LIMIT');
  });

  test('버킷이 다르면 서로 영향을 주지 않는다', async () => {
    // 이게 깨지면 한 사람이 전원을 차단할 수 있다.
    const a = `t:${Math.random().toString(36).slice(2)}`;
    const b = `t:${Math.random().toString(36).slice(2)}`;

    for (let i = 0; i < INVITE_RESOLVE_RATE_LIMIT.maxHits; i += 1) await hit(a);
    expect(await codeOf(() => hit(a))).toBe('E_RATE_LIMIT');
    expect(await hit(b)).toBe(1);
  });

  test('빈 버킷 이름은 거절한다', async () => {
    // 허용하면 전원이 한 버킷을 공유해, 제한이 아니라 공용 차단 장치가 된다.
    expect(await codeOf(() => hit(''))).toBe('E_VALIDATION');
    expect(await codeOf(() => hit('   '))).toBe('E_VALIDATION');
  });
});

describe('창 경계', () => {
  test('창 시작은 epoch 기준으로 내림한 값이라 호출자마다 어긋나지 않는다', async () => {
    // 창이 호출 시각마다 새로 열리면 한도가 사실상 사라진다.
    const bucket = `t:${Math.random().toString(36).slice(2)}`;
    await hit(bucket);
    await hit(bucket);

    const { rows } = await db.asAdmin(
      `select count(*)::int as windows from public.rate_limit_counters where bucket = $1`,
      [bucket],
    );
    expect(Number((rows[0] as { windows: number }).windows)).toBe(1);
  });

  test('지난 창은 청소된다 — 별도 배치가 필요 없다', async () => {
    const bucket = `t:${Math.random().toString(36).slice(2)}`;
    await db.asAdmin(
      `insert into public.rate_limit_counters (bucket, window_start, hits)
       values ($1, now() - interval '3 hours', 999)`,
      [bucket],
    );

    await hit(bucket);

    const { rows } = await db.asAdmin(
      `select count(*)::int as n from public.rate_limit_counters
        where bucket = $1 and window_start < now() - interval '1 hour'`,
      [bucket],
    );
    expect(Number((rows[0] as { n: number }).n)).toBe(0);
  });

  test('오래된 창이 남아 있어도 현재 창 카운트는 1부터 시작한다', async () => {
    const bucket = `t:${Math.random().toString(36).slice(2)}`;
    await db.asAdmin(
      `insert into public.rate_limit_counters (bucket, window_start, hits)
       values ($1, now() - interval '3 hours', 999)`,
      [bucket],
    );
    expect(await hit(bucket)).toBe(1);
  });
});

describe('권한 — 서버 전용', () => {
  test.each([
    ['lf_rate_limit_hit(text)'],
    ['lf_rate_limit_window_seconds()'],
    ['lf_rate_limit_max_hits()'],
  ])('%s 는 anon·authenticated·public 모두에게 닫혀 있다', async (signature) => {
    // 열려 있으면 남의 버킷을 채워 그 사람을 차단할 수 있다.
    // has_function_privilege 로 함수별로 본다 — "던지더라"식 확인은 옆 함수의 revoke 에
    // 만족해 버려서 빠진 한 줄을 숨긴다.
    for (const role of ['anon', 'authenticated', 'public']) {
      const { rows } = await db.asAdmin(
        `select has_function_privilege($1, $2, 'execute') as ok`,
        [role, `public.${signature}`],
      );
      expect((rows[0] as { ok: boolean }).ok, `${role} → ${signature}`).toBe(false);
    }
  });

  test('service_role 은 부를 수 있다', async () => {
    const { rows } = await db.asAdmin(
      `select has_function_privilege('service_role', 'public.lf_rate_limit_hit(text)', 'execute') as ok`,
    );
    expect((rows[0] as { ok: boolean }).ok).toBe(true);
  });
});

describe('저장소', () => {
  test('RLS 가 켜져 있고 정책은 하나도 없다 — 서버 전용', async () => {
    const { rows } = await db.asAdmin(
      `select c.relrowsecurity as rls,
              (select count(*)::int from pg_policies p
                where p.schemaname = 'public' and p.tablename = 'rate_limit_counters') as policies
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'rate_limit_counters'`,
    );
    const row = rows[0] as { rls: boolean; policies: number };
    expect(row.rls).toBe(true);
    expect(Number(row.policies)).toBe(0);
  });
});
