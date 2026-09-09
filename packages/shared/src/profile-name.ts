import type { Localized } from './i18n.ts';
import { normalizeInput } from './text.ts';

/** 제공자가 이메일을 이름으로 돌려주는 경우에도 공개 프로필에 복제하지 않는다. */
export function safeProfileName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = normalizeInput(value);
  return name.length > 0 && !name.includes('@') ? name : null;
}

export function profileNameFromMetadata(metadata: Record<string, unknown>): string | null {
  for (const key of ['nickname', 'name', 'full_name', 'preferred_username']) {
    const name = safeProfileName(metadata[key]);
    if (name !== null) return name;
  }
  return null;
}

const ko = {
  title: '수락할 계정을 확인해 주세요',
  body: '이 계정으로 약속을 확인하고 수락해요. 앱에서도 같은 계정을 사용해 주세요.',
  continue: '이 계정으로 계속하기',
  change: '다른 계정으로 로그인',
  fallback: '사용자',
  provider: { google: 'Google', kakao: '카카오', other: '로그인 계정' },
  error: '계정을 확인하지 못했어요. 다시 시도해 주세요.',
  retry: '다시 시도',
};
const en = {
  title: 'Choose the account for this promise',
  body: 'You will review and accept with this account. Use the same account in the app.',
  continue: 'Continue with this account',
  change: 'Sign in with another account',
  fallback: 'User',
  provider: { google: 'Google', kakao: 'Kakao', other: 'Signed-in account' },
  error: 'Could not check your account. Please try again.',
  retry: 'Try again',
} satisfies typeof ko;

export const INVITE_ACCOUNT_LABEL: Localized<typeof ko> = { ko, en };
