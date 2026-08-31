import { ENDPOINT } from '@littlefinger/shared';

import { deletePendingPromise } from './invite-native.ts';
import { callMobileFunctionNative, currentMobileUserId } from './mobile-api-native.ts';
import { getMobileEncryptedStorage } from './supabase-native.ts';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('./mobile-api-native.ts', () => ({
  callMobileFunctionNative: jest.fn(),
  currentMobileUserId: jest.fn(),
}));
jest.mock('./supabase-native.ts', () => ({ getMobileEncryptedStorage: jest.fn() }));

describe('invite-native PENDING 삭제', () => {
  const removeItem = jest.fn();

  beforeEach(() => {
    jest.mocked(callMobileFunctionNative).mockReset().mockResolvedValue({
      promise_id: '11111111-1111-4111-8111-111111111111',
      deleted: true,
    });
    jest.mocked(currentMobileUserId).mockReset().mockResolvedValue('user-1');
    removeItem.mockReset().mockResolvedValue(undefined);
    jest.mocked(getMobileEncryptedStorage).mockReset().mockReturnValue({
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem,
    } as never);
  });

  test('멱등 Edge 호출 성공 뒤 사용자별 저장 토큰을 제거한다', async () => {
    const promiseId = '11111111-1111-4111-8111-111111111111';

    await deletePendingPromise(promiseId);

    expect(callMobileFunctionNative).toHaveBeenCalledWith(
      ENDPOINT.promisePendingDelete,
      { promise_id: promiseId },
      { idempotent: true },
    );
    expect(removeItem).toHaveBeenCalledWith(`lf.invite.user-1.${promiseId}`);
  });

  test('서버 삭제 뒤 로컬 토큰 정리 실패는 성공을 뒤집지 않는다', async () => {
    removeItem.mockRejectedValue(new Error('secure store unavailable'));

    await expect(
      deletePendingPromise('11111111-1111-4111-8111-111111111111'),
    ).resolves.toBeUndefined();
  });
});
