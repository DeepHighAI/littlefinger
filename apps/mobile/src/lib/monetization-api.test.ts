import {
  ENDPOINT,
  type Endpoint,
  type PromiseEntitlementsView,
  type RewardIntentResponse,
  type RewardStatusResponse,
} from '@littlefinger/shared';

import {
  createRewardIntent,
  fetchPromiseEntitlements,
  fetchRewardStatus,
  type MonetizationApiDeps,
} from './monetization-api.ts';

const PROMISE_ID = '11111111-1111-4111-8111-111111111111';
const INTENT_ID = '22222222-2222-4222-8222-222222222222';

const ENTITLEMENTS: PromiseEntitlementsView = {
  promise_id: PROMISE_ID,
  my_role: 'PARTNER',
  witness: { creator_capacity: 1, partner_capacity: 0, creator_used: 1, partner_used: 0, max: 3 },
  duration: { ceiling_date: '2026-10-28', unlimited: false },
  retention: {
    anchor_at: '2026-09-01T00:00:00.000Z',
    expires_at: '2026-10-31T00:00:00.000Z',
    permanent: false,
    renewable: true,
  },
};
const INTENT: RewardIntentResponse = {
  intent_id: INTENT_ID,
  status: 'PENDING',
  opaque_user_id: 'a'.repeat(64),
  expires_at: '2026-08-29T10:30:00.000Z',
};
const STATUS: RewardStatusResponse = {
  intent_id: INTENT_ID,
  status: 'GRANTED',
  entitlements: ENTITLEMENTS,
};

function deps() {
  const call = jest.fn<Promise<unknown>, [Endpoint, unknown, { idempotent?: boolean }]>();
  return { call, deps: { call } as MonetizationApiDeps };
}

describe('monetization mobile Edge API', () => {
  test('권리 조회는 약속 ID 만 보내는 비멱등 읽기다', async () => {
    const d = deps();
    d.call.mockResolvedValue(ENTITLEMENTS);

    await expect(fetchPromiseEntitlements(PROMISE_ID, d.deps)).resolves.toEqual(ENTITLEMENTS);
    expect(d.call).toHaveBeenCalledWith(
      ENDPOINT.promiseEntitlements,
      { promise_id: PROMISE_ID },
      { idempotent: false },
    );
  });

  test('보상 의도 생성은 약속 ID 와 행동을 보낸다', async () => {
    const d = deps();
    d.call.mockResolvedValue(INTENT);

    await expect(createRewardIntent(PROMISE_ID, 'DURATION_30D', d.deps)).resolves.toEqual(INTENT);
    expect(d.call).toHaveBeenCalledWith(
      ENDPOINT.rewardIntentCreate,
      { promise_id: PROMISE_ID, action: 'DURATION_30D' },
      { idempotent: false },
    );
  });

  test('보상 상태 조회는 의도 ID 만 보낸다', async () => {
    const d = deps();
    d.call.mockResolvedValue(STATUS);

    await expect(fetchRewardStatus(INTENT_ID, d.deps)).resolves.toEqual(STATUS);
    expect(d.call).toHaveBeenCalledWith(
      ENDPOINT.rewardStatus,
      { intent_id: INTENT_ID },
      { idempotent: false },
    );
  });

  // 파서가 거른 응답은 화면까지 가지 않는다 — 서버 계약 밖의 형태는 전부 같은 오류다.
  test.each([
    ['알 수 없는 키', { ...ENTITLEMENTS, extra: true }],
    ['UUID 아닌 약속 ID', { ...ENTITLEMENTS, promise_id: 'bad' }],
    ['정의되지 않은 역할', { ...ENTITLEMENTS, my_role: 'OWNER' }],
    ['음수 증인 용량', { ...ENTITLEMENTS, witness: { ...ENTITLEMENTS.witness, max: -1 } }],
    ['날짜가 아닌 상한', { ...ENTITLEMENTS, duration: { ceiling_date: 'soon', unlimited: false } }],
    ['객체가 아닌 응답', null],
  ])('권리 응답이 계약 밖이면 거부한다: %s', async (_, payload) => {
    const d = deps();
    d.call.mockResolvedValue(payload);
    await expect(fetchPromiseEntitlements(PROMISE_ID, d.deps)).rejects.toThrow(
      'INVALID_MONETIZATION_RESPONSE',
    );
  });

  test.each([
    ['알 수 없는 키', { ...INTENT, extra: true }],
    ['UUID 아닌 의도 ID', { ...INTENT, intent_id: 'bad' }],
    ['SSV 형식이 아닌 사용자 ID', { ...INTENT, opaque_user_id: 'user-1' }],
    ['정의되지 않은 상태', { ...INTENT, status: 'DONE' }],
  ])('보상 의도 응답이 계약 밖이면 거부한다: %s', async (_, payload) => {
    const d = deps();
    d.call.mockResolvedValue(payload);
    await expect(createRewardIntent(PROMISE_ID, 'RETENTION_30D', d.deps)).rejects.toThrow(
      'INVALID_MONETIZATION_RESPONSE',
    );
  });

  test.each([
    ['알 수 없는 키', { ...STATUS, extra: true }],
    ['계약 밖 권리 객체', { ...STATUS, entitlements: { ...ENTITLEMENTS, extra: true } }],
    ['정의되지 않은 상태', { ...STATUS, status: 'DONE' }],
  ])('보상 상태 응답이 계약 밖이면 거부한다: %s', async (_, payload) => {
    const d = deps();
    d.call.mockResolvedValue(payload);
    await expect(fetchRewardStatus(INTENT_ID, d.deps)).rejects.toThrow(
      'INVALID_MONETIZATION_RESPONSE',
    );
  });
});
