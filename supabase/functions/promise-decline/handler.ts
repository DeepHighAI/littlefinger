// promise-decline — 02 §4-3-4, T-04 (PENDING → DECLINED).

import type { Deps } from '../_shared/deps.ts';
import { optionalString } from '../_shared/request.ts';
import { createTransitionHandler } from '../_shared/transition.ts';

/**
 * §5-3 은 거절 사유에 문구를 주지 않았다(선택 필드, 0~200자). 지어내지 않고 `null` 로 둬서
 * 공통 문구로 떨어뜨린다 — `packages/shared/src/validation.ts` 가 §5 문구 없는 필드에 쓰는
 * 규칙과 같다.
 */
export const DECLINE_VALIDATION = {
  field: 'decline_reason',
  message: null,
} as const;

export function createDeclineHandler(deps: Deps) {
  return createTransitionHandler(
    {
      rpc: 'lf_promise_decline',
      event: 'NT-02',
      validation: DECLINE_VALIDATION,
      // 선택 필드다. 없으면 NULL 을 넘기고 RPC 가 `nullif(정규화, '')` 로 마무리한다.
      extraArgs: (body) => ({ p_reason: optionalString(body, 'reason', 'decline_reason') }),
    },
    deps,
  );
}
