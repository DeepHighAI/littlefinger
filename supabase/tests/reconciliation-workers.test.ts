import { describe, expect, test, vi } from 'vitest';

import { createAccountDeleteRetryHandler } from '../functions/account-delete-retry/handler.ts';
import { createPurchaseReconcileHandler } from '../functions/purchase-reconcile/handler.ts';

const NOW = new Date('2026-08-27T00:00:00Z');

function internalRequest(header: string, secret: string): Request {
  return new Request('https://ref.supabase.co/functions/v1/internal-worker', {
    method: 'POST',
    headers: { [header]: secret },
    body: '{}',
  });
}

const log = { error: vi.fn() };

describe('purchase-reconcile', () => {
  test('공유 비밀을 검증하고 최근 voided 구매를 멱등 회수 RPC로 전달한다', async () => {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const handler = createPurchaseReconcileHandler({
      reconcileSecret: 'reconcile-secret',
      now: () => NOW,
      log,
      listVoidedPurchases: vi.fn().mockResolvedValue([
        {
          purchaseToken: 'token-a',
          voidedTimeMillis: '1787788800000',
          voidedSource: 1,
          voidedReason: 1,
        },
        {
          purchaseToken: 'token-b',
          voidedTimeMillis: '1787788800000',
          voidedSource: 0,
          voidedReason: 0,
        },
      ]),
      rpc: async (fn, args) => {
        calls.push({ fn, args });
        return calls.length === 1;
      },
    });

    const response = await handler(
      internalRequest('x-purchase-reconcile-secret', 'reconcile-secret'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ checked_count: 2, revoked_count: 1 });
    expect(calls.map((call) => call.fn)).toEqual(['lf_slot_revoke', 'lf_slot_revoke']);
    expect(calls[0]?.args).toMatchObject({
      p_purchase_token: 'token-a',
      p_voided_source: 1,
      p_voided_reason: 1,
    });
  });

  test('공유 비밀이 다르면 Google과 DB를 호출하지 않는다', async () => {
    const listVoidedPurchases = vi.fn();
    const rpc = vi.fn();
    const response = await createPurchaseReconcileHandler({
      reconcileSecret: 'right-secret',
      now: () => NOW,
      log,
      listVoidedPurchases,
      rpc,
    })(internalRequest('x-purchase-reconcile-secret', 'wrong-secret'));

    expect(response.status).toBe(401);
    expect(listVoidedPurchases).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('account-delete-retry', () => {
  test('성공은 완료 처리하고 Auth 장애는 다음 시도로 되돌린다', async () => {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const deleteAuthUser = vi.fn(async (userId: string) => {
      if (userId === 'user-b') throw new Error('AUTH_UNAVAILABLE');
    });
    const handler = createAccountDeleteRetryHandler({
      retrySecret: 'delete-secret',
      now: () => NOW,
      log,
      deleteAuthUser,
      rpc: async (fn, args) => {
        calls.push({ fn, args });
        if (fn === 'lf_auth_deletion_claim') {
          return {
            items: [
              { user_id: 'user-a', lease_id: 'lease-a' },
              { user_id: 'user-b', lease_id: 'lease-b' },
            ],
          };
        }
        return true;
      },
    });

    const response = await handler(
      internalRequest('x-account-delete-retry-secret', 'delete-secret'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      claimed_count: 2,
      deleted_count: 1,
      retry_count: 1,
    });
    expect(calls.map((call) => call.fn)).toEqual([
      'lf_auth_deletion_claim',
      'lf_auth_deletion_complete',
      'lf_auth_deletion_retry',
    ]);
    expect(calls[2]?.args).toMatchObject({ p_error: 'AUTH_UNAVAILABLE' });
  });
});
