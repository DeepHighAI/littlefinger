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
 *
 * **`cf-connecting-ip` 을 쓴다. `x-forwarded-for` 는 예비다.** 배포된 함수에 실제로 도착하는
 * 헤더를 관측해서 정했다(2026-07-27) — Supabase Edge Functions 앞에는 Cloudflare 가 있다.
 *
 *   cf-connecting-ip : 실제 클라이언트 주소. 요청마다 고정.
 *   x-forwarded-for  : `[실제주소, 실제주소, 내부홉]` — **마지막 항목이 요청마다 바뀐다.**
 *   클라이언트가 보낸 X-Forwarded-For : Cloudflare 가 버린다. 위조본은 아예 도착하지 않는다.
 *
 * 이걸 추측으로 정했다가 실제로 당했다. 처음엔 "프록시가 뒤에 덧붙이니 맨 뒤가 진짜"라고
 * 보고 마지막 항목을 읽었는데, 그 자리는 회전하는 내부 홉이라 요청마다 rate limit 버킷이
 * 새로 생겼다 — 210회를 두드려도 429 가 나오지 않았다. 맨 앞도 안전한 근거가 얕다.
 * 위조본이 도착하지 않는 것은 Cloudflare 가 그렇게 설정돼 있기 때문이지 XFF 규약 때문이
 * 아니어서, 그 설정이 바뀌면 조용히 위조를 신뢰하게 된다.
 */
export function clientIp(request: Request): string | null {
  // 예비 경로는 맨 앞이다. 관측상 [실제주소, …] 이고, 마지막은 절대 쓰지 않는다.
  const candidates = [
    request.headers.get('cf-connecting-ip'),
    request.headers.get('x-forwarded-for')?.split(',')[0] ?? null,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value !== undefined && value.length > 0) return value;
  }
  return null;
}

/**
 * 빈도 제한 버킷 이름. `{endpoint}:{IP 해시}` 다.
 *
 * IP 를 모르면 `unknown` 하나를 공유한다. 제한을 건너뛰는 것보다 낫다 — 건너뛰면 헤더를
 * 지우는 것이 곧 우회가 된다. 호스팅된 함수 앞에는 언제나 프록시가 있으므로 이 갈래는
 * 사실상 오지 않는다.
 */
export function rateLimitBucket(endpoint: string, ipHash: string | null): string {
  return `${endpoint}:${ipHash ?? 'unknown'}`;
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

/**
 * 본문 JSON. 형태가 아니면 `E_VALIDATION` 이다 — 우리 클라이언트가 보낸 요청이 아니다.
 *
 * `field` 는 함수마다 다르다. 토큰 하나로 시작하는 네 함수는 `token`, 약속 작성은 `title` 이다.
 */
export async function jsonBody(
  request: Request,
  field: ApiValidationField = 'token',
): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new ApiError('E_VALIDATION', { field });
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ApiError('E_VALIDATION', { field });
  }
  return parsed as Record<string, unknown>;
}

/** 선택 불리언. 없으면 `null` 이고 RPC 가 기본값을 정한다. */
export function optionalBoolean(
  body: Record<string, unknown>,
  key: string,
  field: ApiValidationField,
): boolean | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'boolean') {
    throw new ApiError('E_VALIDATION', { field });
  }
  return value;
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
