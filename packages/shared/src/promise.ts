/**
 * 리틀핑거 — 약속 도메인 계약 (contracts-first).
 *
 * 상태·역할·열거값의 **영문 문자열은 코드와 DB 가 동일**하다(02 §6-3).
 * 화면에 보이는 한국어는 여기 라벨 상수를 거친다 — 화면에 하드코딩하지 않는다.
 *
 * 정책 수치는 이 파일에 두지 않는다. 전부 `config.ts`(02 §11-3)에 있다.
 *
 * 용어 주의: 도메인 용어는 "Promise(약속)"이지만 `Promise` 는 JS 전역 타입이라
 * 인터페이스명으로 쓸 수 없다. 엔티티 타입만 `PromiseRecord` 로 부르고,
 * 그 외(필드·함수·문서)에서는 promise 를 그대로 쓴다.
 */

// ── 상태 (02 §2-4 — 변경 금지) ─────────────────────────────

export const PROMISE_STATUSES = [
  'DRAFT', // 작성 중 — 작성자만 열람·수정·삭제
  'PENDING', // 승인 대기 — 초대 링크 1회용, INVITE_TTL_HOURS 만료
  'ACTIVE', // 진행 중 — 양측 승인 완료, 내용 불변
  'AMEND_PENDING', // 변경 협의 중 — 상대 동의 시에만 성립
  'CHECKING', // 이행 확인 중 — 양측 응답 대기
  'COMPLETED', // 완료 — 약속 지킴율에 반영
  'BROKEN', // 불이행 — 기록된 벌칙 표시, 지킴율에 반영
  'DISPUTED', // 의견 불일치 — 판정 없이 양측 주장만 기록. 재협의로 CHECKING 재진입(T-16)
  'UNRESOLVED', // 미확정 종결 — 지킴율 제외, 별도 건수 표기
  'DECLINED', // 거절됨 — 지킴율 제외
  'CANCELED', // 파기됨 — 지킴율 제외
] as const;

export type PromiseStatus = (typeof PROMISE_STATUSES)[number];

/** 상태별 화면 표시 라벨 (디자인요청서 §9 용어 사전. 새 용어 발명 금지) */
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

/**
 * 종결 상태. 도달하면 리마인드가 멈춘다.
 * `DISPUTED` 만 준종결이라 재협의로 `CHECKING` 에 재진입할 수 있다(S-13, T-16).
 */
export const TERMINAL_STATUSES: readonly PromiseStatus[] = [
  'COMPLETED',
  'BROKEN',
  'DISPUTED',
  'UNRESOLVED',
  'DECLINED',
  'CANCELED',
];

/** 약속 지킴율 계산에 반영되는 종결 상태 */
export const RATE_COUNTED_STATUSES: readonly PromiseStatus[] = ['COMPLETED', 'BROKEN'];

/** 종결됐지만 지킴율에서 제외되는 상태 — 프로필에 별도 건수로 표기 */
export const RATE_EXCLUDED_STATUSES: readonly PromiseStatus[] = [
  'DISPUTED',
  'UNRESOLVED',
  'DECLINED',
  'CANCELED',
];

// ── 열거값 (02 §6-3 — 코드와 DB 동일 문자열) ────────────────

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

export type ParticipantStatus = 'INVITED' | 'JOINED' | 'DECLINED' | 'WITHDRAWN';

/**
 * 지킬 사람 — 이행 주체. 역할과는 **별개 속성**이다(02 §2-1).
 * 이행 확인 질문은 양측 모두에게 가고, 평가 대상은 지킬 사람의 이행 여부다.
 */
export type Keeper = 'CREATOR' | 'PARTNER' | 'BOTH';

/**
 * 지킬 사람 라벨. 보는 사람에 따라 바뀌지 않는다 —
 * 수락 웹의 상대방도 같은 문구를 읽어야 하므로 "나 / 상대"로 렌더하지 않는다(§5-1).
 */
export const KEEPER_LABEL: Record<Keeper, string> = {
  CREATOR: '작성자',
  PARTNER: '상대방',
  BOTH: '둘 다',
};

/** 이행 확인 응답 (02 §6-3 Answer) */
export type Answer = 'KEPT' | 'NOT_KEPT';

/** 프로덕트 표면 — 같은 약속도 표면에 따라 가능한 행동이 다르다. */
export type Surface = 'APP' | 'WEB';

export type InvitationStatus = 'PENDING' | 'USED' | 'EXPIRED' | 'REVOKED';

export type AmendType = 'AMEND' | 'CANCEL';

export type AmendStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'WITHDRAWN' | 'EXPIRED';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWN';

// ── 기본 타입 ─────────────────────────────────────────────

/** ISO 8601 문자열 (예: 2026-08-11T21:04:00+09:00) */
export type IsoDateTime = string;

/** ISO 8601 날짜 (예: 2026-08-11). 시각 개념이 없다. */
export type IsoDate = string;

// ── 엔티티 ────────────────────────────────────────────────

export interface User {
  id: string;
  /** 카카오 계정 기준 표시 이름 */
  name: string;
}

export interface Participant {
  user: User;
  role: ParticipantRole;
  /** 승인·서명 시각. 미승인이면 null */
  approvedAt: IsoDateTime | null;
}

/** 보상 / 벌칙 — 프리셋 선택 또는 자유 입력 (§9 용어: Penalty 는 "벌칙") */
export interface PromiseStake {
  reward: string | null;
  penalty: string | null;
}

/**
 * 확정 기록 — ACTIVE 전환 시 고정된다.
 * `fingerprint` 는 확정 내용 해시의 사람이 읽는 표현으로,
 * 모든 확정 영역(SCR-A05/ACTIVE, SCR-W03)에 노출한다.
 *
 * `contentHash` 는 Edge Function 안에서만 만들어진다 — 클라이언트가 위조할 수 없게(04 §7-3).
 */
export interface PromiseConfirmation {
  confirmedAt: IsoDateTime;
  /** 표시 형식 예: A3F9-77C2-01 */
  fingerprint: string;
  contentHash: string;
}

/** 이행 확인 응답. 양측 응답을 비교해 종결 상태가 결정된다(F-07). */
export interface FulfillmentResponse {
  userId: string;
  role: Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>;
  answer: Answer;
  comment: string | null;
  submittedAt: IsoDateTime;
  revisedAt: IsoDateTime | null;
  roundNo: number;
}

/** 변경·파기 합의 요청 (F-11) */
export interface AmendRequest {
  id: string;
  requestedBy: string;
  type: AmendType;
  /** 변경·파기 이유(선택) */
  reason: string | null;
  requestedAt: IsoDateTime;
}

/** 버전 이력 — 원본은 항상 보존한다. append-only. */
export interface PromiseVersion {
  versionNo: number;
  title: string;
  body: string;
  endDate: IsoDate;
  stake: PromiseStake;
  createdAt: IsoDateTime;
}

/** 약속 엔티티 */
export interface PromiseRecord {
  id: string;
  status: PromiseStatus;
  title: string;
  body: string;
  category: PromiseCategory;
  /** 종료일 — 필수. 익일 00:00 KST 에 CHECKING 으로 전환된다(T-11). */
  endDate: IsoDate;
  keeper: Keeper;
  stake: PromiseStake;
  /** 증인 사용 여부. 사용 시 최대 WITNESS_MAX 명. */
  witnessEnabled: boolean;
  participants: readonly Participant[];
  /** ACTIVE 이후에만 존재 */
  confirmation: PromiseConfirmation | null;
  fulfillmentResponses: readonly FulfillmentResponse[];
  amendRequest: AmendRequest | null;
  versions: readonly PromiseVersion[];
  createdAt: IsoDateTime;
}

/** 1회용 초대 링크. 토큰 원문은 저장하지 않고 해시만 남긴다(04 §12-8). */
export interface InviteLink {
  promiseId: string;
  /** 증인 초대와 상대방 초대를 구분한다. */
  targetRole: Extract<ParticipantRole, 'PARTNER' | 'WITNESS'>;
  status: InvitationStatus;
  expiresAt: IsoDateTime;
  usedAt: IsoDateTime | null;
}

/** 링크가 더 이상 유효하지 않은 사유 (SCR-W06) */
export type InviteLinkInvalidReason = 'EXPIRED' | 'ALREADY_USED' | 'REVOKED';

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
 * 표시명은 "약속 지킴율"이다(O-D3).
 * 분쟁·무응답은 비율에서 빼고 건수만 따로 보여준다.
 */
export interface TrustProfile {
  userId: string;
  /** 0~100. 표본이 TRUST_MIN_SAMPLE 미만이면 null — 화면에는 "집계 중". */
  keepRate: number | null;
  completedCount: number;
  brokenCount: number;
  disputedCount: number;
  unresolvedCount: number;
  activeCount: number;
}

/**
 * 확정 영역에 반드시 노출하는 고지 문구.
 * 상위기획서 §10 확정 문구 — **변경 금지**.
 *
 * 노출 위치 4곳: SCR-W02 · SCR-A05/ACTIVE 확정 영역 · SCR-W03 · SCR-A08 약관 영역.
 * 렌더하는 컴포넌트는 이 상수만 쓰고 문구를 props 로 받지 않는다(04 §12-2).
 */
export const LEGAL_DISCLAIMER =
  '리틀핑거의 약속 기록은 공증이나 전자계약 서비스가 아니며, 법적 효력을 보증하지 않습니다. ' +
  '다만 양측의 승인 이력과 시각 정보는 분쟁 시 참고 자료로 활용될 수 있습니다.';
