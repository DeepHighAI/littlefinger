import type {
  FulfillmentCheckView,
  PromiseDetailResponse,
} from '@littlefinger/shared';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Share } from 'react-native';

import PromiseDetailScreen from '../app/promise/[promise_id]';
import {
  claimCompletionCelebration,
  markCompletionCelebrationShown,
} from '../lib/completion-celebration-native.ts';
import {
  createFulfillmentIdempotencyKey,
  reopenFulfillment,
  signFulfillmentEvidence,
} from '../lib/fulfillment-native.ts';
import { MobileApiError } from '../lib/mobile-api.ts';
import { getPromiseDetail } from '../lib/promise-detail-native.ts';
import {
  createPromiseAmendIdempotencyKey,
  listPromiseVersions,
  requestPromiseAmend,
  respondPromiseAmend,
  withdrawPromiseAmend,
} from '../lib/promise-amend-native.ts';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));
jest.mock('../lib/promise-detail-native.ts', () => ({ getPromiseDetail: jest.fn() }));
jest.mock('../lib/completion-celebration-native.ts', () => ({
  claimCompletionCelebration: jest.fn(),
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
jest.mock('../components/promise-amend-sheet.tsx', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PromiseAmendSheet: ({
      visible,
      onSubmit,
    }: {
      visible: boolean;
      onSubmit(input: unknown): Promise<void>;
    }) => visible ? React.createElement(
      View,
      null,
      React.createElement(Text, null, '변경·파기 요청 시트'),
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: '테스트 변경 제출',
          onPress: () => void onSubmit({
            promise_id: '11111111-1111-4111-8111-111111111111',
            type: 'AMEND',
            proposed: {
              title: '매주 화·목 아침 러닝 같이 하기',
              body: '매주 화요일과 목요일에 함께 달린다.',
              category: 'HABIT',
              end_date: '2026-09-01',
              keeper: 'BOTH',
              reward: '오마카세 사주기',
              penalty: '한 달 커피 사기',
            },
          }).catch(() => undefined),
        },
        React.createElement(Text, null, '테스트 변경 제출'),
      ),
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: '테스트 다른 변경 제출',
          onPress: () => void onSubmit({
            promise_id: '11111111-1111-4111-8111-111111111111',
            type: 'CANCEL',
          }).catch(() => undefined),
        },
        React.createElement(Text, null, '테스트 다른 변경 제출'),
      ),
    ) : null,
  };
}, { virtual: true });
jest.mock('../components/witness-invite-sheet.tsx', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    WitnessInviteSheet: ({ visible, promiseId }: { visible: boolean; promiseId: string }) =>
      visible ? React.createElement(Text, null, `증인 초대 시트 ${promiseId}`) : null,
  };
});
jest.mock('../components/completion-celebration-sheet.tsx', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CompletionCelebrationSheet: ({
      visible,
      celebration,
      onShown,
      onClose,
      onNewPromise,
      onShare,
    }: {
      visible: boolean;
      celebration: { title: string } | null;
      onShown(): void;
      onClose(): void;
      onNewPromise(): void;
      onShare(): void;
    }) => visible && celebration !== null ? React.createElement(
      View,
      { testID: 'completion-celebration-sheet' },
      React.createElement(Text, null, `축하 시트 ${celebration.title}`),
      React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: '테스트 표시', onPress: onShown }, React.createElement(Text, null, '테스트 표시')),
      React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: '축하 닫기', onPress: onClose }, React.createElement(Text, null, '축하 닫기')),
      React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: '새 약속 만들기', onPress: onNewPromise }, React.createElement(Text, null, '새 약속 만들기')),
      React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: '공유하기', onPress: onShare }, React.createElement(Text, null, '공유하기')),
    ) : null,
  };
}, { virtual: true });

const PROMISE_ID = '11111111-1111-4111-8111-111111111111';
const CREATOR_ID = '22222222-2222-4222-8222-222222222222';
const PARTNER_ID = '33333333-3333-4333-8333-333333333333';
const push = jest.fn();
const back = jest.fn();
const loadDetailMock = jest.mocked(getPromiseDetail);
const reopenMock = jest.mocked(reopenFulfillment);
const createKeyMock = jest.mocked(createFulfillmentIdempotencyKey);
const signEvidenceMock = jest.mocked(signFulfillmentEvidence);
const createAmendKeyMock = jest.mocked(createPromiseAmendIdempotencyKey);
const listVersionsMock = jest.mocked(listPromiseVersions);
const requestAmendMock = jest.mocked(requestPromiseAmend);
const respondAmendMock = jest.mocked(respondPromiseAmend);
const withdrawAmendMock = jest.mocked(withdrawPromiseAmend);
const claimCelebrationMock = jest.mocked(claimCompletionCelebration);
const markCelebrationShownMock = jest.mocked(markCompletionCelebrationShown);

const VERSION = {
  version_no: 1,
  title: '매주 화·목 아침 러닝 같이 하기',
  body: '매주 화요일과 목요일에 함께 달린다.',
  category: 'HABIT',
  end_date: '2026-09-01',
  keeper: 'BOTH',
  reward: '오마카세 사주기',
  penalty: '한 달 커피 사기',
  content_hash: 'a'.repeat(64),
  fingerprint: 'AAAA-AAAA-AA',
  activated_at: '2026-08-01T00:00:00Z',
  superseded_at: null,
  change_reason: null,
} as const;

const CELEBRATION = {
  claim_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  promise_id: PROMISE_ID,
  title: VERSION.title,
  counterpart_nickname: '민준',
  keep_rate_before: 87,
  keep_rate_after: 89,
} as const;

const creatorCheck: FulfillmentCheckView = {
  role: 'CREATOR',
  answer: 'KEPT',
  comment: '계획대로 지켰어요.',
  submitted_at: '2026-09-01T01:00:00Z',
  revised_at: null,
  round_no: 1,
  evidences: [
    {
      evidence_id: '44444444-4444-4444-8444-444444444444',
      mime: 'image/jpeg',
      bytes: 1024,
      width: 640,
      height: 480,
      availability: 'AVAILABLE',
    },
    {
      evidence_id: '55555555-5555-4555-8555-555555555555',
      mime: 'image/jpeg',
      bytes: 1024,
      width: 640,
      height: 480,
      availability: 'BLINDED',
    },
    {
      evidence_id: '66666666-6666-4666-8666-666666666666',
      mime: 'image/jpeg',
      bytes: 1024,
      width: 640,
      height: 480,
      availability: 'EXPIRED',
    },
  ],
};

const partnerCheck: FulfillmentCheckView = {
  role: 'PARTNER',
  answer: 'NOT_KEPT',
  comment: '비 오는 날은 쉬었어요.',
  submitted_at: '2026-09-01T02:00:00Z',
  revised_at: null,
  round_no: 1,
  evidences: [],
};

function makeDetail(overrides: Partial<PromiseDetailResponse> = {}): PromiseDetailResponse {
  return {
    promise_id: PROMISE_ID,
    status: 'ACTIVE',
    title: VERSION.title,
    body: VERSION.body,
    category: VERSION.category,
    end_date: VERSION.end_date,
    keeper: VERSION.keeper,
    reward: VERSION.reward,
    penalty: VERSION.penalty,
    witness_enabled: true,
    activated_at: '2026-08-01T00:00:00Z',
    closed_at: null,
    checking_started_at: null,
    check_deadline_at: null,
    check_round_no: 1,
    my_role: 'CREATOR',
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
    witnesses: [
      {
        user_id: '77777777-7777-4777-8777-777777777777',
        nickname: '하린',
        profile_image_url: null,
        role: 'WITNESS',
        status: 'JOINED',
        joined_at: '2026-08-02T00:00:00Z',
      },
    ],
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

function checkingDetail(overrides: Partial<PromiseDetailResponse> = {}): PromiseDetailResponse {
  return makeDetail({
    status: 'CHECKING',
    checking_started_at: '2026-09-01T15:00:00Z',
    check_deadline_at: '2026-09-08T15:00:00Z',
    fulfillment: {
      round_no: 1,
      creator_has_submitted: true,
      partner_has_submitted: false,
      creator_check: creatorCheck,
      partner_check: null,
      history: [],
    },
    ...overrides,
  });
}

function terminalDetail(
  status: Extract<PromiseDetailResponse['status'], 'COMPLETED' | 'BROKEN' | 'DISPUTED' | 'UNRESOLVED'>,
): PromiseDetailResponse {
  const checks =
    status === 'COMPLETED'
      ? { creator_check: creatorCheck, partner_check: { ...partnerCheck, answer: 'KEPT' as const } }
      : status === 'BROKEN'
        ? {
            creator_check: { ...creatorCheck, answer: 'NOT_KEPT' as const },
            partner_check: partnerCheck,
          }
        : status === 'DISPUTED'
          ? { creator_check: creatorCheck, partner_check: partnerCheck }
          : { creator_check: creatorCheck, partner_check: null };
  return makeDetail({
    status,
    closed_at: status === 'DISPUTED' ? null : '2026-09-08T15:00:00Z',
    fulfillment: {
      round_no: 1,
      creator_has_submitted: true,
      partner_has_submitted: status !== 'UNRESOLVED',
      ...checks,
      history: [],
    },
  });
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('SCR-A05 약속 상세', () => {
  beforeEach(() => {
    push.mockReset();
    back.mockReset();
    jest.mocked(useRouter).mockReturnValue({ push, back } as never);
    jest.mocked(useLocalSearchParams).mockReturnValue({ promise_id: PROMISE_ID });
    loadDetailMock.mockReset();
    loadDetailMock.mockResolvedValue(makeDetail());
    reopenMock.mockReset();
    reopenMock.mockResolvedValue({
      promise_id: PROMISE_ID,
      status: 'CHECKING',
      round_no: 2,
      check_deadline_at: '2026-09-15T15:00:00Z',
      title: VERSION.title,
      notification_recipients: [],
    });
    createKeyMock.mockReset();
    createKeyMock.mockReturnValue('88888888-8888-4888-8888-888888888888');
    signEvidenceMock.mockReset();
    signEvidenceMock.mockResolvedValue({
      evidence_id: creatorCheck.evidences[0]!.evidence_id,
      variant: 'FULL',
      signed_url: 'https://storage.example/full',
      expires_at: '2026-09-01T03:10:00Z',
    });
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    createAmendKeyMock.mockReset();
    createAmendKeyMock.mockReturnValue('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    requestAmendMock.mockReset();
    requestAmendMock.mockResolvedValue({
      promise_id: PROMISE_ID,
      status: 'AMEND_PENDING',
      request_id: '99999999-9999-4999-8999-999999999999',
      type: 'AMEND',
      expires_at: '2026-08-24T00:00:00Z',
    });
    respondAmendMock.mockReset();
    respondAmendMock.mockResolvedValue({
      promise_id: PROMISE_ID,
      status: 'ACTIVE',
      request_id: '99999999-9999-4999-8999-999999999999',
      request_status: 'APPROVED',
      version_no: 2,
    });
    withdrawAmendMock.mockReset();
    withdrawAmendMock.mockResolvedValue({
      promise_id: PROMISE_ID,
      status: 'ACTIVE',
      request_id: '99999999-9999-4999-8999-999999999999',
      request_status: 'WITHDRAWN',
    });
    listVersionsMock.mockReset();
    listVersionsMock.mockResolvedValue({ promise_id: PROMISE_ID, versions: [] });
    claimCelebrationMock.mockReset();
    claimCelebrationMock.mockResolvedValue(null);
    markCelebrationShownMock.mockReset();
    markCelebrationShownMock.mockResolvedValue();
  });

  afterEach(() => jest.restoreAllMocks());

  test.each(['CREATOR', 'PARTNER'] as const)('COMPLETED %s는 상세 뒤 MOD-03을 claim한다', async (role) => {
    loadDetailMock.mockResolvedValue({ ...terminalDetail('COMPLETED'), my_role: role });
    claimCelebrationMock.mockResolvedValue(CELEBRATION);
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.getByText(VERSION.title)).toBeTruthy();
    expect(claimCelebrationMock).toHaveBeenCalledWith(PROMISE_ID);
    expect(view.getByTestId('completion-celebration-sheet')).toBeTruthy();
  });

  test.each([
    ['COMPLETED', 'WITNESS'],
    ['PENDING', 'CREATOR'],
    ['ACTIVE', 'CREATOR'],
    ['AMEND_PENDING', 'PARTNER'],
    ['CHECKING', 'CREATOR'],
    ['BROKEN', 'CREATOR'],
    ['DISPUTED', 'PARTNER'],
    ['UNRESOLVED', 'CREATOR'],
    ['DECLINED', 'CREATOR'],
    ['CANCELED', 'PARTNER'],
  ] as const)('%s %s는 MOD-03을 claim하지 않는다', async (status, role) => {
    loadDetailMock.mockResolvedValue(makeDetail({ status, my_role: role }));
    await render(<PromiseDetailScreen />);
    await settle();
    expect(claimCelebrationMock).not.toHaveBeenCalled();
  });

  test.each([
    ['없음', async (): Promise<null> => null],
    ['실패', async (): Promise<never> => { throw new Error('network'); }],
  ] as const)('claim %s은 상세 사용성을 깨거나 오류 배너를 만들지 않는다', async (_case, result) => {
    loadDetailMock.mockResolvedValue(terminalDetail('COMPLETED'));
    claimCelebrationMock.mockImplementation(result);
    const view = await render(<PromiseDetailScreen />);
    await settle();
    expect(view.getByText(VERSION.title)).toBeTruthy();
    expect(view.queryByTestId('completion-celebration-sheet')).toBeNull();
    expect(view.queryByText('요청을 처리하지 못했어요. 다시 시도해 주세요.')).toBeNull();
  });

  test('같은 상세 화면 generation의 재렌더는 claim을 중복 시작하지 않는다', async () => {
    loadDetailMock.mockResolvedValue(terminalDetail('COMPLETED'));
    claimCelebrationMock.mockResolvedValue(CELEBRATION);
    const view = await render(<PromiseDetailScreen />);
    await settle();
    await view.rerender(<PromiseDetailScreen />);
    await settle();
    expect(claimCelebrationMock).toHaveBeenCalledTimes(1);
  });

  test('native onShow는 서버 claim ID를 한 번만 확인하고 실패해도 상세를 유지한다', async () => {
    loadDetailMock.mockResolvedValue(terminalDetail('COMPLETED'));
    claimCelebrationMock.mockResolvedValue(CELEBRATION);
    markCelebrationShownMock.mockRejectedValue(new Error('network'));
    const view = await render(<PromiseDetailScreen />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '테스트 표시' }));
    await fireEvent.press(view.getByRole('button', { name: '테스트 표시' }));
    await settle();
    expect(markCelebrationShownMock).toHaveBeenCalledTimes(1);
    expect(markCelebrationShownMock).toHaveBeenCalledWith(PROMISE_ID, CELEBRATION.claim_id);
    expect(view.getByText(VERSION.title)).toBeTruthy();
    expect(view.getByTestId('completion-celebration-sheet')).toBeTruthy();
  });

  test('닫기는 상세에 남고 다시 claim하지 않는다', async () => {
    loadDetailMock.mockResolvedValue(terminalDetail('COMPLETED'));
    claimCelebrationMock.mockResolvedValue(CELEBRATION);
    const view = await render(<PromiseDetailScreen />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '축하 닫기' }));
    expect(view.queryByTestId('completion-celebration-sheet')).toBeNull();
    expect(view.getByText(VERSION.title)).toBeTruthy();
    expect(claimCelebrationMock).toHaveBeenCalledTimes(1);
  });

  test('새 약속은 닫고 작성 화면으로 이동한다', async () => {
    loadDetailMock.mockResolvedValue(terminalDetail('COMPLETED'));
    claimCelebrationMock.mockResolvedValue(CELEBRATION);
    const view = await render(<PromiseDetailScreen />);
    await settle();
    await fireEvent.press(
      within(view.getByTestId('completion-celebration-sheet')).getByRole(
        'button',
        { name: '새 약속 만들기' },
      ),
    );
    expect(view.queryByTestId('completion-celebration-sheet')).toBeNull();
    expect(push).toHaveBeenCalledWith('/promise/edit');
  });

  test('공유는 SCR-A05 문구를 재사용하고 시트를 유지한다', async () => {
    loadDetailMock.mockResolvedValue(terminalDetail('COMPLETED'));
    claimCelebrationMock.mockResolvedValue(CELEBRATION);
    const view = await render(<PromiseDetailScreen />);
    await settle();
    await fireEvent.press(
      within(view.getByTestId('completion-celebration-sheet')).getByRole(
        'button',
        { name: '공유하기' },
      ),
    );
    await settle();
    expect(Share.share).toHaveBeenCalledWith({ message: `${VERSION.title} · 완료` });
    expect(view.getByTestId('completion-celebration-sheet')).toBeTruthy();
  });

  test.each([undefined, 'bad-id'])('없거나 잘못된 promise_id는 네트워크 없이 숨긴다', async (promiseId) => {
    jest.mocked(useLocalSearchParams).mockReturnValue(
      promiseId === undefined ? {} : { promise_id: promiseId },
    );
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(loadDetailMock).not.toHaveBeenCalled();
    expect(view.getByText('약속을 찾을 수 없어요.')).toBeTruthy();
  });

  test('로딩 뒤 네트워크 오류를 안전하게 다시 시도한다', async () => {
    let rejectLoad: ((error: Error) => void) | undefined;
    loadDetailMock
      .mockImplementationOnce(
        async () => await new Promise((_, reject) => { rejectLoad = reject; }),
      )
      .mockResolvedValueOnce(makeDetail());
    const view = await render(<PromiseDetailScreen />);

    expect(view.getByText('약속 상세를 불러오는 중이에요')).toBeTruthy();
    await act(async () => rejectLoad?.(new Error('network')));
    expect(view.getByText('약속 상세를 불러오지 못했어요.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '다시 시도' }));
    await settle();
    expect(view.getByText(VERSION.title)).toBeTruthy();
    expect(loadDetailMock).toHaveBeenCalledTimes(2);
  });

  test('E_NOT_FOUND와 뒤로 가기는 내부 식별자를 드러내지 않는다', async () => {
    loadDetailMock.mockRejectedValue(new MobileApiError('E_NOT_FOUND', 'not found'));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.getByText('약속을 찾을 수 없어요.')).toBeTruthy();
    expect(view.queryByText(PROMISE_ID)).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: '뒤로' }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  test('공통 전문·분류·지킬 사람·종료일·보상·벌칙·참여자·승인·지문을 표시한다', async () => {
    const view = await render(<PromiseDetailScreen />);
    await settle();

    for (const text of [
      VERSION.title,
      VERSION.body,
      '카테고리 · 습관',
      '지킬 사람 · 둘 다',
      '2026-09-01 (화)',
      VERSION.reward,
      VERSION.penalty,
      '지우',
      '민준',
      '하린',
      '2026-07-31 09:00 (KST)',
      '2026-08-01 09:00 (KST)',
      '기록 지문 · AAAA-AAAA-AA',
    ]) expect(view.getAllByText(text).length).toBeGreaterThan(0);
    expect(view.queryByText('기록 일치')).toBeNull();
    expect(view.queryByText('기록 불일치')).toBeNull();
    expect(view.queryByText('확정 전 기록')).toBeNull();
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
  });

  test('ACTIVE에만 불변 법적 안내를 표시하고 내부 무결성 결과는 노출하지 않는다', async () => {
    loadDetailMock.mockResolvedValue(makeDetail());
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.getByText('두 사람이 손가락 걸었어요!')).toBeTruthy();
    expect(view.queryByText('기록 일치')).toBeNull();
    expect(view.queryByText('기록 불일치')).toBeNull();
    expect(view.queryByText('확정 전 기록')).toBeNull();
    expect(view.getByText(/공증이나 전자계약 서비스가 아니며/u)).toBeTruthy();
  });

  test.each([
    ['PENDING', 'CREATOR'],
    ['PENDING', 'PARTNER'],
    ['ACTIVE', 'CREATOR'],
    ['ACTIVE', 'PARTNER'],
    ['AMEND_PENDING', 'CREATOR'],
    ['AMEND_PENDING', 'PARTNER'],
    ['CHECKING', 'CREATOR'],
    ['CHECKING', 'PARTNER'],
  ] as const)('%s의 %s는 MOD-02를 열 수 있다', async (status, myRole) => {
    loadDetailMock.mockResolvedValue(makeDetail({ status, my_role: myRole }));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '증인 초대' }));
    expect(view.getByText(`증인 초대 시트 ${PROMISE_ID}`)).toBeTruthy();
  });

  test('증인 역할과 종결 상태에는 MOD-02 진입을 노출하지 않는다', async () => {
    loadDetailMock.mockResolvedValue(makeDetail({ status: 'COMPLETED', my_role: 'WITNESS' }));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.queryByRole('button', { name: '증인 초대' })).toBeNull();
  });

  test('PENDING은 초대 만료를 표시하고 기존 초대 관리로 이동한다', async () => {
    loadDetailMock.mockResolvedValue(makeDetail({
      status: 'PENDING', activated_at: null, partner: null, approvals: [],
      current_version: { ...VERSION, activated_at: null },
      invitation: { status: 'PENDING', expires_at: '2026-08-18T15:00:00Z', resend_count: 2 },
    }));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.getByText('상대방의 승인을 기다리고 있어요')).toBeTruthy();
    expect(view.getByText('2026-08-19 00:00 (KST)')).toBeTruthy();
    expect(view.queryByText(/공증이나 전자계약 서비스가 아니며/u)).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: '초대 관리하기' }));
    expect(push).toHaveBeenCalledWith({ pathname: '/invite', params: { promise_id: PROMISE_ID } });
  });

  test('AMEND_PENDING은 변경된 필드만 동등한 전후 구조로 보여주고 요청자는 철회한다', async () => {
    loadDetailMock.mockResolvedValue(makeDetail({
      status: 'AMEND_PENDING',
      amend_request: {
        request_id: '99999999-9999-4999-8999-999999999999',
        type: 'AMEND', status: 'PENDING',
        requester: { user_id: CREATOR_ID, nickname: '지우', profile_image_url: null },
        reason: '휴가 기간 반영', created_at: '2026-08-10T00:00:00Z',
        expires_at: '2026-08-17T00:00:00Z',
        proposed_version: { ...VERSION, version_no: 2, end_date: '2026-09-15', content_hash: 'b'.repeat(64), fingerprint: 'BBBB-BBBB-BB', activated_at: null, change_reason: '휴가 기간 반영' },
      },
    }));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.getByText('변경 전 · 종료일')).toBeTruthy();
    expect(view.getByText('변경 후 · 종료일')).toBeTruthy();
    expect(view.getAllByText('2026-09-01 (화)').length).toBeGreaterThan(0);
    expect(view.getByText('2026-09-15 (화)')).toBeTruthy();
    expect(view.queryByText('변경 전 · 제목')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: '요청 철회' }));
    await settle();
    expect(withdrawAmendMock).toHaveBeenCalledWith(
      PROMISE_ID,
      '99999999-9999-4999-8999-999999999999',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
  });

  test('ACTIVE 당사자만 MOD-01에 진입하고 증인·다른 상태에는 액션을 숨긴다', async () => {
    const view = await render(<PromiseDetailScreen />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '변경·파기 요청' }));
    expect(view.getByText('변경·파기 요청 시트')).toBeTruthy();

    loadDetailMock.mockResolvedValue(makeDetail({ my_role: 'WITNESS' }));
    const witness = await render(<PromiseDetailScreen />);
    await settle();
    expect(witness.queryByRole('button', { name: '변경·파기 요청' })).toBeNull();
  });

  test('변경 요청 재시도는 같은 키를 보존하고 성공한 authoritative refresh 뒤 초기화한다', async () => {
    requestAmendMock
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        promise_id: PROMISE_ID,
        status: 'AMEND_PENDING',
        request_id: '99999999-9999-4999-8999-999999999999',
        type: 'AMEND',
        expires_at: '2026-08-24T00:00:00Z',
      });
    loadDetailMock
      .mockResolvedValueOnce(makeDetail())
      .mockResolvedValueOnce(makeDetail({ status: 'AMEND_PENDING' }));
    const view = await render(<PromiseDetailScreen />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '변경·파기 요청' }));
    await fireEvent.press(view.getByRole('button', { name: '테스트 변경 제출' }));
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '테스트 변경 제출' }));
    await settle();

    expect(createAmendKeyMock).toHaveBeenCalledTimes(1);
    expect(requestAmendMock.mock.calls.map((call) => call[1])).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ]);
    expect(loadDetailMock).toHaveBeenCalledTimes(2);
  });

  test('네트워크 실패 뒤 요청 전문이 바뀌면 새 멱등 키를 사용한다', async () => {
    createAmendKeyMock
      .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    requestAmendMock.mockRejectedValue(new Error('network'));
    const view = await render(<PromiseDetailScreen />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '변경·파기 요청' }));
    await fireEvent.press(view.getByRole('button', { name: '테스트 변경 제출' }));
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '테스트 다른 변경 제출' }));
    await settle();

    expect(requestAmendMock.mock.calls.map((call) => call[1])).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ]);
  });

  test('응답자는 변경 승인·거절을 보고 만료된 승인 실패 시 최신 상태를 다시 읽는다', async () => {
    const pending = makeDetail({
      status: 'AMEND_PENDING',
      my_role: 'PARTNER',
      amend_request: {
        request_id: '99999999-9999-4999-8999-999999999999',
        type: 'AMEND',
        status: 'PENDING',
        requester: { user_id: CREATOR_ID, nickname: '지우', profile_image_url: null },
        reason: null,
        created_at: '2026-08-10T00:00:00Z',
        expires_at: '2026-08-24T00:00:00Z',
        proposed_version: { ...VERSION, version_no: 2, end_date: '2026-09-15', content_hash: 'b'.repeat(64), fingerprint: 'BBBB-BBBB-BB', activated_at: null },
      },
    });
    respondAmendMock.mockRejectedValueOnce(new MobileApiError('E_VALIDATION', '종료일 경과'));
    loadDetailMock.mockResolvedValueOnce(pending).mockResolvedValueOnce(makeDetail());
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.getByRole('button', { name: '변경 승인' })).toHaveStyle({ minHeight: 48 });
    expect(view.getByRole('button', { name: '거절' })).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '변경 승인' }));
    await settle();
    expect(respondAmendMock).toHaveBeenCalledWith(
      { promise_id: PROMISE_ID, request_id: '99999999-9999-4999-8999-999999999999', decision: 'APPROVE' },
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect(loadDetailMock).toHaveBeenCalledTimes(2);
    expect(view.getByText('두 사람이 손가락 걸었어요!')).toBeTruthy();
  });

  test('네트워크 실패 뒤 응답 결정을 바꾸면 새 멱등 키를 사용한다', async () => {
    createAmendKeyMock
      .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    respondAmendMock.mockRejectedValue(new Error('network'));
    loadDetailMock.mockResolvedValue(makeDetail({
      status: 'AMEND_PENDING',
      my_role: 'PARTNER',
      amend_request: {
        request_id: '99999999-9999-4999-8999-999999999999',
        type: 'AMEND', status: 'PENDING',
        requester: { user_id: CREATOR_ID, nickname: '지우', profile_image_url: null },
        reason: null, created_at: '2026-08-10T00:00:00Z', expires_at: '2026-08-24T00:00:00Z',
        proposed_version: { ...VERSION, version_no: 2, end_date: '2026-09-15', activated_at: null },
      },
    }));
    const view = await render(<PromiseDetailScreen />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '변경 승인' }));
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '거절' }));
    await settle();

    expect(respondAmendMock.mock.calls.map((call) => call[1])).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ]);
  });

  test('파기 대기에는 전문 비교 대신 중립 안내와 파기 승인 문구를 표시한다', async () => {
    loadDetailMock.mockResolvedValue(makeDetail({
      status: 'AMEND_PENDING',
      my_role: 'PARTNER',
      amend_request: {
        request_id: '99999999-9999-4999-8999-999999999999',
        type: 'CANCEL',
        status: 'PENDING',
        requester: { user_id: CREATOR_ID, nickname: '지우', profile_image_url: null },
        reason: '일정 변경',
        created_at: '2026-08-10T00:00:00Z',
        expires_at: '2026-08-24T00:00:00Z',
        proposed_version: null,
      },
    }));
    const view = await render(<PromiseDetailScreen />);
    await settle();
    expect(view.getByText('지우님이 파기를 요청했어요')).toBeTruthy();
    expect(view.queryByText('변경 전 · 종료일')).toBeNull();
    expect(view.getByRole('button', { name: '파기 승인' })).toBeTruthy();
  });

  test('버전 이력은 메타데이터와 각 버전 전문을 읽기 전용으로 표시한다', async () => {
    listVersionsMock.mockResolvedValue({
      promise_id: PROMISE_ID,
      versions: [{
        version: VERSION,
        change_requester: { user_id: CREATOR_ID, nickname: '지우', profile_image_url: null },
        approved_by: { user_id: PARTNER_ID, nickname: '민준', profile_image_url: null },
        approved_at: '2026-08-01T00:00:00Z',
        change_reason: '첫 확정',
      }],
    });
    const view = await render(<PromiseDetailScreen />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '버전 이력 보기' }));
    await settle();

    for (const text of ['v1', '지우', '민준', '첫 확정', VERSION.body, 'aaaaaaaa']) {
      expect(view.getAllByText(text).length).toBeGreaterThan(0);
    }
    expect(view.queryByRole('button', { name: /삭제/u })).toBeNull();
  });

  test('CHECKING은 양측 제출 사실과 기한을 표시하고 SCR-A06으로 이동한다', async () => {
    loadDetailMock.mockResolvedValue(checkingDetail());
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.getByText('지우 · 응답 완료')).toBeTruthy();
    expect(view.getByText('민준 · 응답 없음')).toBeTruthy();
    expect(view.getByText('2026-09-09 00:00 (KST)')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '이행 확인하기' }));
    expect(push).toHaveBeenCalledWith({ pathname: '/fulfillment/[promise_id]', params: { promise_id: PROMISE_ID } });
  });

  test.each([
    ['COMPLETED', '약속 지킴! 완주했어요'],
    ['BROKEN', '이번엔 못 지켰어요'],
    ['DISPUTED', '서로의 응답이 달라요'],
    ['UNRESOLVED', '응답 없이 종료됐어요'],
  ] as const)('%s 결과를 상태 문구와 양측 사실로 표시한다', async (status, headline) => {
    loadDetailMock.mockResolvedValue(terminalDetail(status));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.getByText(headline)).toBeTruthy();
    expect(view.getByText('지우 · 응답 완료')).toBeTruthy();
    expect(view.getByText(status === 'UNRESOLVED' ? '민준 · 응답 없음' : '민준 · 응답 완료')).toBeTruthy();
  });

  test('DISPUTED는 양측 주장을 같은 카드 구조로 표시하고 재확인 라운드를 연다', async () => {
    loadDetailMock.mockResolvedValue(terminalDetail('DISPUTED'));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    const claims = view.getAllByTestId(/^detail-claim-/u);
    expect(claims).toHaveLength(2);
    for (const claim of claims) {
      expect(within(claim).getAllByText(/증빙/u).length).toBeGreaterThan(0);
    }
    await fireEvent.press(view.getByRole('button', { name: '재확인하기' }));
    await settle();
    expect(reopenMock).toHaveBeenCalledWith(
      PROMISE_ID,
      '88888888-8888-4888-8888-888888888888',
    );
    expect(push).toHaveBeenCalledWith({ pathname: '/fulfillment/[promise_id]', params: { promise_id: PROMISE_ID } });
  });

  test('증빙은 블라인드·만료 문구를 유지하고 AVAILABLE만 새 10분 URL로 연다', async () => {
    loadDetailMock.mockResolvedValue(terminalDetail('COMPLETED'));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.getByText('신고 접수로 가려진 이미지입니다')).toBeTruthy();
    expect(view.getByText('보관 기간이 지난 증빙입니다')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '증빙 사진 열기' }));
    await settle();
    expect(signEvidenceMock).toHaveBeenCalledWith(creatorCheck.evidences[0]!.evidence_id, 'FULL');
    expect(Linking.openURL).toHaveBeenCalledWith('https://storage.example/full');
  });

  test('COMPLETED 공유는 제목·상태만 포함하고 새 약속 작성으로 이동한다', async () => {
    loadDetailMock.mockResolvedValue(terminalDetail('COMPLETED'));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '공유하기' }));
    const shared = JSON.stringify(jest.mocked(Share.share).mock.calls[0]?.[0]);
    expect(shared).toContain(VERSION.title);
    expect(shared).toContain('완료');
    expect(shared).not.toContain(VERSION.body);
    expect(shared).not.toContain(VERSION.reward);
    expect(shared).not.toContain(VERSION.penalty);
    await fireEvent.press(view.getByRole('button', { name: '새 약속 만들기' }));
    expect(push).toHaveBeenCalledWith('/promise/edit');
  });

  test.each([
    ['DECLINED', '이번엔 성립되지 않았어요', '초대 내용을 받아들이기 어려워요'],
    ['CANCELED', '약속이 파기됐어요', '일정이 바뀌었어요'],
  ] as const)('%s는 중립 종결 이유를 표시하고 가짜 수정 액션이 없다', async (status, headline, reason) => {
    loadDetailMock.mockResolvedValue(makeDetail({
      status,
      closed_at: '2026-08-20T00:00:00Z',
      amend_request: status === 'CANCELED' ? {
        request_id: '99999999-9999-4999-8999-999999999999', type: 'CANCEL', status: 'APPROVED',
        requester: { user_id: CREATOR_ID, nickname: '지우', profile_image_url: null },
        reason, created_at: '2026-08-19T00:00:00Z', expires_at: '2026-08-26T00:00:00Z', proposed_version: null,
      } : null,
      approvals: status === 'DECLINED' ? [{
        role: 'PARTNER', action: 'DECLINE', actor: { user_id: PARTNER_ID, nickname: '민준', profile_image_url: null },
        acted_at: '2026-08-20T00:00:00Z', comment: reason,
      }] : [],
    }));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.getByText(headline)).toBeTruthy();
    expect(view.getAllByText(reason).length).toBeGreaterThan(0);
    expect(view.queryByRole('button', { name: /다시 보내기|변경|파기|증인|버전/u })).toBeNull();
  });
});
