/**
 * 정책 설정값 — 02_세부기능명세서 §11-3.
 *
 * 정책 수치는 화면·로직에 절대 직접 쓰지 않고 전부 여기를 거친다.
 * "기본안" 표시된 값은 PO 미확정이라 언제든 바뀔 수 있고, 원격 변경이 필요한 값은
 * Supabase `app_configs` 테이블이 이 파일보다 우선한다.
 */

// ── PO 확정값 — 바꾸지 않는다 ──────────────────────────────

/** 초대 링크 유효 시간. 1회용이며 만료 후에는 재발송만 가능하다. */
export const INVITE_TTL_HOURS = 72;

/** 증인 최대 인원 */
export const WITNESS_MAX = 2;

/** 광고 활성화를 검토하는 일 확정 건수. 도달 시 운영자에게 알린다(F-12). */
export const ADS_ACTIVATION_DAILY_CONFIRMS = 100;

/**
 * 광고 기본 상태. 원격 플래그 `app_configs.ads_enabled` 가 정본이고 이 값은 그 기본값이다.
 * false 일 때 광고 컴포넌트는 **렌더 자체를 하지 않는다** — 빈 자리도 만들지 않는다(04 §12-1).
 */
export const ADS_ENABLED_DEFAULT = false;

// ── 기본안 — PO 미확정, 변경 가능 ─────────────────────────

/** 이행 확인 응답 기한(일). 경과 시 UNRESOLVED 로 종결된다(J-03). */
export const CHECK_DEADLINE_DAYS = 7;

/** 변경·파기 요청이 자동 철회되는 기한(일) (J-05) */
export const AMEND_AUTO_WITHDRAW_DAYS = 7;

/** 리마인드 발송 시점 (종료일 기준 D-n). D-Day 는 0. */
export const REMINDER_OFFSETS_DAYS: readonly number[] = [7, 3, 1, 0];

/** 예약 알림 발송 시각 (KST) */
export const REMINDER_SEND_HOUR_KST = 9;

/**
 * 조용한 시간 (KST). 이 구간의 **예약 알림**은 다음 08:00 으로 이연한다.
 * 즉시성 알림은 예외다(§8-3).
 */
export const QUIET_HOURS_KST = { startHour: 21, endHour: 8 } as const;

export const ACCESS_TOKEN_TTL_MIN = 30;
export const REFRESH_TOKEN_TTL_DAYS = 30;

/** 약속 지킴율을 %로 보여주기 위한 최소 표본. 미만이면 "집계 중"으로 표시한다(S-2). */
export const TRUST_MIN_SAMPLE = 3;

export const EVIDENCE_MAX_COUNT = 3;
export const EVIDENCE_MAX_MB = 10;

export const DRAFT_MAX_CONCURRENT = 20;
export const PROMISE_MAX_PER_DAY = 30;

export const INVITE_RESEND_MAX = 10;
export const DEVICE_TOKEN_MAX = 3;

/** 종료일 상한 (오늘 + n일, KST) (S-7) */
export const END_DATE_MAX_DAYS = 365;

/** 증빙 사진 보존 기간(일). 종결 후 기준. */
export const EVIDENCE_RETENTION_DAYS = 365;

/** 미수정 DRAFT 자동 삭제 기한(일) (J-06) */
export const DRAFT_TTL_DAYS = 90;

/** 재협의 라운드 상한. `null` = 무제한 (S-10 기본안). 대안은 3회 제한. */
export const AMEND_MAX_ROUNDS: number | null = null;

// ── §11-3 표에 이름이 없지만 코드에 박으면 안 되는 값 ──────

/** 증빙 사진 서명 URL 유효 시간(분). 비공개 버킷을 유지하기 위한 값(02 §13 · 04 §12-8). */
export const EVIDENCE_SIGNED_URL_MIN = 10;

/** 목록에서 "임박"으로 올리는 기준 (02 §6-4: 0 ≤ D ≤ 3 이고 상태 ACTIVE) */
export const IMMINENT_THRESHOLD_DAYS = 3;
