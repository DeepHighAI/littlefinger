import type { Localized } from '@littlefinger/shared';

// SCR-A09 지난 약속 히스토리 (PO 2026-08-26, ADR 0011).
// 탭 이름은 판정하지 않는다(P1): 의견 불일치·미확정 종결은 '협의 중단'이라는 중립 묶음이다.
const ko = {
  title: '지난 약속',
  back: '뒤로',
  doneTab: (count: number) => `완료 ${count}`,
  brokenTab: (count: number) => `불이행 ${count}`,
  unsettledTab: (count: number) => `협의 중단 ${count}`,
  declinedTab: (count: number) => `거절·파기 ${count}`,
  empty: '이 분류의 지난 약속이 없어요',
  emptyDescription: '약속이 종결되면 여기에 차곡차곡 기록돼요',
  loading: '지난 약속을 불러오는 중이에요',
  loadError: '지난 약속을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  retry: '다시 시도',
  retryListAccessibility: '지난 약속 목록 다시 시도',
  retryPageAccessibility: '목록 더 불러오기 다시 시도',
  pageError: '목록을 더 불러오지 못했어요.',
};

const en = {
  title: 'Past promises',
  back: 'Back',
  doneTab: (count: number) => `Completed ${count}`,
  brokenTab: (count: number) => `Not kept ${count}`,
  unsettledTab: (count: number) => `Unsettled ${count}`,
  declinedTab: (count: number) => `Declined ${count}`,
  empty: 'No past promises in this group',
  emptyDescription: 'Closed promises are recorded here',
  loading: 'Loading past promises',
  loadError: 'Could not load past promises. Please try again shortly.',
  retry: 'Try again',
  retryListAccessibility: 'Retry loading past promises',
  retryPageAccessibility: 'Retry loading more promises',
  pageError: 'Could not load more promises.',
} satisfies typeof ko;

export const SCR_A09_LABEL: Localized<typeof ko> = { ko, en };
