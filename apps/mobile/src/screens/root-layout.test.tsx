import type { Session } from '@supabase/supabase-js';
import { act, render } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';

import {
  createPushNavigationManager,
  type PushNavigationManager,
  type PushRoute,
} from '../lib/push-navigation.ts';
import type { MobileSessionGateEvents } from '../lib/session-gate.ts';
import RootLayout from '../app/_layout';

const SESSION = {
  access_token: 'access-token',
  user: { id: 'user-1' },
} as Session;

interface MockAndroidPushEvents {
  areProtectedRoutesReady(): boolean;
  navigate(route: PushRoute): void;
}

const mockStop = jest.fn();
const mockPushStop = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockEncryptedStorageSet = jest.fn();
const mockRestorePushNavigationNative = jest.fn(
  (navigate: (route: PushRoute) => void) => mockPushManager.restore(navigate),
);
let mockRootNavigationReady = false;
let mockStoredPushValue: string | null = null;
let mockPushManager!: PushNavigationManager;
let mockAndroidPushEvents: MockAndroidPushEvents | null = null;
let mockPathname = '/';
const mockReadOnboardingCompletionNative = jest.fn().mockResolvedValue(true);
const mockLoadMinimumAppVersionNative = jest.fn().mockResolvedValue(false);
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
  return {
    Stack,
    useRootNavigationState: () => (mockRootNavigationReady ? { key: 'root' } : undefined),
    usePathname: () => mockPathname,
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
  };
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
jest.mock('../lib/onboarding-native.ts', () => ({
  readOnboardingCompletionNative: () => mockReadOnboardingCompletionNative(),
}));
jest.mock('../lib/minimum-app-version-native.ts', () => ({
  loadMinimumAppVersionNative: () => mockLoadMinimumAppVersionNative(),
}));
jest.mock(
  '../lib/push-navigation-native.ts',
  () => ({
    restoreAndroidPushNavigationNative: (navigate: (route: PushRoute) => void) =>
      mockRestorePushNavigationNative(navigate),
    startAndroidPushNavigationNative: jest.fn((events: MockAndroidPushEvents) => {
      mockAndroidPushEvents = events;
      return mockPushStop;
    }),
  }),
  { virtual: true },
);

const { startAndroidPushNavigationNative } = jest.requireMock(
  '../lib/push-navigation-native.ts',
) as {
  startAndroidPushNavigationNative: jest.Mock;
};

describe('루트 인증 게이트', () => {
  beforeEach(() => {
    capturedEvents = null;
    mockAndroidPushEvents = null;
    mockRootNavigationReady = false;
    mockStoredPushValue = null;
    mockEncryptedStorageSet.mockReset();
    mockPushManager = createPushNavigationManager({
      logError: () => undefined,
      storage: {
        getItem: async () => mockStoredPushValue,
        setItem: async (_key, value) => {
          mockEncryptedStorageSet(value);
          mockStoredPushValue = value;
        },
        removeItem: async () => {
          mockStoredPushValue = null;
        },
      },
    });
    mockStop.mockReset();
    mockPushStop.mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockPathname = '/';
    mockReadOnboardingCompletionNative.mockReset().mockResolvedValue(true);
    mockLoadMinimumAppVersionNative.mockReset().mockResolvedValue(false);
    mockRestorePushNavigationNative.mockClear();
    startAndroidPushNavigationNative.mockClear();
    mockStartMobileSessionGateNative.mockClear();
    jest.mocked(SplashScreen.hideAsync).mockClear();
  });

  test('루트 내비게이터는 초기 렌더부터 유지하고 세션 준비 전에는 스플래시를 숨기지 않는다', async () => {
    const view = await render(<RootLayout />);

    expect(view.getByText('screen:index')).toBeTruthy();
    expect(view.getByText('screen:auth-callback')).toBeTruthy();
    expect(view.getByText('screen:onboarding')).toBeTruthy();
    expect(view.getByText('screen:update-required')).toBeTruthy();
    expect(view.queryByText('screen:profile')).toBeNull();
    expect(mockStartMobileSessionGateNative).toHaveBeenCalledTimes(1);
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  test('최초 비로그인 실행은 SCR-A00으로 한 번 교체한다', async () => {
    mockRootNavigationReady = true;
    mockReadOnboardingCompletionNative.mockResolvedValue(false);
    await render(<RootLayout />);
    await act(async () => capturedEvents?.onReady());
    await act(async () => { await new Promise<void>((resolve) => setImmediate(() => resolve())); });
    expect(mockReplace).toHaveBeenCalledWith('/onboarding');
  });

  test('EC-I04 강제 업데이트는 온보딩보다 우선한다', async () => {
    mockRootNavigationReady = true;
    mockReadOnboardingCompletionNative.mockResolvedValue(false);
    mockLoadMinimumAppVersionNative.mockResolvedValue(true);
    await render(<RootLayout />);
    await act(async () => capturedEvents?.onReady());
    await act(async () => { await new Promise<void>((resolve) => setImmediate(() => resolve())); });
    expect(mockReplace).toHaveBeenCalledWith('/update-required');
    expect(mockReplace).not.toHaveBeenCalledWith('/onboarding');
  });

  test('저장 세션·OAuth 성공은 모두 보호된 SCR-A02 라우트로 전환한다', async () => {
    const view = await render(<RootLayout />);

    await act(async () => {
      capturedEvents?.onSession(SESSION);
      capturedEvents?.onReady();
    });

    expect(view.queryByText('screen:index')).toBeNull();
    expect(view.queryByText('screen:auth-callback')).toBeNull();
    expect(view.getByText('screen:home')).toBeTruthy();
    expect(view.getByText('screen:promise/edit')).toBeTruthy();
    expect(view.getByText('screen:promise/[promise_id]')).toBeTruthy();
    expect(view.getByText('screen:invite')).toBeTruthy();
    expect(view.getByText('screen:fulfillment/[promise_id]')).toBeTruthy();
    expect(view.getByText('screen:notifications')).toBeTruthy();
    expect(view.getByText('screen:profile')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  test('로그아웃·탈퇴로 세션이 사라지면 보호 화면에서 로그인으로 교체한다', async () => {
    mockRootNavigationReady = true;
    await render(<RootLayout />);
    await act(async () => {
      capturedEvents?.onSession(SESSION);
      capturedEvents?.onReady();
    });

    // E2E Run 1 F5: 마이 화면에서 세션이 사라지면 Stack.Protected 폴백이
    // update-required 로 떨어졌다. 로그인 화면으로 교체돼야 한다.
    mockPathname = '/profile';
    await act(async () => capturedEvents?.onSession(null));
    await act(async () => { await new Promise<void>((resolve) => setImmediate(() => resolve())); });

    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(mockReplace).not.toHaveBeenCalledWith('/update-required');
  });

  test('세션 없는 auth-callback과 초대 앱링크는 로그인으로 쫓아내지 않는다', async () => {
    mockRootNavigationReady = true;
    mockPathname = '/auth-callback';
    await render(<RootLayout />);
    await act(async () => capturedEvents?.onReady());
    await act(async () => { await new Promise<void>((resolve) => setImmediate(() => resolve())); });
    expect(mockReplace).not.toHaveBeenCalled();

    mockPathname = '/i/test-token';
    await act(async () => capturedEvents?.onSession(null));
    await act(async () => { await new Promise<void>((resolve) => setImmediate(() => resolve())); });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test('초대 앱링크 위에서 로그인해도 홈으로 끌려가지 않는다', async () => {
    // 앱 내 초대 검토(EC-I01)는 랜딩에서 로그인한 뒤 같은 라우트에서 검토로 이어진다.
    // 세션 등장 시 홈 교체가 /i/ 를 덮으면 토큰이 유실되고 검토가 영영 열리지 않는다.
    mockRootNavigationReady = true;
    mockPathname = '/i/test-token';
    await render(<RootLayout />);
    await act(async () => capturedEvents?.onReady());
    await act(async () => capturedEvents?.onSession(SESSION));
    await act(async () => { await new Promise<void>((resolve) => setImmediate(() => resolve())); });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  test('언마운트 시 세션·딥링크 구독을 해제한다', async () => {
    const view = await render(<RootLayout />);
    await act(async () => {
      view.unmount();
    });
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  test('콜드 스타트 푸시 복구 목적지는 /home 교체로 덮이지 않는다', async () => {
    // E2E Run 1 F4: 종료 상태에서 푸시를 탭하면 목적지 대신 홈이 열렸다 — 복구 이동을
    // stale pathname 기준의 홈 교체가 덮어썼다.
    mockRootNavigationReady = true;
    mockStoredPushValue = JSON.stringify({
      state: 'PENDING',
      data: {
        notification_id: '99999999-9999-4999-8999-999999999999',
        deeplink: 'SCR-A06',
        promise_id: '88888888-8888-4888-8888-888888888888',
      },
    });
    await render(<RootLayout />);
    await act(async () => {
      capturedEvents?.onSession(SESSION);
      capturedEvents?.onReady();
    });
    await act(async () => { await new Promise<void>((resolve) => setImmediate(() => resolve())); });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/fulfillment/[promise_id]',
      params: { promise_id: '88888888-8888-4888-8888-888888888888' },
    });
    expect(mockReplace).not.toHaveBeenCalledWith('/home');
  });

  test('복구할 푸시가 없으면 로그인 뒤 홈으로 교체한다', async () => {
    mockRootNavigationReady = true;
    await render(<RootLayout />);
    await act(async () => {
      capturedEvents?.onSession(SESSION);
      capturedEvents?.onReady();
    });
    await act(async () => { await new Promise<void>((resolve) => setImmediate(() => resolve())); });

    expect(mockReplace).toHaveBeenCalledWith('/home');
    expect(mockPush).not.toHaveBeenCalled();
  });

  test('루트 라우터가 준비된 뒤 수신기를 한 번 열고 로그인 복구 목적지를 한 번 소비한다', async () => {
    const view = await render(<RootLayout />);

    await act(async () => {
      capturedEvents?.onSession(SESSION);
      capturedEvents?.onReady();
    });
    expect(startAndroidPushNavigationNative).not.toHaveBeenCalled();
    expect(mockRestorePushNavigationNative).not.toHaveBeenCalled();

    mockRootNavigationReady = true;
    await act(async () => {
      view.rerender(<RootLayout />);
    });

    expect(startAndroidPushNavigationNative).toHaveBeenCalledTimes(1);
    expect(mockRestorePushNavigationNative).toHaveBeenCalledTimes(1);

    await act(async () => {
      view.rerender(<RootLayout />);
    });
    expect(startAndroidPushNavigationNative).toHaveBeenCalledTimes(1);
    expect(mockRestorePushNavigationNative).toHaveBeenCalledTimes(1);

    await act(async () => {
      view.unmount();
    });
    expect(mockPushStop).toHaveBeenCalledTimes(1);
  });

  test('세션 수신 직후 보호 라우트 커밋 전 푸시는 암호화 저장 후 한 번 복구한다', async () => {
    mockRootNavigationReady = true;
    const view = await render(<RootLayout />);
    const pushEvents = mockAndroidPushEvents;
    if (pushEvents === null) throw new Error('push listener missing');
    const data = {
      notification_id: '77777777-7777-4777-8777-777777777777',
      deeplink: 'SCR-A06',
      promise_id: '88888888-8888-4888-8888-888888888888',
    };
    let handling!: Promise<boolean>;

    await act(async () => {
      capturedEvents?.onSession(SESSION);
      handling = mockPushManager.handle(
        data,
        pushEvents.areProtectedRoutesReady(),
        pushEvents.navigate,
      );
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockEncryptedStorageSet).toHaveBeenCalledTimes(1);
      await handling;
    });

    await act(async () => {
      await new Promise<void>((resolve) => setImmediate(() => resolve()));
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/fulfillment/[promise_id]',
      params: { promise_id: '88888888-8888-4888-8888-888888888888' },
    });
    expect(mockStoredPushValue).toBeNull();
    expect(mockRestorePushNavigationNative).toHaveBeenCalledTimes(1);

    await act(async () => {
      view.rerender(<RootLayout />);
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
