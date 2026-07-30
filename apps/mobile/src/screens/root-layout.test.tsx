import type { Session } from '@supabase/supabase-js';
import { act, render } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';

import type { MobileSessionGateEvents } from '../lib/session-gate.ts';
import RootLayout from '../app/_layout';

const SESSION = {
  access_token: 'access-token',
  user: { id: 'user-1' },
} as Session;

const mockStop = jest.fn();
const mockStartMobileSessionGateNative = jest.fn(
  (_events: MobileSessionGateEvents) => mockStop,
);
let capturedEvents: MobileSessionGateEvents | null = null;

jest.mock('expo-font', () => ({
  useFonts: jest.fn(() => [true, null]),
}));
jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn().mockResolvedValue(undefined),
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  const { Text } = require('react-native') as typeof import('react-native');

  function Stack({ children }: { children: React.ReactNode }): React.JSX.Element {
    return <>{children}</>;
  }
  Stack.Screen = ({ name }: { name: string }) => <Text>{`screen:${name}`}</Text>;
  Stack.Protected = ({
    children,
    guard,
  }: {
    children: React.ReactNode;
    guard: boolean;
  }) => (guard ? <>{children}</> : null);
  return { Stack };
});
jest.mock(
  '../lib/session-gate-native.ts',
  () => ({
    startMobileSessionGateNative: (events: MobileSessionGateEvents) => {
      capturedEvents = events;
      return mockStartMobileSessionGateNative(events);
    },
  }),
  { virtual: true },
);

describe('루트 인증 게이트', () => {
  beforeEach(() => {
    capturedEvents = null;
    mockStop.mockReset();
    mockStartMobileSessionGateNative.mockClear();
    jest.mocked(SplashScreen.hideAsync).mockClear();
  });

  test('루트 내비게이터는 초기 렌더부터 유지하고 세션 준비 전에는 스플래시를 숨기지 않는다', async () => {
    const view = await render(<RootLayout />);

    expect(view.getByText('screen:index')).toBeTruthy();
    expect(mockStartMobileSessionGateNative).toHaveBeenCalledTimes(1);
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  test('저장 세션·OAuth 성공은 모두 보호된 SCR-A02 라우트로 전환한다', async () => {
    const view = await render(<RootLayout />);

    await act(async () => {
      capturedEvents?.onSession(SESSION);
      capturedEvents?.onReady();
    });

    expect(view.queryByText('screen:index')).toBeNull();
    expect(view.getByText('screen:home')).toBeTruthy();
    expect(view.getByText('screen:promise/edit')).toBeTruthy();
    expect(view.getByText('screen:invite')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  test('언마운트 시 세션·딥링크 구독을 해제한다', async () => {
    const view = await render(<RootLayout />);
    await act(async () => {
      view.unmount();
    });
    expect(mockStop).toHaveBeenCalledTimes(1);
  });
});
