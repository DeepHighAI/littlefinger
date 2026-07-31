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
  createFulfillmentIdempotencyKey,
  clearFulfillmentEvidenceDraft,
  discardFulfillmentEvidence,
  loadFulfillmentDetail,
  loadFulfillmentEvidenceDraft,
  pickFulfillmentEvidence,
  reopenFulfillment,
  saveFulfillmentEvidenceDraft,
  signFulfillmentEvidence,
  submitFulfillment,
  uploadFulfillmentEvidence,
} from '../lib/fulfillment-native.ts';
import { MobileApiError } from '../lib/mobile-api.ts';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));
jest.mock(
  '../lib/fulfillment-native.ts',
  () => ({
    createFulfillmentIdempotencyKey: jest.fn(),
    clearFulfillmentEvidenceDraft: jest.fn(),
    discardFulfillmentEvidence: jest.fn(),
    loadFulfillmentDetail: jest.fn(),
    loadFulfillmentEvidenceDraft: jest.fn(),
    pickFulfillmentEvidence: jest.fn(),
    reopenFulfillment: jest.fn(),
    saveFulfillmentEvidenceDraft: jest.fn(),
    signFulfillmentEvidence: jest.fn(),
    submitFulfillment: jest.fn(),
    uploadFulfillmentEvidence: jest.fn(),
  }),
  { virtual: true },
);

const push = jest.fn();
const back = jest.fn();
const loadDetailMock = jest.mocked(loadFulfillmentDetail);
const submitMock = jest.mocked(submitFulfillment);
const reopenMock = jest.mocked(reopenFulfillment);
const createKeyMock = jest.mocked(createFulfillmentIdempotencyKey);
const pickEvidenceMock = jest.mocked(pickFulfillmentEvidence);
const uploadEvidenceMock = jest.mocked(uploadFulfillmentEvidence);
const discardEvidenceMock = jest.mocked(discardFulfillmentEvidence);
const signEvidenceMock = jest.mocked(signFulfillmentEvidence);
const loadEvidenceDraftMock = jest.mocked(loadFulfillmentEvidenceDraft);
const saveEvidenceDraftMock = jest.mocked(saveFulfillmentEvidenceDraft);
const clearEvidenceDraftMock = jest.mocked(clearFulfillmentEvidenceDraft);

const creatorCheck: FulfillmentCheckView = {
  role: 'CREATOR',
  answer: 'KEPT',
  comment: '아침마다 함께 달렸어요',
  submitted_at: '2026-08-11T16:30:00Z',
  revised_at: null,
  round_no: 1,
  evidences: [],
};

const partnerCheck: FulfillmentCheckView = {
  role: 'PARTNER',
  answer: 'NOT_KEPT',
  comment: '비 오는 날은 쉬었어요',
  submitted_at: '2026-08-11T17:30:00Z',
  revised_at: null,
  round_no: 1,
  evidences: [],
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
    my_role: 'CREATOR',
    my_check: null,
    creator_has_submitted: false,
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
    createKeyMock.mockReset();
    createKeyMock.mockReturnValue('11111111-1111-4111-8111-111111111111');
    pickEvidenceMock.mockReset();
    pickEvidenceMock.mockResolvedValue({ status: 'CANCELED', assets: [] });
    uploadEvidenceMock.mockReset();
    discardEvidenceMock.mockReset();
    discardEvidenceMock.mockResolvedValue({
      upload_id: 'upload-1',
      status: 'DISCARDED',
    });
    signEvidenceMock.mockReset();
    signEvidenceMock.mockResolvedValue({
      evidence_id: 'evidence-1',
      variant: 'THUMBNAIL',
      signed_url: 'https://storage.example/thumbnail',
      expires_at: '2026-08-12T01:10:00Z',
    });
    loadEvidenceDraftMock.mockReset();
    loadEvidenceDraftMock.mockResolvedValue(null);
    saveEvidenceDraftMock.mockReset();
    saveEvidenceDraftMock.mockResolvedValue();
    clearEvidenceDraftMock.mockReset();
    clearEvidenceDraftMock.mockResolvedValue();
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

  test('답을 선택해야 제출이 활성화되고 선택 증빙 영역에는 광고가 없다', async () => {
    const view = await render(<FulfillmentScreen />);
    await settle();

    expect(
      view.getByRole('button', { name: '제출' }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
    await fireEvent.press(view.getByRole('button', { name: '지켰어요' }));
    expect(
      view.getByRole('button', { name: '제출' }).props.accessibilityState,
    ).toMatchObject({ disabled: false });
    expect(view.getByText(/증빙 사진/u)).toBeTruthy();
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
    expect(view.getByTestId('evidence-picker')).toBeTruthy();
  });

  test('사진 권한 거부를 안내하고 업로드를 시작하지 않는다', async () => {
    pickEvidenceMock.mockResolvedValue({ status: 'DENIED', assets: [] });
    const view = await render(<FulfillmentScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '사진 추가' }));
    await settle();

    expect(view.getByText('사진을 선택하려면 사진 접근 권한을 허용해 주세요.')).toBeTruthy();
    expect(uploadEvidenceMock).not.toHaveBeenCalled();
  });

  test('사진 선택기를 열지 못해도 화면을 유지하고 공통 오류를 안내한다', async () => {
    pickEvidenceMock.mockRejectedValue(new Error('picker unavailable'));
    const view = await render(<FulfillmentScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '사진 추가' }));
    await settle();

    expect(
      view.getByText('요청을 처리하지 못했어요. 다시 시도해 주세요.'),
    ).toBeTruthy();
    expect(uploadEvidenceMock).not.toHaveBeenCalled();
  });

  test('최대 3장을 개별 병렬 선업로드하고 진행 중에는 제출을 막는다', async () => {
    const assets = [1, 2, 3].map((index) => ({
      uri: `file:///photo-${index}.jpg`,
      file_name: `photo-${index}.jpg`,
      mime: 'image/jpeg',
      bytes: 1024 * index,
    }));
    pickEvidenceMock.mockResolvedValue({ status: 'SELECTED', assets });
    createKeyMock
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')
      .mockReturnValueOnce('33333333-3333-4333-8333-333333333333');
    const resolvers: ((value: {
      upload_id: string;
      status: 'READY';
      mime: 'image/jpeg';
      bytes: number;
      width: number;
      height: number;
    }) => void)[] = [];
    uploadEvidenceMock.mockImplementation(
      async () =>
        await new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const view = await render(<FulfillmentScreen />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '지켰어요' }));

    await fireEvent.press(view.getByRole('button', { name: '사진 추가' }));
    await settle();

    expect(uploadEvidenceMock).toHaveBeenCalledTimes(3);
    expect(
      view.getByRole('button', { name: '제출' }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
    expect(view.queryByRole('button', { name: '사진 추가' })).toBeNull();

    await act(async () => {
      resolvers.forEach((resolve, index) =>
        resolve({
          upload_id: `upload-${index + 1}`,
          status: 'READY',
          mime: 'image/jpeg',
          bytes: 800,
          width: 100,
          height: 50,
        }),
      );
      await Promise.resolve();
    });
    expect(
      view.getByRole('button', { name: '제출' }).props.accessibilityState,
    ).toMatchObject({ disabled: false });
  });

  test('형식·5MB를 넘는 사진은 거르고 일부 실패 뒤 성공 사진만 제출한다', async () => {
    pickEvidenceMock.mockResolvedValue({
      status: 'SELECTED',
      assets: [
        {
          uri: 'file:///ready.jpg',
          file_name: 'ready.jpg',
          mime: 'image/jpeg',
          bytes: 5 * 1024 * 1024,
        },
        {
          uri: 'file:///too-large.png',
          file_name: 'too-large.png',
          mime: 'image/png',
          bytes: 5 * 1024 * 1024 + 1,
        },
        {
          uri: 'file:///failed.webp',
          file_name: 'failed.webp',
          mime: 'image/webp',
          bytes: 1024,
        },
      ],
    });
    createKeyMock
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')
      .mockReturnValueOnce('33333333-3333-4333-8333-333333333333');
    uploadEvidenceMock
      .mockResolvedValueOnce({
        upload_id: 'upload-ready',
        status: 'READY',
        mime: 'image/jpeg',
        bytes: 800,
        width: 100,
        height: 50,
      })
      .mockRejectedValueOnce(new Error('network'));
    const view = await render(<FulfillmentScreen />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '지켰어요' }));

    await fireEvent.press(view.getByRole('button', { name: '사진 추가' }));
    await settle();

    expect(uploadEvidenceMock).toHaveBeenCalledTimes(2);
    expect(view.getByText('사진은 장당 5MB까지 올릴 수 있어요.')).toBeTruthy();
    expect(view.getByText('사진 1장을 올리지 못했어요.')).toBeTruthy();
    expect(
      view.getByRole('button', { name: '제출' }).props.accessibilityState,
    ).toMatchObject({ disabled: false });

    await fireEvent.press(view.getByRole('button', { name: '제출' }));
    await settle();
    expect(submitMock).toHaveBeenCalledWith(
      {
        promise_id: 'promise-1',
        answer: 'KEPT',
        evidence_upload_ids: ['upload-ready'],
      },
      '33333333-3333-4333-8333-333333333333',
    );
    expect(clearEvidenceDraftMock).toHaveBeenCalledWith('promise-1', 1);
  });

  test('이미지 피커가 MIME을 비워도 HEIC 확장자를 선업로드한다', async () => {
    const heic = {
      uri: 'file:///camera.heic',
      file_name: 'camera.heic',
      mime: '',
      bytes: 1024,
    };
    pickEvidenceMock.mockResolvedValue({
      status: 'SELECTED',
      assets: [heic],
    });
    uploadEvidenceMock.mockResolvedValue({
      upload_id: 'upload-heic',
      status: 'READY',
      mime: 'image/jpeg',
      bytes: 800,
      width: 100,
      height: 50,
    });
    const view = await render(<FulfillmentScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '사진 추가' }));
    await settle();

    expect(uploadEvidenceMock).toHaveBeenCalledWith(
      'promise-1',
      1,
      heic,
      '11111111-1111-4111-8111-111111111111',
    );
    expect(view.getByText('업로드 완료')).toBeTruthy();
  });

  test('정정은 기존 증빙 유지·제거와 신규 업로드를 함께 제출한다', async () => {
    const evidenceOne = {
      evidence_id: 'evidence-1',
      mime: 'image/jpeg',
      bytes: 100,
      width: 100,
      height: 50,
      availability: 'AVAILABLE' as const,
    };
    const evidenceTwo = { ...evidenceOne, evidence_id: 'evidence-2' };
    loadDetailMock.mockResolvedValue(
      makeDetail({
        my_check: {
          ...creatorCheck,
          evidences: [evidenceOne, evidenceTwo],
        },
      }),
    );
    signEvidenceMock.mockImplementation(async (evidenceId, variant) => ({
      evidence_id: evidenceId,
      variant,
      signed_url: `https://storage.example/${evidenceId}/${variant}`,
      expires_at: '2026-08-12T01:10:00Z',
    }));
    pickEvidenceMock.mockResolvedValue({
      status: 'SELECTED',
      assets: [
        {
          uri: 'file:///new.jpg',
          file_name: 'new.jpg',
          mime: 'image/jpeg',
          bytes: 1024,
        },
      ],
    });
    createKeyMock
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')
      .mockReturnValueOnce('33333333-3333-4333-8333-333333333333');
    uploadEvidenceMock.mockResolvedValue({
      upload_id: 'upload-new',
      status: 'READY',
      mime: 'image/jpeg',
      bytes: 800,
      width: 100,
      height: 50,
    });
    const view = await render(<FulfillmentScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '응답 수정' }));
    await fireEvent.press(
      view.getByRole('button', { name: '증빙 evidence-1 삭제' }),
    );
    await fireEvent.press(view.getByRole('button', { name: '사진 추가' }));
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '수정 제출' }));
    await settle();

    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        revise: true,
        evidence_upload_ids: ['upload-new'],
        retained_evidence_ids: ['evidence-2'],
      }),
      '22222222-2222-4222-8222-222222222222',
    );
  });

  test('열람은 10분 서명 URL을 요청하고 블라인드·만료 플레이스홀더를 구분한다', async () => {
    loadDetailMock.mockResolvedValue(
      makeDetail({
        status: 'COMPLETED',
        my_check: {
          ...creatorCheck,
          evidences: [
            {
              evidence_id: 'evidence-1',
              mime: 'image/jpeg',
              bytes: 100,
              width: 100,
              height: 50,
              availability: 'AVAILABLE',
            },
            {
              evidence_id: 'evidence-2',
              mime: 'image/jpeg',
              bytes: 100,
              width: 100,
              height: 50,
              availability: 'BLINDED',
            },
            {
              evidence_id: 'evidence-3',
              mime: 'image/jpeg',
              bytes: 100,
              width: 100,
              height: 50,
              availability: 'EXPIRED',
            },
          ],
        },
      }),
    );
    const view = await render(<FulfillmentScreen />);
    await settle();

    expect(signEvidenceMock).toHaveBeenCalledWith('evidence-1', 'THUMBNAIL');
    expect(view.getByText('신고 접수로 가려진 이미지입니다')).toBeTruthy();
    expect(view.getByText('보관 기간이 만료된 증빙입니다')).toBeTruthy();
    await fireEvent(
      view.getByTestId('evidence-image-evidence-1'),
      'error',
    );
    await settle();
    expect(signEvidenceMock).toHaveBeenCalledTimes(2);
  });

  test('실패한 사진 재시도는 같은 업로드 멱등 키를 쓰고 READY 제거는 폐기 API를 부른다', async () => {
    pickEvidenceMock.mockResolvedValue({
      status: 'SELECTED',
      assets: [
        {
          uri: 'file:///retry.jpg',
          file_name: 'retry.jpg',
          mime: 'image/jpeg',
          bytes: 1024,
        },
      ],
    });
    createKeyMock
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
    uploadEvidenceMock
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        upload_id: 'upload-retry',
        status: 'READY',
        mime: 'image/jpeg',
        bytes: 800,
        width: 100,
        height: 50,
      });
    const view = await render(<FulfillmentScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '사진 추가' }));
    await settle();
    await fireEvent.press(
      view.getByRole('button', { name: '사진 업로드 다시 시도' }),
    );
    await settle();

    expect(uploadEvidenceMock.mock.calls.map((call) => call[3])).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111',
    ]);
    await fireEvent.press(
      view.getByRole('button', {
        name: '증빙 11111111-1111-4111-8111-111111111111 삭제',
      }),
    );
    await settle();
    expect(discardEvidenceMock).toHaveBeenCalledWith(
      'upload-retry',
      '22222222-2222-4222-8222-222222222222',
    );
  });

  test('암호화 초안을 사용자·약속·라운드 기준으로 복원하고 제출 성공 시 지운다', async () => {
    loadEvidenceDraftMock.mockResolvedValue({
      answer: 'NOT_KEPT',
      comment: '복원한 의견',
      uploads: [
        {
          local_id: 'local-restored',
          upload_id: 'upload-restored',
          idempotency_key: '11111111-1111-4111-8111-111111111111',
          uri: 'file:///restored.jpg',
          mime: 'image/jpeg',
          bytes: 1024,
        },
      ],
      retained_evidence_ids: [],
    });
    createKeyMock.mockReturnValue(
      '22222222-2222-4222-8222-222222222222',
    );
    const view = await render(<FulfillmentScreen />);
    await settle();

    expect(
      view.getByRole('button', { name: '안 지켜졌어요' }).props
        .accessibilityState,
    ).toMatchObject({ selected: true });
    expect(view.getByLabelText('한 줄 의견').props.value).toBe('복원한 의견');
    await fireEvent.press(view.getByRole('button', { name: '제출' }));
    await settle();
    expect(submitMock).toHaveBeenCalledWith(
      {
        promise_id: 'promise-1',
        answer: 'NOT_KEPT',
        comment: '복원한 의견',
        evidence_upload_ids: ['upload-restored'],
      },
      '22222222-2222-4222-8222-222222222222',
    );
    expect(clearEvidenceDraftMock).toHaveBeenCalledWith('promise-1', 1);
  });

  test('정정 중 저장된 암호화 초안은 새로 열어도 수정 폼으로 복원한다', async () => {
    const evidence = {
      evidence_id: 'evidence-1',
      mime: 'image/jpeg',
      bytes: 100,
      width: 100,
      height: 50,
      availability: 'AVAILABLE' as const,
    };
    loadDetailMock.mockResolvedValue(
      makeDetail({
        my_check: {
          ...creatorCheck,
          evidences: [evidence],
        },
      }),
    );
    loadEvidenceDraftMock.mockResolvedValue({
      answer: 'NOT_KEPT',
      comment: '정정 중인 의견',
      uploads: [],
      retained_evidence_ids: ['evidence-1'],
    });

    const view = await render(<FulfillmentScreen />);
    await settle();

    expect(loadEvidenceDraftMock).toHaveBeenCalledWith('promise-1', 1);
    expect(view.getByRole('button', { name: '수정 제출' })).toBeTruthy();
    expect(
      view.getByRole('button', { name: '안 지켜졌어요' }).props
        .accessibilityState,
    ).toMatchObject({ selected: true });
    expect(view.getByLabelText('한 줄 의견').props.value).toBe(
      '정정 중인 의견',
    );
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
    createKeyMock
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
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

    expect(submitMock).toHaveBeenNthCalledWith(
      2,
      {
        promise_id: 'promise-1',
        answer: 'NOT_KEPT',
        comment: '수정한 의견',
        revise: true,
      },
      '22222222-2222-4222-8222-222222222222',
    );
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

  test('제출 응답 유실 뒤 같은 payload는 같은 키로 재시도하고 변경한 payload는 새 키를 쓴다', async () => {
    createKeyMock
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
    submitMock
      .mockRejectedValueOnce(new MobileApiError(null, 'network'))
      .mockRejectedValueOnce(new MobileApiError(null, 'network'))
      .mockResolvedValueOnce({
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
    const view = await render(<FulfillmentScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '지켰어요' }));
    await fireEvent.press(view.getByRole('button', { name: '제출' }));
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '제출' }));
    await settle();
    await fireEvent.changeText(view.getByLabelText('한 줄 의견'), '새 의견');
    await fireEvent.press(view.getByRole('button', { name: '제출' }));
    await settle();

    expect(submitMock).toHaveBeenNthCalledWith(
      1,
      { promise_id: 'promise-1', answer: 'KEPT' },
      '11111111-1111-4111-8111-111111111111',
    );
    expect(submitMock).toHaveBeenNthCalledWith(
      2,
      { promise_id: 'promise-1', answer: 'KEPT' },
      '11111111-1111-4111-8111-111111111111',
    );
    expect(submitMock).toHaveBeenNthCalledWith(
      3,
      {
        promise_id: 'promise-1',
        answer: 'KEPT',
        comment: '새 의견',
      },
      '22222222-2222-4222-8222-222222222222',
    );
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
    expect(reopenMock).toHaveBeenCalledWith(
      'promise-1',
      '11111111-1111-4111-8111-111111111111',
    );
    expect(loadDetailMock).toHaveBeenCalledTimes(2);
    expect(view.getByText('약속, 지켜졌나요?')).toBeTruthy();
  });

  test('재확인 응답 유실 뒤 같은 키로 재시도한다', async () => {
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
    reopenMock
      .mockRejectedValueOnce(new MobileApiError(null, 'network'))
      .mockResolvedValueOnce({
        promise_id: 'promise-1',
        status: 'CHECKING',
        round_no: 2,
        check_deadline_at: '2026-08-25T15:00:00Z',
        title: '매주 화·목 아침 러닝 같이 하기',
        notification_recipients: [],
      });
    const view = await render(<FulfillmentScreen />);
    await settle();

    await fireEvent.press(
      view.getByRole('button', { name: '다시 확인 요청하기' }),
    );
    await settle();
    await fireEvent.press(
      view.getByRole('button', { name: '다시 확인 요청하기' }),
    );
    await settle();

    expect(reopenMock).toHaveBeenNthCalledWith(
      1,
      'promise-1',
      '11111111-1111-4111-8111-111111111111',
    );
    expect(reopenMock).toHaveBeenNthCalledWith(
      2,
      'promise-1',
      '11111111-1111-4111-8111-111111111111',
    );
    expect(createKeyMock).toHaveBeenCalledTimes(1);
  });

  test('재확인이 이미 커밋된 상태 충돌도 상세를 다시 불러 CHECKING으로 수렴한다', async () => {
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
    reopenMock.mockRejectedValue(
      new MobileApiError('E_STATE_CONFLICT', '현재 상태에서는 처리할 수 없어요.'),
    );
    const view = await render(<FulfillmentScreen />);
    await settle();

    await fireEvent.press(
      view.getByRole('button', { name: '다시 확인 요청하기' }),
    );
    await settle();

    expect(loadDetailMock).toHaveBeenCalledTimes(2);
    expect(view.getByText('약속, 지켜졌나요?')).toBeTruthy();
  });

  test('UNRESOLVED는 누가 응답했는지만 기록하고 잘못을 암시하지 않는다', async () => {
    loadDetailMock.mockResolvedValue(
      makeDetail({
        status: 'UNRESOLVED',
        my_check: creatorCheck,
        creator_has_submitted: true,
      }),
    );

    const view = await render(<FulfillmentScreen />);
    await settle();

    expect(view.getByText('작성자 응답 완료')).toBeTruthy();
    expect(view.getByText('상대방 미응답')).toBeTruthy();
    expect(view.queryByText(/잘못|책임|탓/u)).toBeNull();
  });

  test('UNRESOLVED 미응답 상대방 관점에서도 작성자의 제출 사실을 정확히 표시한다', async () => {
    loadDetailMock.mockResolvedValue(
      makeDetail({
        status: 'UNRESOLVED',
        my_role: 'PARTNER',
        my_check: null,
        creator_has_submitted: true,
        partner_has_submitted: false,
        partner_check: null,
      }),
    );

    const view = await render(<FulfillmentScreen />);
    await settle();

    expect(view.getByText('작성자 응답 완료')).toBeTruthy();
    expect(view.getByText('상대방 미응답')).toBeTruthy();
    expect(view.queryByText('아침마다 함께 달렸어요')).toBeNull();
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
