import { createSign, generateKeyPairSync } from 'node:crypto';

import { describe, expect, test, vi } from 'vitest';

import type { Deps } from '../functions/_shared/deps.ts';
import { createPromiseEntitlementsHandler } from '../functions/promise-entitlements/handler.ts';
import { createRetentionMaintenanceHandler } from '../functions/retention-maintenance/handler.ts';
import { createRewardCallbackHandler } from '../functions/reward-callback/handler.ts';
import { createVerifierKeyCache } from '../functions/reward-callback/keys.ts';
import { derToP1363 } from '../functions/reward-callback/ssv.ts';
import { createRewardIntentHandler } from '../functions/reward-intent-create/handler.ts';
import { createRewardStatusHandler } from '../functions/reward-status/handler.ts';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const PROMISE_ID = '22222222-2222-4222-8222-222222222222';
const INTENT_ID = '33333333-3333-4333-8333-333333333333';
const LEASE_ID = '44444444-4444-4444-8444-444444444444';

const ENTITLEMENTS = {
  promise_id: PROMISE_ID,
  my_role: 'CREATOR',
  witness: {
    creator_capacity: 1,
    partner_capacity: 0,
    creator_used: 0,
    partner_used: 0,
    max: 3,
  },
  duration: { ceiling_date: '2026-09-28', unlimited: false },
  retention: { anchor_at: null, expires_at: null, permanent: false, renewable: false },
} as const;

function deps(payload: unknown): { value: Deps; calls: { fn: string; args: Record<string, unknown> }[] } {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    value: {
      authenticate: async () => ACTOR,
      rpc: async (fn, args) => {
        calls.push({ fn, args });
        return payload;
      },
      secrets: { invitePepper: 'unused', piiSalt: 'unused' },
      log: { error: () => undefined },
      now: () => new Date('2026-08-29T00:00:00Z'),
    },
  };
}

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://ref.supabase.co/functions/v1/${path}`, {
    method: 'POST',
    headers: { authorization: 'Bearer jwt', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('monetization Edge shells', () => {
  test('promise-entitlements authenticates and strictly parses the RPC response', async () => {
    const spy = deps(ENTITLEMENTS);
    const response = await createPromiseEntitlementsHandler(spy.value)(
      post('promise-entitlements', { promise_id: PROMISE_ID }),
    );
    expect(response.status).toBe(200);
    expect(spy.calls).toEqual([{
      fn: 'lf_promise_entitlements',
      args: { p_actor: ACTOR, p_promise_id: PROMISE_ID },
    }]);
  });

  test('reward intent accepts only the four server actions', async () => {
    const spy = deps({
      intent_id: INTENT_ID,
      status: 'PENDING',
      opaque_user_id: 'a'.repeat(64),
      expires_at: '2026-08-29T00:15:00.000Z',
    });
    const valid = await createRewardIntentHandler(spy.value)(post('reward-intent-create', {
      promise_id: PROMISE_ID,
      action: 'DURATION_30D',
    }));
    expect(valid.status).toBe(200);
    expect(spy.calls[0]).toEqual({
      fn: 'lf_reward_intent_create',
      args: { p_actor: ACTOR, p_promise_id: PROMISE_ID, p_action: 'DURATION_30D' },
    });

    const invalid = await createRewardIntentHandler(spy.value)(post('reward-intent-create', {
      promise_id: PROMISE_ID,
      action: 'FREE_MONEY',
    }));
    expect(invalid.status).toBe(422);
    expect((await invalid.json())['field']).toBe('action');
  });

  test('status uses the authenticated actor and intent only', async () => {
    const payload = { intent_id: INTENT_ID, status: 'GRANTED', entitlements: ENTITLEMENTS };
    const statusSpy = deps(payload);
    expect((await createRewardStatusHandler(statusSpy.value)(
      post('reward-status', { intent_id: INTENT_ID }),
    )).status).toBe(200);
    expect(statusSpy.calls).toEqual([{
      fn: 'lf_reward_status',
      args: { p_actor: ACTOR, p_intent_id: INTENT_ID },
    }]);
  });
});

describe('reward-callback', () => {
  const T0 = Date.parse('2026-08-29T00:00:00Z');
  const HOUR_MS = 60 * 60 * 1_000;
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const signedQuery = new URLSearchParams({
    ad_unit: 'allowed-unit',
    custom_data: INTENT_ID,
    user_id: 'a'.repeat(64),
    transaction_id: 'transaction-1',
    timestamp: '1787961600000',
  }).toString();
  const signature = createSign('SHA256').update(signedQuery).sign(privateKey).toString('base64url');
  const callbackUrl = (query: string, keyId: number): string =>
    `https://ref.supabase.co/functions/v1/reward-callback?${query}&signature=${signature}&key_id=${keyId}`;
  const signedCallbackUrl = (query: string, keyId: number): string => {
    const querySignature = createSign('SHA256').update(query).sign(privateKey).toString('base64url');
    return `https://ref.supabase.co/functions/v1/reward-callback?${query}&signature=${querySignature}&key_id=${keyId}`;
  };

  function keyCache(clock: () => number) {
    const fetchJson = vi.fn().mockResolvedValue({ keys: [{ keyId: 7, pem }] });
    return { fetchJson, cache: createVerifierKeyCache({ fetchJson, now: clock }) };
  }

  test('Google verifier key cache expires within 24 hours', async () => {
    let clock = T0;
    const { fetchJson, cache } = keyCache(() => clock);
    await cache.keys();
    await cache.keys();
    expect(fetchJson).toHaveBeenCalledTimes(1);
    clock = T0 + 24 * HOUR_MS;
    await cache.keys();
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  test('Google 형식 ECDSA 서명과 허용 광고 단위를 검증한 뒤에만 SSV를 부여한다', async () => {
    const rpc = vi.fn().mockResolvedValue({ granted: true });
    const handler = createRewardCallbackHandler({
      rpc,
      verifierKeys: { keys: async () => [{ keyId: 7, pem }], refresh: async () => [] },
      allowedAdUnits: new Set(['allowed-unit']),
      log: { error: () => undefined },
    });
    const response = await handler(new Request(callbackUrl(signedQuery, 7)));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('lf_reward_grant', {
      p_intent_id: INTENT_ID,
      p_opaque_user_id: 'a'.repeat(64),
      p_source: 'ADMOB_SSV',
      p_transaction_id: 'transaction-1',
      p_ad_unit_id: 'allowed-unit',
      p_rewarded_at: '2026-08-29T00:00:00.000Z',
    });
  });

  test('AdMob 콘솔의 서명된 고정 확인 요청은 지급 없이 200으로 응답한다', async () => {
    const rpc = vi.fn();
    const probeQuery = new URLSearchParams({
      ad_network: '5450213213286189855',
      ad_unit: '1234567890',
      custom_data: '00000000-0000-4000-8000-000000000000',
      reward_amount: '1',
      reward_item: 'Reward',
      timestamp: '1788099245844',
      transaction_id: '123456789',
      user_id: '0'.repeat(64),
    }).toString();
    const handler = createRewardCallbackHandler({
      rpc,
      verifierKeys: { keys: async () => [{ keyId: 7, pem }], refresh: async () => [] },
      allowedAdUnits: new Set(),
      log: { error: () => undefined },
    });

    const response = await handler(new Request(signedCallbackUrl(probeQuery, 7)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ granted: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  test('signature verification failure never reaches the grant RPC', async () => {
    const rpc = vi.fn();
    const keys = vi.fn().mockResolvedValue([]);
    const refresh = vi.fn().mockResolvedValue([]);
    const handler = createRewardCallbackHandler({
      rpc,
      verifierKeys: { keys, refresh },
      allowedAdUnits: new Set(['allowed-unit']),
      log: { error: () => undefined },
    });
    const response = await handler(new Request(
      'https://ref.supabase.co/functions/v1/reward-callback?transaction_id=fake',
    ));
    expect(response.status).toBe(401);
    // key_id 가 없는 요청은 키 회전의 증거가 아니다 — 재조회 없이 캐시 한 번만 읽는다.
    expect(keys).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  test('서명 뒤에 파라미터 하나를 바꾸면 401 이고 RPC 에 닿지 않는다', async () => {
    const rpc = vi.fn();
    const handler = createRewardCallbackHandler({
      rpc,
      verifierKeys: { keys: async () => [{ keyId: 7, pem }], refresh: async () => [] },
      allowedAdUnits: new Set(['allowed-unit']),
      log: { error: () => undefined },
    });
    const tampered = signedQuery.replace('transaction-1', 'transaction-2');
    expect(tampered).not.toBe(signedQuery);
    const response = await handler(new Request(callbackUrl(tampered, 7)));
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  test('아는 key_id 로 서명이 틀리면 Google 을 다시 부르지 않는다', async () => {
    const { fetchJson, cache } = keyCache(() => T0);
    const handler = createRewardCallbackHandler({
      rpc: vi.fn(),
      verifierKeys: cache,
      allowedAdUnits: new Set(['allowed-unit']),
      log: { error: () => undefined },
    });
    const tampered = signedQuery.replace('transaction-1', 'transaction-2');
    expect((await handler(new Request(callbackUrl(tampered, 7)))).status).toBe(401);
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  test('모르는 key_id 는 60초에 한 번만 재조회한다', async () => {
    let clock = T0;
    const { fetchJson, cache } = keyCache(() => clock);
    const handler = createRewardCallbackHandler({
      rpc: vi.fn(),
      verifierKeys: cache,
      allowedAdUnits: new Set(['allowed-unit']),
      log: { error: () => undefined },
    });
    const unknownKey = new Request(callbackUrl(signedQuery, 99));
    expect((await handler(unknownKey)).status).toBe(401);
    // 최초 캐시 채우기 1회 + 강제 재조회 1회.
    expect(fetchJson).toHaveBeenCalledTimes(2);
    clock = T0 + 30_000;
    expect((await handler(unknownKey)).status).toBe(401);
    expect(fetchJson).toHaveBeenCalledTimes(2);
    clock = T0 + 61_000;
    expect((await handler(unknownKey)).status).toBe(401);
    expect(fetchJson).toHaveBeenCalledTimes(3);
  });

  describe('derToP1363', () => {
    const der = (r: number[], s: number[]): Uint8Array => {
      const body = [0x02, r.length, ...r, 0x02, s.length, ...s];
      return Uint8Array.from([0x30, body.length, ...body]);
    };
    // r 은 최상위 비트가 서 있어 DER 이 0x00 을 앞에 붙인 33바이트, s 는 31바이트다.
    const R = [0x00, 0x80, ...Array<number>(31).fill(0x11)];
    const S = Array<number>(31).fill(0x22);

    test('앞의 0x00 은 떼고 짧은 정수는 왼쪽을 0 으로 채워 32바이트씩 맞춘다', () => {
      expect([...derToP1363(der(R, S))]).toEqual([
        0x80, ...Array<number>(31).fill(0x11),
        0x00, ...Array<number>(31).fill(0x22),
      ]);
    });

    test('뒤에 바이트가 남으면 던진다', () => {
      expect(() => derToP1363(Uint8Array.from([...der(R, S), 0x00]))).toThrow('INVALID_DER_SIGNATURE');
    });

    test('SEQUENCE 태그가 아니면 던진다', () => {
      const wrongTag = der(R, S);
      wrongTag[0] = 0x31;
      expect(() => derToP1363(wrongTag)).toThrow('INVALID_DER_SIGNATURE');
    });
  });
});

describe('retention-maintenance Edge worker', () => {
  test('shared secret gates maintenance, storage deletion, and purge finalize', async () => {
    const calls: string[] = [];
    const remove = vi.fn().mockResolvedValue(undefined);
    const handler = createRetentionMaintenanceHandler({
      workerSecret: 'worker-secret',
      storage: { remove },
      now: () => new Date('2026-08-29T00:00:00Z'),
      log: { error: () => undefined },
      rpc: async (fn) => {
        calls.push(fn);
        if (fn === 'lf_retention_maintenance') return { warned: 0, queued: 1 };
        if (fn === 'lf_purge_job_claim') return {
          items: [{ promise_id: PROMISE_ID, lease_id: LEASE_ID, storage_keys: ['a.jpg'] }],
        };
        return true;
      },
    });
    const denied = await handler(post('retention-maintenance', {}, {
      'x-retention-worker-secret': 'wrong-secret',
    }));
    expect(denied.status).toBe(401);
    const response = await handler(post('retention-maintenance', {}, {
      'x-retention-worker-secret': 'worker-secret',
    }));
    expect(response.status).toBe(200);
    expect(calls).toEqual([
      'lf_retention_maintenance',
      'lf_purge_job_claim',
      'lf_purge_job_finalize',
    ]);
    expect(remove).toHaveBeenCalledWith('fulfillment-evidences', ['a.jpg']);
  });

  test('형태가 어긋난 작업은 건너뛰고 나머지는 계속 지운다', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const logged: unknown[] = [];
    const finalized: Record<string, unknown>[] = [];
    const handler = createRetentionMaintenanceHandler({
      workerSecret: 'worker-secret',
      storage: { remove },
      now: () => new Date('2026-08-29T00:00:00Z'),
      log: { error: (_message, detail) => logged.push(detail) },
      rpc: async (fn, args) => {
        if (fn === 'lf_retention_maintenance') return { warned: 0, queued: 0 };
        if (fn === 'lf_purge_job_claim') return {
          items: [
            { promise_id: 'not-a-uuid', lease_id: LEASE_ID, storage_keys: ['b.jpg'] },
            { promise_id: PROMISE_ID, lease_id: LEASE_ID, storage_keys: [1] },
            { promise_id: PROMISE_ID, lease_id: LEASE_ID, storage_keys: ['a.jpg'] },
          ],
        };
        finalized.push(args);
        return true;
      },
    });
    const response = await handler(post('retention-maintenance', {}, {
      'x-retention-worker-secret': 'worker-secret',
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ claimed_count: 3, purged_count: 1, failed_count: 2 });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('fulfillment-evidences', ['a.jpg']);
    expect(finalized).toEqual([{
      p_promise_id: PROMISE_ID,
      p_lease_id: LEASE_ID,
      p_now: '2026-08-29T00:00:00.000Z',
    }]);
    expect(logged).toEqual(['INVALID_PURGE_JOB', 'INVALID_PURGE_JOB']);
  });
});
