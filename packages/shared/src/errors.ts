/**
 * 에러 코드 — 02_세부기능명세서 §2-3.
 *
 * 코드는 앱·웹·Edge Function 이 공유하는 유일한 실패 어휘다.
 * 비참여자 조회는 "권한 없음"이 아니라 `E_NOT_FOUND` 로 답한다 —
 * 약속의 존재 자체를 알리지 않기 위해서다(04 §7-2).
 *
 * `E_SLOT_LIMIT` 은 §2-3 원표에 없던 15번째 코드다(PO 2026-08-24, 유료 슬롯 도입).
 * 한도 초과이지만 `E_RATE_LIMIT`(기다리면 풀림)와 달리 **결제로만 풀리는** 상태라서
 * 코드를 분리했다 — 클라이언트가 이 코드를 보고 결제 시트를 연다.
 */

import { INVITE_TTL_HOURS } from './config.ts';
import type { Localized } from './i18n.ts';

export const ERROR_CODES = [
  'E_AUTH_REQUIRED',
  'E_FORBIDDEN',
  'E_NOT_FOUND',
  'E_INVITE_EXPIRED',
  'E_INVITE_USED',
  'E_INVITE_REVOKED',
  'E_STATE_CONFLICT',
  'E_VALIDATION',
  'E_SELF_INVITE',
  'E_DUPLICATE_ROLE',
  'E_WITNESS_LIMIT',
  'E_BLOCKED',
  'E_RATE_LIMIT',
  'E_UPLOAD_FAILED',
  'E_SLOT_LIMIT',
  'E_END_DATE_RANGE',
  'E_REWARD_NOT_ELIGIBLE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  E_AUTH_REQUIRED: 401,
  E_FORBIDDEN: 403,
  E_NOT_FOUND: 404,
  E_INVITE_EXPIRED: 410,
  E_INVITE_USED: 410,
  E_INVITE_REVOKED: 410,
  E_STATE_CONFLICT: 409,
  E_VALIDATION: 422,
  E_SELF_INVITE: 422,
  E_DUPLICATE_ROLE: 422,
  E_WITNESS_LIMIT: 422,
  E_BLOCKED: 422,
  E_RATE_LIMIT: 429,
  E_UPLOAD_FAILED: 400,
  E_SLOT_LIMIT: 402,
  E_END_DATE_RANGE: 402,
  E_REWARD_NOT_ELIGIBLE: 422,
};

/**
 * 사용자 노출 문구. `null` 은 공통 문구가 없다는 뜻이다 —
 * `E_VALIDATION` 은 필드별 문구(§5)를 쓰므로 여기서 하나로 정하지 않는다.
 *
 * 숫자가 들어가는 문구는 정책 상수에서 만든다. 문자열에 박으면 정책이 바뀔 때 문구만 남는다.
 */
export const ERROR_MESSAGE: Record<ErrorCode, string | null> = {
  E_AUTH_REQUIRED: '다시 로그인해 주세요.',
  E_FORBIDDEN: '이 약속에 대한 권한이 없어요.',
  E_NOT_FOUND: '약속을 찾을 수 없어요.',
  E_INVITE_EXPIRED: `초대 링크가 만료됐어요. (${INVITE_TTL_HOURS}시간)`,
  E_INVITE_USED: '이미 사용된 초대 링크예요.',
  E_INVITE_REVOKED: '작성자가 초대를 다시 보냈어요. 최신 링크를 확인해 주세요.',
  E_STATE_CONFLICT: '약속 상태가 변경됐어요. 새로고침 후 다시 시도해 주세요.',
  E_VALIDATION: null,
  E_SELF_INVITE: '본인은 상대방이 될 수 없어요.',
  E_DUPLICATE_ROLE: '이미 이 약속에 참여하고 있어요.',
  E_WITNESS_LIMIT: '지금 사용할 수 있는 증인 자리를 모두 사용했어요.',
  E_BLOCKED: '초대를 받을 수 없습니다.',
  E_RATE_LIMIT: '잠시 후 다시 시도해 주세요.',
  E_UPLOAD_FAILED: '사진을 올리지 못했어요. 다시 시도해 주세요.',
  // 용량은 사용자마다 다르므로(무료 5 + 구매 수) 숫자를 문구에 넣지 않는다.
  E_SLOT_LIMIT: '약속 슬롯이 가득 찼어요. 슬롯을 추가하면 새 약속을 보낼 수 있어요.',
  // 수락 웹에도 그대로 노출되는 문구다 — 광고·구매 안내는 앱 카탈로그(promise-benefit-labels)의 몫(§8-1).
  E_END_DATE_RANGE: '설정할 수 있는 종료일 범위를 넘었어요.',
  E_REWARD_NOT_ELIGIBLE: '지금은 이 혜택을 받을 수 없어요.',
};

/**
 * 로케일별 사용자 노출 문구 (PO 2026-08-20: 클라이언트 렌더만 로케일을 탄다).
 * ko 는 위 상수 그대로 — 서버 봉투는 1차에서 계속 ko 문구를 싣고, 클라이언트가
 * 코드로 다시 그릴 수 있는 경우에만 로케일 문구가 보인다.
 */
export const ERROR_MESSAGE_BY_LOCALE: Localized<Record<ErrorCode, string | null>> = {
  ko: ERROR_MESSAGE,
  en: {
    E_AUTH_REQUIRED: 'Please sign in again.',
    E_FORBIDDEN: 'You do not have access to this promise.',
    E_NOT_FOUND: 'Promise not found.',
    E_INVITE_EXPIRED: `This invite link has expired. (${INVITE_TTL_HOURS} hours)`,
    E_INVITE_USED: 'This invite link has already been used.',
    E_INVITE_REVOKED: 'The creator sent a new invite. Please use the latest link.',
    E_STATE_CONFLICT: 'The promise has changed. Refresh and try again.',
    E_VALIDATION: null,
    E_SELF_INVITE: 'You cannot be your own partner.',
    E_DUPLICATE_ROLE: 'You are already part of this promise.',
    E_WITNESS_LIMIT: 'All currently available witness spots are in use.',
    E_BLOCKED: 'This invite cannot be accepted.',
    E_RATE_LIMIT: 'Please try again in a moment.',
    E_UPLOAD_FAILED: 'The photo could not be uploaded. Please try again.',
    E_SLOT_LIMIT: 'Your promise slots are full. Add a slot to send a new promise.',
    E_END_DATE_RANGE: 'This end date is beyond the allowed range.',
    E_REWARD_NOT_ELIGIBLE: 'This benefit is not available right now.',
  },
};
