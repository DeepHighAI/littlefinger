import { ENDPOINT } from '@littlefinger/shared';
import { makeRedirectUri } from 'expo-auth-session';
import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';

import {
  completeKakaoSignIn as completeKakaoSignInWithDeps,
  signInWithGoogle as signInWithGoogleWithDeps,
  signInWithKakao as signInWithKakaoWithDeps,
  type KakaoAuthDeps,
  type KakaoSignInResult,
} from './kakao-auth.ts';
import {
  getMobileFunctionUrl,
  getMobileSupabaseClient,
} from './supabase-native.ts';

WebBrowser.maybeCompleteAuthSession();

function liveKakaoAuthDeps(): KakaoAuthDeps {
  const client = getMobileSupabaseClient();
  const redirectTo = makeRedirectUri({
    scheme: 'littlefinger',
    path: 'auth-callback',
  });

  return {
    auth: {
      signInWithOAuth: (input) => client.auth.signInWithOAuth(input),
      exchangeCodeForSession: (code) => client.auth.exchangeCodeForSession(code),
    },
    fetch: (input, init) => globalThis.fetch(input, init),
    functionUrl: getMobileFunctionUrl(ENDPOINT.userProvision),
    openAuthSession: async (url, returnUrl) => {
      const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
      return result.type === 'success'
        ? { type: result.type, url: result.url }
        : { type: result.type };
    },
    parseUrl: getQueryParams,
    redirectTo,
  };
}

export function signInWithKakao(): Promise<KakaoSignInResult> {
  return signInWithKakaoWithDeps(liveKakaoAuthDeps());
}

// Google 은 임베디드 WebView 로그인을 차단하지만 expo-web-browser 는 Android
// Custom Tabs 를 열므로 허용 대상이다. 리다이렉트·콜백 경로는 카카오와 공유한다.
export function signInWithGoogle(): Promise<KakaoSignInResult> {
  return signInWithGoogleWithDeps(liveKakaoAuthDeps());
}

export function completeKakaoSignIn(url: string): Promise<KakaoSignInResult> {
  return completeKakaoSignInWithDeps(url, liveKakaoAuthDeps());
}
