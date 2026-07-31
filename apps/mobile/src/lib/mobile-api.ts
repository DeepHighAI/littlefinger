import {
  ERROR_CODES,
  ERROR_MESSAGE,
  type ApiErrorBody,
  type ApiValidationField,
  type Endpoint,
  type ErrorCode,
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

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && ERROR_CODES.includes(value as ErrorCode);
}

function apiErrorOf(value: unknown): ApiErrorBody | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Partial<ApiErrorBody>;
  if (!isErrorCode(candidate.code) || typeof candidate.message !== 'string') return null;
  return candidate as ApiErrorBody;
}

export async function callMobileFunction<T>(
  endpoint: Endpoint,
  body: unknown,
  options: MobileApiOptions,
  deps: MobileApiDeps,
): Promise<T> {
  const accessToken = await deps.getAccessToken();
  if (accessToken === null) {
    throw new MobileApiError(
      'E_AUTH_REQUIRED',
      ERROR_MESSAGE.E_AUTH_REQUIRED ?? UNKNOWN_ERROR_MESSAGE,
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  if (options.idempotencyKey !== undefined) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  } else if (options.idempotent === true) {
    headers['Idempotency-Key'] = deps.randomUuid();
  }

  let response: FetchResponse;
  try {
    response = await deps.fetch(deps.functionUrl(endpoint), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
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
