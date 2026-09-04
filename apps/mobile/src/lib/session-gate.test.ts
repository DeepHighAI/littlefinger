import type { Session } from '@supabase/supabase-js';

import {
  startMobileSessionGate,
  type MobileSessionGateDeps,
  type MobileSessionGateEvents,
} from './session-gate.ts';

const SESSION: Session = {
  access_token: 'access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 1_800_000_000,
  refresh_token: 'refresh-token',
  user: {
    id: 'user-1',
    app_metadata: { provider: 'kakao', providers: ['kakao'] },
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-07-30T00:00:00Z',
  },
};

interface Harness {
  authListener: ((session: Session | null) => void) | null;
  deps: MobileSessionGateDeps;
  events: MobileSessionGateEvents;
  onCallbackError: jest.Mock;
  onReady: jest.Mock;
  onSession: jest.Mock;
  push: jest.Mock;
  removeAuth: jest.Mock;
  removeUrl: jest.Mock;
  urlListener: ((url: string) => void) | null;
}

function harness(
  overrides: Partial<MobileSessionGateDeps> = {},
): Harness {
  let authListener: ((session: Session | null) => void) | null = null;
  let urlListener: ((url: string) => void) | null = null;
  const removeAuth = jest.fn();
  const removeUrl = jest.fn();
  const onCallbackError = jest.fn();
  const onReady = jest.fn();
  const onSession = jest.fn();
  const push = jest.fn().mockResolvedValue(undefined);

  const deps: MobileSessionGateDeps = {
    addUrlListener: (listener) => {
      urlListener = listener;
      return { remove: removeUrl };
    },
    completeKakaoSignIn: jest.fn().mockResolvedValue('SIGNED_IN'),
    getInitialUrl: jest.fn().mockResolvedValue(null),
    getSession: jest.fn().mockResolvedValue(SESSION),
    logError: jest.fn(),
    onAuthStateChange: (listener) => {
      authListener = listener;
      return { unsubscribe: removeAuth };
    },
    registerPush: push,
    ...overrides,
  };
  const events = { onCallbackError, onReady, onSession };

  return {
    get authListener() {
      return authListener;
    },
    deps,
    events,
    onCallbackError,
    onReady,
    onSession,
    push,
    removeAuth,
    removeUrl,
    get urlListener() {
      return urlListener;
    },
  };
}

// 마이크로태스크를 몇 번 도는지 세지 않는다. 게이트에 await 이 하나 늘 때마다 그 숫자가
// 틀려지고, 실패가 "게이트가 안 돈다"가 아니라 "테스트 헬퍼가 모자라다"로 나온다.
async function flush(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('모바일 루트 세션 게이트', () => {
  test('저장 세션을 복원해 SCR-A02용 session 상태를 만들고 푸시를 등록한다', async () => {
    const h = harness();

    startMobileSessionGate(h.deps, h.events);
    await flush();

    expect(h.onSession).toHaveBeenCalledWith(SESSION);
    expect(h.onReady).toHaveBeenCalledTimes(1);
    expect(h.push).toHaveBeenCalledWith(SESSION);
  });

  test('일반 OAuth의 SIGNED_IN 이벤트도 같은 session 경로로 수렴한다', async () => {
    const h = harness({
      getSession: jest.fn().mockResolvedValue(null),
    });

    startMobileSessionGate(h.deps, h.events);
    await flush();
    h.authListener?.(SESSION);
    await flush();

    expect(h.onSession).toHaveBeenLastCalledWith(SESSION);
    expect(h.push).toHaveBeenCalledWith(SESSION);
  });

  test('콜드 스타트 OAuth URL을 루트에서 교환하고 같은 URL은 한 번만 처리한다', async () => {
    const callbackUrl =
      'littlefinger://auth-callback?code=auth-code';
    const complete = jest.fn().mockResolvedValue('SIGNED_IN');
    const h = harness({
      completeKakaoSignIn: complete,
      getInitialUrl: jest.fn().mockResolvedValue(callbackUrl),
      getSession: jest.fn().mockResolvedValue(null),
    });

    startMobileSessionGate(h.deps, h.events);
    await flush();
    h.urlListener?.(callbackUrl);
    await flush();

    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(callbackUrl);
  });

  test('이미 로그인돼 있으면 콜백 딥링크로 세션을 갈아끼우지 않는다', async () => {
    // littlefinger:// 는 exported·BROWSABLE 이라 아무 웹페이지나 다른 앱이 이 URL 을
    // 던질 수 있다. 세션이 있는데도 교환하면 공격자가 준 링크 한 번으로 피해자가 남의
    // 계정에 로그인되고, 이후 만드는 약속과 증빙 사진이 그 계정에 쌓인다.
    const complete = jest.fn().mockResolvedValue('SIGNED_IN');
    const h = harness({
      completeKakaoSignIn: complete,
      getSession: jest.fn().mockResolvedValue(SESSION),
    });

    startMobileSessionGate(h.deps, h.events);
    await flush();
    h.urlListener?.('littlefinger://auth-callback?code=attacker-code');
    await flush();

    expect(complete).not.toHaveBeenCalled();
  });

  test('푸시 권한 거부·네트워크 오류는 로그인 라우팅을 막지 않는다', async () => {
    const pushError = new Error('push network');
    const h = harness({
      registerPush: jest.fn().mockRejectedValue(pushError),
    });

    startMobileSessionGate(h.deps, h.events);
    await flush();

    expect(h.onSession).toHaveBeenCalledWith(SESSION);
    expect(h.onReady).toHaveBeenCalledTimes(1);
    expect(h.deps.logError).toHaveBeenCalledWith(pushError);
  });

  test('로그아웃 후 같은 계정 로그인은 푸시 등록을 다시 시도한다', async () => {
    const h = harness();

    startMobileSessionGate(h.deps, h.events);
    await flush();
    h.authListener?.(null);
    h.authListener?.(SESSION);
    await flush();

    expect(h.push).toHaveBeenCalledTimes(2);
  });

  test('콜드 스타트 교환 실패는 로그인 화면에 전달하되 준비 상태는 끝낸다', async () => {
    const callbackError = new Error('callback failed');
    const h = harness({
      completeKakaoSignIn: jest.fn().mockRejectedValue(callbackError),
      getInitialUrl: jest
        .fn()
        .mockResolvedValue('littlefinger://auth-callback#error=invalid_request'),
      getSession: jest.fn().mockResolvedValue(null),
    });

    startMobileSessionGate(h.deps, h.events);
    await flush();

    expect(h.onCallbackError).toHaveBeenCalledWith(callbackError);
    expect(h.onReady).toHaveBeenCalledTimes(1);
  });

  test('정리하면 auth와 URL 구독을 모두 해제하고 이후 이벤트를 무시한다', async () => {
    const h = harness({
      getSession: jest.fn().mockResolvedValue(null),
    });

    const stop = startMobileSessionGate(h.deps, h.events);
    await flush();
    stop();
    h.authListener?.(SESSION);
    h.urlListener?.('littlefinger://auth-callback#access_token=a&refresh_token=r');
    await flush();

    expect(h.removeAuth).toHaveBeenCalledTimes(1);
    expect(h.removeUrl).toHaveBeenCalledTimes(1);
    expect(h.push).not.toHaveBeenCalled();
  });
});
