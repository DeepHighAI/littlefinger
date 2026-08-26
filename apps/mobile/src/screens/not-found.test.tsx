import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import NotFoundScreen from '../app/+not-found';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));

describe('unmatched deep link screen', () => {
  beforeEach(() => mockReplace.mockReset());

  test('브랜드 폰트로 안내하고 처음으로 버튼이 루트로 보낸다', async () => {
    const view = await render(<NotFoundScreen />);

    const title = view.getByText('화면을 찾을 수 없어요');
    // 시스템 폰트로 떨어지는 회귀를 막는다 — 이 화면은 딥링크 실패 시 첫인상이다.
    expect(StyleSheet.flatten(title.props.style).fontFamily).toBe('Gaegu-Bold');

    await fireEvent.press(view.getByRole('button', { name: '처음으로' }));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
