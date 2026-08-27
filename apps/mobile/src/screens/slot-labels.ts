import type { Localized } from '@littlefinger/shared';

/** ₩ 천 단위 구분 — Hermes 의 Intl 공백을 피해서 직접 찍는다. */
function formatWon(won: number): string {
  return `₩${won.toString().replace(/\B(?=(\d{3})+(?!\d))/gu, ',')}`;
}

// 신뢰 순간의 결제 문구다(§8): 재촉·유도 없이, 슬롯이 무엇이고 언제 비워지는지만 말한다.
const ko = {
  sheetTitle: '약속 슬롯',
  close: '닫기',
  explain: '진행 중인 약속은 슬롯을 하나씩 사용해요. 약속이 종결되면 슬롯은 다시 비워져요.',
  fullNotice: '지금은 슬롯이 가득 차 있어요. 슬롯을 추가하면 바로 보낼 수 있어요.',
  usage: (used: number, capacity: number) => `사용 중 ${used} / ${capacity}`,
  usageAccessibility: (used: number, capacity: number) =>
    `약속 슬롯 ${capacity}개 중 ${used}개 사용 중`,
  addTitle: '슬롯 1개 추가',
  addDescription: '한 번 구매하면 영구히 유지돼요.',
  purchase: (price: string) => `${price}에 추가하기`,
  priceFallback: formatWon,
  purchasing: '구매를 진행하고 있어요…',
  purchased: '슬롯이 추가됐어요',
  purchaseError: '구매를 완료하지 못했어요. 결제가 이미 됐다면 이 창을 다시 열 때 자동으로 반영돼요.',
  loading: '슬롯 정보를 불러오는 중이에요',
  loadError: '슬롯 정보를 불러오지 못했어요.',
  retry: '다시 시도',
  profileTitle: '약속 슬롯',
  profileExplain: '약속이 종결되면 슬롯은 다시 비워져요',
  profileAdd: '추가',
  profileAddAccessibility: '약속 슬롯 추가',
};

const en = {
  sheetTitle: 'Promise slots',
  close: 'Close',
  explain: 'Each promise in progress uses one slot. When a promise closes, its slot frees up.',
  fullNotice: 'Your slots are full right now. Add a slot to send this promise.',
  usage: (used: number, capacity: number) => `Using ${used} / ${capacity}`,
  usageAccessibility: (used: number, capacity: number) =>
    `Using ${used} of ${capacity} promise slots`,
  addTitle: 'Add 1 slot',
  addDescription: 'A purchased slot is yours permanently.',
  purchase: (price: string) => `Add for ${price}`,
  priceFallback: formatWon,
  purchasing: 'Processing your purchase…',
  purchased: 'Slot added',
  purchaseError:
    'The purchase could not be completed. If you were charged, it will be applied automatically when you reopen this sheet.',
  loading: 'Loading slot info',
  loadError: 'Could not load slot info.',
  retry: 'Try again',
  profileTitle: 'Promise slots',
  profileExplain: 'When a promise closes, its slot frees up.',
  profileAdd: 'Add',
  profileAddAccessibility: 'Add a promise slot',
} satisfies typeof ko;

export const SLOT_LABEL: Localized<typeof ko> = { ko, en };
