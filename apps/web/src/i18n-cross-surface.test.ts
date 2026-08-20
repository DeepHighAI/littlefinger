import { describe, expect, it } from 'vitest';

import { INVITE_REVIEW_LABEL } from '../../mobile/src/screens/invite-review-labels.ts';
import { RESPONSE_COMPLETE_LABEL } from './screens/response-complete-labels.ts';
import { SCR_W06_LABEL } from './screens/scr-w06-labels.ts';

/**
 * 표면 간 카피 계약.
 *
 * 같은 초대가 앱(EC-I01 인앱 검토)에서도 웹(SCR-W01…W06)에서도 열린다. 같은 실패·같은
 * 종결을 어느 쪽에서 만나든 **같은 문장**을 읽어야 한다 — 두 카탈로그가 따로 있으니
 * 한쪽만 고치는 드리프트는 눈에 띄지 않고 남는다. 그 드리프트를 여기서 깬다.
 *
 * 앱 카탈로그는 `@littlefinger/shared` 만 import 하는 순수 TS 라 웹 테스트에서 읽을 수
 * 있다(react-native 를 끌고 오지 않는다). 이 파일이 워크스페이스 경계를 넘는 유일한
 * 지점이고, 넘는 이유가 곧 이 테스트의 목적이다.
 */
describe('앱·웹 공통 문구', () => {
  it('링크 무효 다섯 사유가 두 표면에서 같다', () => {
    for (const locale of ['ko', 'en'] as const) {
      expect(INVITE_REVIEW_LABEL[locale].unavailableTitle).toBe(SCR_W06_LABEL[locale].title);
      expect(INVITE_REVIEW_LABEL[locale].oneTimeNotice).toBe(SCR_W06_LABEL[locale].oneTimeNotice);
      expect(INVITE_REVIEW_LABEL[locale].unavailableReason).toEqual(
        SCR_W06_LABEL[locale].reasonBody,
      );
    }
  });

  it('거절·수정 제안 종결 문구가 두 표면에서 같다', () => {
    for (const locale of ['ko', 'en'] as const) {
      expect(INVITE_REVIEW_LABEL[locale].doneDeclined).toBe(
        RESPONSE_COMPLETE_LABEL[locale].outcomeMessage.declined,
      );
      expect(INVITE_REVIEW_LABEL[locale].doneAmendSuggested).toBe(
        RESPONSE_COMPLETE_LABEL[locale].outcomeMessage['amend-suggested'],
      );
    }
  });
});
