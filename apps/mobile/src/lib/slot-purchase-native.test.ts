import type { Purchase } from 'expo-iap';

/**
 * 구매 오케스트레이션 — 순서가 계약이다: 검증 200 → 소모. 그 사이 실패는
 * 미소모 구매로 남아 reconcile 이 줍는다.
 */

const listeners: {
  updated: ((purchase: Purchase) => void) | null;
  failed: ((error: { code: string; message: string }) => void) | null;
} = { updated: null, failed: null };

const mockInitConnection = jest.fn().mockResolvedValue(true);
const mockFetchProducts = jest.fn();
const mockRequestPurchase = jest.fn();
const mockFinishTransaction = jest.fn().mockResolvedValue(undefined);
const mockGetAvailablePurchases = jest.fn();

jest.mock('expo-iap', () => ({
  ErrorCode: { UserCancelled: 'user-cancelled' },
  initConnection: (...args: unknown[]) => mockInitConnection(...args),
  fetchProducts: (...args: unknown[]) => mockFetchProducts(...args),
  requestPurchase: (...args: unknown[]) => mockRequestPurchase(...args),
  finishTransaction: (...args: unknown[]) => mockFinishTransaction(...args),
  getAvailablePurchases: (...args: unknown[]) => mockGetAvailablePurchases(...args),
  purchaseUpdatedListener: (listener: (purchase: Purchase) => void) => {
    listeners.updated = listener;
    return { remove: () => { listeners.updated = null; } };
  },
  purchaseErrorListener: (listener: (error: { code: string; message: string }) => void) => {
    listeners.failed = listener;
    return { remove: () => { listeners.failed = null; } };
  },
}));

jest.mock('./mobile-api-native.ts', () => ({
  currentMobileUserId: jest.fn().mockResolvedValue('user-1'),
}));

jest.mock('./slots-native.ts', () => ({
  verifyPermanentAccessPurchaseNative: jest.fn(),
  verifySlotPurchaseNative: jest.fn(),
}));

import {
  verifyPermanentAccessPurchaseNative,
  verifySlotPurchaseNative,
} from './slots-native.ts';
import {
  loadPermanentAccessPrice,
  loadSlotPrice,
  purchaseSlot,
  reconcilePermanentAccessPurchase,
  reconcileSlotPurchases,
  SlotPurchaseCancelledError,
} from './slot-purchase-native.ts';

const verifyMock = jest.mocked(verifySlotPurchaseNative);
const verifyPermanentMock = jest.mocked(verifyPermanentAccessPurchaseNative);

const PURCHASE = {
  productId: 'promise_slot_plus1',
  purchaseToken: 'play-token',
} as unknown as Purchase;

beforeEach(() => {
  jest.clearAllMocks();
  mockInitConnection.mockResolvedValue(true);
  mockFinishTransaction.mockResolvedValue(undefined);
  listeners.updated = null;
  listeners.failed = null;
});

describe('reconcilePermanentAccessPurchase', () => {
  test('약속에 바인딩된 미소모 영구 보관 구매를 복구한다', async () => {
    const purchase = {
      productId: 'promise_permanent_access',
      purchaseToken: 'permanent-token',
      obfuscatedProfileIdAndroid: '11111111-1111-4111-8111-111111111111',
    } as unknown as Purchase;
    const entitlements = {
      promise_id: '11111111-1111-4111-8111-111111111111',
      my_role: 'CREATOR',
      witness: {
        creator_capacity: 1,
        partner_capacity: 0,
        creator_used: 0,
        partner_used: 0,
        max: 3,
      },
      duration: { ceiling_date: null, unlimited: true },
      retention: { anchor_at: null, permanent: true, expires_at: null, renewable: false },
    } as const;
    mockGetAvailablePurchases.mockResolvedValue([purchase]);
    verifyPermanentMock.mockResolvedValue(entitlements);

    await expect(reconcilePermanentAccessPurchase(entitlements.promise_id)).resolves.toEqual(
      entitlements,
    );
    expect(verifyPermanentMock).toHaveBeenCalledWith(
      entitlements.promise_id,
      'promise_permanent_access',
      'permanent-token',
    );
    expect(mockFinishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
  });

  test('다른 약속에 바인딩됐거나 바인딩이 없는 구매는 검증도 소모도 하지 않는다', async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      {
        productId: 'promise_permanent_access',
        purchaseToken: 'other-token',
        obfuscatedProfileIdAndroid: '22222222-2222-4222-8222-222222222222',
      } as unknown as Purchase,
      { productId: 'promise_permanent_access', purchaseToken: 'unbound-token' } as unknown as Purchase,
    ]);

    await expect(reconcilePermanentAccessPurchase('11111111-1111-4111-8111-111111111111'))
      .resolves.toBeNull();
    expect(verifyPermanentMock).not.toHaveBeenCalled();
    expect(mockFinishTransaction).not.toHaveBeenCalled();
  });
});

describe('purchaseSlot', () => {
  test('결제 이벤트 → 서버 검증 → 소모 순서로 끝난다', async () => {
    verifyMock.mockResolvedValue({ capacity: 6, used: 5 });
    mockRequestPurchase.mockImplementation(async () => {
      listeners.updated?.(PURCHASE);
      return null;
    });

    await expect(purchaseSlot()).resolves.toEqual({ capacity: 6, used: 5 });

    expect(verifyMock).toHaveBeenCalledWith('promise_slot_plus1', 'play-token');
    expect(mockFinishTransaction).toHaveBeenCalledWith({ purchase: PURCHASE, isConsumable: true });
    // 계정 바인딩 — 서버가 obfuscatedExternalAccountId 로 대조한다.
    expect(mockRequestPurchase).toHaveBeenCalledWith({
      request: { google: { skus: ['promise_slot_plus1'], obfuscatedAccountId: 'user-1' } },
      type: 'in-app',
    });
  });

  test('사용자 취소는 전용 오류다 — 화면이 오류로 그리지 않는다', async () => {
    mockRequestPurchase.mockImplementation(async () => {
      listeners.failed?.({ code: 'user-cancelled', message: 'cancelled' });
      return null;
    });

    await expect(purchaseSlot()).rejects.toBeInstanceOf(SlotPurchaseCancelledError);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  test('서버 검증이 실패하면 소모하지 않는다 — 미소모 구매로 남아 복구된다', async () => {
    verifyMock.mockRejectedValue(new Error('E_VALIDATION'));
    mockRequestPurchase.mockImplementation(async () => {
      listeners.updated?.(PURCHASE);
      return null;
    });

    await expect(purchaseSlot()).rejects.toThrow('E_VALIDATION');
    expect(mockFinishTransaction).not.toHaveBeenCalled();
  });
});

describe('reconcileSlotPurchases', () => {
  test('미소모 슬롯 구매만 재검증하고 소모한다', async () => {
    verifyMock.mockResolvedValue({ capacity: 6, used: 5 });
    mockGetAvailablePurchases.mockResolvedValue([
      PURCHASE,
      { productId: 'other_product', purchaseToken: 'x' } as unknown as Purchase,
    ]);

    await expect(reconcileSlotPurchases()).resolves.toEqual({ capacity: 6, used: 5 });

    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
  });

  test('검증 불가 구매는 소모하지 않고 남긴다', async () => {
    verifyMock.mockRejectedValue(new Error('E_VALIDATION'));
    mockGetAvailablePurchases.mockResolvedValue([PURCHASE]);

    await expect(reconcileSlotPurchases()).resolves.toBeNull();
    expect(mockFinishTransaction).not.toHaveBeenCalled();
  });

  test('스토어 조회 실패는 null — 결제 시트 열기를 막지 않는다', async () => {
    mockGetAvailablePurchases.mockRejectedValue(new Error('store down'));

    await expect(reconcileSlotPurchases()).resolves.toBeNull();
  });
});

describe('loadSlotPrice', () => {
  test('스토어 현지화 가격을 돌려준다', async () => {
    mockFetchProducts.mockResolvedValue([
      { id: 'promise_slot_plus1', displayPrice: '₩1,000' },
    ]);

    await expect(loadSlotPrice()).resolves.toBe('₩1,000');
    expect(mockFetchProducts).toHaveBeenCalledWith({
      skus: ['promise_slot_plus1'],
      type: 'in-app',
    });
  });

  test('조회 실패는 null — 화면이 기본값 표기로 대체한다', async () => {
    mockFetchProducts.mockRejectedValue(new Error('store down'));

    await expect(loadSlotPrice()).resolves.toBeNull();
  });

  test('스토어가 빈 가격을 반환하면 null — 비어 있는 구매 문구를 만들지 않는다', async () => {
    mockFetchProducts.mockResolvedValue([
      { id: 'promise_slot_plus1', displayPrice: '   ' },
    ]);

    await expect(loadSlotPrice()).resolves.toBeNull();
  });
});

describe('loadPermanentAccessPrice', () => {
  test('스토어 현지화 가격을 돌려준다', async () => {
    mockFetchProducts.mockResolvedValue([
      { id: 'promise_permanent_access', displayPrice: '₩2,000' },
    ]);

    await expect(loadPermanentAccessPrice()).resolves.toBe('₩2,000');
    expect(mockFetchProducts).toHaveBeenCalledWith({
      skus: ['promise_permanent_access'],
      type: 'in-app',
    });
  });

  test('스토어가 빈 가격을 반환하면 null — 화면이 기본값 표기로 대체한다', async () => {
    mockFetchProducts.mockResolvedValue([
      { id: 'promise_permanent_access', displayPrice: '' },
    ]);

    await expect(loadPermanentAccessPrice()).resolves.toBeNull();
  });
});
