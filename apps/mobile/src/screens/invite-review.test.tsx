import { LEGAL_DISCLAIMER } from '@littlefinger/shared';
import { act, fireEvent, render } from '@testing-library/react-native';

import InviteReviewScreen from '../app/i/[token]';
import { openInviteInBrowserNative } from '../lib/invite-link-native.ts';
import {
  approveInviteNative,
  declineInviteNative,
  previewInviteNative,
  resolveInviteNative,
  suggestInviteAmendNative,
  watchMobileSession,
} from '../lib/invite-review-native.ts';
import { signInWithKakao } from '../lib/kakao-auth-native.ts';
import { MobileApiError } from '../lib/mobile-api.ts';

let mockToken = 'a-b_c';
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ token: mockToken }),
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock('../lib/invite-link-native.ts', () => ({ openInviteInBrowserNative: jest.fn() }));
jest.mock('../lib/invite-review-native.ts', () => ({
  resolveInviteNative: jest.fn(),
  previewInviteNative: jest.fn(),
  approveInviteNative: jest.fn(),
  declineInviteNative: jest.fn(),
  suggestInviteAmendNative: jest.fn(),
  watchMobileSession: jest.fn(),
  createInviteReviewIdempotencyKey: jest.fn(() => 'key-1'),
}));
jest.mock('../lib/kakao-auth-native.ts', () => ({
  signInWithKakao: jest.fn(),
  signInWithGoogle: jest.fn(),
}));

const resolveMock = jest.mocked(resolveInviteNative);
const previewMock = jest.mocked(previewInviteNative);
const approveMock = jest.mocked(approveInviteNative);
const declineMock = jest.mocked(declineInviteNative);
const suggestMock = jest.mocked(suggestInviteAmendNative);
const watchMock = jest.mocked(watchMobileSession);
const openBrowserMock = jest.mocked(openInviteInBrowserNative);
const kakaoMock = jest.mocked(signInWithKakao);

const INVITE = {
  creator_nickname: '지우',
  title: '매일 걷기',
  expires_at: '2099-01-01T00:00:00Z',
  target_role: 'PARTNER' as const,
};

const PREVIEW = {
  title: '매일 걷기',
  body: '매일 30분 걷기로 했다',
  category: 'HABIT' as const,
  end_date: '2099-01-01',
  keeper: 'BOTH' as const,
  reward: '커피 한 잔',
  penalty: null,
  witness_enabled: true,
  creator: { nickname: '지우', profile_image_url: null },
};

let sessionListener: ((hasSession: boolean) => void) | null = null;

async function settle(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

async function emitSession(hasSession: boolean): Promise<void> {
  await act(async () => {
    sessionListener?.(hasSession);
  });
  await settle();
}

describe('EC-I01 앱 내 초대 검토', () => {
  beforeEach(() => {
    mockToken = 'a-b_c';
    sessionListener = null;
    mockReplace.mockReset();
    resolveMock.mockReset().mockResolvedValue(INVITE);
    previewMock.mockReset().mockResolvedValue(PREVIEW);
    approveMock.mockReset();
    declineMock.mockReset().mockResolvedValue(undefined);
    suggestMock.mockReset().mockResolvedValue(undefined);
    openBrowserMock.mockReset().mockResolvedValue(undefined);
    kakaoMock.mockReset();
    watchMock.mockReset().mockImplementation((listener) => {
      sessionListener = listener;
      return () => {};
    });
  });

  test('비로그인 상대는 최소 정보 랜딩과 로그인 버튼을 본다 — 광고 없음', async () => {
    const view = await render(<InviteReviewScreen />);
    await emitSession(false);

    expect(view.getByText('지우님이 약속을 보냈어요')).toBeTruthy();
    expect(view.getByText('매일 걷기')).toBeTruthy();
    expect(view.getByText('자세한 내용은 로그인 후 볼 수 있어요')).toBeTruthy();
    expect(view.getByRole('button', { name: '카카오 로그인하고 내용 보기' })).toBeTruthy();
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
    // 본문·보상·벌칙은 로그인 전에 절대 그리지 않는다(§4-3-3).
    expect(previewMock).not.toHaveBeenCalled();
  });

  test('로그인한 상대는 전문 검토를 보고 확인 시트를 거쳐 승인한다', async () => {
    approveMock.mockResolvedValue({ promise_id: 'p-1' } as never);
    const view = await render(<InviteReviewScreen />);
    await emitSession(true);

    expect(previewMock).toHaveBeenCalledWith('a-b_c');
    expect(view.getByText('지우님과의 약속, 꼼꼼히 봐주세요')).toBeTruthy();
    expect(view.getByText('매일 30분 걷기로 했다')).toBeTruthy();
    expect(view.getByText('커피 한 잔')).toBeTruthy();
    expect(view.getByText(LEGAL_DISCLAIMER)).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: '승인하기' }));
    expect(view.getByText('지우님이 보낸 약속이 맞나요?')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '네, 승인합니다' }));
    await settle();

    expect(approveMock).toHaveBeenCalledWith('a-b_c', 'key-1');
    expect(mockReplace).toHaveBeenCalledWith('/promise/p-1');
  });

  test('거절은 종결 화면으로 남고 홈으로 나간다', async () => {
    const view = await render(<InviteReviewScreen />);
    await emitSession(true);

    await fireEvent.press(view.getByRole('button', { name: '거절하기' }));
    await settle();

    expect(declineMock).toHaveBeenCalledWith('a-b_c', '', 'key-1');
    expect(view.getByText('거절했어요. 작성자에게 알려드릴게요.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '홈으로' }));
    expect(mockReplace).toHaveBeenCalledWith('/home');
  });

  test('수정 제안은 5자 미만이면 서버 없이 막고, 유효하면 보낸다', async () => {
    const view = await render(<InviteReviewScreen />);
    await emitSession(true);

    await fireEvent.press(view.getByRole('button', { name: '수정 제안' }));
    const input = view.getByLabelText('수정 제안 의견');
    await fireEvent.changeText(input, '짧다');
    await fireEvent.press(view.getByRole('button', { name: '수정 제안' }));
    expect(view.getByText('어떤 부분을 바꾸고 싶은지 알려주세요.')).toBeTruthy();
    expect(suggestMock).not.toHaveBeenCalled();

    await fireEvent.changeText(input, '종료일을 다음 주로 바꿔 주세요');
    await fireEvent.press(view.getByRole('button', { name: '수정 제안' }));
    await settle();

    expect(suggestMock).toHaveBeenCalledWith('a-b_c', '종료일을 다음 주로 바꿔 주세요', 'key-1');
    expect(view.getByText(/수정 제안을 보냈어요/u)).toBeTruthy();
  });

  test('증인 토큰은 세션과 무관하게 기본 브라우저로 핸드오프한다', async () => {
    resolveMock.mockResolvedValue({ ...INVITE, target_role: 'WITNESS' });
    const view = await render(<InviteReviewScreen />);
    await emitSession(true);

    expect(view.getByText('초대 확인은 웹에서 이어져요')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '기본 브라우저에서 열기' }));
    expect(openBrowserMock).toHaveBeenCalledWith('a-b_c');
    expect(previewMock).not.toHaveBeenCalled();
  });

  test('죽은 링크 다섯 사유는 SCR-W06 동형 화면이다', async () => {
    resolveMock.mockRejectedValue(
      new MobileApiError('E_INVITE_EXPIRED', '초대 링크가 만료됐어요. (72시간)'),
    );
    const view = await render(<InviteReviewScreen />);
    await emitSession(false);

    expect(view.getByText('이 링크는 더 쓸 수 없어요')).toBeTruthy();
    expect(
      view.getByText('초대 링크가 만료되었습니다. 상대에게 새 링크를 요청해 주세요.'),
    ).toBeTruthy();
    expect(view.getByText('초대 링크는 1회용이에요')).toBeTruthy();
  });

  test('자기 초대는 링크 사망이 아니라 홈 출구가 있는 안내다 (EC-B05)', async () => {
    resolveMock.mockRejectedValue(new MobileApiError('E_SELF_INVITE', '본인은 상대방이 될 수 없어요.'));
    const view = await render(<InviteReviewScreen />);
    await emitSession(true);

    expect(view.getByText('본인은 상대방이 될 수 없어요.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '홈으로' }));
    expect(mockReplace).toHaveBeenCalledWith('/home');
  });

  test('토큰이 없으면 액션 없이 안내만 남는다', async () => {
    mockToken = '';
    const view = await render(<InviteReviewScreen />);
    await settle();

    expect(view.getByText('초대 링크를 확인할 수 없어요.')).toBeTruthy();
    expect(view.queryByRole('button')).toBeNull();
    expect(resolveMock).not.toHaveBeenCalled();
  });
});
