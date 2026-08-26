import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../lib/slot-purchase-native.ts', () => {
  class SlotPurchaseCancelledError extends Error {}
  return {
    SlotPurchaseCancelledError,
    loadSlotPrice: jest.fn(),
    purchaseSlot: jest.fn(),
    reconcileSlotPurchases: jest.fn(),
  };
});
jest.mock('../lib/slots-native.ts', () => ({ loadSlotStatus: jest.fn() }));

import {
  loadSlotPrice,
  purchaseSlot,
  reconcileSlotPurchases,
  SlotPurchaseCancelledError,
} from '../lib/slot-purchase-native.ts';
import { loadSlotStatus } from '../lib/slots-native.ts';
import { SlotPaywallSheet } from './slot-paywall-sheet.tsx';

const statusMock = jest.mocked(loadSlotStatus);
const priceMock = jest.mocked(loadSlotPrice);
const purchaseMock = jest.mocked(purchaseSlot);
const reconcileMock = jest.mocked(reconcileSlotPurchases);

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setImmediate(() => resolve()));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  statusMock.mockResolvedValue({ capacity: 5, used: 5 });
  priceMock.mockResolvedValue('₩1,000');
  reconcileMock.mockResolvedValue(null);
});

describe('슬롯 결제 시트', () => {
  test('현황·스토어 가격·설명을 그린다 (limit 사유는 가득 참 안내 포함)', async () => {
    const view = await render(
      <SlotPaywallSheet visible reason="limit" onClose={jest.fn()} />,
    );
    await flush();

    expect(view.getByText('사용 중 5 / 5')).toBeTruthy();
    expect(view.getByText('지금은 슬롯이 가득 차 있어요. 슬롯을 추가하면 바로 보낼 수 있어요.')).toBeTruthy();
    expect(view.getByRole('button', { name: '₩1,000에 추가하기' })).toBeTruthy();
    // 열릴 때 미소모 구매를 먼저 줍는다.
    expect(reconcileMock).toHaveBeenCalledTimes(1);
  });

  test('스토어 가격 조회 실패는 기본값 표기로 대체한다', async () => {
    priceMock.mockResolvedValue(null);
    const view = await render(
      <SlotPaywallSheet visible reason="manage" onClose={jest.fn()} />,
    );
    await flush();

    expect(view.getByRole('button', { name: '₩1,000에 추가하기' })).toBeTruthy();
    expect(view.queryByText(/가득 차 있어요/u)).toBeNull();
  });

  test('구매 성공은 새 현황을 그리고 onPurchased 로 알린다', async () => {
    purchaseMock.mockResolvedValue({ capacity: 6, used: 5 });
    const onPurchased = jest.fn();
    const view = await render(
      <SlotPaywallSheet visible reason="limit" onClose={jest.fn()} onPurchased={onPurchased} />,
    );
    await flush();

    await act(async () => fireEvent.press(view.getByRole('button', { name: '₩1,000에 추가하기' })));
    await flush();

    expect(view.getByText('슬롯이 추가됐어요')).toBeTruthy();
    expect(view.getByText('사용 중 5 / 6')).toBeTruthy();
    expect(onPurchased).toHaveBeenCalledWith({ capacity: 6, used: 5 });
  });

  test('스토어 시트를 닫은 것은 오류로 그리지 않는다', async () => {
    purchaseMock.mockRejectedValue(new SlotPurchaseCancelledError());
    const view = await render(
      <SlotPaywallSheet visible reason="limit" onClose={jest.fn()} />,
    );
    await flush();

    await act(async () => fireEvent.press(view.getByRole('button', { name: '₩1,000에 추가하기' })));
    await flush();

    expect(view.queryByText(/완료하지 못했어요/u)).toBeNull();
  });

  test('구매 실패는 자동 반영 안내와 함께 알린다', async () => {
    purchaseMock.mockRejectedValue(new Error('store error'));
    const view = await render(
      <SlotPaywallSheet visible reason="limit" onClose={jest.fn()} />,
    );
    await flush();

    await act(async () => fireEvent.press(view.getByRole('button', { name: '₩1,000에 추가하기' })));
    await flush();

    expect(view.getByText(/구매를 완료하지 못했어요/u)).toBeTruthy();
  });

  test('현황 조회 실패는 다시 시도로 복구한다', async () => {
    statusMock.mockRejectedValueOnce(new Error('network'));
    const view = await render(
      <SlotPaywallSheet visible reason="manage" onClose={jest.fn()} />,
    );
    await flush();

    expect(view.getByText('슬롯 정보를 불러오지 못했어요.')).toBeTruthy();

    await act(async () => fireEvent.press(view.getByRole('button', { name: '다시 시도' })));
    await flush();

    expect(view.getByText('사용 중 5 / 5')).toBeTruthy();
  });
});
