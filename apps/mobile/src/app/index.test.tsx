import { render } from '@testing-library/react-native';

import { colors } from '../theme/tokens';
import LoginScreen from './index';

/**
 * SCR-A01 로그인 — 04 §10 M0-3.
 *
 * 이 화면 하나가 이식 규칙 전체를 검증하는 자리다. 여기서는 **구조와 문구**를 잠근다.
 * 픽셀 대조는 실기기·에뮬레이터에서 design-reference 갤러리와 나란히 놓고 해야 한다.
 */
describe('SCR-A01 로그인', () => {
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
