// promise-amend — 02 §4-3-4, T-05 (PENDING → DRAFT).
//
// 이 함수는 EC-B10 의 출구이기도 하다. 종료일이 지난 약속은 승인할 수 없고 수정 제안만
// 가능하므로, 여기에 종료일 가드를 달면 약속이 PENDING 에 영구히 갇힌다. RPC 쪽에 그
// 이유가 적혀 있고 테스트 세 개가 붙들고 있다 — 껍데기도 종료일을 보지 않는다.

import type { Deps } from '../_shared/deps.ts';
import { requiredString } from '../_shared/request.ts';
import { createTransitionHandler } from '../_shared/transition.ts';

/** §5-3 의 문구 원문. 필수 5~300자. */
export const AMEND_VALIDATION = {
  field: 'amend_suggestion',
  message: '어떤 부분을 바꾸고 싶은지 알려주세요.',
} as const;

export function createAmendHandler(deps: Deps) {
  return createTransitionHandler(
    {
      rpc: 'lf_promise_amend_suggest',
      event: 'NT-03',
      validation: AMEND_VALIDATION,
      extraArgs: (body) => ({
        p_comment: requiredString(body, 'comment', 'amend_suggestion'),
      }),
    },
    deps,
  );
}
