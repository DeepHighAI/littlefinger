// 요청에서 RPC 인자를 뽑아내는 순수 함수들 — Deno 전역도 네트워크도 쓰지 않는다.
//
// 여기 있는 것이 전부 순수해야 테스트가 존재할 수 있다. Deno 전역을 모듈 최상단에서 건드리면
// vitest 가 파일을 import 하는 순간 `ReferenceError: Deno is not defined` 로 죽는다.

import type { ApiValidationField } from '../../../packages/shared/src/api.ts';
import { ApiError } from './errors.ts';

/** 02 §2-1 의 표면. `approvals.surface` 가 NOT NULL 이라 반드시 정해야 한다. */
export type Surface = 'APP' | 'WEB';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 표면 판정 — `Origin` 헤더의 **유무**로 가른다.
 *
 * 브라우저는 교차 출처 POST 에 `Origin` 을 항상 붙이고, RN 의 fetch 는 붙이지 않는다.
 * 수락 웹은 `*.pages.dev` 에서 `*.supabase.co` 를 부르므로 언제나 교차 출처다.
 *
 * 클라이언트가 body 로 선언하게 두지 않는 이유: `approvals` 는 정정할 수 없는 append-only
 * 감사 기록이다(정책 자체가 없다). 고칠 수 없는 자리에 클라이언트 자기 신고를 적지 않는다.
 * `users.primary_surface` 도 답이 아니다 — 그건 **최초 가입** 표면이라 KPI 필드다(§6-2).
 */
export function surfaceOf(request: Request): Surface {
  return request.headers.get('origin') === null ? 'APP' : 'WEB';
}

/**
 * 클라이언트 IP. 없으면 `null` 이고, 그대로 NULL 로 저장한다.
 *
 * `approvals.ip_hash` 는 nullable 이고 RPC 자신도 작성자 행에는 NULL 을 쓴다. 프록시 뒤라
 * 헤더가 비는 경우(카카오톡 인앱 브라우저에서 실제로 일어난다)에 자리 표시자를 해싱해
 * 넣으면, 서로 다른 사람이 같은 해시를 갖게 되어 기록이 거짓말을 한다.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded === null) return null;
  const first = forwarded.split(',')[0]?.trim();
  return first !== undefined && first.length > 0 ? first : null;
}

export function userAgent(request: Request): string | null {
  const value = request.headers.get('user-agent');
  return value !== null && value.length > 0 ? value : null;
}

/**
 * `Idempotency-Key` — §7-3.6 이 모든 상태 변경 요청에 요구하는 UUID.
 *
 * 없거나 UUID 가 아니면 거절한다. 임의 문자열을 받아 주면 클라이언트가 상수를 보내는 순간
 * 그 사용자의 모든 요청이 첫 응답에 영구히 고정된다 — `lf_idempotency_begin` 은 키가
 * 같으면 캐시를 돌려주는 것이 일이기 때문에 DB 쪽에서는 막을 방법이 없다.
 */
export function idempotencyKeyOf(request: Request): string {
  const key = request.headers.get('idempotency-key');
  if (key === null || !UUID_PATTERN.test(key)) {
    throw new ApiError('E_VALIDATION', { field: 'idempotency_key' });
  }
  return key;
}

/** 본문 JSON. 형태가 아니면 `E_VALIDATION` 이다 — 우리 클라이언트가 보낸 요청이 아니다. */
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new ApiError('E_VALIDATION', { field: 'token' });
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ApiError('E_VALIDATION', { field: 'token' });
  }
  return parsed as Record<string, unknown>;
}

/** 필수 문자열 필드. 길이 판정은 하지 않는다 — 그건 RPC 가 정규화한 뒤에 하는 일이다(§2-3). */
export function requiredString(
  body: Record<string, unknown>,
  key: string,
  field: ApiValidationField,
): string {
  const value = body[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError('E_VALIDATION', { field });
  }
  return value;
}

/** 선택 문자열 필드. 없으면 `null` 을 RPC 로 넘긴다. */
export function optionalString(
  body: Record<string, unknown>,
  key: string,
  field: ApiValidationField,
): string | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new ApiError('E_VALIDATION', { field });
  }
  return value;
}
