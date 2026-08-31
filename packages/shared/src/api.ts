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
  ParticipantStatus,
  PromiseCategory,
  PromiseStatus,
  AmendStatus,
  AmendType,
} from './promise.ts';
import type { NotificationDeeplink, NotificationEvent } from './notification.ts';

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
  | 'participant_id'
  | 'decline_reason'
  | 'amend_suggestion'
  | 'answer'
  | 'comment'
  | 'revise'
  | 'evidences'
  | 'upload_id'
  | 'evidence_id'
  | 'variant'
  | 'idempotency_key'
  | 'tab'
  | 'cursor'
  | 'limit'
  | 'notification_id'
  | 'reminders'
  | 'remind_hour'
  | 'nickname'
  | 'profile_image_url'
  | 'expo_push_token'
  | 'type'
  | 'proposed'
  | 'reason'
  | 'request_id'
  | 'decision'
  | 'target_user_id'
  | 'hidden'
  | 'detail'
  | 'product_id'
  | 'purchase_token'
  | 'action'
  | 'intent_id';

export type RewardAction =
  | 'WITNESS_CREATOR'
  | 'WITNESS_PARTNER'
  | 'DURATION_30D'
  | 'RETENTION_30D';

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
  end_date: string | null;
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

/** 작성자가 승인 전 약속과 연결된 초대 전체를 삭제한다. */
export interface PromisePendingDeleteRequest {
  promise_id: string;
}

export interface PromisePendingDeleteResponse {
  promise_id: string;
  deleted: true;
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
  end_date: IsoDate | null;
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

/** MOD-02가 표시하는 증인 초대 슬롯. 로그인 전 슬롯은 식별 프로필이 없다. */
export interface WitnessSlotView {
  participant_id: string;
  status: Extract<ParticipantStatus, 'INVITED' | 'JOINED'>;
  nickname: string | null;
  profile_image_url: string | null;
  expires_at: IsoDateTime | null;
  signed_at: IsoDateTime | null;
}

export interface WitnessInviteListRequest {
  promise_id: string;
}

export interface WitnessInviteListResponse {
  promise_id: string;
  occupied_count: number;
  capacity: number;
  witness_max: number;
  creator_capacity: number;
  partner_capacity: number;
  witnesses: readonly WitnessSlotView[];
}

export interface WitnessInviteRequest {
  promise_id: string;
  /** 없으면 새 슬롯, 있으면 해당 미결합 슬롯의 링크 재발급이다. */
  participant_id?: string;
}

export interface WitnessInviteResponse {
  promise_id: string;
  participant_id: string;
  invitation_id: string;
  title: string;
  expires_at: IsoDateTime;
  /** 멱등 재생 응답에는 없다. 원문을 서버 저장소에 보관하지 않기 때문이다. */
  token?: string;
}

export interface WitnessJoinRequest extends InviteTokenRequest {}

export interface WitnessJoinResponse {
  promise_id: string;
  participant_id: string;
  status: 'JOINED';
}

export interface WitnessDetailRequest {
  promise_id: string;
}

export interface WitnessDetailActor {
  user_id: string;
  nickname: string;
  profile_image_url: string | null;
}

export interface WitnessDetailContent {
  body: string;
  category: PromiseCategory;
  end_date: IsoDate | null;
  keeper: Keeper;
  reward: string | null;
  penalty: string | null;
}

export interface WitnessFulfillmentClaim {
  role: Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>;
  answer: Answer;
  comment: string | null;
  submitted_at: IsoDateTime;
  evidences: readonly EvidenceView[];
}

export interface WitnessFulfillmentView {
  round_no: number;
  claims: readonly WitnessFulfillmentClaim[];
}

export interface WitnessDetailResponse {
  promise_id: string;
  status: PromiseStatus;
  visibility: 'LIMITED' | 'FULL';
  title: string;
  creator: WitnessDetailActor;
  partner: WitnessDetailActor | null;
  activated_at: IsoDateTime | null;
  signed_at: IsoDateTime | null;
  content: WitnessDetailContent | null;
  fulfillment: WitnessFulfillmentView | null;
}

export interface WitnessSignRequest {
  promise_id: string;
}

export interface WitnessSignResponse {
  promise_id: string;
  signed_at: IsoDateTime;
}

export interface WitnessLeaveRequest {
  promise_id: string;
}

export interface WitnessLeaveResponse {
  promise_id: string;
  status: 'WITHDRAWN';
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
 * - `provider_user_id` — RPC 가 `auth.identities.provider_id` 에서 직접 읽는다. 클라이언트가
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
  end_date: IsoDate | null;
  keeper: Keeper;
  updated_at: IsoDateTime;
  check_deadline_at: IsoDateTime | null;
  check_round_no: number;
  needs_response: boolean;
  waiting_for_partner: boolean;
}

/**
 * 홈 탭 3종 + SCR-A09 히스토리 탭 4종(PO 2026-08-26, ADR 0011).
 * `COMPLETED` 는 구버전 설치 빌드가 계속 부르는 레거시 탭이라 남는다.
 * DISPUTED 를 '불이행'으로 묶지 않는 UNSETTLED 분리는 P1(판정하지 않는다)의 요구다.
 */
export type PromiseHomeTab =
  | 'ACTIVE'
  | 'WAITING'
  | 'COMPLETED'
  | 'DONE'
  | 'BROKEN'
  | 'UNSETTLED'
  | 'DECLINED';

export type PromiseHomeTerminalTab = 'COMPLETED' | 'DONE' | 'BROKEN' | 'UNSETTLED' | 'DECLINED';

export type PromiseHomeCursor =
  | {
      tab: 'ACTIVE';
      status_rank: number;
      end_date: IsoDate | null;
      promise_id: string;
    }
  | {
      tab: 'WAITING';
      updated_at: IsoDateTime;
      promise_id: string;
    }
  | {
      tab: PromiseHomeTerminalTab;
      closed_at: IsoDateTime | null;
      updated_at: IsoDateTime;
      promise_id: string;
    };

export interface PromiseHomePerson {
  nickname: string;
  profile_image_url: string | null;
}

export interface PromiseHomeCard {
  promise_id: string;
  title: string;
  status: PromiseStatus;
  end_date: IsoDate | null;
  updated_at: IsoDateTime;
  closed_at: IsoDateTime | null;
  my_role: ParticipantRole;
  creator: PromiseHomePerson;
  partner: PromiseHomePerson | null;
  has_witness: boolean;
  needs_response: boolean;
}

export interface PromiseHomeListRequest {
  tab: PromiseHomeTab;
  cursor?: PromiseHomeCursor;
}

export interface PromiseHomeListResponse {
  items: readonly PromiseHomeCard[];
  pinned: readonly PromiseHomeCard[];
  /**
   * 요청 탭의 패밀리별 정확 키: 홈 탭 요청은 {ACTIVE, WAITING, COMPLETED},
   * 히스토리 탭 요청은 {DONE, BROKEN, UNSETTLED, DECLINED}. 구버전 파서가 3키
   * 정확 일치를 검사하므로 레거시 응답 형태는 영구히 그대로다.
   */
  counts: Readonly<Partial<Record<PromiseHomeTab, number>>>;
  next_cursor: PromiseHomeCursor | null;
}

export interface PromiseDetailRequest {
  promise_id: string;
}

export type PromiseDetailStatus = Exclude<PromiseStatus, 'DRAFT'>;

export interface PromiseDetailActor {
  user_id: string;
  nickname: string;
  profile_image_url: string | null;
}

export interface PromiseDetailPerson extends PromiseDetailActor {
  role: ParticipantRole;
  status: ParticipantStatus;
  joined_at: IsoDateTime | null;
}

export type PromiseDetailApprovalAction =
  | 'APPROVE'
  | 'DECLINE'
  | 'AMEND_SUGGEST'
  | 'AMEND_REQUEST'
  | 'AMEND_APPROVE'
  | 'AMEND_DECLINE'
  | 'AMEND_WITHDRAW'
  | 'CANCEL_REQUEST'
  | 'CANCEL_APPROVE'
  | 'CANCEL_DECLINE'
  | 'FINISH_REQUEST'
  | 'FINISH_APPROVE'
  | 'FINISH_DECLINE'
  | 'FINISH_WITHDRAW'
  | 'WITNESS_SIGN';

export interface PromiseDetailApproval {
  role: ParticipantRole;
  action: PromiseDetailApprovalAction;
  actor: PromiseDetailActor;
  acted_at: IsoDateTime;
  comment: string | null;
}

export interface PromiseDetailVersion {
  version_no: number;
  title: string;
  body: string;
  category: PromiseCategory;
  end_date: IsoDate | null;
  keeper: Keeper;
  reward: string | null;
  penalty: string | null;
  content_hash: string;
  fingerprint: string;
  activated_at: IsoDateTime | null;
  superseded_at: IsoDateTime | null;
  change_reason: string | null;
}

export interface PromiseDetailInvitation {
  status: 'PENDING' | 'USED' | 'EXPIRED' | 'REVOKED';
  expires_at: IsoDateTime;
  resend_count: number;
}

export interface PromiseDetailAmendRequest {
  request_id: string;
  type: AmendType;
  status: AmendStatus;
  requester: PromiseDetailActor;
  reason: string | null;
  created_at: IsoDateTime;
  expires_at: IsoDateTime;
  proposed_version: PromiseDetailVersion | null;
}

/** F-11 변경 요청의 제안 전문. 확정 전이라 버전 메타데이터를 포함하지 않는다. */
export interface PromiseAmendProposal {
  title: string;
  body: string;
  category: PromiseCategory;
  end_date: IsoDate | null;
  keeper: Keeper;
  reward: string | null;
  penalty: string | null;
}

export interface PromiseAmendCreateRequest {
  promise_id: string;
  type: AmendType;
  proposed?: PromiseAmendProposal;
  reason?: string;
}

export interface PromiseAmendCreateResponse {
  promise_id: string;
  status: 'AMEND_PENDING';
  request_id: string;
  type: AmendType;
  expires_at: IsoDateTime;
}

export type PromiseAmendDecision = 'APPROVE' | 'DECLINE';

export interface PromiseAmendRespondRequest {
  promise_id: string;
  request_id: string;
  decision: PromiseAmendDecision;
}

export interface PromiseAmendRespondResponse {
  promise_id: string;
  status: 'ACTIVE' | 'CANCELED' | 'CHECKING';
  request_id: string;
  request_status: Extract<AmendStatus, 'APPROVED' | 'DECLINED'>;
  version_no: number | null;
}

export interface PromiseAmendWithdrawRequest {
  promise_id: string;
  request_id: string;
}

export interface PromiseAmendWithdrawResponse {
  promise_id: string;
  status: 'ACTIVE';
  request_id: string;
  request_status: 'WITHDRAWN';
}

export interface PromiseVersionHistoryItem {
  version: PromiseDetailVersion;
  change_requester: PromiseDetailActor | null;
  approved_by: PromiseDetailActor | null;
  approved_at: IsoDateTime | null;
  change_reason: string | null;
}

export interface PromiseVersionListRequest {
  promise_id: string;
}

export interface PromiseVersionListResponse {
  promise_id: string;
  versions: readonly PromiseVersionHistoryItem[];
}

export interface PromiseDetailFulfillment {
  round_no: number;
  creator_has_submitted: boolean;
  partner_has_submitted: boolean;
  creator_check: FulfillmentCheckView | null;
  partner_check: FulfillmentCheckView | null;
  history: readonly FulfillmentRoundView[];
}

export interface PromiseDetailResponse {
  promise_id: string;
  status: PromiseDetailStatus;
  title: string;
  body: string;
  category: PromiseCategory;
  end_date: IsoDate | null;
  keeper: Keeper;
  reward: string | null;
  penalty: string | null;
  witness_enabled: boolean;
  activated_at: IsoDateTime | null;
  closed_at: IsoDateTime | null;
  checking_started_at: IsoDateTime | null;
  check_deadline_at: IsoDateTime | null;
  check_round_no: number;
  my_role: ParticipantRole;
  /** 현재 사용자의 반대편 당사자가 앱 푸시를 받을 기기를 등록했는지 여부. */
  counterpart_push_available: boolean;
  creator: PromiseDetailPerson;
  partner: PromiseDetailPerson | null;
  witnesses: readonly PromiseDetailPerson[];
  approvals: readonly PromiseDetailApproval[];
  current_version: PromiseDetailVersion;
  invitation: PromiseDetailInvitation | null;
  amend_request: PromiseDetailAmendRequest | null;
  fulfillment: PromiseDetailFulfillment | null;
}

export interface PromiseFulfillmentDetailRequest {
  promise_id: string;
}

export type EvidenceAvailability = 'AVAILABLE' | 'BLINDED' | 'EXPIRED';

export interface EvidenceView {
  evidence_id: string;
  mime: string;
  bytes: number;
  width: number;
  height: number;
  availability: EvidenceAvailability;
}

export interface EvidenceUploadResponse {
  upload_id: string;
  status: 'READY';
  mime: 'image/jpeg';
  bytes: number;
  width: number;
  height: number;
}

export interface EvidenceDiscardRequest {
  upload_id: string;
}

export interface EvidenceSignUrlRequest {
  evidence_id: string;
  variant: 'THUMBNAIL' | 'FULL';
}

export interface EvidenceSignUrlResponse {
  evidence_id: string;
  variant: 'THUMBNAIL' | 'FULL';
  signed_url: string;
  expires_at: IsoDateTime;
}

/** 한 라운드에서 당사자 한 명이 제출한 주장. */
export interface FulfillmentCheckView {
  role: Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>;
  answer: Answer;
  comment: string | null;
  submitted_at: IsoDateTime;
  revised_at: IsoDateTime | null;
  round_no: number;
  evidences: readonly EvidenceView[];
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
  end_date: IsoDate | null;
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
  /** 현재 호출자의 확정 역할. 역할별 제출 사실을 호출자 관점과 혼동하지 않게 한다. */
  my_role: Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>;
  my_check: FulfillmentCheckView | null;
  /** 현재 라운드 작성자 제출 여부. 답변·의견 공개 여부와 무관한 사실이다. */
  creator_has_submitted: boolean;
  /** 현재 라운드 상대방 제출 여부. 답변·의견 공개 여부와 무관한 사실이다. */
  partner_has_submitted: boolean;
  /** 현재 호출자의 반대편 응답. 호출자가 미제출이면 내용 보호를 위해 null이다. */
  partner_check: FulfillmentCheckView | null;
  history: readonly FulfillmentRoundView[];
}

export interface FulfillmentSubmitRequest {
  promise_id: string;
  answer: Answer;
  comment?: string;
  revise?: boolean;
  evidence_upload_ids?: readonly string[];
  retained_evidence_ids?: readonly string[];
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
  /** NT-09 제목의 `{상대}`에 쓰는 이번 제출자 닉네임. */
  actor_nickname: string;
  /** Task 3가 상태별 수신자를 고르는 데 필요한 최소 식별 정보. */
  notification_recipients: readonly FulfillmentNotificationRecipient[];
}

export interface FulfillmentReopenRequest {
  promise_id: string;
}

export interface FulfillmentReopenResponse {
  promise_id: string;
  status: 'CHECKING';
  round_no: number;
  check_deadline_at: IsoDateTime;
  /** NT-19 알림 본문에 쓰는 현재 약속 제목. 추가 조회 없이 전이 payload만 사용한다. */
  title: string;
  /** NT-19를 받을 반대편 당사자 한 명. 응답 내용은 포함하지 않는다. */
  notification_recipients: readonly FulfillmentNotificationRecipient[];
}

/** SCR-A07 알림함의 한 항목. 내부 전송·중복제거 상태는 절대 노출하지 않는다. */
export interface NotificationInboxItem {
  notification_id: string;
  promise_id: string | null;
  event: NotificationEvent;
  title: string;
  body: string;
  deeplink: NotificationDeeplink | null;
  created_at: IsoDateTime;
  read_at: IsoDateTime | null;
}

/** 동률 시에도 항목을 건너뛰지 않는 최신순 복합 cursor. */
export interface NotificationInboxCursor {
  created_at: IsoDateTime;
  notification_id: string;
}

export interface NotificationInboxListRequest {
  cursor?: NotificationInboxCursor;
  limit?: number;
}

export interface NotificationInboxListResponse {
  items: readonly NotificationInboxItem[];
  unread_count: number;
  next_cursor: NotificationInboxCursor | null;
}

export interface NotificationReadRequest {
  notification_id: string;
}

export interface NotificationReadResponse {
  notification_id: string;
  read_at: IsoDateTime;
}

export interface NotificationReadAllResponse {
  read_count: number;
}

export interface AccountWithdrawResponse {
  status: 'WITHDRAWN';
}

export interface ProfileNicknameUpdateRequest {
  nickname: string;
}

export interface ProfileNicknameUpdateResponse {
  nickname: string;
}

export interface PromiseHideRequest {
  promise_id: string;
  hidden: boolean;
}

export interface PromiseHideResponse extends PromiseHideRequest {}

export interface UserBlockRequest {
  target_user_id: string;
}

export interface UserBlockResponse extends UserBlockRequest {
  blocked: true;
}

export interface UserUnblockRequest {
  target_user_id: string;
}

export interface UserUnblockResponse extends UserUnblockRequest {
  blocked: false;
}

export interface BlockedUserItem {
  target_user_id: string;
  nickname: string;
  profile_image_url: string | null;
  blocked_at: IsoDateTime;
}

export interface UserBlockListResponse {
  items: readonly BlockedUserItem[];
}

export type SafetyReportReason = 'ABUSE' | 'SPAM' | 'IMPERSONATION' | 'WRONG_PARTNER' | 'ETC';

export interface SafetyReportRequest {
  promise_id: string;
  target_user_id: string | null;
  evidence_id: string | null;
  reason: SafetyReportReason;
  detail: string | null;
}

export interface SafetyReportResponse {
  report_id: string;
  status: 'RECEIVED';
  evidence_blinded: boolean;
}

/**
 * 슬롯 현황 (PO 2026-08-24 유료 슬롯).
 * `used` 는 내가 작성자인 '진행 중'(§4-1-4) 약속 수, `capacity` 는 무료 5 + 구매 수다.
 * 수치의 정본은 서버(`lf_slot_status`) — 클라이언트는 절대 스스로 세지 않는다.
 */
export interface SlotStatusResponse {
  capacity: number;
  used: number;
}

export interface PurchaseVerifyRequest {
  product_id: string;
  /** Google Play 구매 토큰. 서버가 Play Developer API 로 직접 검증한다 — 영수증 자체는 신뢰하지 않는다. */
  purchase_token: string;
  /** 약속별 영구보관 상품일 때 필수다. 슬롯 상품에는 싣지 않는다. */
  promise_id?: string;
}

export interface PromiseEntitlementsView {
  promise_id: string;
  my_role: ParticipantRole;
  witness: {
    creator_capacity: number;
    partner_capacity: number;
    creator_used: number;
    partner_used: number;
    max: number;
  };
  duration: {
    ceiling_date: IsoDate | null;
    unlimited: boolean;
  };
  retention: {
    anchor_at: IsoDateTime | null;
    expires_at: IsoDateTime | null;
    permanent: boolean;
    renewable: boolean;
  };
}

export interface RewardIntentCreateRequest {
  promise_id: string;
  action: RewardAction;
}

export interface RewardIntentResponse {
  intent_id: string;
  status: 'PENDING' | 'GRANTED' | 'REJECTED';
  opaque_user_id: string;
  expires_at: IsoDateTime;
}

export interface RewardStatusRequest {
  intent_id: string;
}

export interface RewardStatusResponse {
  intent_id: string;
  status: RewardIntentResponse['status'];
  entitlements: PromiseEntitlementsView | null;
}

/** 상품에 따라 슬롯 현황 또는 약속별 권리를 반환한다. */
export type PurchaseVerifyResponse = SlotStatusResponse | PromiseEntitlementsView;

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
  promisePendingDelete: 'promise-pending-delete',
  inviteResolve: 'invite-resolve',
  invitePreview: 'invite-preview',
  witnessInviteList: 'witness-invite-list',
  witnessInvite: 'witness-invite',
  witnessJoin: 'witness-join',
  witnessDetail: 'witness-detail',
  witnessSign: 'witness-sign',
  witnessLeave: 'witness-leave',
  promiseApprove: 'promise-approve',
  promiseDecline: 'promise-decline',
  promiseAmend: 'promise-amend',
  promiseAmendRequest: 'promise-amend-request',
  promiseAmendRespond: 'promise-amend-respond',
  promiseAmendWithdraw: 'promise-amend-withdraw',
  promiseVersionList: 'promise-version-list',
  userProvision: 'user-provision',
  deviceTokenRegister: 'device-token-register',
  deviceTokenUnregister: 'device-token-unregister',
  trustProfile: 'trust-profile',
  trustProfileSettingsUpdate: 'trust-profile-settings-update',
  promiseHomeList: 'promise-home-list',
  promiseDetail: 'promise-detail',
  participantPromiseList: 'participant-promise-list',
  promiseFulfillmentDetail: 'promise-fulfillment-detail',
  fulfillmentSubmit: 'fulfillment-submit',
  fulfillmentReopen: 'fulfillment-reopen',
  evidenceUpload: 'evidence-upload',
  evidenceDiscard: 'evidence-discard',
  evidenceSignUrl: 'evidence-sign-url',
  notificationInbox: 'notification-inbox',
  notificationRead: 'notification-read',
  notificationReadAll: 'notification-read-all',
  completionCelebrationClaim: 'completion-celebration-claim',
  completionCelebrationShown: 'completion-celebration-shown',
  accountWithdraw: 'account-withdraw',
  profileNicknameUpdate: 'profile-nickname-update',
  promiseHide: 'promise-hide',
  userBlock: 'user-block',
  userUnblock: 'user-unblock',
  userBlockList: 'user-block-list',
  safetyReport: 'safety-report',
  slotStatus: 'slot-status',
  purchaseVerify: 'purchase-verify',
  promiseEntitlements: 'promise-entitlements',
  rewardIntentCreate: 'reward-intent-create',
  rewardStatus: 'reward-status',
} as const;

export type Endpoint = (typeof ENDPOINT)[keyof typeof ENDPOINT];
