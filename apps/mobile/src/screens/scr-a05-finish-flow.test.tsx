import type { PromiseDetailResponse, PromiseEntitlementsView } from '@littlefinger/shared';
import { act, fireEvent, render } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';

import PromiseDetailScreen from '../app/promise/[promise_id]';
import { getPromiseEntitlements } from '../lib/monetization-native.ts';
import {
  createPromiseAmendIdempotencyKey,
  requestPromiseAmend,
  respondPromiseAmend,
  withdrawPromiseAmend,
} from '../lib/promise-amend-native.ts';
import { getPromiseDetail } from '../lib/promise-detail-native.ts';

/**
 * SCR-A05 FINISH(마무리) 흐름 — 02 §7-1 T-19~T-21.
 * 종료일 없는 ACTIVE 약속만 당사자가 마무리를 요청할 수 있고, 화면 문구는 어디서나
 * "마무리"다 (PO 2026-08-29). 전송·응답·철회는 변경 요청과 같은 RPC 를 type 만 달리해 쓴다.
 */

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));
jest.mock('../lib/promise-detail-native.ts', () => ({ getPromiseDetail: jest.fn() }));
jest.mock('../lib/monetization-native.ts', () => ({ getPromiseEntitlements: jest.fn() }));
jest.mock('../lib/account-safety-native.ts', () => ({
  blockUserNative: jest.fn(),
  hidePromiseNative: jest.fn(),
  reportSafetyIssueNative: jest.fn(),
}));
jest.mock('../lib/completion-celebration-native.ts', () => ({
  claimCompletionCelebration: jest.fn().mockResolvedValue(null),
  markCompletionCelebrationShown: jest.fn(),
}));
jest.mock('../lib/fulfillment-native.ts', () => ({
  createFulfillmentIdempotencyKey: jest.fn(),
  reopenFulfillment: jest.fn(),
  signFulfillmentEvidence: jest.fn(),
}));
jest.mock('../lib/promise-amend-native.ts', () => ({
  createPromiseAmendIdempotencyKey: jest.fn(),
  listPromiseVersions: jest.fn(),
  requestPromiseAmend: jest.fn(),
  respondPromiseAmend: jest.fn(),
  withdrawPromiseAmend: jest.fn(),
}));
jest.mock('../lib/promise-editor-native.ts', () => ({ openEndDatePicker: jest.fn() }));
// 시트들은 이 흐름의 대상이 아니다 — 열리지 않는 빈 컴포넌트로 대체해 화면 계약만 본다.
jest.mock('../components/promise-amend-sheet.tsx', () => ({ PromiseAmendSheet: () => null }));
jest.mock('../components/witness-invite-sheet.tsx', () => ({ WitnessInviteSheet: () => null }));
jest.mock('../components/promise-entitlement-sheet.tsx', () => ({
  PromiseEntitlementSheet: () => null,
}));
jest.mock('../components/completion-celebration-sheet.tsx', () => ({
  CompletionCelebrationSheet: () => null,
}));

const PROMISE_ID = '11111111-1111-4111-8111-111111111111';
const CREATOR_ID = '22222222-2222-4222-8222-222222222222';
const PARTNER_ID = '33333333-3333-4333-8333-333333333333';
const WITNESS_ID = '77777777-7777-4777-8777-777777777777';
const REQUEST_ID = '99999999-9999-4999-8999-999999999999';
const AMEND_KEY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const loadDetailMock = jest.mocked(getPromiseDetail);
const entitlementsMock = jest.mocked(getPromiseEntitlements);
const createAmendKeyMock = jest.mocked(createPromiseAmendIdempotencyKey);
const requestAmendMock = jest.mocked(requestPromiseAmend);
const respondAmendMock = jest.mocked(respondPromiseAmend);
const withdrawAmendMock = jest.mocked(withdrawPromiseAmend);

const VERSION = {
  version_no: 1,
  title: '매주 화·목 아침 러닝 같이 하기',
  body: '매주 화요일과 목요일에 함께 달린다.',
  category: 'HABIT',
  end_date: null,
  keeper: 'BOTH',
  reward: null,
  penalty: null,
  content_hash: 'a'.repeat(64),
  fingerprint: 'AAAA-AAAA-AA',
  activated_at: '2026-08-01T00:00:00Z',
  superseded_at: null,
  change_reason: null,
} as const;

const ENTITLEMENTS: PromiseEntitlementsView = {
  promise_id: PROMISE_ID,
  my_role: 'CREATOR',
  witness: { creator_capacity: 1, partner_capacity: 0, creator_used: 0, partner_used: 0, max: 3 },
  duration: { ceiling_date: null, unlimited: false },
  retention: { anchor_at: null, expires_at: null, permanent: false, renewable: false },
};

const FINISH_REQUEST: NonNullable<PromiseDetailResponse['amend_request']> = {
  request_id: REQUEST_ID,
  type: 'FINISH',
  status: 'PENDING',
  requester: { user_id: CREATOR_ID, nickname: '지우', profile_image_url: null },
  reason: null,
  created_at: '2026-08-10T00:00:00Z',
  expires_at: '2026-08-24T00:00:00Z',
  proposed_version: null,
};

function makeDetail(overrides: Partial<PromiseDetailResponse> = {}): PromiseDetailResponse {
  return {
    promise_id: PROMISE_ID,
    status: 'ACTIVE',
    title: VERSION.title,
    body: VERSION.body,
    category: VERSION.category,
    end_date: null,
    keeper: VERSION.keeper,
    reward: null,
    penalty: null,
    witness_enabled: true,
    activated_at: '2026-08-01T00:00:00Z',
    closed_at: null,
    checking_started_at: null,
    check_deadline_at: null,
    check_round_no: 1,
    my_role: 'CREATOR',
    counterpart_push_available: true,
    creator: {
      user_id: CREATOR_ID,
      nickname: '지우',
      profile_image_url: null,
      role: 'CREATOR',
      status: 'JOINED',
      joined_at: '2026-07-31T00:00:00Z',
    },
    partner: {
      user_id: PARTNER_ID,
      nickname: '민준',
      profile_image_url: null,
      role: 'PARTNER',
      status: 'JOINED',
      joined_at: '2026-08-01T00:00:00Z',
    },
    witnesses: [],
    approvals: [
      {
        role: 'CREATOR',
        action: 'APPROVE',
        actor: { user_id: CREATOR_ID, nickname: '지우', profile_image_url: null },
        acted_at: '2026-07-31T00:00:00Z',
        comment: null,
      },
      {
        role: 'PARTNER',
        action: 'APPROVE',
        actor: { user_id: PARTNER_ID, nickname: '민준', profile_image_url: null },
        acted_at: '2026-08-01T00:00:00Z',
        comment: null,
      },
    ],
    current_version: VERSION,
    invitation: null,
    amend_request: null,
    fulfillment: null,
    ...overrides,
  };
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function alertButtons(): AlertButton[] {
  const buttons = jest.mocked(Alert.alert).mock.calls[0]?.[2];
  if (buttons === undefined) throw new Error('Alert.alert 이 버튼 없이 호출됐다.');
  return buttons;
}

describe('SCR-A05 마무리(FINISH) 흐름', () => {
  beforeEach(() => {
    jest.mocked(useRouter).mockReturnValue({ push: jest.fn(), back: jest.fn() } as never);
    jest.mocked(useLocalSearchParams).mockReturnValue({ promise_id: PROMISE_ID });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    loadDetailMock.mockReset().mockResolvedValue(makeDetail());
    entitlementsMock.mockReset().mockResolvedValue(ENTITLEMENTS);
    createAmendKeyMock.mockReset().mockReturnValue(AMEND_KEY);
    requestAmendMock.mockReset().mockResolvedValue({
      promise_id: PROMISE_ID,
      status: 'AMEND_PENDING',
      request_id: REQUEST_ID,
      type: 'FINISH',
      expires_at: '2026-08-24T00:00:00Z',
    });
    respondAmendMock.mockReset().mockResolvedValue({
      promise_id: PROMISE_ID,
      status: 'CHECKING',
      request_id: REQUEST_ID,
      request_status: 'APPROVED',
      version_no: 1,
    });
    withdrawAmendMock.mockReset().mockResolvedValue({
      promise_id: PROMISE_ID,
      status: 'ACTIVE',
      request_id: REQUEST_ID,
      request_status: 'WITHDRAWN',
    });
  });

  afterEach(() => jest.restoreAllMocks());

  test('종료일 없는 ACTIVE 약속은 당사자에게만 마무리 요청 액션을 보여준다', async () => {
    const view = await render(<PromiseDetailScreen />);
    await settle();
    expect(view.getByRole('button', { name: '이 약속 마무리 요청' })).toHaveStyle({ minHeight: 48 });
    // 종료일 없는 약속의 보관 기준 시각은 마무리 합의가 정한다.
    expect(view.getByText('마무리 합의 뒤 보관이 시작돼요')).toBeTruthy();

    loadDetailMock.mockResolvedValue(makeDetail({ end_date: '2026-09-01' }));
    const dated = await render(<PromiseDetailScreen />);
    await settle();
    expect(dated.queryByRole('button', { name: '이 약속 마무리 요청' })).toBeNull();

    loadDetailMock.mockResolvedValue(makeDetail({
      my_role: 'WITNESS',
      witnesses: [{
        user_id: WITNESS_ID,
        nickname: '하린',
        profile_image_url: null,
        role: 'WITNESS',
        status: 'JOINED',
        joined_at: '2026-08-02T00:00:00Z',
      }],
    }));
    const witness = await render(<PromiseDetailScreen />);
    await settle();
    expect(witness.queryByRole('button', { name: '이 약속 마무리 요청' })).toBeNull();
  });

  test('마무리 요청을 확인하면 FINISH 타입으로 변경 요청 API 를 호출하고 상세를 다시 읽는다', async () => {
    loadDetailMock
      .mockResolvedValueOnce(makeDetail())
      .mockResolvedValueOnce(makeDetail({ status: 'AMEND_PENDING', amend_request: FINISH_REQUEST }));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '이 약속 마무리 요청' }));
    expect(Alert.alert).toHaveBeenCalledWith(
      '이 약속의 마무리를 요청할까요?',
      '상대방이 승인한 시각부터 이행 확인과 기록 보관 기간이 시작돼요.',
      expect.any(Array),
    );
    const confirm = alertButtons().find((button) => button.text === '마무리 요청');
    expect(confirm).toBeDefined();
    expect(requestAmendMock).not.toHaveBeenCalled();

    await act(async () => { confirm?.onPress?.(); });
    await settle();
    expect(requestAmendMock).toHaveBeenCalledWith(
      { promise_id: PROMISE_ID, type: 'FINISH' },
      AMEND_KEY,
    );
    expect(loadDetailMock).toHaveBeenCalledTimes(2);
    expect(view.getByText('지우님이 이 약속의 마무리를 요청했어요.')).toBeTruthy();
  });

  test('마무리 대기 중 응답자는 마무리 승인·거절을 보고 승인하면 APPROVE 를 보낸다', async () => {
    loadDetailMock.mockResolvedValue(makeDetail({
      status: 'AMEND_PENDING',
      my_role: 'PARTNER',
      amend_request: FINISH_REQUEST,
    }));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.getByText('지우님이 이 약속의 마무리를 요청했어요.')).toBeTruthy();
    expect(view.getByRole('button', { name: '마무리하고 이행 확인 시작' })).toBeTruthy();
    expect(view.getByRole('button', { name: '거절' })).toBeTruthy();
    expect(view.queryByRole('button', { name: '요청 철회' })).toBeNull();
    expect(view.queryByText(/종료 승인|종료하고/u)).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: '마무리하고 이행 확인 시작' }));
    await settle();
    expect(respondAmendMock).toHaveBeenCalledWith(
      { promise_id: PROMISE_ID, request_id: REQUEST_ID, decision: 'APPROVE' },
      AMEND_KEY,
    );
  });

  test('마무리 대기 중 요청자는 승인 대신 철회만 본다', async () => {
    loadDetailMock.mockResolvedValue(makeDetail({
      status: 'AMEND_PENDING',
      amend_request: FINISH_REQUEST,
    }));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.queryByRole('button', { name: '마무리하고 이행 확인 시작' })).toBeNull();
    expect(view.queryByRole('button', { name: '거절' })).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: '요청 철회' }));
    await settle();
    expect(withdrawAmendMock).toHaveBeenCalledWith(PROMISE_ID, REQUEST_ID, AMEND_KEY);
  });

  test('승인 이력의 마무리 행동은 "종료" 가 아니라 "마무리" 로 표기된다', async () => {
    const base = makeDetail();
    loadDetailMock.mockResolvedValue(makeDetail({
      status: 'CHECKING',
      checking_started_at: '2026-08-12T00:00:00Z',
      check_deadline_at: '2026-08-19T00:00:00Z',
      approvals: [
        ...base.approvals,
        {
          role: 'CREATOR',
          action: 'FINISH_REQUEST',
          actor: { user_id: CREATOR_ID, nickname: '지우', profile_image_url: null },
          acted_at: '2026-08-10T00:00:00Z',
          comment: null,
        },
        {
          role: 'PARTNER',
          action: 'FINISH_APPROVE',
          actor: { user_id: PARTNER_ID, nickname: '민준', profile_image_url: null },
          acted_at: '2026-08-12T00:00:00Z',
          comment: null,
        },
      ],
      fulfillment: {
        round_no: 1,
        creator_has_submitted: false,
        partner_has_submitted: false,
        creator_check: null,
        partner_check: null,
        history: [],
      },
    }));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.getByText('마무리 요청')).toBeTruthy();
    expect(view.getByText('마무리 승인')).toBeTruthy();
    expect(view.queryByText(/종료 요청|종료 승인/u)).toBeNull();
  });
});
