import { act, fireEvent, render } from '@testing-library/react-native';

import { signInWithKakao } from '../lib/kakao-auth-native.ts';
import { MobileAuthGateContext } from '../lib/mobile-auth-gate.ts';
import { colors } from '../theme/tokens';
import LoginScreen from '../app/index';

jest.mock('../lib/kakao-auth-native.ts', () => ({
  signInWithKakao: jest.fn(),
}));

const signInWithKakaoMock = jest.mocked(signInWithKakao);

/**
 * SCR-A01 로그인 — 04 §10 M0-3.
 *
 * 이 화면 하나가 이식 규칙 전체를 검증하는 자리다. 여기서는 **구조와 문구**를 잠근다.
 * 픽셀 대조는 실기기·에뮬레이터에서 design-reference 갤러리와 나란히 놓고 해야 한다.
 */
describe('SCR-A01 로그인', () => {
  beforeEach(() => {
    signInWithKakaoMock.mockReset();
    signInWithKakaoMock.mockResolvedValue('SIGNED_IN');
  });

  test('브랜드 워드마크를 보여준다', async () => {
    const view = await render(<LoginScreen />);
    expect(view.getByText('리틀핑거')).toBeTruthy();
  });

  test('원본과 같은 문구를 쓴다', async () => {
    const view = await render(<LoginScreen />);
    expect(view.getByText('새끼손가락 걸고, 약속!')).toBeTruthy();
    expect(view.getByText('오늘도 새끼손가락 걸어볼까요?')).toBeTruthy();
  });

  test('로그인 수단은 카카오 하나뿐이다', async () => {
    // MVP 는 카카오 로그인이 유일한 진입 경로다(02 §4 F-01).
    const view = await render(<LoginScreen />);
    const buttons = view.getAllByRole('button');
    const labels = buttons.map((b) => b.props.accessibilityLabel ?? '');
    expect(view.getByRole('button', { name: '카카오로 시작하기' })).toBeTruthy();
    // 로고 배지도 누를 수 있으므로 버튼은 둘이다. 그 외 로그인 버튼은 없다.
    expect(buttons).toHaveLength(2);
    expect(labels).toContain('리틀핑거 로고');
  });

  test('카카오 버튼은 공식 가이드 색을 쓴다', async () => {
    const view = await render(<LoginScreen />);
    const button = view.getByRole('button', { name: '카카오로 시작하기' });
    const style = Array.isArray(button.props.style)
      ? Object.assign({}, ...button.props.style.filter(Boolean))
      : button.props.style;
    expect(style.backgroundColor).toBe(colors.kakao);
  });

  test('카카오 로그인 취소는 EC-A01 안내를 보여준다', async () => {
    // onPress 연결이 빠지거나 취소를 장애로 취급하면 이 문구에 도달하지 않는다.
    signInWithKakaoMock.mockResolvedValue('CANCELED');
    const view = await render(<LoginScreen />);

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: '카카오로 시작하기' }));
    });

    expect(
      await view.findByText('로그인을 취소했습니다. 다시 시도해 주세요.'),
    ).toBeTruthy();
  });

  test('카카오 로그인 오류는 EC-A02 안내를 보여준다', async () => {
    // SDK·네트워크 오류 원문은 사용자에게 노출하지 않고 재시도 가능한 문구로 평탄화한다.
    signInWithKakaoMock.mockRejectedValue(new Error('provider details'));
    const view = await render(<LoginScreen />);

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: '카카오로 시작하기' }));
    });

    expect(
      await view.findByText(
        '지금 카카오 로그인이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.',
      ),
    ).toBeTruthy();
  });

  test('콜드 스타트 OAuth 딥링크 실패도 EC-A02 안내를 보여준다', async () => {
    // 딥링크 교환은 루트 게이트가 맡고, 화면에는 실패 여부만 내려준다.
    const view = await render(
      <MobileAuthGateContext.Provider value={{ callbackFailed: true }}>
        <LoginScreen />
      </MobileAuthGateContext.Provider>,
    );

    expect(
      await view.findByText(
        '지금 카카오 로그인이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.',
      ),
    ).toBeTruthy();
  });

  test('약관 동의 안내를 보여준다', async () => {
    const view = await render(<LoginScreen />);
    expect(view.getByText(/이용약관/u)).toBeTruthy();
    expect(view.getByText(/개인정보 처리방침/u)).toBeTruthy();
  });

  test('광고가 없다 — 신뢰 순간 화면이다', async () => {
    // 04 §12-1 절대제약: 광고는 SCR-A02 하단 1구좌뿐이다.
    const view = await render(<LoginScreen />);
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
  });
});
