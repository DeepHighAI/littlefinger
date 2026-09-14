import { END_DATE_MAX_DAYS, toKstDate, validateEndDate } from '@littlefinger/shared';

const DAY_MS = 24 * 60 * 60 * 1000;
export const DAYS_PER_WEEK = 7;

export function endDateRange(now: Date): { minimum: string; maximum: string } {
  const minimum = toKstDate(now);
  return { minimum, maximum: new Date(Date.parse(`${minimum}T00:00:00Z`) + END_DATE_MAX_DAYS * DAY_MS).toISOString().slice(0, 10) };
}

export function shiftCalendarMonth(month: string, offset: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function calendarWeeks(month: string): (string | null)[][] {
  const first = new Date(`${month}-01T00:00:00Z`);
  const days = new Date(Date.parse(`${shiftCalendarMonth(month, 1)}-01T00:00:00Z`) - DAY_MS).getUTCDate();
  const cells = Array.from({ length: Math.ceil((first.getUTCDay() + days) / DAYS_PER_WEEK) * DAYS_PER_WEEK }, (_, index) => {
    const day = index - first.getUTCDay() + 1;
    return day > 0 && day <= days ? `${month}-${String(day).padStart(2, '0')}` : null;
  });
  return Array.from({ length: cells.length / DAYS_PER_WEEK }, (_, week) => cells.slice(week * DAYS_PER_WEEK, (week + 1) * DAYS_PER_WEEK));
}

interface EndDateRequest {
  id: number;
  value: string;
  onSelect(value: string): void;
}

let request: EndDateRequest | null = null;
let requestId = 0;
const listeners = new Set<() => void>();
export function subscribeEndDatePicker(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getEndDateRequest(): EndDateRequest | null { return request; }
export function closeEndDatePicker(): void {
  request = null;
  listeners.forEach((listener) => listener());
}
export function openEndDatePicker(value: string | null, onSelect: (isoDate: string) => void): void {
  const now = new Date();
  request = { id: ++requestId, value: value !== null && validateEndDate(value, now).valid ? value : toKstDate(now), onSelect };
  listeners.forEach((listener) => listener());
}
