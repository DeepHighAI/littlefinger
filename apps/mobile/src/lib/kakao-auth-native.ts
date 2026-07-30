import { ENDPOINT } from '@littlefinger/shared';
import { makeRedirectUri } from 'expo-auth-session';
import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';

import {
  completeKakaoSignIn as completeKakaoSignInWithDeps,
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
      setSession: (tokens) => client.auth.setSession(tokens),
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
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

export function signInWithKakao(): Promise<KakaoSignInResult> {
  return signInWithKakaoWithDeps(liveKakaoAuthDeps());
}

export function completeKakaoSignIn(url: string): Promise<KakaoSignInResult> {
  return completeKakaoSignInWithDeps(url, liveKakaoAuthDeps());
}
