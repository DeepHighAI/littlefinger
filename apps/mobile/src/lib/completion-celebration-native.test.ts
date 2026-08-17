const mockCallMobileFunctionNative = jest.fn();
const mockCurrentMobileUserId = jest.fn();
const mockRandomUuid = jest.fn();
const mockValues = new Map<string, string>();

jest.mock('expo-crypto', () => ({ randomUUID: () => mockRandomUuid() }));
jest.mock('./mobile-api-native.ts', () => ({
  callMobileFunctionNative: (...args: unknown[]) => mockCallMobileFunctionNative(...args),
  currentMobileUserId: () => mockCurrentMobileUserId(),
}));
jest.mock('./supabase-native.ts', () => ({
  getMobileEncryptedStorage: () => ({
    getItem: async (key: string) => mockValues.get(key) ?? null,
    setItem: async (key: string, value: string) => { mockValues.set(key, value); },
    removeItem: async (key: string) => { mockValues.delete(key); },
  }),
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PROMISE_ID = '22222222-2222-4222-8222-222222222222';
const CLAIM_ID = '33333333-3333-4333-8333-333333333333';
const CLAIM_KEY = '44444444-4444-4444-8444-444444444444';

describe('MOD-03 native lifecycle binding', () => {
  beforeEach(() => {
    mockValues.clear();
    mockCallMobileFunctionNative.mockReset();
    mockCurrentMobileUserId.mockReset().mockResolvedValue(USER_ID);
    mockRandomUuid.mockReset().mockReturnValue(CLAIM_KEY);
  });

  test('pure claim modules do not load Expo native bindings', () => {
    jest.isolateModules(() => {
      expect(() => require('./completion-celebration-api.ts')).not.toThrow();
      expect(() => require('./completion-celebration-claim.ts')).not.toThrow();
    });
  });

  test('native binding delegates one durable claim through the shared mobile caller', async () => {
    mockCallMobileFunctionNative.mockResolvedValue({
      available: true,
      celebration: {
        claim_id: CLAIM_ID,
        promise_id: PROMISE_ID,
        title: '매일 걷기',
        counterpart_nickname: null,
        keep_rate_before: null,
        keep_rate_after: 100,
      },
    });
    const native = require('./completion-celebration-native.ts') as typeof import(
      './completion-celebration-native.ts'
    );

    await expect(native.claimCompletionCelebration(PROMISE_ID)).resolves.toMatchObject({
      claim_id: CLAIM_ID,
    });
    expect(mockCurrentMobileUserId).toHaveBeenCalledTimes(1);
    expect(mockRandomUuid).toHaveBeenCalledTimes(1);
  });
});
