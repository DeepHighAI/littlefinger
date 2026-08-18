import { fireEvent, render } from '@testing-library/react-native';

import { openInviteInBrowserNative } from '../lib/invite-link-native.ts';
import InviteAppLinkScreen from '../app/i/[token]';

let mockToken = 'a-b_c';

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ token: mockToken }) }));
jest.mock('../lib/invite-link-native.ts', () => ({ openInviteInBrowserNative: jest.fn() }));

const openMock = jest.mocked(openInviteInBrowserNative);

describe('EC-I01 App Link 앱 경계', () => {
  beforeEach(() => {
    mockToken = 'a-b_c';
    openMock.mockReset().mockResolvedValue(undefined);
  });

  test('초대 토큰을 기본 브라우저로 이어 주고 광고를 렌더하지 않는다', async () => {
    const view = await render(<InviteAppLinkScreen />);
    expect(view.getByText('초대 확인은 웹에서 이어져요')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: '기본 브라우저에서 열기' }));
    expect(openMock).toHaveBeenCalledWith('a-b_c');
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
  });

  test('토큰이 없으면 외부 열기 동작을 노출하지 않는다', async () => {
    mockToken = '';
    const view = await render(<InviteAppLinkScreen />);
    expect(view.getByText('초대 링크를 확인할 수 없어요.')).toBeTruthy();
    expect(view.queryByRole('button')).toBeNull();
  });
});
