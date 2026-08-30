import { describe, expect, test } from 'vitest';

import type { Deps } from '../functions/_shared/deps.ts';
import { createGoogleVoidedPurchaseLister } from '../functions/purchase-reconcile/google.ts';
import type { GoogleProductPurchase } from '../functions/purchase-verify/google.ts';
import { createGooglePurchaseVerifier } from '../functions/purchase-verify/google.ts';
import { createPurchaseVerifyHandler } from '../functions/purchase-verify/handler.ts';
import { createSlotStatusHandler } from '../functions/slot-status/handler.ts';

/**
 * 유료 슬롯 껍데기 (PO 2026-08-24) — slot-status · purchase-verify.
 *
 * 부여의 근거는 서버가 Google 에 직접 물어본 결과뿐이다. 이 파일은 그 판정 순서(상품 →
 * 영수증 → 상태 → 계정 바인딩)와, 실패 응답이 위조 시도에 진행률을 알려주지 않는 것을 못박는다.
 */

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';

const PURCHASE_OK: GoogleProductPurchase = {
  purchaseState: 0,
  orderId: 'GPA.1234-5678',
  purchaseTimeMillis: '1756000000000',
  obfuscatedExternalAccountId: ACTOR_ID,
  obfuscatedExternalProfileId: null,
};

interface Spy {
  deps: Deps;
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
}

function spy(options: { payload?: unknown } = {}): Spy {
  const rpcCalls: Spy['rpcCalls'] = [];
  return {
    rpcCalls,
    deps: {
      authenticate: async () => ACTOR_ID,
      rpc: async (fn, args) => {
        rpcCalls.push({ fn, args });
        return options.payload ?? { capacity: 6, used: 5 };
      },
      secrets: { invitePepper: 'unused', piiSalt: 'unused' },
      log: { error: () => {} },
      now: () => new Date('2026-08-24T00:00:00Z'),
    },
  };
}

function request(body: unknown, method = 'POST'): Request {
  return new Request('https://ref.supabase.co/functions/v1/purchase-verify', {
    method,
    headers: { 'content-type': 'application/json', authorization: 'Bearer jwt' },
    ...(method === 'OPTIONS' ? {} : { body: JSON.stringify(body) }),
  });
}

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════════
// slot-status
// ══════════════════════════════════════════════════════════════

describe('slot-status', () => {
  test('빈 본문 POST 로 현황을 돌려준다', async () => {
    const { deps, rpcCalls } = spy({ payload: { capacity: 5, used: 2 } });
    const response = await createSlotStatusHandler(deps)(request({}));

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toEqual({ capacity: 5, used: 2 });
    expect(rpcCalls).toEqual([{ fn: 'lf_slot_status', args: { p_actor: ACTOR_ID } }]);
  });

  test('본문에 무엇이든 실려 오면 E_VALIDATION 이다', async () => {
    const { deps } = spy();
    const response = await createSlotStatusHandler(deps)(request({ extra: true }));
    expect(response.status).toBe(422);
  });

  test('RPC 응답이 형태를 벗어나면 500 이다', async () => {
    const { deps } = spy({ payload: { capacity: 'many', used: 0 } });
    const response = await createSlotStatusHandler(deps)(request({}));
    expect(response.status).toBe(500);
    expect((await jsonOf(response))['code']).toBe('E_INTERNAL');
  });
});

// ══════════════════════════════════════════════════════════════
// purchase-verify
// ══════════════════════════════════════════════════════════════

function purchaseHandler(
  base: Spy,
  verifyPurchase: (
    productId: string,
    purchaseToken: string,
  ) => Promise<GoogleProductPurchase | null>,
) {
  return createPurchaseVerifyHandler({ ...base.deps, verifyPurchase });
}

const BODY = { product_id: 'promise_slot_plus1', purchase_token: 'play-token' };

describe('purchase-verify', () => {
  test('검증 통과 → lf_slot_grant → 현황 응답', async () => {
    const base = spy({ payload: { capacity: 6, used: 5 } });
    const verified: string[][] = [];
    const handle = purchaseHandler(base, async (productId, token) => {
      verified.push([productId, token]);
      return PURCHASE_OK;
    });

    const response = await handle(request(BODY));

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toEqual({ capacity: 6, used: 5 });
    expect(verified).toEqual([['promise_slot_plus1', 'play-token']]);
    expect(base.rpcCalls).toEqual([
      {
        fn: 'lf_slot_grant',
        args: {
          p_user_id: ACTOR_ID,
          p_product_id: 'promise_slot_plus1',
          p_order_id: 'GPA.1234-5678',
          p_purchase_token: 'play-token',
          p_purchase_time: new Date(1756000000000).toISOString(),
        },
      },
    ]);
  });

  test('구매 시각이 없으면 서버 시각으로 기록한다', async () => {
    const base = spy();
    const handle = purchaseHandler(base, async () => ({
      ...PURCHASE_OK,
      purchaseTimeMillis: null,
    }));

    await handle(request(BODY));

    expect(base.rpcCalls[0]?.args['p_purchase_time']).toBe('2026-08-24T00:00:00.000Z');
  });

  test('파는 상품이 아니면 Google 에 묻지도 않는다', async () => {
    const base = spy();
    let called = false;
    const handle = purchaseHandler(base, async () => {
      called = true;
      return PURCHASE_OK;
    });

    const response = await handle(request({ ...BODY, product_id: 'premium_theme' }));

    expect(response.status).toBe(422);
    expect((await jsonOf(response))['field']).toBe('product_id');
    expect(called).toBe(false);
    expect(base.rpcCalls).toEqual([]);
  });

  test('영구 보관 상품의 promise_id 가 UUID 가 아니면 Google 에 묻지도 않는다', async () => {
    const base = spy();
    let called = false;
    const handle = purchaseHandler(base, async () => {
      called = true;
      return PURCHASE_OK;
    });

    const response = await handle(request({
      ...BODY,
      product_id: 'promise_permanent_access',
      promise_id: 'not-a-uuid',
    }));

    expect(response.status).toBe(422);
    expect((await jsonOf(response))['field']).toBe('promise_id');
    expect(called).toBe(false);
    expect(base.rpcCalls).toEqual([]);
  });

  test.each([
    ['없는 영수증', null],
    ['취소된 구매', { ...PURCHASE_OK, purchaseState: 1 }],
    ['대기 중 구매', { ...PURCHASE_OK, purchaseState: 2 }],
    ['주문 ID 없음', { ...PURCHASE_OK, orderId: null }],
    ['남의 계정 영수증', { ...PURCHASE_OK, obfuscatedExternalAccountId: 'other-user' }],
    ['계정 바인딩 없음', { ...PURCHASE_OK, obfuscatedExternalAccountId: null }],
  ])('%s 은 같은 E_VALIDATION 이고 부여하지 않는다', async (_label, purchase) => {
    const base = spy();
    const handle = purchaseHandler(base, async () => purchase);

    const response = await handle(request(BODY));

    expect(response.status).toBe(422);
    expect((await jsonOf(response))['field']).toBe('purchase_token');
    expect(base.rpcCalls).toEqual([]);
  });

  test('Google 쪽 장애는 500 이다 — 사용자 영수증 문제가 아니다', async () => {
    const base = spy();
    const handle = purchaseHandler(base, async () => {
      throw new Error('GOOGLE_PLAY_API_503');
    });

    const response = await handle(request(BODY));

    expect(response.status).toBe(500);
    expect((await jsonOf(response))['code']).toBe('E_INTERNAL');
  });

  test('필수 필드가 빠지면 E_VALIDATION 이다', async () => {
    const base = spy();
    const handle = purchaseHandler(base, async () => PURCHASE_OK);

    const response = await handle(request({ product_id: 'promise_slot_plus1' }));

    expect(response.status).toBe(422);
    expect((await jsonOf(response))['field']).toBe('purchase_token');
  });
});

// ══════════════════════════════════════════════════════════════
// Google 검증기 — 실제 서명 + 모의 fetch
// ══════════════════════════════════════════════════════════════

async function testServiceAccountJson(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ['sign', 'verify'],
  );
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  let binary = '';
  for (const byte of der) binary += String.fromCharCode(byte);
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(binary)}\n-----END PRIVATE KEY-----\n`;
  return JSON.stringify({ client_email: 'svc@test.iam.gserviceaccount.com', private_key: pem });
}

function fetchStub(purchaseResponse: () => Response): { calls: Request[]; impl: typeof fetch } {
  const calls: Request[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    calls.push(req);
    if (req.url.startsWith('https://oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'ya29.test' }), { status: 200 });
    }
    return purchaseResponse();
  }) as typeof fetch;
  return { calls, impl };
}

describe('createGooglePurchaseVerifier', () => {
  test('서명 → 토큰 교환 → 구매 조회 순서로 부르고 필드를 추린다', async () => {
    const { calls, impl } = fetchStub(
      () =>
        new Response(
          JSON.stringify({
            purchaseState: 0,
            orderId: 'GPA.9',
            purchaseTimeMillis: '1756000000000',
            obfuscatedExternalAccountId: ACTOR_ID,
            kind: 'androidpublisher#productPurchase',
          }),
          { status: 200 },
        ),
    );
    const verify = createGooglePurchaseVerifier({
      serviceAccountJson: await testServiceAccountJson(),
      packageName: 'com.littlefinger.app',
      fetchImpl: impl,
      now: () => new Date('2026-08-24T00:00:00Z'),
    });

    const purchase = await verify('promise_slot_plus1', 'the-token');

    expect(purchase).toEqual({
      purchaseState: 0,
      orderId: 'GPA.9',
      purchaseTimeMillis: '1756000000000',
      obfuscatedExternalAccountId: ACTOR_ID,
      obfuscatedExternalProfileId: null,
    });
    expect(calls).toHaveLength(2);
    const assertion = new URLSearchParams(await calls[0]!.clone().text()).get('assertion');
    // RS256 JWT 세 조각 — 헤더.클레임.서명
    expect(assertion?.split('.')).toHaveLength(3);
    expect(calls[1]!.url).toContain('/applications/com.littlefinger.app/purchases/products/');
    expect(calls[1]!.url).toContain('/tokens/the-token');
    expect(calls[1]!.headers.get('authorization')).toBe('Bearer ya29.test');
  });

  test('404 는 null — 사용자 영수증 문제로 분류된다', async () => {
    const { impl } = fetchStub(() => new Response('{}', { status: 404 }));
    const verify = createGooglePurchaseVerifier({
      serviceAccountJson: await testServiceAccountJson(),
      packageName: 'com.littlefinger.app',
      fetchImpl: impl,
    });

    expect(await verify('promise_slot_plus1', 'gone')).toBeNull();
  });

  test('5xx 는 throw — 재시도할 우리 쪽 사정이다', async () => {
    const { impl } = fetchStub(() => new Response('{}', { status: 503 }));
    const verify = createGooglePurchaseVerifier({
      serviceAccountJson: await testServiceAccountJson(),
      packageName: 'com.littlefinger.app',
      fetchImpl: impl,
    });

    await expect(verify('promise_slot_plus1', 'x')).rejects.toThrow('GOOGLE_PLAY_API_503');
  });
});

describe('createGoogleVoidedPurchaseLister', () => {
  test('OAuth는 한 번만 받고 nextPageToken 끝까지 순회한다', async () => {
    const calls: Request[] = [];
    let page = 0;
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      calls.push(request);
      if (request.url.startsWith('https://oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'ya29.voided' }), { status: 200 });
      }
      page += 1;
      return new Response(JSON.stringify(page === 1 ? {
        voidedPurchases: [{
          purchaseToken: 'token-a',
          voidedTimeMillis: '1787788800000',
          voidedSource: 1,
          voidedReason: 1,
        }],
        tokenPagination: { nextPageToken: 'next' },
      } : {
        voidedPurchases: [{
          purchaseToken: 'token-b',
          voidedTimeMillis: '1787788801000',
          voidedSource: 0,
          voidedReason: 0,
        }],
      }), { status: 200 });
    }) as typeof fetch;
    const list = createGoogleVoidedPurchaseLister({
      serviceAccountJson: await testServiceAccountJson(),
      packageName: 'com.littlefinger.app',
      fetchImpl,
      now: () => new Date('2026-08-27T00:00:00Z'),
    });

    const purchases = await list(1785196800000, 1787788800000);

    expect(purchases.map((item) => item.purchaseToken)).toEqual(['token-a', 'token-b']);
    expect(calls).toHaveLength(3);
    expect(calls[2]?.url).toContain('pageSelection.token=next');
    expect(calls[1]?.headers.get('authorization')).toBe('Bearer ya29.voided');
  });
});
