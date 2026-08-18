import type { Session } from '@supabase/supabase-js';

export interface MobileSessionGateDeps {
  getSession(): Promise<Session | null>;
  onAuthStateChange(listener: (session: Session | null) => void): {
    unsubscribe(): void;
  };
  getInitialUrl(): Promise<string | null>;
  addUrlListener(listener: (url: string) => void): { remove(): void };
  completeKakaoSignIn(url: string): Promise<'SIGNED_IN' | 'CANCELED' | 'NICKNAME_REQUIRED'>;
  registerPush(session: Session): Promise<unknown>;
  logError(error: unknown): void;
}

export interface MobileSessionGateEvents {
  onSession(session: Session | null): void;
  onReady(): void;
  onCallbackError(error: unknown): void;
}

const KAKAO_CALLBACK_PREFIX = 'littlefinger://auth-callback';

/**
 * 저장 세션·OAuth 이벤트·콜드 스타트 딥링크를 루트의 세션 상태 하나로 모은다.
 *
 * 구독을 세션 조회보다 먼저 여는 이유는 조회와 OAuth 완료 사이의 SIGNED_IN 이벤트를 놓치지
 * 않기 위해서다. 반대로 그 이벤트가 먼저 왔다면 뒤늦은 getSession 결과로 덮어쓰지 않는다.
 */
export function startMobileSessionGate(
  deps: MobileSessionGateDeps,
  events: MobileSessionGateEvents,
): () => void {
  let active = true;
  let authEventSeen = false;
  let lastPushAccessToken: string | null = null;
  const handledUrls = new Set<string>();

  function applySession(session: Session | null): void {
    if (!active) return;

    events.onSession(session);
    if (session === null) {
      // 다음 로그인은 같은 액세스 토큰이어도 다시 등록을 시도할 수 있어야 한다.
      lastPushAccessToken = null;
      return;
    }

    if (lastPushAccessToken === session.access_token) return;
    lastPushAccessToken = session.access_token;
    void deps.registerPush(session).catch((error: unknown) => {
      if (active) deps.logError(error);
    });
  }

  async function handleUrl(url: string | null): Promise<void> {
    if (
      !active ||
      url === null ||
      !url.startsWith(KAKAO_CALLBACK_PREFIX) ||
      handledUrls.has(url)
    ) {
      return;
    }

    handledUrls.add(url);
    try {
      await deps.completeKakaoSignIn(url);
    } catch (error) {
      if (active) events.onCallbackError(error);
    }
  }

  const authSubscription = deps.onAuthStateChange((session) => {
    authEventSeen = true;
    applySession(session);
  });
  const urlSubscription = deps.addUrlListener((url) => {
    void handleUrl(url);
  });

  void (async () => {
    try {
      const session = await deps.getSession();
      if (!authEventSeen) applySession(session);
    } catch (error) {
      if (active) deps.logError(error);
    }

    try {
      await handleUrl(await deps.getInitialUrl());
    } catch (error) {
      if (active) deps.logError(error);
    } finally {
      if (active) events.onReady();
    }
  })();

  return () => {
    active = false;
    authSubscription.unsubscribe();
    urlSubscription.remove();
  };
}
