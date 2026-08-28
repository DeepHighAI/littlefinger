import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import type { GoogleVoidedPurchase } from './google.ts';

// Google 이 받아주는 창은 30일이고, 정확히 30일을 보내면 요청이 처리되는 사이에 흐른
// 시간만큼 이미 범위 밖이다. 하루를 빼서 경계에서 물러선다 — 원장 PK 가 겹침을 흡수하므로
// 창이 좁아져도 놓치는 구매는 없다.
const RECONCILE_WINDOW_DAYS = 29;

export interface PurchaseReconcileDeps extends Pick<Deps, 'rpc' | 'log' | 'now'> {
  reconcileSecret: string;
  listVoidedPurchases: (
    startTimeMs: number,
    endTimeMs: number,
  ) => Promise<GoogleVoidedPurchase[]>;
}

function secretsMatch(actual: string | null, expected: string): boolean {
  if (actual === null || actual.length !== expected.length || expected.length === 0) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export function createPurchaseReconcileHandler(deps: PurchaseReconcileDeps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (
        request.method !== 'POST' ||
        !secretsMatch(
          request.headers.get('x-purchase-reconcile-secret'),
          deps.reconcileSecret,
        )
      ) {
        throw new ApiError('E_AUTH_REQUIRED');
      }

      const endTimeMs = deps.now().getTime();
      const startTimeMs = endTimeMs - RECONCILE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      const purchases = await deps.listVoidedPurchases(startTimeMs, endTimeMs);
      let revokedCount = 0;

      for (const purchase of purchases) {
        const voidedAt = new Date(Number(purchase.voidedTimeMillis));
        if (Number.isNaN(voidedAt.getTime())) throw new Error('INVALID_VOIDED_TIME');
        const inserted = await deps.rpc('lf_slot_revoke', {
          p_purchase_token: purchase.purchaseToken,
          p_voided_at: voidedAt.toISOString(),
          p_voided_source: purchase.voidedSource,
          p_voided_reason: purchase.voidedReason,
        });
        if (inserted === true) revokedCount += 1;
      }

      return jsonResponse({ checked_count: purchases.length, revoked_count: revokedCount }, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
