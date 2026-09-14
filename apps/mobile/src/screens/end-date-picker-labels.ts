import type { Localized } from '@littlefinger/shared';

const ko = {
  title: '종료일 선택', close: '닫기', cancel: '취소', confirm: '확인',
  previousMonth: '이전 달', nextMonth: '다음 달', today: '오늘',
  hint: '오늘부터 선택할 수 있어요.',
  rangeChanged: '날짜가 바뀌었어요. 종료일을 다시 확인해 주세요.',
  weekdays: ['일', '월', '화', '수', '목', '금', '토'],
};
const en = {
  title: 'Choose end date', close: 'Close', cancel: 'Cancel', confirm: 'Confirm',
  previousMonth: 'Previous month', nextMonth: 'Next month', today: 'Today',
  hint: 'You can select today or a later date.',
  rangeChanged: 'The date has changed. Please check the end date again.',
  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
} satisfies typeof ko;
export const END_DATE_PICKER_LABEL: Localized<typeof ko> = { ko, en };
