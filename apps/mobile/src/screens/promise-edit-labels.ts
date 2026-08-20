import { PROMISE_STATUS_LABEL_BY_LOCALE, type Localized } from '@littlefinger/shared';

/**
 * SCR-A03 약속 작성 문구 카탈로그.
 *
 * 증인 상한처럼 수치가 끼는 문구는 함수다 — 정책 숫자는 config 상수(WITNESS_MAX)가
 * 출처라 호출부가 넘긴다. 상단 칩(작성 중)은 상태 라벨 공용 맵을 그대로 쓴다.
 */
const ko = {
  title: '약속 만들기',
  editing: PROMISE_STATUS_LABEL_BY_LOCALE.ko.DRAFT,
  close: '닫기',
  titleField: '제목',
  bodyField: '약속 내용',
  category: '카테고리',
  endDate: '종료일',
  endDatePicker: '종료일 선택',
  keeper: '지킬 사람',
  reward: '보상',
  penalty: '벌칙',
  witness: '증인 초대하기',
  witnessDescription: (max: number) => `확정 후 증인을 초대할 수 있어요(최대 ${max}명)`,
  moneyNotice:
    '금전 약속도 기록할 수 있지만, 리틀핑거는 차용증·공증 서비스가 아니에요.',
  save: '임시저장',
  send: '상대에게 보내기',
  saved: '임시저장했어요',
  loading: '초안을 불러오는 중이에요',
  loadError: '초안을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  amendComment: '상대방의 수정 제안 의견',
  privacyTitle: '개인정보가 포함돼 있어요',
  privacyBody: '그대로 기록할까요?',
  privacyContinue: '그대로 기록',
  cancel: '취소',
  genericError: '문제가 발생했어요. 잠시 후 다시 시도해 주세요.',
};

const en = {
  title: 'Create a promise',
  editing: PROMISE_STATUS_LABEL_BY_LOCALE.en.DRAFT,
  close: 'Close',
  titleField: 'Title',
  bodyField: 'Promise details',
  category: 'Category',
  endDate: 'End date',
  endDatePicker: 'Choose end date',
  keeper: 'Who keeps it',
  reward: 'Reward',
  penalty: 'Penalty',
  witness: 'Invite witnesses',
  witnessDescription: (max: number) =>
    `You can invite witnesses after it is confirmed (up to ${max})`,
  moneyNotice:
    'You can record money promises too, but Littlefinger is not an IOU or notarization service.',
  save: 'Save draft',
  send: 'Send to partner',
  saved: 'Draft saved',
  loading: 'Loading your draft',
  loadError: 'Could not load the draft. Please try again shortly.',
  amendComment: "Your partner's suggested change",
  privacyTitle: 'This includes personal information',
  privacyBody: 'Record it as is?',
  privacyContinue: 'Record as is',
  cancel: 'Cancel',
  genericError: 'Something went wrong. Please try again shortly.',
} satisfies typeof ko;

export const PROMISE_EDIT_LABEL: Localized<typeof ko> = { ko, en };
