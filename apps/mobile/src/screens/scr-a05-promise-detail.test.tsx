import type {
  FulfillmentCheckView,
  PromiseDetailResponse,
} from '@littlefinger/shared';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Share } from 'react-native';

import PromiseDetailScreen from '../app/promise/[promise_id]';
import {
  createFulfillmentIdempotencyKey,
  reopenFulfillment,
  signFulfillmentEvidence,
} from '../lib/fulfillment-native.ts';
import { MobileApiError } from '../lib/mobile-api.ts';
import { getPromiseDetail } from '../lib/promise-detail-native.ts';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));
jest.mock('../lib/promise-detail-native.ts', () => ({ getPromiseDetail: jest.fn() }));
jest.mock('../lib/fulfillment-native.ts', () => ({
  createFulfillmentIdempotencyKey: jest.fn(),
  reopenFulfillment: jest.fn(),
  signFulfillmentEvidence: jest.fn(),
}));

const PROMISE_ID = '11111111-1111-4111-8111-111111111111';
const CREATOR_ID = '22222222-2222-4222-8222-222222222222';
const PARTNER_ID = '33333333-3333-4333-8333-333333333333';
const push = jest.fn();
const back = jest.fn();
const loadDetailMock = jest.mocked(getPromiseDetail);
const reopenMock = jest.mocked(reopenFulfillment);
const createKeyMock = jest.mocked(createFulfillmentIdempotencyKey);
const signEvidenceMock = jest.mocked(signFulfillmentEvidence);

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
    integrity_status: 'VERIFIED',
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
  });

  afterEach(() => jest.restoreAllMocks());

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
      '기록 일치',
    ]) expect(view.getAllByText(text).length).toBeGreaterThan(0);
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
  });

  test('ACTIVE에만 불변 법적 안내를 표시하고 무결성 실패를 별도 표기한다', async () => {
    loadDetailMock.mockResolvedValue(makeDetail({ integrity_status: 'FAILED' }));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.getByText('두 사람이 손가락 걸었어요!')).toBeTruthy();
    expect(view.getByText('기록 불일치')).toBeTruthy();
    expect(view.getByText(/공증이나 전자계약 서비스가 아니며/u)).toBeTruthy();
  });

  test('PENDING은 초대 만료를 표시하고 기존 초대 관리로 이동한다', async () => {
    loadDetailMock.mockResolvedValue(makeDetail({
      status: 'PENDING', activated_at: null, partner: null, approvals: [],
      current_version: { ...VERSION, activated_at: null },
      invitation: { status: 'PENDING', expires_at: '2026-08-18T15:00:00Z', resend_count: 2 },
      integrity_status: 'UNVERIFIED',
    }));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.getByText('상대방의 승인을 기다리고 있어요')).toBeTruthy();
    expect(view.getByText('2026-08-19 00:00 (KST)')).toBeTruthy();
    expect(view.queryByText(/공증이나 전자계약 서비스가 아니며/u)).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: '초대 관리하기' }));
    expect(push).toHaveBeenCalledWith({ pathname: '/invite', params: { promise_id: PROMISE_ID } });
  });

  test('AMEND_PENDING은 현재·제안 내용을 동등하게 보여주고 미구현 액션은 렌더하지 않는다', async () => {
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

    expect(view.getByText('현재 내용')).toBeTruthy();
    expect(view.getByText('제안 내용')).toBeTruthy();
    expect(view.getAllByText('2026-09-01 (화)').length).toBeGreaterThan(0);
    expect(view.getByText('2026-09-15 (화)')).toBeTruthy();
    expect(view.queryByRole('button', { name: /승인|거절|철회/u })).toBeNull();
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
      integrity_status: status === 'DECLINED' ? 'UNVERIFIED' : 'VERIFIED',
    }));
    const view = await render(<PromiseDetailScreen />);
    await settle();

    expect(view.getByText(headline)).toBeTruthy();
    expect(view.getAllByText(reason).length).toBeGreaterThan(0);
    expect(view.queryByRole('button', { name: /다시 보내기|변경|파기|증인|버전/u })).toBeNull();
  });
});
