import { ERROR_MESSAGE, type Endpoint } from '@littlefinger/shared';
import * as Crypto from 'expo-crypto';

import {
  MobileApiError,
  callMobileFunction,
  callMobileMultipartFunction,
  type MobileApiOptions,
} from './mobile-api.ts';
import {
  getMobileFunctionUrl,
  getMobileSupabaseClient,
} from './supabase-native.ts';

export async function currentMobileUserId(): Promise<string> {
  const { data, error } = await getMobileSupabaseClient().auth.getSession();
  if (error !== null || data.session === null) {
    throw new MobileApiError(
      'E_AUTH_REQUIRED',
      ERROR_MESSAGE.E_AUTH_REQUIRED ?? '다시 로그인해 주세요.',
    );
  }
  return data.session.user.id;
}

export async function callMobileFunctionNative<T>(
  endpoint: Endpoint,
  body: unknown,
  options: MobileApiOptions,
): Promise<T> {
  return await callMobileFunction<T>(endpoint, body, options, {
    fetch: async (url, init) => await fetch(url, init),
    functionUrl: getMobileFunctionUrl,
    getAccessToken: async () => {
      const { data, error } = await getMobileSupabaseClient().auth.getSession();
      if (error !== null) return null;
      return data.session?.access_token ?? null;
    },
    randomUuid: () => Crypto.randomUUID(),
  });
}

export async function callMobileMultipartFunctionNative<T>(
  endpoint: Endpoint,
  body: FormData,
  idempotencyKey: string,
): Promise<T> {
  return await callMobileMultipartFunction(endpoint, body, idempotencyKey, {
    fetch: async (url, init) => await fetch(url, init),
    functionUrl: getMobileFunctionUrl,
    getAccessToken: async () => {
      const { data, error } = await getMobileSupabaseClient().auth.getSession();
      if (error !== null) return null;
      return data.session?.access_token ?? null;
    },
    randomUuid: () => Crypto.randomUUID(),
  });
}
