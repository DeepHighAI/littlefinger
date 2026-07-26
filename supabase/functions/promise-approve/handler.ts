// promise-approve — 02 §4-3-5, T-03 (PENDING → ACTIVE).
//
// 껍데기가 하는 일은 JWT → 검증 → `lf_promise_approve` → 에러 매핑 → NT-01 이 전부다.
// 확정 10단계와 `content_hash` 생성은 전부 RPC 안에서 한 트랜잭션으로 돈다(ADR 0003).

import type { Deps } from '../_shared/deps.ts';
import { createTransitionHandler } from '../_shared/transition.ts';

/**
 * 이 함수에서 `E_VALIDATION` 은 **종료일 경과 하나뿐**이다 — 승인에는 사용자가 입력하는
 * 필드가 없어서 다른 원인이 존재할 수 없다.
 *
 * EC-B10 이 지정한 출구를 `action` 으로 실어 보낸다. 필드 이름만으로는 "[종료일 변경
 * 요청하기] 버튼을 띄우라"를 표현할 수 없고, 그 버튼이 없으면 종료일이 지난 약속은
 * PENDING 에 갇힌다.
 */
export const APPROVE_VALIDATION = {
  field: 'end_date',
  message: '종료일이 지난 약속은 승인할 수 없어요. 작성자에게 종료일 변경을 요청해 주세요.',
  action: 'AMEND_SUGGEST',
} as const;

export function createApproveHandler(deps: Deps) {
  return createTransitionHandler(
    {
      rpc: 'lf_promise_approve',
      event: 'NT-01',
      validation: APPROVE_VALIDATION,
      // 승인은 본문이 토큰뿐이다.
      extraArgs: () => ({}),
    },
    deps,
  );
}
