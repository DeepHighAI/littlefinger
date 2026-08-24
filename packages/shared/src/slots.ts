/**
 * 유료 약속 슬롯 (PO 2026-08-24) — 응답 파서.
 *
 * 수치의 정본은 서버(`lf_slot_status` · `lf_slot_grant`)다. 클라이언트는 진행 중 약속을
 * 스스로 세지 않는다 — 세는 규칙(작성자 기준 4개 상태)이 서버와 어긋나는 순간 결제 UI 가
 * 거짓말을 하기 때문이다.
 */

import type { SlotStatusResponse } from './api.ts';

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** 서버 응답이 아닌 형태는 전부 `null` — 호출부가 실패로 처리한다. */
export function asSlotStatusResponse(value: unknown): SlotStatusResponse | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== 2 || keys[0] !== 'capacity' || keys[1] !== 'used') return null;
  if (!isCount(record['capacity']) || !isCount(record['used'])) return null;
  return record as unknown as SlotStatusResponse;
}
