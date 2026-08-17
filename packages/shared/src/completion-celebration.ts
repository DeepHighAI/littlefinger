import { isIsoInstant } from './datetime.ts';
import type { IsoDateTime } from './promise.ts';

export interface CompletionCelebrationClaimRequest {
  promise_id: string;
}

export interface CompletionCelebrationView {
  claim_id: string;
  promise_id: string;
  title: string;
  counterpart_nickname: string | null;
  keep_rate_before: number | null;
  keep_rate_after: number | null;
}

export type CompletionCelebrationClaimResponse =
  | { available: true; celebration: CompletionCelebrationView }
  | { available: false; celebration: null };

export interface CompletionCelebrationShownRequest {
  promise_id: string;
  claim_id: string;
}

export interface CompletionCelebrationShownResponse {
  promise_id: string;
  shown_at: IsoDateTime;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
    ? record
    : null;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isKeepRate(value: unknown): value is number | null {
  return (
    value === null ||
    (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 100)
  );
}

function asCompletionCelebrationView(value: unknown): CompletionCelebrationView | null {
  const record = exactRecord(value, [
    'claim_id',
    'promise_id',
    'title',
    'counterpart_nickname',
    'keep_rate_before',
    'keep_rate_after',
  ]);
  if (
    record === null ||
    !isUuid(record['claim_id']) ||
    !isUuid(record['promise_id']) ||
    typeof record['title'] !== 'string' ||
    record['title'].length === 0 ||
    (record['counterpart_nickname'] !== null &&
      typeof record['counterpart_nickname'] !== 'string') ||
    !isKeepRate(record['keep_rate_before']) ||
    !isKeepRate(record['keep_rate_after'])
  ) {
    return null;
  }
  return record as unknown as CompletionCelebrationView;
}

export function asCompletionCelebrationClaimResponse(
  value: unknown,
): CompletionCelebrationClaimResponse | null {
  const record = exactRecord(value, ['available', 'celebration']);
  if (record === null || typeof record['available'] !== 'boolean') return null;
  if (!record['available']) {
    return record['celebration'] === null
      ? (record as unknown as CompletionCelebrationClaimResponse)
      : null;
  }
  return asCompletionCelebrationView(record['celebration']) === null
    ? null
    : (record as unknown as CompletionCelebrationClaimResponse);
}

export function asCompletionCelebrationShownResponse(
  value: unknown,
): CompletionCelebrationShownResponse | null {
  const record = exactRecord(value, ['promise_id', 'shown_at']);
  if (
    record === null ||
    !isUuid(record['promise_id']) ||
    !isIsoInstant(record['shown_at'])
  ) {
    return null;
  }
  return record as unknown as CompletionCelebrationShownResponse;
}

export function completionKeepRateLabel(before: number | null, after: number | null): string {
  if (after === null) return '약속 지킴율 집계 중';
  if (before === null) return `지킴율 집계가 시작됐어요 · ${after}%`;
  if (before === after) return `약속 지킴율 ${after}% 유지`;
  return `약속 지킴율 ${before}% → ${after}%`;
}
