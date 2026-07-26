/**
 * 시각·날짜 계산 — 02_세부기능명세서 §2-2, §6-4.
 *
 * 저장은 UTC(`timestamptz`), 계산·표시는 **Asia/Seoul 고정**이다.
 * 기기 타임존을 절대 읽지 않는다(EC-F09) — 그래서 `getHours()` 같은 로컬 시각 API 대신
 * UTC 시각을 9시간 밀어 `getUTC*` 로 KST 성분을 읽는다.
 *
 * 날짜 경계 판단의 최종 권한은 서버(Edge Function·배치)에 있다.
 * 여기 계산은 화면 표시와 클라이언트 CTA 게이팅용이다.
 */

import { CHECK_DEADLINE_DAYS, IMMINENT_THRESHOLD_DAYS } from './config.js';
import type { IsoDate, PromiseStatus } from './promise.js';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const QUIET_START_HOUR = 21;
const QUIET_END_HOUR = 8;

/** UTC 시각을 KST 로 민 뒤 `getUTC*` 로 읽으면 기기 타임존과 무관하게 KST 성분이 나온다. */
function shiftToKst(instant: Date): Date {
  return new Date(instant.getTime() + KST_OFFSET_MS);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** `YYYY-MM-DD` 를 그 날 00:00 UTC 로 읽는다. 날짜 차이 계산용이라 시각 개념이 없다. */
function parseIsoDateAsUtcMidnight(date: IsoDate): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

/** UTC 시각이 KST 로 몇 월 며칠인지 */
export function toKstDate(instant: Date): IsoDate {
  const kst = shiftToKst(instant);
  return `${kst.getUTCFullYear()}-${pad2(kst.getUTCMonth() + 1)}-${pad2(kst.getUTCDate())}`;
}

/** D-Day. `end_date - today(KST)` (§6-4) */
export function ddayFrom(endDate: IsoDate, now: Date): number {
  const today = parseIsoDateAsUtcMidnight(toKstDate(now));
  return Math.round((parseIsoDateAsUtcMidnight(endDate) - today) / DAY_MS);
}

/** 표시 형식. 당일 `D-Day`, 남았으면 `D-n`, 지났으면 `D+n` (§6-4) */
export function formatDday(dday: number): string {
  if (dday === 0) return 'D-Day';
  return dday > 0 ? `D-${dday}` : `D+${-dday}`;
}

/** 목록 상단 고정 기준. `0 ≤ D ≤ 3` 이고 상태가 ACTIVE 일 때만이다(§6-4). */
export function isImminent(status: PromiseStatus, dday: number): boolean {
  return status === 'ACTIVE' && dday >= 0 && dday <= IMMINENT_THRESHOLD_DAYS;
}

/**
 * 이행 확인이 시작되는 시각 = **종료일 익일 00:00 KST**.
 * 종료일 하루를 온전히 보장하기 위해서다(EC-F08).
 */
export function checkingStartsAt(endDate: IsoDate): Date {
  const nextDayKstMidnight = parseIsoDateAsUtcMidnight(endDate) + DAY_MS;
  return new Date(nextDayKstMidnight - KST_OFFSET_MS);
}

/** 이행 확인 응답 기한. 경과하면 UNRESOLVED 로 종결된다(J-03). */
export function checkDeadlineAt(checkingStartedAt: Date): Date {
  return new Date(checkingStartedAt.getTime() + CHECK_DEADLINE_DAYS * DAY_MS);
}

/**
 * 조용한 시간(KST 21:00–08:00) 여부.
 * 해당하면 **예약 알림**을 다음 08:00 으로 이연한다. 즉시성 알림은 예외다(§8-3).
 */
export function isQuietHours(instant: Date): boolean {
  const hour = shiftToKst(instant).getUTCHours();
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}
