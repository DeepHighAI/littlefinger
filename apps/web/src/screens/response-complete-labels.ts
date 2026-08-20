import type { Localized } from '@littlefinger/shared';

import { RESPONSE_OUTCOME, type ResponseOutcome } from '../routes.ts';

/**
 * 거절·수정 제안 종결 화면 문구.
 *
 * ko 두 문장은 PO 승인 원문 그대로다(PO 2026-07-29). en 은 앱 INVITE_REVIEW_LABEL 의
 * doneDeclined · doneAmendSuggested 와 문자 그대로 같아야 한다 — 같은 종결을 앱에서
 * 보든 웹에서 보든 같은 문장을 만나야 한다.
 */
const ko = {
  outcomeMessage: {
    [RESPONSE_OUTCOME.declined]: '거절했어요. 작성자에게 알려드릴게요.',
    [RESPONSE_OUTCOME.amendSuggested]:
      '수정 제안을 보냈어요. 작성자가 내용을 고쳐 다시 보내면 알림을 받게 돼요.',
  } satisfies Record<ResponseOutcome, string>,
};

const en = {
  outcomeMessage: {
    [RESPONSE_OUTCOME.declined]: 'Declined. We will let the creator know.',
    [RESPONSE_OUTCOME.amendSuggested]:
      'Suggestion sent. You will be notified when the creator updates the promise.',
  },
} satisfies typeof ko;

export const RESPONSE_COMPLETE_LABEL: Localized<typeof ko> = { ko, en };
