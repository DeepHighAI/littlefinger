import type { PromiseEntitlementsView } from '@littlefinger/shared';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../lib/monetization-native.ts', () => ({
  getPromiseEntitlements: jest.fn(),
  unlockWithRewardedAd: jest.fn(),
}));
jest.mock('../lib/slot-purchase-native.ts', () => {
  class SlotPurchaseCancelledError extends Error {}
  return {
    SlotPurchaseCancelledError,
    loadPermanentAccessPrice: jest.fn(),
    purchasePermanentAccess: jest.fn(),
    reconcilePermanentAccessPurchase: jest.fn(),
  };
});

import { getPromiseEntitlements, unlockWithRewardedAd } from '../lib/monetization-native.ts';
import {
  loadPermanentAccessPrice,
  purchasePermanentAccess,
  reconcilePermanentAccessPurchase,
} from '../lib/slot-purchase-native.ts';
import { PromiseEntitlementSheet } from './promise-entitlement-sheet.tsx';

const PROMISE_ID = '22222222-2222-4222-8222-222222222222';
const BASE: PromiseEntitlementsView = {
  promise_id: PROMISE_ID,
  my_role: 'CREATOR',
  witness: {
    creator_capacity: 1,
    partner_capacity: 0,
    creator_used: 0,
    partner_used: 0,
    max: 3,
  },
  duration: { ceiling_date: '2026-09-28', unlimited: false },
  retention: {
    anchor_at: '2026-09-01T00:00:00.000Z',
    expires_at: '2026-10-01T00:00:00.000Z',
    permanent: false,
    renewable: true,
  },
};
const PERMANENT: PromiseEntitlementsView = {
  ...BASE,
  duration: { ceiling_date: null, unlimited: true },
  retention: { ...BASE.retention, expires_at: null, permanent: true, renewable: false },
};

const entitlementMock = jest.mocked(getPromiseEntitlements);
const rewardMock = jest.mocked(unlockWithRewardedAd);
const priceMock = jest.mocked(loadPermanentAccessPrice);
const purchaseMock = jest.mocked(purchasePermanentAccess);
const reconcileMock = jest.mocked(reconcilePermanentAccessPurchase);

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  entitlementMock.mockResolvedValue(BASE);
  priceMock.mockResolvedValue('₩2,000');
  reconcileMock.mockResolvedValue(null);
});

describe('약속 혜택 시트', () => {
  test('기간 상한과 보상형 광고·영구보관 제안을 함께 보여준다', async () => {
    const view = await render(
      <PromiseEntitlementSheet visible promiseId={PROMISE_ID} mode="DURATION" onClose={jest.fn()} />,
    );
    await settle();
    expect(view.getByText(/현재 설정 가능한 마지막 날/u)).toBeTruthy();
    expect(view.getByRole('button', { name: '광고 보고 30일 늘리기' })).toBeTruthy();
    expect(view.getByRole('button', { name: '₩2,000에 영구 보관' })).toBeTruthy();
    expect(view.queryByText(/종료일 무제한/u)).toBeNull();
  });

  test('E_END_DATE_RANGE 로 열린 시트는 광고 1편 = 30일 · 영구 보관 = 무제한 안내를 직접 말한다', async () => {
    const view = await render(
      <PromiseEntitlementSheet
        visible
        promiseId={PROMISE_ID}
        mode="DURATION"
        reason="END_DATE_RANGE"
        onClose={jest.fn()}
      />,
    );
    await settle();
    expect(view.getByText(/광고 1편 = 30일 연장 · 영구 보관 구매 = 종료일 무제한/u)).toBeTruthy();
  });

  test('상대방에게는 기간 광고 버튼 대신 작성자 전용 안내를 보여준다', async () => {
    entitlementMock.mockResolvedValue({ ...BASE, my_role: 'PARTNER' });
    const view = await render(
      <PromiseEntitlementSheet visible promiseId={PROMISE_ID} mode="DURATION" onClose={jest.fn()} />,
    );
    await settle();
    expect(view.queryByRole('button', { name: '광고 보고 30일 늘리기' })).toBeNull();
    expect(view.getByText('종료일 범위는 작성자만 늘릴 수 있어요.')).toBeTruthy();
    expect(view.getByRole('button', { name: '₩2,000에 영구 보관' })).toBeTruthy();
  });

  test('광고를 볼 수 없으면 무료 대체 없이 잠금 상태와 구매 CTA 만 남는다', async () => {
    rewardMock.mockResolvedValue({ phase: 'UNAVAILABLE' });
    const onChanged = jest.fn();
    const view = await render(
      <PromiseEntitlementSheet
        visible
        promiseId={PROMISE_ID}
        mode="RETENTION"
        onClose={jest.fn()}
        onChanged={onChanged}
      />,
    );
    await settle();
    await act(async () => fireEvent.press(
      view.getByRole('button', { name: '광고 보고 내 보관 30일 늘리기' }),
    ));
    expect(view.getByText('지금은 광고를 볼 수 없어 잠겨 있어요.')).toBeTruthy();
    expect(view.queryByRole('button', { name: /광고 보고/u })).toBeNull();
    expect(view.queryByText(/무료 대체/u)).toBeNull();
    expect(view.getByRole('button', { name: '₩2,000에 영구 보관' })).toBeTruthy();
    expect(onChanged).not.toHaveBeenCalled();
  });

  test('광고 진행 중에는 구매 버튼이 "구매 확인 중" 으로 바뀌지 않는다', async () => {
    let finishReward: ((value: { phase: 'DISMISSED' }) => void) | undefined;
    rewardMock.mockImplementation(async () => await new Promise((resolve) => { finishReward = resolve; }));
    const view = await render(
      <PromiseEntitlementSheet visible promiseId={PROMISE_ID} mode="DURATION" onClose={jest.fn()} />,
    );
    await settle();
    await act(async () => fireEvent.press(view.getByRole('button', { name: '광고 보고 30일 늘리기' })));
    expect(view.getByRole('button', { name: '광고 준비 중…' })).toBeTruthy();
    expect(view.getByRole('button', { name: '₩2,000에 영구 보관' })).toBeTruthy();
    expect(view.queryByRole('button', { name: '구매 확인 중…' })).toBeNull();
    await act(async () => finishReward?.({ phase: 'DISMISSED' }));
    expect(view.getByRole('button', { name: '광고 보고 30일 늘리기' })).toBeTruthy();
  });

  test('미소모 영구보관 구매를 복구하면 즉시 상위 화면에도 반영한다', async () => {
    reconcileMock.mockResolvedValue(PERMANENT);
    const onChanged = jest.fn();
    const view = await render(
      <PromiseEntitlementSheet
        visible
        promiseId={PROMISE_ID}
        mode="DURATION"
        onClose={jest.fn()}
        onChanged={onChanged}
      />,
    );
    await settle();
    expect(view.getByText('종료일 없이 제안할 수 있어요')).toBeTruthy();
    expect(onChanged).toHaveBeenCalledWith(PERMANENT);
    expect(view.queryByRole('button', { name: /영구 보관$/u })).toBeNull();
  });

  test('구매를 서버 검증한 뒤 개인 영구보관 상태로 전환한다', async () => {
    purchaseMock.mockResolvedValue(PERMANENT);
    const view = await render(
      <PromiseEntitlementSheet visible promiseId={PROMISE_ID} mode="RETENTION" onClose={jest.fn()} />,
    );
    await settle();
    await act(async () => fireEvent.press(
      view.getByRole('button', { name: '₩2,000에 영구 보관' }),
    ));
    expect(purchaseMock).toHaveBeenCalledWith(PROMISE_ID);
    expect(view.getByText('이 기록은 내 계정에 영구 보관돼요')).toBeTruthy();
  });
});
