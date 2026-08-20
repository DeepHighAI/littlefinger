import {
  ERROR_CODES,
  ERROR_MESSAGE,
  ERROR_MESSAGE_BY_LOCALE,
  type ApiErrorBody,
  type ApiValidationField,
  type Endpoint,
  type ErrorCode,
  type Locale,
} from '@littlefinger/shared';

const UNKNOWN_ERROR_MESSAGE = '문제가 발생했어요. 잠시 후 다시 시도해 주세요.';

interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export interface MobileApiDeps {
  fetch(url: string, init: RequestInit): Promise<FetchResponse>;
  functionUrl(endpoint: Endpoint): string;
  getAccessToken(): Promise<string | null>;
  randomUuid(): string;
}

export interface MobileApiOptions {
  idempotent?: boolean;
  idempotencyKey?: string;
}

export class MobileApiError extends Error {
  constructor(
    readonly code: ErrorCode | null,
    message: string,
    readonly field?: ApiValidationField,
  ) {
    super(message);
    this.name = 'MobileApiError';
  }
}

/**
 * 에러를 현재 로케일 문구로 그린다. 코드가 있으면 클라이언트 사전이 서버 문구를
 * 대체하고(1차: 서버 봉투는 ko 유지), 코드가 없으면 서버/기본 문구 그대로다.
 */
export function localizedApiMessage(error: MobileApiError, locale: Locale): string {
  if (error.code !== null) {
    return ERROR_MESSAGE_BY_LOCALE[locale][error.code] ?? error.message;
  }
  return error.message;
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && ERROR_CODES.includes(value as ErrorCode);
}

function apiErrorOf(value: unknown): ApiErrorBody | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Partial<ApiErrorBody>;
  if (!isErrorCode(candidate.code) || typeof candidate.message !== 'string') return null;
  return candidate as ApiErrorBody;
}

async function accessTokenOf(deps: MobileApiDeps): Promise<string> {
  const accessToken = await deps.getAccessToken();
  if (accessToken === null) {
    throw new MobileApiError(
      'E_AUTH_REQUIRED',
      ERROR_MESSAGE.E_AUTH_REQUIRED ?? UNKNOWN_ERROR_MESSAGE,
    );
  }
  return accessToken;
}

async function readMobileResponse<T>(
  endpoint: Endpoint,
  init: RequestInit,
  deps: MobileApiDeps,
): Promise<T> {
  let response: FetchResponse;
  try {
    response = await deps.fetch(deps.functionUrl(endpoint), init);
  } catch {
    throw new MobileApiError(null, UNKNOWN_ERROR_MESSAGE);
  }

  const text = await response.text();
  if (response.ok) {
    return (text === '' ? undefined : JSON.parse(text)) as T;
  }

  try {
    const error = apiErrorOf(JSON.parse(text));
    if (error !== null) {
      throw new MobileApiError(error.code, error.message, error.field);
    }
  } catch (error) {
    if (error instanceof MobileApiError) throw error;
  }
  throw new MobileApiError(null, UNKNOWN_ERROR_MESSAGE);
}

export async function callMobileFunction<T>(
  endpoint: Endpoint,
  body: unknown,
  options: MobileApiOptions,
  deps: MobileApiDeps,
): Promise<T> {
  const accessToken = await accessTokenOf(deps);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  if (options.idempotencyKey !== undefined) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  } else if (options.idempotent === true) {
    headers['Idempotency-Key'] = deps.randomUuid();
  }

  return await readMobileResponse<T>(
    endpoint,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    },
    deps,
  );
}

/**
 * 로그인 전 공개 엔드포인트 호출 — 지금은 `invite-resolve`(verify_jwt=false) 하나뿐이다.
 * anon 키도 Authorization 도 싣지 않는다: 로그인 전 화면이 가진 열쇠는 어차피 공개
 * anon 키뿐이고, 필요 없는 것을 실으면 CORS 허용 헤더에만 의존하는 표면이 넓어진다.
 */
export async function callMobileFunctionPublic<T>(
  endpoint: Endpoint,
  body: unknown,
  deps: MobileApiDeps,
): Promise<T> {
  return await readMobileResponse<T>(
    endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    deps,
  );
}

export async function callMobileMultipartFunction<T>(
  endpoint: Endpoint,
  body: FormData,
  idempotencyKey: string,
  deps: MobileApiDeps,
): Promise<T> {
  const accessToken = await accessTokenOf(deps);
  return await readMobileResponse<T>(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // FormData가 플랫폼별 boundary를 붙이므로 Content-Type은 직접 지정하지 않는다.
        'Idempotency-Key': idempotencyKey,
      },
      body,
    },
    deps,
  );
}
