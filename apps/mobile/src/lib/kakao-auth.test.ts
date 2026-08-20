import type { Session } from '@supabase/supabase-js';

import {
  completeKakaoSignIn,
  signInWithGoogle,
  signInWithKakao,
  type KakaoAuthDeps,
  type MobileAuthClient,
} from './kakao-auth.ts';

const SESSION: Session = {
  access_token: 'access-token',
  token_type: 'bearer',
  expires_in: 1800,
  expires_at: 1_785_392_000,
  refresh_token: 'refresh-token',
  user: {
    id: '46f418c0-fc89-4db3-9947-1f7f6c54c068',
    aud: 'authenticated',
    role: 'authenticated',
    phone: '',
    app_metadata: { provider: 'kakao', providers: ['kakao'] },
    user_metadata: {
      name: '지우',
      avatar_url: 'https://k.kakaocdn.net/p.jpg',
    },
    identities: [],
    created_at: '2026-07-30T00:00:00Z',
    updated_at: '2026-07-30T00:00:00Z',
    is_anonymous: false,
  },
};

function deps() {
  const signInWithOAuth = jest.fn().mockResolvedValue({
    data: { provider: 'kakao', url: 'https://project.supabase.co/auth/v1/authorize' },
    error: null,
  });
  const setSession = jest.fn().mockResolvedValue({
    data: { session: SESSION, user: SESSION.user },
    error: null,
  });
  const auth: MobileAuthClient = { signInWithOAuth, setSession };
  const openAuthSession = jest.fn().mockResolvedValue({
    type: 'success',
    url: 'littlefinger://auth-callback#access_token=access-token&refresh_token=refresh-token',
  });
  const fetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
  const sleep = jest.fn().mockResolvedValue(undefined);
  const value: KakaoAuthDeps = {
    auth,
    fetch,
    functionUrl: 'https://project.supabase.co/functions/v1/user-provision',
    openAuthSession,
    parseUrl: () => ({
      params: { access_token: 'access-token', refresh_token: 'refresh-token' },
      errorCode: null,
    }),
    redirectTo: 'littlefinger://auth-callback',
    sleep,
  };
  return { fetch, openAuthSession, setSession, signInWithOAuth, sleep, value };
}

describe('signInWithKakao', () => {
  test('OAuth 콜백을 세션으로 저장하고 APP 표면 프로비저닝을 호출한다', async () => {
    // openAuthSessionAsync 뒤 setSession 이 빠지면 로그인 화면만 성공하고 앱 세션은 null 이다.
    // 프로비저닝 호출이 빠지면 users.kakao_id 는 pending:* 으로 남는다.
    const d = deps();

    await expect(signInWithKakao(d.value)).resolves.toBe('SIGNED_IN');

    expect(d.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'kakao',
      options: {
        redirectTo: 'littlefinger://auth-callback',
        skipBrowserRedirect: true,
      },
    });
    expect(d.openAuthSession).toHaveBeenCalledWith(
      'https://project.supabase.co/auth/v1/authorize',
      'littlefinger://auth-callback',
    );
    expect(d.setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
    expect(d.fetch).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/user-provision',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer access-token',
        },
        body: JSON.stringify({
          nickname: '지우',
          profile_image_url: 'https://k.kakaocdn.net/p.jpg',
        }),
      },
    );
  });

  test('사용자가 인증 브라우저를 닫으면 세션 없이 취소로 끝난다', async () => {
    // 취소를 장애로 던지면 SCR-A01 이 EC-A01 문구 대신 서버 장애 문구를 보여준다.
    const d = deps();
    d.openAuthSession.mockResolvedValue({ type: 'cancel' });

    await expect(signInWithKakao(d.value)).resolves.toBe('CANCELED');

    expect(d.setSession).not.toHaveBeenCalled();
    expect(d.fetch).not.toHaveBeenCalled();
  });
});

describe('signInWithGoogle', () => {
  test('provider 만 다르고 콜백·세션·프로비저닝 경로는 카카오와 같다', async () => {
    const d = deps();

    await expect(signInWithGoogle(d.value)).resolves.toBe('SIGNED_IN');

    expect(d.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'littlefinger://auth-callback',
        skipBrowserRedirect: true,
      },
    });
    expect(d.setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  test('브라우저 취소는 카카오와 같은 CANCELED 로 끝난다', async () => {
    const d = deps();
    d.openAuthSession.mockResolvedValue({ type: 'cancel' });

    await expect(signInWithGoogle(d.value)).resolves.toBe('CANCELED');

    expect(d.setSession).not.toHaveBeenCalled();
  });
});

describe('OAuth 콜백 공통 경로', () => {
  test('EC-A03 profile_nickname 필수 동의 거부는 재동의 결과로 구분한다', async () => {
    const d = deps();
    d.value.parseUrl = () => ({
      params: { error_description: 'Required consent item profile_nickname was denied' },
      errorCode: 'access_denied',
    });

    await expect(
      completeKakaoSignIn('littlefinger://auth-callback?error=access_denied', d.value),
    ).resolves.toBe('NICKNAME_REQUIRED');
    expect(d.setSession).not.toHaveBeenCalled();
  });

  test('프로비저닝 실패는 저장된 로그인 세션을 실패로 바꾸지 않는다', async () => {
    // setSession 뒤 함수 호출은 별도 트랜잭션이다. 여기서 throw 하면 실제로 로그인된
    // 사용자에게 실패 화면을 보여 주고, 다음 탭에서 갑자기 로그인된 모순이 생긴다.
    const d = deps();
    d.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(signInWithKakao(d.value)).resolves.toBe('SIGNED_IN');

    expect(d.setSession).toHaveBeenCalledTimes(1);
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  test('문자열이 아닌 카카오 프로필 메타데이터는 프로비저닝 본문에서 뺀다', async () => {
    // user_metadata 는 사용자가 바꿀 수 있다. 숫자·불리언을 그대로 보내면 함수가
    // E_VALIDATION 으로 거절하고 kakao_id 보정까지 놓친다.
    const d = deps();
    d.setSession.mockResolvedValue({
      data: {
        session: {
          ...SESSION,
          user: {
            ...SESSION.user,
            user_metadata: { name: 42, avatar_url: false },
          },
        },
        user: SESSION.user,
      },
      error: null,
    });

    await signInWithKakao(d.value);

    const [, init] = d.fetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({});
  });

  test('세션 교환 실패는 1초·2초·4초 뒤 세 번 재시도한다', async () => {
    // 첫 오류를 바로 사용자에게 보이면 일시적인 카카오 장애가 전부 로그인 실패가 된다.
    // 반대로 네 번째 이후까지 호출하면 명세보다 오래 사용자를 붙잡는다.
    const d = deps();
    d.setSession
      .mockReset()
      .mockResolvedValueOnce({
        data: { session: null, user: null },
        error: new Error('temporary-1'),
      })
      .mockResolvedValueOnce({
        data: { session: null, user: null },
        error: new Error('temporary-2'),
      })
      .mockResolvedValueOnce({
        data: { session: null, user: null },
        error: new Error('temporary-3'),
      })
      .mockResolvedValueOnce({
        data: { session: SESSION, user: SESSION.user },
        error: null,
      });

    await expect(signInWithKakao(d.value)).resolves.toBe('SIGNED_IN');

    expect(d.setSession).toHaveBeenCalledTimes(4);
    expect(d.sleep.mock.calls).toEqual([[1000], [2000], [4000]]);
  });

  test('콜드 스타트 딥링크는 OAuth를 다시 열지 않고 세션을 완성한다', async () => {
    // 외부 브라우저가 앱 프로세스를 새로 띄우면 signInWithKakao 의 대기 promise 는 없다.
    // URL 처리 진입점이 없으면 사용자는 카카오 동의 뒤 다시 로그인 화면을 본다.
    const d = deps();
    const callbackUrl =
      'littlefinger://auth-callback#access_token=access-token&refresh_token=refresh-token';

    await expect(completeKakaoSignIn(callbackUrl, d.value)).resolves.toBe('SIGNED_IN');

    expect(d.signInWithOAuth).not.toHaveBeenCalled();
    expect(d.openAuthSession).not.toHaveBeenCalled();
    expect(d.setSession).toHaveBeenCalledTimes(1);
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });
});
