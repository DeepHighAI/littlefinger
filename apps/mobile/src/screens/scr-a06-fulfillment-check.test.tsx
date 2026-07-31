import type {
  FulfillmentCheckView,
  PromiseFulfillmentDetailResponse,
} from '@littlefinger/shared';
import {
  act,
  fireEvent,
  render,
  within,
} from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import FulfillmentScreen from '../app/fulfillment/[promise_id]';
import {
  loadFulfillmentDetail,
  reopenFulfillment,
  submitFulfillment,
} from '../lib/fulfillment-native.ts';
import { MobileApiError } from '../lib/mobile-api.ts';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));
jest.mock(
  '../lib/fulfillment-native.ts',
  () => ({
    loadFulfillmentDetail: jest.fn(),
    reopenFulfillment: jest.fn(),
    submitFulfillment: jest.fn(),
  }),
  { virtual: true },
);

const push = jest.fn();
const back = jest.fn();
const loadDetailMock = jest.mocked(loadFulfillmentDetail);
const submitMock = jest.mocked(submitFulfillment);
const reopenMock = jest.mocked(reopenFulfillment);

const creatorCheck: FulfillmentCheckView = {
  role: 'CREATOR',
  answer: 'KEPT',
  comment: '아침마다 함께 달렸어요',
  submitted_at: '2026-08-11T16:30:00Z',
  revised_at: null,
  round_no: 1,
};

const partnerCheck: FulfillmentCheckView = {
  role: 'PARTNER',
  answer: 'NOT_KEPT',
  comment: '비 오는 날은 쉬었어요',
  submitted_at: '2026-08-11T17:30:00Z',
  revised_at: null,
  round_no: 1,
};

function makeDetail(
  overrides: Partial<PromiseFulfillmentDetailResponse> = {},
): PromiseFulfillmentDetailResponse {
  return {
    promise_id: 'promise-1',
    title: '매주 화·목 아침 러닝 같이 하기',
    body: '매주 두 번 함께 달린다.',
    category: 'HABIT',
    end_date: '2026-08-11',
    keeper: 'BOTH',
    reward: '브런치',
    penalty: '커피 사기',
    status: 'CHECKING',
    checking_started_at: '2026-08-11T15:00:00Z',
    check_deadline_at: '2026-08-18T15:00:00Z',
    check_round_no: 1,
    creator: {
      user_id: 'creator-1',
      nickname: '서윤',
      profile_image_url: null,
    },
    partner: {
      user_id: 'partner-1',
      nickname: '민준',
      profile_image_url: null,
    },
    my_check: null,
    partner_has_submitted: false,
    partner_check: null,
    history: [],
    ...overrides,
  };
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('SCR-A06 이행 확인', () => {
  beforeEach(() => {
    push.mockReset();
    back.mockReset();
    jest.mocked(useRouter).mockReturnValue({ push, back } as never);
    jest.mocked(useLocalSearchParams).mockReturnValue({ promise_id: 'promise-1' });
    loadDetailMock.mockReset();
    loadDetailMock.mockResolvedValue(makeDetail());
    submitMock.mockReset();
    submitMock.mockResolvedValue({
      promise_id: 'promise-1',
      status: 'CHECKING',
      round_no: 1,
      submitted_at: '2026-08-12T01:00:00Z',
      revised_at: null,
      waiting_for_partner: true,
      title: '매주 화·목 아침 러닝 같이 하기',
      actor_nickname: '서윤',
      notification_recipients: [],
    });
    reopenMock.mockReset();
    reopenMock.mockResolvedValue({
      promise_id: 'promise-1',
      status: 'CHECKING',
      round_no: 2,
      check_deadline_at: '2026-08-25T15:00:00Z',
      title: '매주 화·목 아침 러닝 같이 하기',
      notification_recipients: [],
    });
  });

  test('promise_id가 없으면 네트워크를 호출하지 않고 찾을 수 없음 상태를 보여준다', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});

    const view = await render(<FulfillmentScreen />);
    await settle();

    expect(loadDetailMock).not.toHaveBeenCalled();
    expect(view.getByText('약속을 찾을 수 없어요.')).toBeTruthy();
  });

  test('로딩을 보여준 뒤 실패한 상세 조회를 다시 시도할 수 있다', async () => {
    let rejectLoad: ((error: Error) => void) | undefined;
    loadDetailMock
      .mockImplementationOnce(
        async () =>
          await new Promise((_, reject) => {
            rejectLoad = reject;
          }),
      )
      .mockResolvedValueOnce(makeDetail());

    const view = await render(<FulfillmentScreen />);
    expect(view.getByText('이행 확인을 불러오는 중이에요')).toBeTruthy();

    await act(async () => rejectLoad?.(new Error('network')));
    expect(view.getByText('이행 확인을 불러오지 못했어요.')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: '다시 시도' }));
    await settle();
    expect(view.getByText('약속, 지켜졌나요?')).toBeTruthy();
    expect(loadDetailMock).toHaveBeenCalledTimes(2);
  });

  test('E_NOT_FOUND는 내부 정보를 숨긴 찾을 수 없음 상태로 표시한다', async () => {
    loadDetailMock.mockRejectedValue(
      new MobileApiError('E_NOT_FOUND', '약속을 찾을 수 없어요.'),
    );

    const view = await render(<FulfillmentScreen />);
    await settle();

    expect(view.getByText('약속을 찾을 수 없어요.')).toBeTruthy();
    expect(view.queryByText(/promise-1/u)).toBeNull();
  });

  test('답을 선택해야 제출이 활성화되고 화면에는 광고·증빙 영역이 없다', async () => {
    const view = await render(<FulfillmentScreen />);
    await settle();

    expect(
      view.getByRole('button', { name: '제출' }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
    await fireEvent.press(view.getByRole('button', { name: '지켰어요' }));
    expect(
      view.getByRole('button', { name: '제출' }).props.accessibilityState,
    ).toMatchObject({ disabled: false });
    expect(view.queryByText(/증빙/u)).toBeNull();
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
    expect(view.queryByTestId('evidence-picker')).toBeNull();
  });

  test('한 줄 의견은 NFC 정규화 뒤 코드포인트 200자는 허용하고 201자는 막는다', async () => {
    const view = await render(<FulfillmentScreen />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '지켰어요' }));

    const input = view.getByLabelText('한 줄 의견');
    await fireEvent.changeText(input, `가${'🙂'.repeat(199)}`);
    expect(input.props.value).toBe(`가${'🙂'.repeat(199)}`);
    expect(view.getByText('200/200')).toBeTruthy();
    expect(
      view.getByRole('button', { name: '제출' }).props.accessibilityState,
    ).toMatchObject({ disabled: false });

    await fireEvent.changeText(input, `가${'🙂'.repeat(200)}`);
    expect(view.getByText('201/200')).toBeTruthy();
    expect(view.getByText('한 줄 의견은 200자까지 입력할 수 있어요.')).toBeTruthy();
    expect(
      view.getByRole('button', { name: '제출' }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  test('내가 답하기 전 상대가 제출해도 답변과 의견은 숨긴다', async () => {
    loadDetailMock.mockResolvedValue(
      makeDetail({
        partner_has_submitted: true,
        partner_check: null,
      }),
    );

    const view = await render(<FulfillmentScreen />);
    await settle();

    expect(view.getByText('상대방이 먼저 답했어요')).toBeTruthy();
    expect(view.queryByText('비 오는 날은 쉬었어요')).toBeNull();
  });

  test('첫 제출 뒤 내 응답을 보존하고 상대 응답 전 한 번만 수정한다', async () => {
    loadDetailMock
      .mockResolvedValueOnce(makeDetail())
      .mockResolvedValueOnce(makeDetail({ my_check: creatorCheck }))
      .mockResolvedValueOnce(
        makeDetail({
          my_check: {
            ...creatorCheck,
            answer: 'NOT_KEPT',
            comment: '수정한 의견',
            revised_at: '2026-08-12T02:00:00Z',
          },
        }),
      );
    const view = await render(<FulfillmentScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '지켰어요' }));
    await fireEvent.changeText(view.getByLabelText('한 줄 의견'), '아침마다 함께 달렸어요');
    await fireEvent.press(view.getByRole('button', { name: '제출' }));
    await settle();

    expect(view.getByText('상대의 확인을 기다리고 있습니다.')).toBeTruthy();
    expect(view.getByText('아침마다 함께 달렸어요')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '응답 수정' }));
    expect(view.getByLabelText('한 줄 의견').props.value).toBe('아침마다 함께 달렸어요');

    await fireEvent.press(view.getByRole('button', { name: '안 지켜졌어요' }));
    await fireEvent.changeText(view.getByLabelText('한 줄 의견'), '수정한 의견');
    await fireEvent.press(view.getByRole('button', { name: '수정 제출' }));
    await settle();

    expect(submitMock).toHaveBeenNthCalledWith(2, {
      promise_id: 'promise-1',
      answer: 'NOT_KEPT',
      comment: '수정한 의견',
      revise: true,
    });
    expect(view.getByText('응답 수정 기회를 사용했어요.')).toBeTruthy();
    expect(view.queryByRole('button', { name: '응답 수정' })).toBeNull();
  });

  test('오래 열린 제출의 상태 충돌은 종결 안내 후 서버 상세를 다시 불러온다', async () => {
    loadDetailMock
      .mockResolvedValueOnce(makeDetail())
      .mockResolvedValueOnce(
        makeDetail({
          status: 'COMPLETED',
          my_check: creatorCheck,
          partner_has_submitted: true,
          partner_check: { ...partnerCheck, answer: 'KEPT' },
        }),
      );
    submitMock.mockRejectedValue(
      new MobileApiError('E_STATE_CONFLICT', '현재 상태에서는 처리할 수 없어요.'),
    );
    const view = await render(<FulfillmentScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '지켰어요' }));
    await fireEvent.press(view.getByRole('button', { name: '제출' }));
    await settle();

    expect(view.getByText('이미 종료된 약속입니다.')).toBeTruthy();
    expect(loadDetailMock).toHaveBeenCalledTimes(2);
    expect(view.getByText('완료')).toBeTruthy();
  });

  test('서버 CHECKING 시작 전 충돌은 종료일 익일 안내 후 상세를 다시 맞춘다', async () => {
    loadDetailMock
      .mockResolvedValueOnce(makeDetail({ checking_started_at: null }))
      .mockResolvedValueOnce(
        makeDetail({
          status: 'ACTIVE',
          checking_started_at: null,
          check_deadline_at: null,
        }),
      );
    submitMock.mockRejectedValue(
      new MobileApiError('E_STATE_CONFLICT', '현재 상태에서는 처리할 수 없어요.'),
    );
    const view = await render(<FulfillmentScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '지켰어요' }));
    await fireEvent.press(view.getByRole('button', { name: '제출' }));
    await settle();

    expect(
      view.getByText('종료일 다음 날부터 확인할 수 있습니다.'),
    ).toBeTruthy();
    expect(loadDetailMock).toHaveBeenCalledTimes(2);
  });

  test('DISPUTED는 양측 주장을 같은 구조로 보여주고 재확인 성공 뒤 새 라운드를 연다', async () => {
    loadDetailMock
      .mockResolvedValueOnce(
        makeDetail({
          status: 'DISPUTED',
          my_check: creatorCheck,
          partner_has_submitted: true,
          partner_check: partnerCheck,
        }),
      )
      .mockResolvedValueOnce(makeDetail({ check_round_no: 2 }));

    const view = await render(<FulfillmentScreen />);
    await settle();

    expect(
      view.getByText('두 분의 확인이 서로 달라요. 대화로 다시 정해보세요.'),
    ).toBeTruthy();
    const creatorClaim = within(view.getByTestId('claim-CREATOR'));
    const partnerClaim = within(view.getByTestId('claim-PARTNER'));
    expect(creatorClaim.getByText('작성자')).toBeTruthy();
    expect(creatorClaim.getByText('지켰어요')).toBeTruthy();
    expect(creatorClaim.getByText('아침마다 함께 달렸어요')).toBeTruthy();
    expect(partnerClaim.getByText('상대방')).toBeTruthy();
    expect(partnerClaim.getByText('안 지켜졌어요')).toBeTruthy();
    expect(partnerClaim.getByText('비 오는 날은 쉬었어요')).toBeTruthy();

    await fireEvent.press(
      view.getByRole('button', { name: '다시 확인 요청하기' }),
    );
    await settle();
    expect(reopenMock).toHaveBeenCalledWith('promise-1');
    expect(loadDetailMock).toHaveBeenCalledTimes(2);
    expect(view.getByText('약속, 지켜졌나요?')).toBeTruthy();
  });

  test('UNRESOLVED는 누가 응답했는지만 기록하고 잘못을 암시하지 않는다', async () => {
    loadDetailMock.mockResolvedValue(
      makeDetail({
        status: 'UNRESOLVED',
        my_check: creatorCheck,
      }),
    );

    const view = await render(<FulfillmentScreen />);
    await settle();

    expect(view.getByText('작성자 응답 완료')).toBeTruthy();
    expect(view.getByText('상대방 미응답')).toBeTruthy();
    expect(view.queryByText(/잘못|책임|탓/u)).toBeNull();
  });

  test('기기 시간대와 무관한 KST 종료일·응답 시각과 과거 라운드를 표시한다', async () => {
    loadDetailMock.mockResolvedValue(
      makeDetail({
        status: 'COMPLETED',
        my_check: creatorCheck,
        partner_has_submitted: true,
        partner_check: { ...partnerCheck, answer: 'KEPT' },
        history: [
          {
            round_no: 1,
            creator_check: creatorCheck,
            partner_check: partnerCheck,
          },
        ],
      }),
    );

    const view = await render(<FulfillmentScreen />);
    await settle();

    expect(view.getByText('종료일 2026-08-11 (화) (KST)')).toBeTruthy();
    expect(view.getAllByText('2026-08-12 01:30 (KST)').length).toBeGreaterThan(0);
    expect(view.getByText('1차 확인 기록')).toBeTruthy();
  });
});
