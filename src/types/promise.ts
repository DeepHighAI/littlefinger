/**
 * 리틀핑거 — 약속 도메인 계약 (contracts-first).
 *
 * 상태명·역할명은 상위기획서 §6 / 디자인요청서 §6의 영문 상수를 그대로 쓴다.
 * 화면에 보이는 한국어 라벨은 여기서 정의하지 않고 `PROMISE_STATUS_LABEL`에 모은다.
 *
 * 용어 주의: 도메인 용어는 "Promise(약속)"이지만 `Promise`는 JS 전역 타입이라
 * 인터페이스명으로 쓸 수 없다. 엔티티 타입만 `PromiseRecord`로 부르고,
 * 그 외(필드·함수·문서)에서는 promise 를 그대로 쓴다.
 */

/** 약속 생애주기 상태 (요청서 §6 상태 다이어그램) */
export type PromiseStatus =
  | 'DRAFT'          // 작성 중 — 작성자만 열람·수정·삭제
  | 'PENDING'        // 승인 대기 — 초대 링크 1회용 + 72시간 만료
  | 'ACTIVE'         // 진행 중 — 양측 승인 완료, 내용 불변
  | 'AMEND_PENDING'  // 변경 협의 중 — 상대 동의 시에만 성립
  | 'CHECKING'       // 이행 확인 중 — 양측 응답 대기 (기한 7일)
  | 'COMPLETED'      // 완료 — 약속 지킴율에 반영
  | 'BROKEN'         // 불이행 — 기록된 벌칙 표시, 지킴율에 반영
  | 'DISPUTED'       // 의견 불일치 — 판정 없이 양측 주장만 기록
  | 'UNRESOLVED'     // 미확정 종결 — 지킴율 제외, 별도 건수 표기
  | 'DECLINED'       // 거절됨 — 지킴율 제외
  | 'CANCELED';      // 파기됨 — 지킴율 제외

/** 상태별 화면 표시 라벨 (요청서 §9 용어 사전. 새 용어 발명 금지) */
export const PROMISE_STATUS_LABEL: Record<PromiseStatus, string> = {
  DRAFT: '작성 중',
  PENDING: '승인 대기',
  ACTIVE: '진행 중',
  AMEND_PENDING: '변경 협의 중',
  CHECKING: '이행 확인 중',
  COMPLETED: '완료',
  BROKEN: '불이행',
  DISPUTED: '의견 불일치',
  UNRESOLVED: '미확정 종결',
  DECLINED: '거절됨',
  CANCELED: '파기됨',
};

/** 약속 지킴율(이행률) 계산에 포함되는 종결 상태 */
export const RATE_COUNTED_STATUSES: readonly PromiseStatus[] = ['COMPLETED', 'BROKEN'];

/** 종결됐지만 지킴율에서 제외되는 상태 — 프로필에 별도 건수로 표기 */
export const RATE_EXCLUDED_STATUSES: readonly PromiseStatus[] = [
  'DISPUTED',
  'UNRESOLVED',
  'DECLINED',
  'CANCELED',
];

/** 약속 카테고리 */
export type PromiseCategory = 'HABIT' | 'BET' | 'MONEY' | 'ETC';

export const PROMISE_CATEGORY_LABEL: Record<PromiseCategory, string> = {
  HABIT: '습관',
  BET: '내기',
  MONEY: '금전',
  ETC: '기타',
};

/** 참여자 역할. 증인은 열람·확인 서명만 가능하며 판정 권한이 없다. */
export type ParticipantRole = 'CREATOR' | 'PARTNER' | 'WITNESS';

export const PARTICIPANT_ROLE_LABEL: Record<ParticipantRole, string> = {
  CREATOR: '작성자',
  PARTNER: '상대방',
  WITNESS: '증인',
};

/** 지킬 사람 — 이행 주체. 역할과는 별개 속성이다. */
export type Obligor = 'CREATOR' | 'PARTNER' | 'BOTH';

export const OBLIGOR_LABEL: Record<Obligor, string> = {
  CREATOR: '작성자',
  PARTNER: '상대방',
  BOTH: '둘 다',
};

/** 프로덕트 표면 — 같은 약속도 표면에 따라 가능한 행동이 다르다. */
export type Surface = 'APP' | 'WEB';

/** ISO 8601 문자열 (예: 2026-08-11T21:04:00+09:00) */
export type IsoDateTime = string;

/** ISO 8601 날짜 (예: 2026-08-11) */
export type IsoDate = string;

export interface User {
  id: string;
  /** 카카오 계정 기준 표시 이름 */
  name: string;
  /** 리마인드 이메일 (수락 웹 참여자가 선택 등록) */
  email: string | null;
}

export interface Participant {
  user: User;
  role: ParticipantRole;
  /** 승인·서명 시각. 미승인이면 null */
  approvedAt: IsoDateTime | null;
}

/** 보상 / 벌칙 — 프리셋 선택 또는 자유 입력 (요청서 §9: Penalty는 "벌칙") */
export interface PromiseStake {
  reward: string | null;
  penalty: string | null;
}

/**
 * 확정 기록 — ACTIVE 전환 시 고정된다.
 * `fingerprint`는 확정 내용 해시의 사람이 읽는 표현으로,
 * 모든 확정 영역(SCR-A05/ACTIVE, SCR-W03)에 노출한다.
 */
export interface PromiseConfirmation {
  confirmedAt: IsoDateTime;
  /** 표시 형식 예: A3F9-77C2-01 */
  fingerprint: string;
  contentHash: string;
}

/** 이행 확인 응답. 양측 응답을 비교해 종결 상태가 결정된다. */
export interface FulfillmentResponse {
  userId: string;
  kept: boolean;
  respondedAt: IsoDateTime;
  /** 이행 증빙 사진. 상대·증인에게 공개된다. */
  proofImageUrl: string | null;
}

/** 변경·파기 합의 요청 (F-11) */
export interface AmendRequest {
  id: string;
  requestedBy: string;
  /** 파기 요청이면 true */
  isCancelRequest: boolean;
  /** 변경 내용 또는 파기 사유(선택) */
  message: string | null;
  requestedAt: IsoDateTime;
}

/** 버전 이력 — 원본은 항상 보존한다. */
export interface PromiseVersion {
  version: number;
  title: string;
  content: string;
  dueDate: IsoDate;
  stake: PromiseStake;
  createdAt: IsoDateTime;
}

/** 약속 엔티티 */
export interface PromiseRecord {
  id: string;
  status: PromiseStatus;
  title: string;
  content: string;
  category: PromiseCategory;
  /** 종료일 — 필수. 도래 시 CHECKING으로 전환된다. */
  dueDate: IsoDate;
  obligor: Obligor;
  stake: PromiseStake;
  /** 증인 사용 여부. 사용 시 최대 2명. */
  witnessEnabled: boolean;
  participants: Participant[];
  /** ACTIVE 이후에만 존재 */
  confirmation: PromiseConfirmation | null;
  fulfillmentResponses: FulfillmentResponse[];
  amendRequest: AmendRequest | null;
  versions: PromiseVersion[];
  createdAt: IsoDateTime;
}

/** 증인 최대 인원 */
export const MAX_WITNESS_COUNT = 2;

/** 초대 링크 유효 시간 (시간 단위). 1회용이며 만료 후 재발송만 가능하다. */
export const INVITE_EXPIRY_HOURS = 72;

/** 이행 확인 응답 기한 (일 단위). 경과 시 UNRESOLVED로 종결된다. */
export const FULFILLMENT_RESPONSE_DEADLINE_DAYS = 7;

/** 리마인드 발송 시점 (종료일 기준 D-n). D-Day는 0. */
export const REMINDER_OFFSET_DAYS: readonly number[] = [7, 3, 1, 0];

/** 목록에서 "임박"으로 상단 고정하는 기준 (D-3 이내) */
export const IMMINENT_THRESHOLD_DAYS = 3;

/** 1회용 초대 링크 */
export interface InviteLink {
  token: string;
  promiseId: string;
  /** 증인 초대와 상대방 초대를 구분한다. */
  invitedRole: Extract<ParticipantRole, 'PARTNER' | 'WITNESS'>;
  expiresAt: IsoDateTime;
  usedAt: IsoDateTime | null;
}

/** 링크가 더 이상 유효하지 않은 사유 (SCR-W06) */
export type InviteLinkInvalidReason = 'EXPIRED' | 'ALREADY_USED';

/** 알림 유형 (F-06) */
export type NotificationType =
  | 'APPROVAL_REQUEST'
  | 'CONFIRMED'
  | 'REMINDER'
  | 'FULFILLMENT_CHECK'
  | 'AMEND_REQUEST';

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  APPROVAL_REQUEST: '승인 요청',
  CONFIRMED: '확정',
  REMINDER: '리마인드',
  FULFILLMENT_CHECK: '이행 확인',
  AMEND_REQUEST: '변경 요청',
};

export interface AppNotification {
  id: string;
  type: NotificationType;
  promiseId: string;
  message: string;
  createdAt: IsoDateTime;
  readAt: IsoDateTime | null;
}

/**
 * 신뢰 프로필 (F-09).
 * 표시명은 "약속 지킴율" (오픈 포인트 O-D3).
 * 분쟁·무응답은 비율에서 빼고 건수만 따로 보여준다.
 */
export interface TrustProfile {
  userId: string;
  /** 0-100. completedCount / (completedCount + brokenCount) */
  keepRate: number;
  completedCount: number;
  brokenCount: number;
  disputedCount: number;
  unresolvedCount: number;
}

/**
 * 확정 영역에 반드시 노출하는 고지 문구.
 * 상위기획서 §10 확정 문구 — 변경 금지.
 */
export const LEGAL_DISCLAIMER =
  '리틀핑거의 약속 기록은 공증이나 전자계약 서비스가 아니며, 법적 효력을 보증하지 않습니다. ' +
  '다만 양측의 승인 이력과 시각 정보는 분쟁 시 참고 자료로 활용될 수 있습니다.';
