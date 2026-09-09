import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { InviteAccountGate } from './InviteAccountGate.tsx';

const mockGetSession = jest.fn();
let mockListener: (event: string, session: Session | null) => void;
jest.mock('../lib/supabase-native.ts', () => ({
  getMobileSupabaseClient: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: (listener: typeof mockListener) => {
        mockListener = listener;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { nickname: '내 별명' }, error: null }) }) }) }),
  }),
}));
jest.mock('../lib/trust-profile-native.ts', () => ({
  logoutCurrentDeviceNative: async () => mockListener('SIGNED_OUT', null),
}));
function session(id: string, provider: string): Session {
  return { user: { id, app_metadata: { provider } } } as unknown as Session;
}
test('앱 초대도 계정 확인 전에는 검토를 열지 않고 변경된 계정은 다시 확인한다', async () => {
  mockGetSession.mockResolvedValue({ data: { session: session('first', 'google') }, error: null });
  const view = await render(<InviteAccountGate><Text>약속 검토</Text></InviteAccountGate>);
  await view.findByText('내 별명');
  expect(view.getByText('Google')).toBeTruthy();
  expect(view.queryByText('약속 검토')).toBeNull();
  await fireEvent.press(view.getByText('이 계정으로 계속하기'));
  expect(view.getByText('약속 검토')).toBeTruthy();
  await act(async () => mockListener('SIGNED_IN', session('second', 'kakao')));
  expect(await view.findByText('카카오')).toBeTruthy();
  expect(view.queryByText('약속 검토')).toBeNull();
});
