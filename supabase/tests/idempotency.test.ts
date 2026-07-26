import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { IDEMPOTENCY_TTL_MIN } from '../../packages/shared/src/config.ts';
import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

/**
 * Idempotency-Key 저장소 — 02 §7-3.6 · EC-C01.
 *
 * 규칙은 한 줄이다: 상태 변경 요청은 `Idempotency-Key`(UUID)를 달고 오고,
 * 서버는 10분간 결과를 캐시해 같은 키에 **같은 응답**을 돌려준다.
 *
 * 중요한 건 응답이 같다는 게 아니라 **두 번째 요청이 아무 일도 하지 않는다**는 것이다.
 * EC-C01 은 수락 버튼을 연속으로 탭해도 `approvals` 행이 하나만 생겨야 한다고 못박는다.
 * 그래서 캐시는 트랜잭션이 끝난 뒤가 아니라 **시작하기 전에** 끊어야 한다.
 * 아래 `lf_test_endpoint` 가 부수 효과를 가진 가짜 엔드포인트로 그 지점을 찌른다.
 */

let db: TestDb;

/**
 * B1-4 의 `lf_promise_approve` 가 쓸 패턴을 그대로 흉내낸 **테스트 전용** 엔드포인트다.
 * 마이그레이션이 아니라 여기서만 만든다 — 운영 스키마에 나가지 않는다.
 *
 * begin → (부수 효과) → finish 순서이고, 캐시가 걸리면 insert 자체에 도달하지 않는다.
 */
const TEST_ENDPOINT = `
  create function public.lf_test_endpoint(
    p_key uuid,
    p_user_id uuid,
    p_promise_id uuid,
    p_endpoint text default 'promise-approve',
    p_fail boolean default false
  )
  returns jsonb
  language plpgsql
  as $$
  declare
    v_cached jsonb;
    v_response jsonb;
  begin
    v_cached := public.lf_idempotency_begin(p_key, p_user_id, p_endpoint);
    if v_cached is not null then
      return v_cached;
    end if;

    insert into public.approvals (promise_id, user_id, role, action, surface)
    values (p_promise_id, p_user_id, 'PARTNER', 'APPROVE', 'WEB');

    if p_fail then
      raise exception 'boom';
    end if;

    v_response := jsonb_build_object('promise_id', p_promise_id, 'status', 'ACTIVE');
    perform public.lf_idempotency_finish(p_key, v_response);
    return v_response;
  end;
  $$;
`;

/** 한 번의 요청. 실제로는 Edge Function 이 이 한 문장을 호출한다. */
async function callEndpoint(
  key: string,
  userId: string,
  promiseId: string,
  options: { endpoint?: string; fail?: boolean } = {},
): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(
    `select public.lf_test_endpoint($1, $2, $3, $4, $5) as r`,
    [key, userId, promiseId, options.endpoint ?? 'promise-approve', options.fail ?? false],
  );
  return (rows[0] as { r: Record<string, unknown> }).r;
}

/** 부수 효과 계측기. EC-C01 은 이 값이 1 이어야 한다고 말한다. */
async function countApprovals(promiseId: string): Promise<number> {
  const { rows } = await db.asAdmin(
    `select count(*)::int as n from public.approvals where promise_id = $1`,
    [promiseId],
  );
  return (rows[0] as { n: number }).n;
}

/** 키의 나이를 조작한다. 실시간으로 10분을 기다릴 수는 없다. */
async function ageKey(key: string, seconds: number): Promise<void> {
  await db.asAdmin(
    `update public.idempotency_keys
        set created_at = created_at - make_interval(secs => $2)
      where key = $1`,
    [key, seconds],
  );
}

/** 사용자와 약속 하나를 새로 만든다. 테스트끼리 approvals 수가 섞이지 않게 매번 새로 만든다. */
async function freshPromise(): Promise<{ userId: string; promiseId: string }> {
  const userId = await createUser(db, `u${randomUUID().slice(0, 8)}`);
  const promiseId = await createPromise(db, { creatorId: userId, status: 'PENDING' });
  return { userId, promiseId };
}

beforeAll(async () => {
  db = await createTestDb();
  await db.asAdmin(TEST_ENDPOINT);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('저장소는 서버 전용이다 — 04 §7-2', () => {
  test('idempotency_keys 테이블이 있다', async () => {
    const { rows } = await db.asAdmin(
      `select 1 as ok from information_schema.tables
        where table_schema = 'public' and table_name = 'idempotency_keys'`,
    );
    expect(rows).toHaveLength(1);
  });

  test('RLS 가 켜져 있다', async () => {
    const { rows } = await db.asAdmin(
      `select relrowsecurity from pg_class
        where oid = 'public.idempotency_keys'::regclass`,
    );
    expect((rows[0] as { relrowsecurity: boolean }).relrowsecurity).toBe(true);
  });

  test('정책이 하나도 없다 — service_role 외에는 아무도 접근하지 못한다', async () => {
    const { rows } = await db.asAdmin(
      `select policyname from pg_policies
        where schemaname = 'public' and tablename = 'idempotency_keys'`,
    );
    expect(rows).toEqual([]);
  });

  test('로그인한 사용자도 자기 키를 읽을 수 없다', async () => {
    const { userId, promiseId } = await freshPromise();
    const key = randomUUID();
    await callEndpoint(key, userId, promiseId);

    const { rows } = await db.asUser(userId, `select key from public.idempotency_keys`);
    expect(rows).toEqual([]);
  });

  test('로그인하지 않은 방문자도 읽을 수 없다', async () => {
    const { rows } = await db.asAnon(`select key from public.idempotency_keys`);
    expect(rows).toEqual([]);
  });

  test('클라이언트는 캐시 행을 심을 수 없다', async () => {
    const { userId } = await freshPromise();
    await expect(
      db.asUser(
        userId,
        `insert into public.idempotency_keys (key, user_id, endpoint, response)
         values ($1, $2, 'promise-approve', '{"status":"ACTIVE"}'::jsonb)`,
        [randomUUID(), userId],
      ),
      // 막연한 실패로는 부족하다 — 테이블 오타로도 통과해 버린다. RLS 가 막았는지를 본다.
    ).rejects.toThrow(/row-level security/iu);
  });

  test('클라이언트는 캐시 함수를 직접 부를 수 없다', async () => {
    // 함수가 클라이언트에게 열려 있으면 남의 요청을 미리 캐시로 막아버릴 수 있다.
    const { userId } = await freshPromise();
    await expect(
      db.asUser(userId, `select public.lf_idempotency_begin($1, $2, 'promise-approve')`, [
        randomUUID(),
        userId,
      ]),
    ).rejects.toThrow(/permission denied/iu);
  });

  /**
   * 위의 행위 테스트만으로는 부족하다. `lf_idempotency_begin` 은 안에서
   * `lf_idempotency_ttl_minutes()` 를 먼저 부르기 때문에, begin 의 revoke 를 지워도
   * 옆 함수의 revoke 가 대신 막아 준다 — 변이 테스트로 실제 확인한 구멍이다.
   * 그래서 함수마다 권한을 직접 본다.
   */
  const SERVER_ONLY_FUNCTIONS = [
    'public.lf_idempotency_ttl_minutes()',
    'public.lf_idempotency_begin(uuid, uuid, text)',
    'public.lf_idempotency_finish(uuid, jsonb)',
  ] as const;

  test.each(
    SERVER_ONLY_FUNCTIONS.flatMap((fn) =>
      (['anon', 'authenticated'] as const).map((role) => [fn, role] as const),
    ),
  )('%s 에 %s 는 execute 권한이 없다', async (fn, role) => {
    const { rows } = await db.asAdmin(`select has_function_privilege($1, $2, 'execute') as allowed`, [
      role,
      fn,
    ]);
    expect((rows[0] as { allowed: boolean }).allowed).toBe(false);
  });

  test.each(SERVER_ONLY_FUNCTIONS)('%s 는 service_role 이 부를 수 있다', async (fn) => {
    const { rows } = await db.asAdmin(
      `select has_function_privilege('service_role', $1, 'execute') as allowed`,
      [fn],
    );
    expect((rows[0] as { allowed: boolean }).allowed).toBe(true);
  });
});

describe('같은 키는 한 번만 실행된다 — EC-C01', () => {
  test('첫 호출은 캐시가 없다', async () => {
    const { userId, promiseId } = await freshPromise();
    const { rows } = await db.asAdmin(
      `select public.lf_idempotency_begin($1, $2, 'promise-approve') as r`,
      [randomUUID(), userId],
    );
    expect((rows[0] as { r: unknown }).r).toBeNull();

    // 클레임만 잡았을 뿐 아무 일도 하지 않았다.
    expect(await countApprovals(promiseId)).toBe(0);
  });

  test('두 번째 호출은 첫 응답을 그대로 돌려준다', async () => {
    const { userId, promiseId } = await freshPromise();
    const key = randomUUID();

    const first = await callEndpoint(key, userId, promiseId);
    const second = await callEndpoint(key, userId, promiseId);

    expect(second).toEqual(first);
  });

  test('두 번째 호출은 approvals 행을 만들지 않는다', async () => {
    const { userId, promiseId } = await freshPromise();
    const key = randomUUID();

    await callEndpoint(key, userId, promiseId);
    await callEndpoint(key, userId, promiseId);

    expect(await countApprovals(promiseId)).toBe(1);
  });

  test('연속 탭 다섯 번도 한 번만 실행된다', async () => {
    const { userId, promiseId } = await freshPromise();
    const key = randomUUID();

    for (let i = 0; i < 5; i += 1) {
      await callEndpoint(key, userId, promiseId);
    }

    expect(await countApprovals(promiseId)).toBe(1);
  });

  test('다른 키는 서로 간섭하지 않는다', async () => {
    const { userId, promiseId } = await freshPromise();

    await callEndpoint(randomUUID(), userId, promiseId);
    await callEndpoint(randomUUID(), userId, promiseId);

    expect(await countApprovals(promiseId)).toBe(2);
  });
});

describe('캐시는 10분만 산다 — §7-3.6', () => {
  test('SQL 의 만료 시간이 IDEMPOTENCY_TTL_MIN 과 같다', async () => {
    // SQL 은 config.ts 를 import 할 수 없다. 두 값이 갈라지면 여기서 잡는다.
    const { rows } = await db.asAdmin(`select public.lf_idempotency_ttl_minutes() as m`);
    expect((rows[0] as { m: number }).m).toBe(IDEMPOTENCY_TTL_MIN);
  });

  test('만료 직전의 키는 여전히 캐시된다', async () => {
    const { userId, promiseId } = await freshPromise();
    const key = randomUUID();

    await callEndpoint(key, userId, promiseId);
    await ageKey(key, IDEMPOTENCY_TTL_MIN * 60 - 1);
    await callEndpoint(key, userId, promiseId);

    expect(await countApprovals(promiseId)).toBe(1);
  });

  test('만료된 키는 다시 실행된다', async () => {
    const { userId, promiseId } = await freshPromise();
    const key = randomUUID();

    const first = await callEndpoint(key, userId, promiseId);
    await ageKey(key, IDEMPOTENCY_TTL_MIN * 60 + 1);
    const second = await callEndpoint(key, userId, promiseId);

    expect(second).toEqual(first);
    expect(await countApprovals(promiseId)).toBe(2);
  });

  test('만료된 키를 재사용해도 캐시 행은 하나뿐이다', async () => {
    const { userId, promiseId } = await freshPromise();
    const key = randomUUID();

    await callEndpoint(key, userId, promiseId);
    await ageKey(key, IDEMPOTENCY_TTL_MIN * 60 + 1);
    await callEndpoint(key, userId, promiseId);

    const { rows } = await db.asAdmin(
      `select count(*)::int as n from public.idempotency_keys where key = $1`,
      [key],
    );
    expect((rows[0] as { n: number }).n).toBe(1);
  });
});

describe('키는 한 (사용자, 엔드포인트) 쌍에만 속한다', () => {
  test('다른 사용자가 같은 키를 쓰면 거부된다', async () => {
    const { userId, promiseId } = await freshPromise();
    const other = await freshPromise();
    const key = randomUUID();

    await callEndpoint(key, userId, promiseId);

    await expect(callEndpoint(key, other.userId, other.promiseId)).rejects.toThrow('E_FORBIDDEN');
  });

  test('거부될 때 남의 응답이 새지 않는다', async () => {
    const { userId, promiseId } = await freshPromise();
    const other = await freshPromise();
    const key = randomUUID();

    await callEndpoint(key, userId, promiseId);

    // 응답이 돌아오는 대신 예외가 난다 — 남의 promise_id 를 볼 방법이 없다.
    await expect(callEndpoint(key, other.userId, other.promiseId)).rejects.toThrow();
    expect(await countApprovals(other.promiseId)).toBe(0);
  });

  test('같은 사용자라도 엔드포인트가 다르면 거부된다', async () => {
    const { userId, promiseId } = await freshPromise();
    const key = randomUUID();

    await callEndpoint(key, userId, promiseId, { endpoint: 'promise-approve' });

    await expect(
      callEndpoint(key, userId, promiseId, { endpoint: 'promise-decline' }),
    ).rejects.toThrow('E_FORBIDDEN');
  });
});

describe('실패한 요청은 캐시되지 않는다 — EC-C02 롤백', () => {
  test('작업이 실패하면 클레임도 함께 사라진다', async () => {
    const { userId, promiseId } = await freshPromise();
    const key = randomUUID();

    await expect(callEndpoint(key, userId, promiseId, { fail: true })).rejects.toThrow('boom');

    const { rows } = await db.asAdmin(
      `select count(*)::int as n from public.idempotency_keys where key = $1`,
      [key],
    );
    expect((rows[0] as { n: number }).n).toBe(0);
  });

  test('실패한 뒤 같은 키로 재시도하면 정상 실행된다', async () => {
    const { userId, promiseId } = await freshPromise();
    const key = randomUUID();

    await expect(callEndpoint(key, userId, promiseId, { fail: true })).rejects.toThrow('boom');
    const retried = await callEndpoint(key, userId, promiseId);

    expect(retried).toMatchObject({ status: 'ACTIVE' });
    // 실패한 요청의 insert 는 롤백됐으므로 성공한 한 번만 남는다.
    expect(await countApprovals(promiseId)).toBe(1);
  });
});
