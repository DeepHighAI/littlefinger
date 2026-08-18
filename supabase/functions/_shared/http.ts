// HTTP 응답 조립과 CORS.
//
// 수락 웹(`*.web.app`)이 함수(`*.supabase.co`)를 부르므로 언제나 교차 출처다 — preflight 를
// 처리하지 않으면 SCR-W02 의 세 액션이 전부 브라우저 단계에서 막힌다.

import type {
  ApiErrorAction,
  ApiErrorBody,
  ApiValidationField,
} from '../../../packages/shared/src/api.ts';
import { ApiError, INTERNAL_ERROR, errorBody, statusFor, toErrorCode } from './errors.ts';

/**
 * 허용 헤더에 `idempotency-key` 가 반드시 들어간다. 빠뜨리면 상태 변경 요청 세 개가
 * preflight 에서 잘려 나가고, 브라우저 콘솔 밖에서는 아무 증상도 보이지 않는다.
 */
const CORS_HEADERS: Readonly<Record<string, string>> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS } });
}

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/**
 * `returns void` 인 RPC 의 성공. 실을 payload 가 없으므로 204 다 — `{}` 를 지어내면
 * 클라이언트가 없는 봉투를 파싱하기 시작한다. CORS 헤더는 그대로 필요하다: 브라우저는
 * 헤더가 없는 응답을 성공이라도 읽지 못하게 막는다.
 */
export function noContentResponse(): Response {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS } });
}

/**
 * 실패 응답. 아는 코드가 아니면 **내부 오류로 뭉갠다**.
 *
 * 모르는 예외를 그대로 내보내면 Postgres 가 붙인 테이블·컬럼·값이 응답에 실린다. 그 한 줄이
 * §9 의 "비참여자에게 약속의 존재조차 알리지 않는다"를 실패 경로에서만 무너뜨린다.
 * 원문은 로그에도 보내지 않는다. PostgREST 오류는 요청 값과 행 식별자를 포함할 수 있으므로
 * 로그에는 고정된 실패 분류만 남긴다.
 */
/**
 * 함수마다 `E_VALIDATION` 이 뜻하는 것 — RPC 는 필드 이름 없이 raise 하지만, 각 함수가
 * 검사하는 필드는 하나뿐이라 호출한 쪽이 어느 필드인지 안다.
 */
export interface ValidationMeaning {
  field: ApiValidationField;
  /** §5 의 필드별 문구. 명세에 문구가 없는 필드는 `null` 이다(validation.ts 와 같은 규칙). */
  message: string | null;
  action?: ApiErrorAction;
}

export function failureResponse(
  raised: unknown,
  options: { validation?: ValidationMeaning; log: (message: string, detail: unknown) => void },
): Response {
  const code = toErrorCode(raised);
  if (code === null) {
    options.log('unmapped RPC failure', { reason: 'UNMAPPED_ERROR' });
    return jsonResponse(INTERNAL_ERROR, 500);
  }

  // 껍데기가 스스로 던진 것은 이미 자기 필드를 알고 있다. 여기에 RPC 용 설명을 덧씌우면
  // `Idempotency-Key` 누락에 "종료일이 지났어요"가 나간다.
  //
  // 그리고 설명은 `E_VALIDATION` 에만 붙인다. 코드를 가리지 않고 덮으면 만료된 링크에
  // 종료일 안내가 나가는 식으로, 사용자가 고칠 수 없는 것을 고치라고 말하게 된다.
  if (raised instanceof ApiError) {
    return jsonResponse(errorBody(raised), statusFor(code));
  }

  const meaning = code === 'E_VALIDATION' ? options.validation : undefined;
  const error = new ApiError(code, {
    ...(meaning?.field !== undefined ? { field: meaning.field } : {}),
    ...(meaning?.action !== undefined ? { action: meaning.action } : {}),
    ...(meaning?.message != null ? { userMessage: meaning.message } : {}),
  });

  const body: ApiErrorBody = errorBody(error);
  return jsonResponse(body, statusFor(code));
}
