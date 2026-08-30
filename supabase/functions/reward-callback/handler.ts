import type { Deps } from '../_shared/deps.ts';
import { corsPreflight, jsonResponse } from '../_shared/http.ts';
import type { VerifierKeyCache } from './keys.ts';
import { ssvKeyIdOf, verifySsvCallback } from './ssv.ts';

export interface RewardCallbackDeps extends Pick<Deps, 'rpc' | 'log'> {
  allowedAdUnits: ReadonlySet<string>;
  verifierKeys: VerifierKeyCache;
}

export function createRewardCallbackHandler(deps: RewardCallbackDeps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    if (request.method !== 'GET') return jsonResponse({ granted: false }, 401);
    try {
      let keys = await deps.verifierKeys.keys();
      let callback = await verifySsvCallback(request.url, keys, deps.allowedAdUnits);
      // 재조회는 캐시에 없는 key_id 에만 허용한다. 아는 키로 서명이 틀린 요청은 위조이지
      // 키 회전이 아니고, 그런 요청마다 Google 을 부르면 이 공개 GET 이 증폭기가 된다.
      const keyId = ssvKeyIdOf(request.url);
      if (callback === null && keyId !== null && !keys.some((key) => key.keyId === keyId)) {
        keys = await deps.verifierKeys.refresh();
        callback = await verifySsvCallback(request.url, keys, deps.allowedAdUnits);
      }
      if (callback === null) return jsonResponse({ granted: false }, 401);
      const result = await deps.rpc('lf_reward_grant', {
        p_intent_id: callback.intentId,
        p_opaque_user_id: callback.opaqueUserId,
        p_source: 'ADMOB_SSV',
        p_transaction_id: callback.transactionId,
        p_ad_unit_id: callback.adUnitId,
        // Google 이 서명한 시각이다. 서버 now() 를 넣으면 지연 도착한 콜백이 의도 TTL 을 어긴다.
        p_rewarded_at: callback.rewardedAt,
      });
      return jsonResponse(result, 200);
    } catch {
      // 원인은 Google 응답이거나 RPC 메시지라 값을 담을 수 있다 — 고정 분류만 남긴다.
      deps.log.error('reward callback failed', 'REWARD_CALLBACK_FAILED');
      return jsonResponse({ granted: false }, 500);
    }
  };
}
