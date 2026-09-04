import { act, fireEvent, render } from '@testing-library/react-native';

import { signInWithGoogle, signInWithKakao } from '../lib/kakao-auth-native.ts';
import { openLegalDocument } from '../lib/legal-native.ts';
import { signInWithTestAccount } from '../lib/test-auth-native.ts';
import { MobileAuthGateContext } from '../lib/mobile-auth-gate.ts';
import { colors } from '../theme/tokens';
import LoginScreen from '../app/index';

jest.mock('../lib/kakao-auth-native.ts', () => ({
  signInWithGoogle: jest.fn(),
  signInWithKakao: jest.fn(),
}));

jest.mock('../lib/legal-native.ts', () => ({
  openLegalDocument: jest.fn(),
}));

jest.mock('../lib/test-auth-native.ts', () => ({
  signInWithTestAccount: jest.fn(),
}));

const signInWithKakaoMock = jest.mocked(signInWithKakao);
const signInWithGoogleMock = jest.mocked(signInWithGoogle);
const openLegalDocumentMock = jest.mocked(openLegalDocument);
const signInWithTestAccountMock = jest.mocked(signInWithTestAccount);

/** 릴리스 번들처럼 렌더하고 싶은 테스트가 `__DEV__` 를 잠시 끈다. 렌더가 끝날 때까지 복원을 미룬다. */
async function withRelease<T>(run: () => Promise<T> | T): Promise<T> {
  const globals = globalThis as unknown as { __DEV__: boolean };
  const previous = globals.__DEV__;
  globals.__DEV__ = false;
  try {
    return await run();
  } finally {
    globals.__DEV__ = previous;
  }
}

/**
 * SCR-A01 로그인 — 04 §10 M0-3.
 *
 * 이 화면 하나가 이식 규칙 전체를 검증하는 자리다. 여기서는 **구조와 문구**를 잠근다.
 * 픽셀 대조는 실기기·에뮬레이터에서 design-reference 갤러리와 나란히 놓고 해야 한다.
 */
/** 동의 체크박스를 켠다. 켜기 전에는 두 CTA 가 모두 비활성이라 press 가 통하지 않는다. */
async function agree(view: Awaited<ReturnType<typeof render>>): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByRole('checkbox', { name: '이용약관과 개인정보 처리방침에 동의합니다' }));
  });
}

describe('SCR-A01 로그인', () => {
  beforeEach(() => {
    signInWithKakaoMock.mockReset();
    signInWithKakaoMock.mockResolvedValue('SIGNED_IN');
    signInWithGoogleMock.mockReset();
    signInWithGoogleMock.mockResolvedValue('SIGNED_IN');
    openLegalDocumentMock.mockReset();
    openLegalDocumentMock.mockResolvedValue(undefined);
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

  test('로그인 수단은 카카오와 Google 뿐이다 — 릴리스 번들 기준', async () => {
    // 프로덕션 진입 경로는 카카오 + Google SSO 둘뿐이다(PO 2026-08-20, N-4).
    // 테스트 로그인은 `__DEV__` 게이트 뒤라 릴리스에서는 존재하지 않는다.
    const view = await withRelease(() => render(<LoginScreen />));
    const buttons = view.getAllByRole('button');
    expect(view.getByRole('button', { name: '카카오로 시작하기' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Google로 시작하기' })).toBeTruthy();
    expect(buttons).toHaveLength(2);
    expect(view.queryByText('테스트 로그인 (개발 빌드 전용)')).toBeNull();
    expect(view.getByRole('image', { name: '리틀핑거 로고' })).toBeTruthy();
  });

  test('개발 빌드에서는 테스트 로그인 섹션이 보인다', async () => {
    const view = await render(<LoginScreen />);
    expect(view.getByText('테스트 로그인 (개발 빌드 전용)')).toBeTruthy();
    expect(view.getByLabelText('테스트 이메일')).toBeTruthy();
    expect(view.getByLabelText('테스트 비밀번호')).toBeTruthy();
  });

  test('테스트 로그인은 다듬은 이메일과 비밀번호로 로그인한다', async () => {
    signInWithTestAccountMock.mockResolvedValue(undefined);
    const view = await render(<LoginScreen />);

    await fireEvent.changeText(view.getByLabelText('테스트 이메일'), '  tester-a@example.com  ');
    await fireEvent.changeText(view.getByLabelText('테스트 비밀번호'), 'secret-pw');
    await fireEvent.press(view.getByRole('button', { name: '테스트 계정으로 로그인' }));

    expect(signInWithTestAccountMock).toHaveBeenCalledWith('tester-a@example.com', 'secret-pw');
  });

  test('테스트 로그인 실패는 오류 문구로 보여준다', async () => {
    signInWithTestAccountMock.mockRejectedValue(new Error('Invalid login credentials'));
    const view = await render(<LoginScreen />);

    await fireEvent.changeText(view.getByLabelText('테스트 이메일'), 'tester-a@example.com');
    await fireEvent.changeText(view.getByLabelText('테스트 비밀번호'), 'wrong');
    await fireEvent.press(view.getByRole('button', { name: '테스트 계정으로 로그인' }));

    expect(
      await view.findByText('테스트 로그인에 실패했습니다. 계정 정보를 확인해 주세요.'),
    ).toBeTruthy();
  });

  test('카카오 버튼은 공식 가이드 색을 쓴다', async () => {
    const view = await render(<LoginScreen />);
    const button = view.getByRole('button', { name: '카카오로 시작하기' });
    const style = Array.isArray(button.props.style)
      ? Object.assign({}, ...button.props.style.filter(Boolean))
      : button.props.style;
    expect(style.backgroundColor).toBe(colors.kakao);
  });

  test('Google 버튼은 공식 가이드 색과 G 마크를 쓴다', async () => {
    const view = await render(<LoginScreen />);
    const button = view.getByRole('button', { name: 'Google로 시작하기' });
    const style = Array.isArray(button.props.style)
      ? Object.assign({}, ...button.props.style.filter(Boolean))
      : button.props.style;
    expect(style.backgroundColor).toBe(colors.google);
    expect(style.borderColor).toBe(colors.googleBorder);
    expect(view.getByTestId('google-mark')).toBeTruthy();
  });

  test('Google 로그인 취소는 EC-A01 안내를 보여준다', async () => {
    signInWithGoogleMock.mockResolvedValue('CANCELED');
    const view = await render(<LoginScreen />);
    await agree(view);

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: 'Google로 시작하기' }));
    });

    expect(
      await view.findByText('로그인을 취소했습니다. 다시 시도해 주세요.'),
    ).toBeTruthy();
  });

  test('Google 로그인 오류는 Google 문구로 평탄화한다', async () => {
    signInWithGoogleMock.mockRejectedValue(new Error('provider details'));
    const view = await render(<LoginScreen />);
    await agree(view);

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: 'Google로 시작하기' }));
    });

    expect(
      await view.findByText('지금 Google 로그인이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.'),
    ).toBeTruthy();
  });

  test('카카오 로그인 취소는 EC-A01 안내를 보여준다', async () => {
    // onPress 연결이 빠지거나 취소를 장애로 취급하면 이 문구에 도달하지 않는다.
    signInWithKakaoMock.mockResolvedValue('CANCELED');
    const view = await render(<LoginScreen />);
    await agree(view);

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
    await agree(view);

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: '카카오로 시작하기' }));
    });

    expect(
      await view.findByText(
        '지금 카카오 로그인이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.',
      ),
    ).toBeTruthy();
  });

  test('EC-A03 닉네임 필수 동의 거부는 재동의를 안내한다', async () => {
    signInWithKakaoMock.mockResolvedValue('NICKNAME_REQUIRED');
    const view = await render(<LoginScreen />);
    await agree(view);

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: '카카오로 시작하기' }));
    });

    expect(
      await view.findByText('닉네임 정보는 약속 기록에 꼭 필요합니다. 동의 후 이용해 주세요.'),
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

  test('EC-A06 만료된 저장 세션은 다시 로그인을 안내한다', async () => {
    const view = await render(
      <MobileAuthGateContext.Provider value={{ callbackFailed: false, sessionExpired: true }}>
        <LoginScreen />
      </MobileAuthGateContext.Provider>,
    );

    expect(await view.findByText('다시 로그인해 주세요.')).toBeTruthy();
  });

  test('약관 링크와 명시적 동의 체크박스를 보여준다', async () => {
    const view = await render(<LoginScreen />);
    expect(view.getByRole('link', { name: '이용약관' })).toBeTruthy();
    expect(view.getByRole('link', { name: '개인정보 처리방침' })).toBeTruthy();
    const box = view.getByRole('checkbox', {
      name: '이용약관과 개인정보 처리방침에 동의합니다',
    });
    expect(box.props.accessibilityState.checked).toBe(false);
  });

  test('동의 전에는 두 로그인 버튼이 모두 잠겨 있다', async () => {
    // 묵시적 동의를 명시적 동의로 바꾼 이유가 이것이다 — 체크 없이는 어떤 provider 로도
    // 가입/로그인이 시작되면 안 된다.
    const view = await render(<LoginScreen />);

    for (const name of ['카카오로 시작하기', 'Google로 시작하기']) {
      const button = view.getByRole('button', { name });
      expect(button.props.accessibilityState.disabled).toBe(true);
      await act(async () => {
        fireEvent.press(button);
      });
    }

    expect(signInWithKakaoMock).not.toHaveBeenCalled();
    expect(signInWithGoogleMock).not.toHaveBeenCalled();

    await agree(view);
    expect(
      view.getByRole('button', { name: '카카오로 시작하기' }).props.accessibilityState.disabled,
    ).toBe(false);
  });

  test.each([
    ['이용약관', 'TERMS'],
    ['개인정보 처리방침', 'PRIVACY'],
  ] as const)('%s 링크를 공개 웹 문서로 연다', async (label, kind) => {
    const view = await render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(view.getByRole('link', { name: label }));
    });
    expect(openLegalDocumentMock).toHaveBeenCalledWith(kind);
    expect(signInWithKakaoMock).not.toHaveBeenCalled();
  });

  test('법적 문서 열기 실패는 로그인 화면을 유지하고 안내한다', async () => {
    openLegalDocumentMock.mockRejectedValue(new Error('cannot open'));
    const view = await render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(view.getByRole('link', { name: '이용약관' }));
    });
    expect(view.getByRole('alert').props.children).toBe(
      '법적 문서를 열 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
    expect(view.getByRole('button', { name: '카카오로 시작하기' })).toBeTruthy();
  });

  test('광고가 없다 — 신뢰 순간 화면이다', async () => {
    // 04 §12-1 절대제약: 광고는 SCR-A02 하단 1구좌뿐이다.
    const view = await render(<LoginScreen />);
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
  });
});
