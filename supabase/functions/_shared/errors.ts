// RPC 가 raise 한 메시지 → 02 §2-3 의 에러 코드·HTTP 상태.
//
// `packages/shared` 의 표를 **import 한다. 복사하지 않는다.** 껍데기가 자기 표를 들고 있으면
// 코드는 열넷인데 표는 열셋인 상태가 조용히 생기고, 그 차이는 실패 경로에서만 드러난다 —
// 즉 아무도 안 보는 곳에서만 틀린다.
//
// 상대경로 import 가 성립하려면 `packages/shared` 안의 지정자가 `.ts` 여야 한다. Deno 는
// 확장자를 그대로 찾고, Supabase CLI 번들러는 못 찾은 파일을 WARN 후 건너뛰기 때문에
// `.js` 로 적혀 있으면 배포가 Module not found 로 죽는다(PO 결정 2026-07-26).

import type { ApiErrorAction, ApiErrorBody, ApiValidationField } from '../../../packages/shared/src/api.ts';
import {
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  ERROR_MESSAGE,
  type ErrorCode,
} from '../../../packages/shared/src/errors.ts';

const KNOWN_CODES: ReadonlySet<string> = new Set<string>(ERROR_CODES);

/**
 * §2-3 표에 없는 유일한 응답.
 *
 * 표는 14개 코드에 401~429 만 배정하고 5xx 를 담지 않는다. 그렇다고 예상 못 한 실패를
 * 그중 하나로 위장하면 클라이언트가 재시도할지 포기할지 판단할 근거를 잃는다. 문구는
 * EC-C02 가 지정한 원문이다 — "약속은 승인 대기 그대로"라는 뜻을 담고 있어야 한다.
 */
export const INTERNAL_ERROR = {
  code: 'E_INTERNAL',
  message: '처리 중 문제가 발생했습니다. 다시 시도해 주세요.',
} as const;

/**
 * 껍데기가 의도적으로 던지는 실패. RPC 가 raise 한 것도 이걸로 감싼다.
 *
 * `field` 와 `action` 을 함수마다 다르게 채우는 것이 이 클래스의 존재 이유다. RPC 는
 * `E_VALIDATION` 을 필드 이름 없이 raise 하는데, 각 함수가 검사하는 필드는 **하나뿐**이라
 * 어느 필드인지는 호출한 쪽이 안다.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly field: ApiValidationField | undefined;
  readonly action: ApiErrorAction | undefined;
  /** §5 의 필드별 문구. 명세에 문구가 없으면 비워 두고 공통 문구로 떨어진다. */
  readonly userMessage: string | undefined;

  constructor(
    code: ErrorCode,
    options: { field?: ApiValidationField; action?: ApiErrorAction; userMessage?: string } = {},
  ) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.field = options.field;
    this.action = options.action;
    this.userMessage = options.userMessage;
  }
}

/**
 * RPC 실패에서 코드를 꺼낸다. 아는 코드가 아니면 `null` 이다.
 *
 * **모르는 메시지를 그대로 흘려보내지 않는다.** Postgres 는 제약 위반이나 타입 오류에
 * 테이블·컬럼·값을 담은 메시지를 붙이는데, 그게 응답에 실리면 비참여자에게 약속의 존재를
 * 알리지 않는다는 규칙(§9)이 실패 경로에서만 무너진다.
 */
export function toErrorCode(raised: unknown): ErrorCode | null {
  if (raised instanceof ApiError) return raised.code;

  const message =
    typeof raised === 'object' && raised !== null && 'message' in raised
      ? String((raised as { message: unknown }).message)
      : '';

  return KNOWN_CODES.has(message) ? (message as ErrorCode) : null;
}

/**
 * 사용자 노출 문구. `E_VALIDATION` 만 필드별 문구(§5)를 쓰므로 호출자가 넘긴다.
 *
 * 어느 코드도 약속의 제목·작성자·존재를 담지 않는다. EC-B01·B03·B11 이 만료·무효화·차단
 * 링크에 "내용 노출 금지"를 걸어 두었는데, 작성자 이름 한 줄이면 그 규칙이 무의미해진다.
 */
export function errorBody(error: ApiError): ApiErrorBody {
  return {
    code: error.code,
    // §2-3 은 `E_VALIDATION` 에만 공통 문구를 주지 않는다(`ERROR_MESSAGE` 가 null). 필드 문구도
    // 없으면 EC-C02 의 내부 오류 문구로 떨어지는데, 그 경로는 사용자가 만들 수 없는 상황
    // (본문 형식 오류·Idempotency-Key 누락)뿐이라 "다시 시도해 주세요"가 맞는 안내다.
    message: error.userMessage ?? ERROR_MESSAGE[error.code] ?? INTERNAL_ERROR.message,
    ...(error.field !== undefined ? { field: error.field } : {}),
    ...(error.action !== undefined ? { action: error.action } : {}),
  };
}

export function statusFor(code: ErrorCode): number {
  return ERROR_HTTP_STATUS[code];
}
