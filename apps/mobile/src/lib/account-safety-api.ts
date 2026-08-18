import {
  ENDPOINT,
  type AccountWithdrawResponse,
  type Endpoint,
  type ProfileNicknameUpdateResponse,
  type PromiseHideResponse,
  type SafetyReportRequest,
  type SafetyReportResponse,
  type UserBlockResponse,
} from '@littlefinger/shared';

import type { MobileApiOptions } from './mobile-api.ts';

export interface AccountSafetyApiDeps {
  call<T>(endpoint: Endpoint, body: unknown, options: MobileApiOptions): Promise<T>;
}

const options = (idempotencyKey: string): MobileApiOptions => ({
  idempotent: true,
  idempotencyKey,
});

export async function withdrawAccount(
  idempotencyKey: string,
  deps: AccountSafetyApiDeps,
): Promise<AccountWithdrawResponse> {
  return await deps.call(ENDPOINT.accountWithdraw, {}, options(idempotencyKey));
}

export async function updateProfileNickname(
  nickname: string,
  idempotencyKey: string,
  deps: AccountSafetyApiDeps,
): Promise<ProfileNicknameUpdateResponse> {
  return await deps.call(ENDPOINT.profileNicknameUpdate, { nickname }, options(idempotencyKey));
}

export async function hidePromise(
  promiseId: string,
  hidden: boolean,
  idempotencyKey: string,
  deps: AccountSafetyApiDeps,
): Promise<PromiseHideResponse> {
  return await deps.call(
    ENDPOINT.promiseHide,
    { promise_id: promiseId, hidden },
    options(idempotencyKey),
  );
}

export async function blockUser(
  targetUserId: string,
  idempotencyKey: string,
  deps: AccountSafetyApiDeps,
): Promise<UserBlockResponse> {
  return await deps.call(
    ENDPOINT.userBlock,
    { target_user_id: targetUserId },
    options(idempotencyKey),
  );
}

export async function reportSafetyIssue(
  input: SafetyReportRequest,
  idempotencyKey: string,
  deps: AccountSafetyApiDeps,
): Promise<SafetyReportResponse> {
  return await deps.call(ENDPOINT.safetyReport, input, options(idempotencyKey));
}
