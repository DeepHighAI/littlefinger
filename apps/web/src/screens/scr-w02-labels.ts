import { WITNESS_MAX, type Localized } from '@littlefinger/shared';

/**
 * SCR-W02 문구 카탈로그.
 *
 * ko 는 화면에 있던 문자열 그대로다 — 명세·서버 원문과 한 글자라도 갈리면 안 된다.
 * 닉네임 접미('님과의…')는 영어에서 닉네임이 문장 앞에 오지 않아 접미 연결 자체가
 * 성립하지 않으므로 함수로 만들었다. 로케일별 문법은 함수 본문이 갖는다.
 */
const ko = {
  // 레퍼런스 HTML(scr-w02-promise-review.html)의 헤드라인을 그대로 쓴다. SCR-W01 과 달리
  // 여기서는 작성자 닉네임을 서버가 준다.
  headline: (nickname: string) => `${nickname}님과의 약속, 꼼꼼히 봐주세요`,
  endDate: '종료일',
  noEndDate: '종료일 없음',
  keeper: '지킬 사람',
  category: '카테고리',
  reward: '보상',
  penalty: '벌칙',
  approveCta: '승인하기',
  amendCta: '수정 제안',
  declineCta: '거절하기',
  // 오수락 방지 확인 시트(§4-3-4 · 상위기획서 F-03). 한 문장을 질문과 결과로 끊어 놓았을 뿐
  // 문구는 명세 원문 그대로다.
  confirmQuestion: (nickname: string) => `${nickname}님이 보낸 약속이 맞나요?`,
  confirmBody: '승인하면 두 사람의 기록으로 확정돼요.',
  confirmYes: '네, 승인합니다',
  confirmNo: '아니에요',
  /**
   * EC-B10 — 대기하는 동안 종료일이 지나 버린 경우.
   *
   * `02` 는 §4-3-4(261행)와 §10(1108행)에 서로 다른 문구를 적어 두었다. **서버가 §4-3-4 를
   * 골랐으므로**(`promise-approve/handler.ts` 의 `APPROVE_VALIDATION`) 화면도 같은 쪽을
   * 따른다 — 클라이언트 판정과 서버 거절이 다른 문장을 내면 같은 사실이 두 번 다르게 보인다.
   * 두 곳에 같은 문자열이 있는 것은 알고 있다. 수락 웹은 Edge Function 코드를 import 하지
   * 않는다.
   */
  endDatePassedMessage:
    '종료일이 지난 약속은 승인할 수 없어요. 작성자에게 종료일 변경을 요청해 주세요.',
  endDatePassedCta: '종료일 변경 요청하기',
  // §4-2-1 원문. 증인 사용 **예정** 여부는 §4-3-4 의 표시 요소인데 전용 문구가 없어서,
  // 같은 사실을 말하는 이 문장을 쓴다. 상한은 정책 상수에서 만든다.
  witnessNotice: `확정 후 증인을 초대할 수 있어요(최대 ${WITNESS_MAX}명)`,
  /**
   * 수정 제안 의견 입력(§4-3-4 필수 · 5~300자).
   *
   * 라벨은 `02` §5-3 의 필드명이고, 레퍼런스 HTML 도 같은 문자열을 `lf-sr-only` 로 달아 뒀다.
   * **화면에서는 보이게 단다** — 레퍼런스는 자리표시자에 "(선택)"이라 적어 두고 라벨을
   * 숨겼는데, §4-3-4 는 이 필드를 필수로 정한다. 틀린 자리표시자를 그대로 쓸 수 없고 고쳐 쓸
   * 문구도 승인받지 않았으므로, 자리표시자를 빼고 라벨을 드러내는 쪽을 택했다. 이름 없는 빈
   * 상자가 [수정 제안]이 눌리지 않는 이유를 설명해 줄 수는 없다.
   */
  amendFieldLabel: '수정 제안 의견',
};

const en = {
  headline: (nickname: string) => `Review your promise with ${nickname} carefully`,
  endDate: 'End date',
  noEndDate: 'No end date',
  keeper: 'Who keeps it',
  category: 'Category',
  reward: 'Reward',
  penalty: 'Penalty',
  approveCta: 'Approve',
  amendCta: 'Suggest a change',
  declineCta: 'Decline',
  confirmQuestion: (nickname: string) => `Is this the promise ${nickname} sent you?`,
  confirmBody: 'Approving confirms it as a record for both of you.',
  confirmYes: 'Yes, approve',
  confirmNo: "No, it isn't",
  // ko 가 서버 원문과 한 몸인 문구다(위 주석). en 은 그 문장의 고정 번역만 허용된다 —
  // 서버 봉투는 한국어를 유지하므로(PO 2026-08-20) 여기서 다른 문장을 지어내지 않는다.
  endDatePassedMessage:
    'A promise past its end date cannot be approved. Ask the creator to change the end date.',
  endDatePassedCta: 'Request an end date change',
  witnessNotice: `You can invite witnesses after it is confirmed (up to ${WITNESS_MAX})`,
  amendFieldLabel: 'Suggestion details',
} satisfies typeof ko;

export const SCR_W02_LABEL: Localized<typeof ko> = { ko, en };
