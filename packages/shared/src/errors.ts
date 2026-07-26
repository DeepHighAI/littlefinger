/**
 * 에러 코드 — 02_세부기능명세서 §2-3.
 *
 * 코드는 앱·웹·Edge Function 이 공유하는 유일한 실패 어휘다.
 * 비참여자 조회는 "권한 없음"이 아니라 `E_NOT_FOUND` 로 답한다 —
 * 약속의 존재 자체를 알리지 않기 위해서다(04 §7-2).
 */

import { INVITE_TTL_HOURS, WITNESS_MAX } from './config.js';

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
  E_WITNESS_LIMIT: `증인은 최대 ${WITNESS_MAX}명까지예요.`,
  E_BLOCKED: '초대를 받을 수 없습니다.',
  E_RATE_LIMIT: '잠시 후 다시 시도해 주세요.',
  E_UPLOAD_FAILED: '사진을 올리지 못했어요. 다시 시도해 주세요.',
};
