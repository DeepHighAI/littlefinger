import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

import { LfIcon } from '../components/LfIcon.tsx';
import { isResponseOutcome, RESPONSE_OUTCOME, type ResponseOutcome } from '../routes.ts';
import { ScrW06LinkExpired } from './scr-w06-link-expired.tsx';

/**
 * 거절 · 수정 제안이 끝난 뒤의 종결 화면.
 *
 * **SCR-ID 가 없다.** `02` 도 디자인요청서도 이 화면에 번호를 주지 않았고 레퍼런스 HTML 도
 * 없어서, 파일명을 하는 일로 지었다. 번호가 생기면 "파일명 = SCR-ID"(CLAUDE.md §5-4)에 맞춰
 * 파일과 경로를 함께 옮겨야 한다 — **PO 확인 필요**.
 *
 * 승인된 문구는 아래 두 문장뿐이다(PO 2026-07-29). 제목 줄은 승인되지 않았으므로 만들지
 * 않고, 그 문장 하나가 제목이자 본문이다. SCR-W06 과 같은 껍데기를 쓴다 — 초대가 소모된
 * 뒤 카톡 인앱 브라우저에 남는 마지막 화면이라는 점이 같다.
 */

const OUTCOME_MESSAGE: Record<ResponseOutcome, string> = {
  [RESPONSE_OUTCOME.declined]: '거절했어요. 작성자에게 알려드릴게요.',
  [RESPONSE_OUTCOME.amendSuggested]:
    '수정 제안을 보냈어요. 작성자가 내용을 고쳐 다시 보내면 알림을 받게 돼요.',
};

// 아이콘은 문구의 동사를 따른다. 거절에 축하·격려 계열 장식을 붙이지 않는 것과 같은 이유로
// (§8-1 NT-02 주석) 둘 다 사실만 말하는 기호로 둔다.
const OUTCOME_ICON = {
  [RESPONSE_OUTCOME.declined]: 'check',
  [RESPONSE_OUTCOME.amendSuggested]: 'send',
} as const;

export function ResponseComplete(): React.JSX.Element {
  const { outcome } = useParams<{ outcome: string }>();
  const messageRef = useRef<HTMLHeadingElement>(null);

  /**
   * SCR-W02 에서 `replace` 로 건너오면 눌렀던 버튼이 통째로 사라진다. 그러면 포커스는
   * body 로 떨어지고, 스크린리더는 화면이 바뀐 사실도 이 문장도 읽지 않는다 — 거절이
   * 되었는지 알 길이 없는 채로 끝난다. 이 화면의 전부인 문장으로 포커스를 옮긴다.
   */
  useEffect(() => {
    messageRef.current?.focus();
  }, [outcome]);

  if (!isResponseOutcome(outcome)) {
    // 주소를 손으로 고쳐 들어온 경우다. 설명할 문구가 없으므로 App 의 catch-all 과 같은
    // 답을 준다 — 없는 주소는 없는 초대와 같다.
    return <ScrW06LinkExpired reason="E_NOT_FOUND" />;
  }

  return (
    // 레퍼런스의 lf-device / lf-browserbar 는 옮기지 않는다. 광고는 수락 웹 전체에 없다.
    <div className="lf-screen">
      <div className="lf-screen__body lf-screen__body--web lf-screen__body--centered lf-gap-5">
        <div className="lf-status-icon">
          <LfIcon name={OUTCOME_ICON[outcome]} />
        </div>

        {/* tabIndex={-1} 은 포커스를 받기 위한 것이지 탭 순서에 끼우기 위한 것이 아니다. */}
        <h1
          className="lf-title lf-title--web"
          data-testid="outcome-message"
          ref={messageRef}
          tabIndex={-1}
        >
          {OUTCOME_MESSAGE[outcome]}
        </h1>
      </div>
    </div>
  );
}
