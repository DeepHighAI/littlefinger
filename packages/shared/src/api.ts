/**
 * Edge Function HTTP 계약 — 02_세부기능명세서 §2-3 · §7-3.6.
 *
 * 명세는 에러 코드와 HTTP 상태만 정하고 응답 봉투는 정하지 않는다. 그래서 여기서 한 번
 * 정하고, 껍데기 4개와 앱·웹이 같은 타입을 쓴다. 함수마다 따로 정의하면 네 벌이 되고,
 * 그중 하나만 어긋나도 클라이언트는 그 함수에서만 에러 문구를 잃는다.
 *
 * 성공은 RPC payload 를 **그대로** 최상위에 싣는다. 봉투로 한 겹 더 싸지 않는 이유는
 * §2-3 이 실패에 진짜 HTTP 상태(401·404·409·410·422·429)를 배정하기 때문이다 —
 * 상태 코드가 이미 성공·실패를 말하므로 `{ok: …}` 는 같은 정보를 두 번 적는 것이다.
 */

import type { ErrorCode } from './errors.ts';

/** 상태 변경 요청이 반드시 달고 오는 헤더 (§7-3.6). 값은 UUID 다. */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/**
 * 실패 응답 본문. HTTP 상태는 `ERROR_HTTP_STATUS[code]` 다.
 *
 * `field` 는 `E_VALIDATION` 전용이다 — §2-3 이 이 코드에만 "필드별 메시지(§5)"를 배정한다.
 * 나머지 코드는 `ERROR_MESSAGE` 의 공통 문구 하나로 끝난다.
 */
export interface ApiErrorBody {
  code: ErrorCode;
  /** 사용자에게 그대로 보여도 되는 문구. 약속의 존재·작성자를 절대 담지 않는다(EC-B01·B03·B11). */
  message: string;
  /** `E_VALIDATION` 일 때 어느 필드인지. §5 의 코드 키를 쓴다. */
  field?: ApiValidationField;
  /**
   * 클라이언트가 실패 자리에 띄울 대안 행동.
   *
   * EC-B10 하나만을 위해 존재한다. 종료일이 지난 약속은 승인할 수 없고, 명세가 지정한
   * 유일한 출구가 [종료일 변경 요청하기](= 수정 제안)다. 필드 이름만으로는 "이 버튼을
   * 띄우라"를 표현할 수 없어서 별도 키로 둔다.
   */
  action?: ApiErrorAction;
}

/** §5 의 코드 키. 껍데기가 실제로 돌려줄 수 있는 것만 적는다. */
export type ApiValidationField =
  | 'token'
  | 'end_date'
  | 'decline_reason'
  | 'amend_suggestion'
  | 'idempotency_key';

export type ApiErrorAction = 'AMEND_SUGGEST';

/** 요청 본문 — 초대 토큰 하나로 시작하는 네 함수의 공통 부분 */
export interface InviteTokenRequest {
  /** URL-safe Base64 원문 토큰. 서버는 해시만 저장하므로 원문은 여기서만 존재한다(§4-3-1). */
  token: string;
}

export interface PromiseDeclineRequest extends InviteTokenRequest {
  /** §5-3. 선택, 0~200자. */
  reason?: string;
}

export interface PromiseAmendRequest extends InviteTokenRequest {
  /** §5-3. 필수, 5~300자. */
  comment: string;
}

/**
 * Edge Function 슬러그. `04` §7-3 의 이름을 그대로 쓴다.
 *
 * `lf_idempotency_begin` 이 이 문자열을 (키, 사용자, 엔드포인트) 쌍의 일부로 저장하므로
 * 값이 바뀌면 캐시가 통째로 어긋난다. 거절·수정 제안이 **서로 달라야** 하는 이유이기도
 * 하다 — 같으면 한쪽 응답이 다른 쪽 요청으로 샌다.
 */
export const ENDPOINT = {
  inviteResolve: 'invite-resolve',
  promiseApprove: 'promise-approve',
  promiseDecline: 'promise-decline',
  promiseAmend: 'promise-amend',
} as const;

export type Endpoint = (typeof ENDPOINT)[keyof typeof ENDPOINT];
