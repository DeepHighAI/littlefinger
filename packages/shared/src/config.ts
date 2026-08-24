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

/**
 * 무료 약속 슬롯 수 (PO 2026-08-24). 내가 **작성자**인 '진행 중'(§4-1-4:
 * PENDING·ACTIVE·AMEND_PENDING·CHECKING) 약속이 이 수에 도달하면 초대 발송(T-02)이
 * `E_SLOT_LIMIT` 으로 막힌다. 종결되면 슬롯은 되돌아오고, DRAFT 는 별도 한도(20건)를 쓴다.
 * 구매 슬롯은 영구 +1 — 용량 = 이 값 + 구매 수. 강제 지점은 `lf_promise_invite` 뿐이다.
 */
export const FREE_PROMISE_SLOTS = 5;

/**
 * 슬롯 +1 인앱 상품 ID. Google Play Console 의 관리 상품(소모성) ID 와 글자까지 같아야
 * 한다 — 서버 검증(`purchase-verify`)이 이 값 외의 상품을 전부 거부한다.
 */
export const SLOT_PRODUCT_ID = 'promise_slot_plus1';

/**
 * 슬롯 가격 표시 기본값(₩, PO 2026-08-24). 화면 표시는 스토어 현지화 가격이 정본이고,
 * 이 값은 스토어 조회가 실패한 화면의 대체 표기 전용이다. 실제 청구액은 Play Console 설정이 결정한다.
 */
export const SLOT_PRICE_KRW_DEFAULT = 1000;

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
 * NT-04 "초대가 곧 만료돼요" 를 만료 몇 시간 전에 보낼지 (§8-2).
 *
 * §11-3 설정값 표에는 없고 §8-2 본문에만 "expires_at - 12시간"으로 적혀 있다. 정책 수치를
 * 코드에 박지 않는 규칙은 표에 실린 값에만 적용되는 것이 아니므로 여기로 끌어올렸다.
 */
export const INVITE_EXPIRE_SOON_LEAD_HOURS = 12;

/**
 * 조용한 시간 (KST). 이 구간의 **예약 알림**은 다음 08:00 으로 이연한다.
 * 즉시성 알림은 예외다(§8-3).
 */
export const QUIET_HOURS_KST = { startHour: 21, endHour: 8 } as const;

export const ACCESS_TOKEN_TTL_MIN = 30;
export const REFRESH_TOKEN_TTL_DAYS = 30;

/** 카카오 OAuth 세션 교환 실패 재시도 간격(EC-A02). 최초 호출 뒤 세 번 재시도한다. */
export const AUTH_SESSION_RETRY_DELAYS_MS: readonly number[] = [1000, 2000, 4000];

/** 약속 지킴율을 %로 보여주기 위한 최소 표본. 미만이면 "집계 중"으로 표시한다(S-2). */
export const TRUST_MIN_SAMPLE = 3;

export const EVIDENCE_MAX_COUNT = 3;
export const EVIDENCE_MAX_MB = 5;
export const EVIDENCE_FULL_MAX_PX = 1920;
export const EVIDENCE_THUMB_MAX_PX = 320;
export const EVIDENCE_JPEG_QUALITY = 85;

export const DRAFT_MAX_CONCURRENT = 20;
export const PROMISE_MAX_PER_DAY = 30;

/** SCR-A02 탭별 목록 한 페이지 크기(F-10). */
export const PROMISE_HOME_PAGE_SIZE = 20;

export const INVITE_RESEND_MAX = 10;
export const DEVICE_TOKEN_MAX = 3;

/** 종료일 상한 (오늘 + n일, KST) (S-7) */
export const END_DATE_MAX_DAYS = 365;

/** 증빙 사진 보존 기간(일). 종결 후 기준. */
export const EVIDENCE_RETENTION_DAYS = 365;

/** 미수정 DRAFT 자동 삭제 기한(일) (J-06) */
export const DRAFT_TTL_DAYS = 90;

/** 인앱 알림 보존 기간(일). 지난 알림은 매일 정리한다(§4-6-3). */
export const NOTIFICATION_RETENTION_DAYS = 90;

/** 재협의 라운드 상한. `null` = 무제한 (S-10 기본안). 대안은 3회 제한. */
export const AMEND_MAX_ROUNDS: number | null = null;

// ── §11-3 표에 이름이 없지만 코드에 박으면 안 되는 값 ──────

/** 증빙 사진 서명 URL 유효 시간(분). 비공개 버킷을 유지하기 위한 값(02 §13 · 04 §12-8). */
export const EVIDENCE_SIGNED_URL_MIN = 10;

/** 목록에서 "임박"으로 올리는 기준 (02 §6-4: 0 ≤ D ≤ 3 이고 상태 ACTIVE) */
export const IMMINENT_THRESHOLD_DAYS = 3;

/** 이행 확인 한 줄 의견의 코드포인트 상한 (02 §5-2). */
export const FULFILLMENT_COMMENT_MAX = 200;

/**
 * `invite-resolve` 요청 빈도 제한 (PO 결정 2026-07-27).
 *
 * §11-3 에 없는 값이다 — §10 의 `E_RATE_LIMIT` 용례는 전부 자원 개수 제한이고 요청 빈도
 * 제한은 명세가 다루지 않는다. 이 함수만 `verify_jwt = false` 라 열쇠 없이 호출되기 때문에
 * 필요하다.
 *
 * **버킷은 IP 해시이고 값이 넉넉한 데는 이유가 있다.** 한국 이동통신 3사는 CGNAT 를 널리
 * 써서 수백~수천 명이 공인 IP 하나를 공유하고, 그게 하필 카카오톡 인앱 브라우저 경로 —
 * SCR-W01 이 실제로 열리는 그 경로다. 빡빡하게 잡으면 아무 잘못 없는 상대방이 차단된다.
 *
 * 정본은 SQL 쪽 `lf_rate_limit_window_seconds()` · `lf_rate_limit_max_hits()` 다.
 * SQL 은 이 파일을 import 할 수 없으므로 `supabase/tests/rate-limit.test.ts` 가 대조한다.
 */
export const INVITE_RESOLVE_RATE_LIMIT = { windowSeconds: 600, maxHits: 60 } as const;

/**
 * `Idempotency-Key` 응답 캐시 유효 시간(분) (02 §7-3.6).
 *
 * 정본은 SQL 쪽 `lf_idempotency_ttl_minutes()` 다 — 캐시 판정이 거기서 일어나기 때문이다.
 * SQL 은 이 파일을 import 할 수 없으므로 `supabase/tests/idempotency.test.ts` 가 두 값을 대조한다.
 */
export const IDEMPOTENCY_TTL_MIN = 10;
