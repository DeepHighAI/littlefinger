import type {
  ProfileNicknameUpdateResponse,
  PromiseHideResponse,
  SafetyReportRequest,
  SafetyReportResponse,
  UserBlockResponse,
} from '@littlefinger/shared';
import * as Crypto from 'expo-crypto';

import {
  blockUser as blockUserWith,
  hidePromise as hidePromiseWith,
  reportSafetyIssue as reportSafetyIssueWith,
  updateProfileNickname as updateProfileNicknameWith,
  withdrawAccount as withdrawAccountWith,
} from './account-safety-api.ts';
import { callMobileFunctionNative } from './mobile-api-native.ts';
import { runIntentionalSignOut } from './intentional-sign-out.ts';
import { getMobileSupabaseClient } from './supabase-native.ts';

const deps = { call: callMobileFunctionNative };
const key = (): string => Crypto.randomUUID();

export async function withdrawAccountNative(): Promise<void> {
  await withdrawAccountWith(key(), deps);
  // 서버 계정 삭제가 끝난 뒤 남은 로컬 세션도 즉시 버려 WITHDRAWN JWT를 재사용하지 않는다.
  await runIntentionalSignOut(async () => {
    const { error } = await getMobileSupabaseClient().auth.signOut({ scope: 'local' });
    if (error !== null) throw error;
  });
}

export async function updateProfileNicknameNative(
  nickname: string,
): Promise<ProfileNicknameUpdateResponse> {
  return await updateProfileNicknameWith(nickname, key(), deps);
}

export async function hidePromiseNative(
  promiseId: string,
  hidden: boolean,
): Promise<PromiseHideResponse> {
  return await hidePromiseWith(promiseId, hidden, key(), deps);
}

export async function blockUserNative(targetUserId: string): Promise<UserBlockResponse> {
  return await blockUserWith(targetUserId, key(), deps);
}

export async function reportSafetyIssueNative(
  input: SafetyReportRequest,
): Promise<SafetyReportResponse> {
  return await reportSafetyIssueWith(input, key(), deps);
}
