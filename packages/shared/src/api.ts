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
import type {
  Answer,
  IsoDate,
  IsoDateTime,
  Keeper,
  ParticipantRole,
  PromiseCategory,
  PromiseStatus,
} from './promise.ts';

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

/**
 * §5 의 코드 키. 껍데기가 실제로 돌려줄 수 있는 것만 적는다.
 *
 * `nickname`·`profile_image_url` 만 §5 밖이다 — 사용자 입력이 아니라 카카오 프로필에서
 * 온 값이라 §5 에 없고, user-provision 껍데기의 형태 판정만 이 이름을 쓴다.
 */
export type ApiValidationField =
  | 'token'
  | 'title'
  | 'body'
  | 'category'
  | 'end_date'
  | 'keeper'
  | 'reward'
  | 'penalty'
  | 'witness_enabled'
  | 'promise_id'
  | 'decline_reason'
  | 'amend_suggestion'
  | 'answer'
  | 'comment'
  | 'revise'
  | 'idempotency_key'
  | 'nickname'
  | 'profile_image_url'
  | 'expo_push_token';

export type ApiErrorAction = 'AMEND_SUGGEST';

/**
 * 약속 작성 (§5-1). `send` 가 true 면 DRAFT 생성과 초대 발송이 **한 트랜잭션**에서 끝난다 —
 * SCR-A03 의 주 CTA [상대에게 보내기]가 한 번의 사용자 행동이기 때문이다(PO 결정 2026-07-27).
 * false 면 [임시저장]이다.
 *
 * 길이·형식 판정은 서버가 최종이다(§2-3). 클라이언트가 같은 규칙을 먼저 돌리는 것은
 * CTA 를 비활성화하기 위해서지, 서버 검증을 대신하기 위해서가 아니다.
 */
export interface PromiseCreateRequest {
  title: string;
  body: string;
  category: string;
  /** `YYYY-MM-DD`, KST 기준. 내일 ~ 오늘 + `END_DATE_MAX_DAYS`. */
  end_date: string;
  /** 생략하면 `BOTH` (§5-1 기본값). */
  keeper?: string;
  reward?: string;
  penalty?: string;
  witness_enabled?: boolean;
  send?: boolean;
}

/** 이미 존재하는 DRAFT의 v1과 조회 캐시를 함께 덮어쓴다(§4-2-2.4). */
export interface PromiseDraftUpdateRequest extends PromiseCreateRequest {
  promise_id: string;
}

/** 이미 있는 DRAFT 를 보내거나(§4-2-1) PENDING 인 약속의 초대를 다시 보낸다(§4-3-2). */
export interface PromiseInviteRequest {
  promise_id: string;
}

/** [임시저장] 응답. */
export interface PromiseDraftResponse {
  promise_id: string;
  status: 'DRAFT';
}

/**
 * 초대 발송 응답.
 *
 * **`token` 은 이 응답에만 존재한다.** DB 에는 해시만 남으므로(§4-3-1, §13) 이 값을 잃으면
 * 링크를 다시 만들 방법이 없고, 새 토큰을 받으려면 재발송해야 한다(`resend_count` 가 오른다).
 *
 * **`token` 이 없는 응답은 멱등 재시도의 캐시본이다.** 같은 `Idempotency-Key` 로 두 번 보내면
 * 서버는 첫 요청의 결과를 그대로 돌려주는데, 그 토큰은 두 번째 요청이 만든 것이 아니라
 * 서버가 되돌려줄 수 없다. 이때 두 번째 요청이 만든 토큰으로 링크를 조립하면 **DB 에 없는
 * 토큰**이 사용자에게 가고, 증상은 E_NOT_FOUND 하나뿐이라 추적할 단서가 없다. 그래서 서버는
 * 아예 싣지 않는다 — 클라이언트는 먼저 도착한 응답의 토큰을 쓴다.
 *
 * 링크는 클라이언트가 조립한다: `https://{web}/i/{token}` (§4-3-1). 웹 도메인은 C-3 이
 * 확정되지 않아 서버에 두지 않는다(PO 결정 2026-07-27).
 */
export interface PromiseInviteResponse {
  promise_id: string;
  status: 'PENDING';
  invitation_id: string;
  /** 발급 + `INVITE_TTL_HOURS`. SCR-A04 카운트다운의 기준점이다. */
  expires_at: string;
  /** 최초 발송은 0. `INVITE_RESEND_MAX` 를 넘으면 `E_RATE_LIMIT` (EC-B08). */
  resend_count: number;
  /** 공유 문구용. §4-3-2 는 제목과 링크만 담으라고 한다. */
  title: string;
  token?: string;
}

/** DRAFT 저장 또는 같은 트랜잭션에서 T-02까지 마친 응답. */
export type PromiseDraftUpdateResponse = PromiseDraftResponse | PromiseInviteResponse;

/** SCR-A04에서 현재 PARTNER 초대만 무효화한다. 약속 취소와는 별개다. */
export interface InviteRevokeRequest {
  promise_id: string;
}

export interface InviteRevokeResponse {
  promise_id: string;
  status: 'PENDING';
  invitation_status: 'REVOKED';
}

/** 요청 본문 — 초대 토큰 하나로 시작하는 다섯 함수의 공통 부분 */
export interface InviteTokenRequest {
  /** URL-safe Base64 원문 토큰. 서버는 해시만 저장하므로 원문은 여기서만 존재한다(§4-3-1). */
  token: string;
}

/**
 * SCR-W02 약속 검토 (§4-3-4). 로그인 **후** 한 번 부르고, 그 응답 하나로 화면이 다 그려진다.
 *
 * `invite-resolve`(로그인 전)와 담는 것이 정반대다 — 그쪽은 링크 유출을 전제로 본문·보상·
 * 벌칙을 **뺀** 최소 정보만 주고, 이쪽은 승인과 같은 가드를 통과한 사람에게만 전문을 준다.
 *
 * 담지 않는 것 두 가지:
 * - **디스클레이머**. `LEGAL_DISCLAIMER` 상수를 그대로 쓴다. 서버가 보내면 문구가 두 벌이 된다.
 * - **D-Day**. `end_date` 만 보내고 `datetime.ts` 가 KST 로 계산한다. 서버가 미리 계산해
 *   문자열로 내려보내면 자정을 넘긴 화면이 갱신되지 않는다.
 */
export interface InvitePreviewResponse {
  title: string;
  body: string;
  category: PromiseCategory;
  /** `YYYY-MM-DD`, KST 기준. 지난 날짜여도 응답은 온다 — 화면은 그려야 하고 CTA 만 잠긴다(EC-B10). */
  end_date: IsoDate;
  keeper: Keeper;
  reward: string | null;
  penalty: string | null;
  /** 증인 사용 **예정** 여부. 확정 전이라 실제 증인은 아직 없다. */
  witness_enabled: boolean;
  /** 오수락 방지 확인 시트가 "{nickname}님이 보낸 약속이 맞나요?"에 쓴다(§4-3-4). */
  creator: {
    nickname: string;
    profile_image_url: string | null;
  };
}

/**
 * SCR-W01 초대 랜딩 (§4-3-3). 로그인 **전** 화면이라, 서비스에서 인증 없이 나가는
 * 유일한 약속 정보다.
 *
 * **담지 않는 것이 이 타입의 본질이다.** 본문·보상·벌칙·종료일·카테고리·지킬 사람·
 * 증인 여부·프로필 이미지가 전부 빠져 있고, 그것들은 로그인 후 `InvitePreviewResponse`
 * 로만 나간다. 카톡으로 퍼진 링크는 의도한 상대가 아닌 사람도 연다는 전제다
 * (§4-3-3 "링크 유출 대비").
 *
 * `target_role` 은 §4-3-3 이 열거하지 않았지만 온다. §4-5-2 가 증인 링크에도 같은
 * 1회용·72시간 규칙을 주므로 증인도 이 화면에 도착하고, 역할을 모르면 로그인 후
 * SCR-W02 로 갈지 SCR-W05 로 갈지 정할 수 없다. 라우팅 정보일 뿐 약속 내용이 아니다.
 *
 * 실패 응답에는 이 payload 가 **존재하지 않는다** — RPC 가 raise 로만 실패를 알리므로
 * 만료·사용됨·무효화 어느 쪽도 작성자 이름이나 제목을 싣지 않는다(EC-B01·B03·B11).
 */
export interface InviteResolveResponse {
  creator_nickname: string;
  title: string;
  /** 초대 발급 + `INVITE_TTL_HOURS`. SCR-W01 만료 카운트다운의 기준점이다. */
  expires_at: IsoDateTime;
  target_role: Extract<ParticipantRole, 'PARTNER' | 'WITNESS'>;
}

/**
 * 승인 응답 (§4-3-5, T-03). SCR-W03 이 그리는 것 전부가 여기 있다.
 *
 * **이 payload 는 한 번만 존재한다.** 승인과 함께 초대는 `USED` 가 되므로 같은 토큰으로는
 * 다시 받을 수 없고, 확정 기록을 계정으로 다시 읽는 경로(SCR-W04)는 아직 없다. 화면은
 * 이 응답을 라우터 state 로 넘겨 받는다.
 *
 * `approvals` 는 **2행 고정**이다 — 작성자의 승인 시각은 초대 발송 시각이고(§4-3-6),
 * 상대방의 승인 시각은 지금이다. 두 시각을 모두 표시하는 것이 명세의 요구다.
 */
export interface PromiseApproveResponse {
  promise_id: string;
  status: 'ACTIVE';
  activated_at: IsoDateTime;
  creator_id: string;
  title: string;
  partner: {
    user_id: string;
    nickname: string;
    profile_image_url: string | null;
  };
  version_no: number;
  /** 사람이 읽는 확정 기록 지문. 예: `A3F9-77C2-01`. */
  fingerprint: string;
  approvals: readonly PromiseApprovalLog[];
}

export interface PromiseApprovalLog {
  role: Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>;
  nickname: string;
  acted_at: IsoDateTime;
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
 * 로그인 직후 `public.users` 행 보정 (02 §165, 핸드오프 2026-07-30).
 *
 * 트리거(`lf_user_stub`)는 로그인을 지키기 위해 대진값만 쓴다 — `after insert on auth.users`
 * 시점에는 `auth.identities` 도 `raw_user_meta_data` 도 아직 없기 때문이다. 이 호출이
 * 로그인 뒤에 진짜 값을 채운다. 로그인마다 한 번 부르고, RPC 가 멱등이라(먼저 쓴 값이
 * 이긴다) 중복 호출은 무해하다.
 *
 * **여기 없는 두 값이 이 타입의 본질이다.**
 * - `kakao_id` — RPC 가 `auth.identities.provider_id` 에서 직접 읽는다. 클라이언트가
 *   보내게 두면 남의 회원번호를 주장할 수 있고, EC-A05 가 계정 동일성 판정에 쓰는 값이다.
 * - `surface` — 껍데기가 `Origin` 헤더의 유무로 판정한다. `approvals.surface` 와 같은 규칙.
 *
 * 두 필드 모두 선택이다. 카카오 profile_nickname 은 [선택 동의]라(§6-1) 거부한 사용자의
 * metadata 에는 키가 **아예 없다** — 그때는 보내지 않고, 서버가 대진값을 유지한다.
 *
 * 성공 응답은 **204, 본문 없음**이다. RPC 가 `returns void` 라 실을 payload 가 없고,
 * 이 파일의 봉투 원칙(성공은 RPC payload 를 그대로)에서 "없음"의 정직한 표현은 204 다.
 */
export interface UserProvisionRequest {
  nickname?: string;
  profile_image_url?: string;
}

/** 앱 로그인 뒤 Expo Push Service 토큰 등록(§4-1-3.5). 플랫폼은 Android로 서버가 고정한다. */
export interface DeviceTokenRegisterRequest {
  expo_push_token: string;
}

/** 로그인한 작성자·상대방의 약속 목록 카드. */
export interface ParticipantPromiseSummary {
  promise_id: string;
  title: string;
  status: PromiseStatus;
  end_date: IsoDate;
  keeper: Keeper;
  updated_at: IsoDateTime;
  check_deadline_at: IsoDateTime | null;
  check_round_no: number;
  needs_response: boolean;
  waiting_for_partner: boolean;
}

export interface PromiseFulfillmentDetailRequest {
  promise_id: string;
}

/** 한 라운드에서 당사자 한 명이 제출한 주장. */
export interface FulfillmentCheckView {
  role: Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>;
  answer: Answer;
  comment: string | null;
  submitted_at: IsoDateTime;
  revised_at: IsoDateTime | null;
  round_no: number;
}

export interface FulfillmentRoundView {
  round_no: number;
  creator_check: FulfillmentCheckView | null;
  partner_check: FulfillmentCheckView | null;
}

export interface PromiseFulfillmentDetailResponse {
  promise_id: string;
  title: string;
  body: string;
  category: PromiseCategory;
  end_date: IsoDate;
  keeper: Keeper;
  reward: string | null;
  penalty: string | null;
  status: PromiseStatus;
  checking_started_at: IsoDateTime | null;
  check_deadline_at: IsoDateTime | null;
  check_round_no: number;
  creator: {
    user_id: string;
    nickname: string;
    profile_image_url: string | null;
  };
  partner: {
    user_id: string;
    nickname: string;
    profile_image_url: string | null;
  };
  my_check: FulfillmentCheckView | null;
  partner_has_submitted: boolean;
  partner_check: FulfillmentCheckView | null;
  history: readonly FulfillmentRoundView[];
}

export interface FulfillmentSubmitRequest {
  promise_id: string;
  answer: Answer;
  comment?: string;
  revise?: boolean;
}

export interface FulfillmentNotificationRecipient {
  user_id: string;
  role: ParticipantRole;
}

export interface FulfillmentSubmitResponse {
  promise_id: string;
  status: Extract<PromiseStatus, 'CHECKING' | 'COMPLETED' | 'BROKEN' | 'DISPUTED'>;
  round_no: number;
  submitted_at: IsoDateTime;
  revised_at: IsoDateTime | null;
  waiting_for_partner: boolean;
  /** 알림 템플릿이 쓰는 약속 제목. 다른 참여자의 응답은 담지 않는다. */
  title: string;
  /** Task 3가 상태별 수신자를 고르는 데 필요한 최소 식별 정보. */
  notification_recipients: readonly FulfillmentNotificationRecipient[];
}

/**
 * Edge Function 슬러그. `04` §7-3 의 이름을 그대로 쓴다.
 *
 * `lf_idempotency_begin` 이 이 문자열을 (키, 사용자, 엔드포인트) 쌍의 일부로 저장하므로
 * 값이 바뀌면 캐시가 통째로 어긋난다. 거절·수정 제안이 **서로 달라야** 하는 이유이기도
 * 하다 — 같으면 한쪽 응답이 다른 쪽 요청으로 샌다.
 */
export const ENDPOINT = {
  promiseCreate: 'promise-create',
  promiseDraftUpdate: 'promise-draft-update',
  promiseInvite: 'promise-invite',
  inviteRevoke: 'invite-revoke',
  inviteResolve: 'invite-resolve',
  invitePreview: 'invite-preview',
  promiseApprove: 'promise-approve',
  promiseDecline: 'promise-decline',
  promiseAmend: 'promise-amend',
  userProvision: 'user-provision',
  deviceTokenRegister: 'device-token-register',
  participantPromiseList: 'participant-promise-list',
  promiseFulfillmentDetail: 'promise-fulfillment-detail',
  fulfillmentSubmit: 'fulfillment-submit',
} as const;

export type Endpoint = (typeof ENDPOINT)[keyof typeof ENDPOINT];
