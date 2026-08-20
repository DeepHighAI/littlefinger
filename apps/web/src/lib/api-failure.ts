import {
  ERROR_CODES,
  ERROR_MESSAGE_BY_LOCALE,
  type ApiErrorAction,
  type ErrorCode,
  type Locale,
  type Localized,
} from '@littlefinger/shared';

/**
 * Edge Function 실패 응답 읽기 — 02 §2-3.
 *
 * SCR-W01 과 SCR-W02 가 같은 규칙을 써야 한다. 화면마다 따로 적으면 같은 코드에 서로 다른
 * 문구가 나가고, 그 차이는 실패 경로에서만 드러나 눈에 띄지 않는다.
 */

/**
 * EC-C02 가 지정한 원문. 서버의 `INTERNAL_ERROR` 와 같은 문장이지만 그쪽은
 * `supabase/functions/_shared` 에 있고, 수락 웹은 Edge Function 코드를 import 하지 않는다.
 * 네트워크가 끊겨 응답 자체가 없을 때도 이 문구를 쓴다 — 그 경우 코드가 없다.
 */
export const INTERNAL_MESSAGE = '처리 중 문제가 발생했습니다. 다시 시도해 주세요.';

/** EC-C02 문구의 로케일 쌍. ko 는 위 상수 그대로다(서버 원문과 한 몸). */
export const INTERNAL_MESSAGE_BY_LOCALE: Localized<string> = {
  ko: INTERNAL_MESSAGE,
  en: 'Something went wrong. Please try again.',
};

export interface ApiFailure {
  /** §2-3 의 14개 코드. 응답이 없거나 모르는 코드면 `null` 이다. */
  code: ErrorCode | null;
  /** 서버가 실은 문구. `E_VALIDATION` 만이 필드별 문구를 여기에 담는다(§2-3). */
  message: string | null;
  /** EC-B10 의 [종료일 변경 요청하기]. 이 하나를 위해 존재하는 키다. */
  action: ApiErrorAction | null;
}

/** 응답이 아예 없을 때(네트워크·JSON 파싱 실패). */
export const NO_RESPONSE: ApiFailure = { code: null, message: null, action: null };

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

/** 실패 응답 본문 → `ApiFailure`. 형태가 어긋나면 응답이 없었던 것과 같이 다룬다. */
export function readFailure(body: unknown): ApiFailure {
  if (typeof body !== 'object' || body === null) return NO_RESPONSE;
  const { code, message, action } = body as Record<string, unknown>;
  return {
    code: isErrorCode(code) ? code : null,
    message: typeof message === 'string' ? message : null,
    action: action === 'AMEND_SUGGEST' ? action : null,
  };
}

/**
 * 실패 문구. §2-3 공통 문구 → 서버가 실은 필드별 문구 → EC-C02 순서다.
 *
 * **모르는 코드면 서버 문구를 쓰지 않는다.** 500 에 실려 오는 것은 §2-3 의 어휘가 아니고,
 * 그대로 띄우면 Postgres 가 붙인 테이블·컬럼 이름이 화면에 나갈 수 있다(§9).
 */
export function messageForFailure(failure: ApiFailure, locale: Locale = 'ko'): string {
  if (failure.code === null) return INTERNAL_MESSAGE_BY_LOCALE[locale];
  return (
    ERROR_MESSAGE_BY_LOCALE[locale][failure.code] ??
    // E_VALIDATION 의 필드별 문구는 서버가 ko 로 싣는다 — 1차에서는 로케일과 무관하게
    // 그대로 보여 준다(PO 2026-08-20: 서버 봉투는 한국어 유지).
    failure.message ??
    INTERNAL_MESSAGE_BY_LOCALE[locale]
  );
}
