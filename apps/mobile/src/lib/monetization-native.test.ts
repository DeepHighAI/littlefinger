import {
  REWARD_SSV_POLL_MS,
  REWARD_SSV_WAIT_MS,
  type PromiseEntitlementsView,
  type RewardIntentResponse,
} from '@littlefinger/shared';

/**
 * 보상형 광고 언락 오케스트레이션 — 순서가 계약이다: 플래그 → 의도 생성 → 광고 → SSV 폴링.
 * UNAVAILABLE 은 종착 상태라 무료 대체 경로가 없고, 폴링이 끝나도 결과가 없으면 PENDING 으로
 * 돌려 화면이 "잠시 후 다시 확인" 을 안내하게 한다.
 */

jest.mock('./ads-config-native.ts', () => ({ readRewardedAdsEnabled: jest.fn() }));
jest.mock('./admob-native.tsx', () => ({ showRewardedAd: jest.fn() }));
jest.mock('./mobile-api-native.ts', () => ({ callMobileFunctionNative: jest.fn() }));
jest.mock('./monetization-api.ts', () => ({
  createRewardIntent: jest.fn(),
  fetchPromiseEntitlements: jest.fn(),
  fetchRewardStatus: jest.fn(),
}));

import { readRewardedAdsEnabled } from './ads-config-native.ts';
import { showRewardedAd } from './admob-native.tsx';
import { callMobileFunctionNative } from './mobile-api-native.ts';
import {
  createRewardIntent,
  fetchPromiseEntitlements,
  fetchRewardStatus,
} from './monetization-api.ts';
import { getPromiseEntitlements, unlockWithRewardedAd } from './monetization-native.ts';

const PROMISE_ID = '11111111-1111-4111-8111-111111111111';
const INTENT_ID = '22222222-2222-4222-8222-222222222222';
const OPAQUE_USER_ID = 'f'.repeat(64);

const INTENT: RewardIntentResponse = {
  intent_id: INTENT_ID,
  status: 'PENDING',
  opaque_user_id: OPAQUE_USER_ID,
  expires_at: '2026-08-29T10:30:00.000Z',
};
const ENTITLEMENTS: PromiseEntitlementsView = {
  promise_id: PROMISE_ID,
  my_role: 'CREATOR',
  witness: { creator_capacity: 1, partner_capacity: 0, creator_used: 0, partner_used: 0, max: 3 },
  duration: { ceiling_date: '2026-10-28', unlimited: false },
  retention: {
    anchor_at: '2026-09-01T00:00:00.000Z',
    expires_at: '2026-10-31T00:00:00.000Z',
    permanent: false,
    renewable: true,
  },
};

const flagMock = jest.mocked(readRewardedAdsEnabled);
const showMock = jest.mocked(showRewardedAd);
const intentMock = jest.mocked(createRewardIntent);
const entitlementsMock = jest.mocked(fetchPromiseEntitlements);
const statusMock = jest.mocked(fetchRewardStatus);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  flagMock.mockResolvedValue(true);
  intentMock.mockResolvedValue(INTENT);
  showMock.mockResolvedValue('EARNED');
  statusMock.mockResolvedValue({ intent_id: INTENT_ID, status: 'PENDING', entitlements: null });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getPromiseEntitlements', () => {
  test('네이티브 호출자를 주입해 권리 조회를 위임한다', async () => {
    entitlementsMock.mockResolvedValue(ENTITLEMENTS);
    await expect(getPromiseEntitlements(PROMISE_ID)).resolves.toEqual(ENTITLEMENTS);
    expect(entitlementsMock).toHaveBeenCalledWith(PROMISE_ID, { call: callMobileFunctionNative });
  });
});

describe('unlockWithRewardedAd', () => {
  test('보상형 플래그가 꺼져 있으면 의도도 광고도 만들지 않고 UNAVAILABLE 로 끝난다', async () => {
    flagMock.mockResolvedValue(false);
    await expect(unlockWithRewardedAd(PROMISE_ID, 'RETENTION_30D')).resolves.toEqual({
      phase: 'UNAVAILABLE',
    });
    expect(intentMock).not.toHaveBeenCalled();
    expect(showMock).not.toHaveBeenCalled();
    expect(statusMock).not.toHaveBeenCalled();
  });

  test('의도 생성 → 광고 시청 → SSV 폴링 순으로 진행해 GRANTED 권리를 돌려준다', async () => {
    statusMock
      .mockResolvedValueOnce({ intent_id: INTENT_ID, status: 'PENDING', entitlements: null })
      .mockResolvedValueOnce({ intent_id: INTENT_ID, status: 'GRANTED', entitlements: ENTITLEMENTS });

    const pending = unlockWithRewardedAd(PROMISE_ID, 'DURATION_30D');
    await jest.advanceTimersByTimeAsync(REWARD_SSV_POLL_MS);

    await expect(pending).resolves.toEqual({ phase: 'GRANTED', entitlements: ENTITLEMENTS });
    expect(intentMock).toHaveBeenCalledWith(PROMISE_ID, 'DURATION_30D', {
      call: callMobileFunctionNative,
    });
    // SSV 의 user_id·custom_data 는 서버가 만든 의도에서 나온다 — 광고는 의도 뒤에만 뜬다.
    expect(showMock).toHaveBeenCalledWith({
      action: 'DURATION_30D',
      opaqueUserId: OPAQUE_USER_ID,
      intentId: INTENT_ID,
    });
    expect(intentMock.mock.invocationCallOrder[0]).toBeLessThan(
      showMock.mock.invocationCallOrder[0] ?? 0,
    );
    expect(statusMock).toHaveBeenCalledTimes(2);
    expect(statusMock).toHaveBeenCalledWith(INTENT_ID, { call: callMobileFunctionNative });
  });

  test('대기 시간 안에 GRANTED 가 오지 않으면 의도 ID 와 함께 PENDING 으로 돌려준다', async () => {
    const pending = unlockWithRewardedAd(PROMISE_ID, 'RETENTION_30D');
    await jest.advanceTimersByTimeAsync(REWARD_SSV_WAIT_MS + REWARD_SSV_POLL_MS);

    await expect(pending).resolves.toEqual({ phase: 'PENDING', intentId: INTENT_ID });
    expect(statusMock).toHaveBeenCalledTimes(Math.ceil(REWARD_SSV_WAIT_MS / REWARD_SSV_POLL_MS));
  });

  test('광고를 끝까지 보지 않으면 폴링 없이 DISMISSED 로 끝난다', async () => {
    showMock.mockResolvedValue('DISMISSED');
    await expect(unlockWithRewardedAd(PROMISE_ID, 'RETENTION_30D')).resolves.toEqual({
      phase: 'DISMISSED',
    });
    expect(intentMock).toHaveBeenCalledTimes(1);
    expect(statusMock).not.toHaveBeenCalled();
  });

  test('광고를 띄우지 못하면 폴링 없이 UNAVAILABLE 로 끝난다', async () => {
    showMock.mockResolvedValue('UNAVAILABLE');
    await expect(unlockWithRewardedAd(PROMISE_ID, 'WITNESS_CREATOR')).resolves.toEqual({
      phase: 'UNAVAILABLE',
    });
    expect(statusMock).not.toHaveBeenCalled();
  });

  test('서버가 REJECTED 로 판정하면 더 기다리지 않고 UNAVAILABLE 로 끝난다', async () => {
    statusMock.mockResolvedValue({ intent_id: INTENT_ID, status: 'REJECTED', entitlements: null });
    await expect(unlockWithRewardedAd(PROMISE_ID, 'RETENTION_30D')).resolves.toEqual({
      phase: 'UNAVAILABLE',
    });
    expect(statusMock).toHaveBeenCalledTimes(1);
  });
});
