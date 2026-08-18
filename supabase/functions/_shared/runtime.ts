// Deno 런타임에 실제로 닿는 유일한 모듈.
//
// `Deno.env` 와 supabase-js 가 여기에만 있고, 핸들러는 `Deps` 인터페이스만 안다. 그래서
// 핸들러는 vitest 가 그대로 import 할 수 있고 이 파일은 절대 import 되지 않는다 —
// Deno 전역을 건드리는 순간 테스트 파일이 통째로 `ReferenceError` 로 죽기 때문이다.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import type { Deps, Logger, Secrets } from './deps.ts';
import { ApiError } from './errors.ts';

/** 없으면 부팅에서 죽는다. 시크릿 누락은 런타임에 조용히 틀린 해시를 만드는 것보다 낫다. */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value.length === 0) {
    throw new Error(`missing required secret: ${name}`);
  }
  return value;
}

/**
 * 원문 토큰·IP·User-Agent 는 이 로거를 통과할 수 없다. §13 수락 기준이 "DB·**로그** 어디에도"
 * 라고 적었으므로, 호출부가 이미 해시나 코드만 넘기도록 되어 있다.
 */
const logger: Logger = {
  error: (message, detail) => {
    console.error(JSON.stringify({ level: 'error', message, detail: String(detail) }));
  },
};

function createSecrets(): Secrets {
  return {
    invitePepper: requireEnv('INVITE_TOKEN_PEPPER'),
    piiSalt: requireEnv('PII_HASH_SALT'),
  };
}

const ACTIVE_ACTOR_EXEMPT_RPCS = new Set(['lf_account_withdraw']);

function actorArgument(args: Record<string, unknown>): string | null {
  const actor = args['p_actor'] ?? args['p_user_id'];
  return typeof actor === 'string' ? actor : null;
}

export function createAdminClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    // 서버 프로세스다. 세션을 들고 있을 이유도, 갱신할 이유도 없다.
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createDeps(): Deps {
  const admin = createAdminClient();

  return {
    rpc: async (fn, args) => {
      const actor = actorArgument(args);
      if (actor !== null && !ACTIVE_ACTOR_EXEMPT_RPCS.has(fn)) {
        const { error } = await admin.rpc('lf_assert_actor', { p_user_id: actor });
        if (error !== null) throw new Error(error.message);
      }
      const { data, error } = await admin.rpc(fn, args);
      // RPC 가 raise 한 문자열이 `error.message` 로 그대로 온다. 여기서 코드로 바꾸지 않는다 —
      // 아는 코드인지 판정하는 곳은 한 군데(`toErrorCode`)여야 한다.
      if (error !== null) throw new Error(error.message);
      return data;
    },

    authenticate: async (authorization) => {
      const jwt = authorization?.replace(/^Bearer\s+/i, '') ?? '';
      if (jwt.length === 0) throw new ApiError('E_AUTH_REQUIRED');

      const { data, error } = await admin.auth.getUser(jwt);
      if (error !== null || data.user === null) {
        // 이유를 삼키지 않는다. `/auth/v1/user` 가 200 을 주는 토큰이 여기서만 401 이 되는
        // 원인이 아직 미상인데(2026-07-29), 그 이유를 아무도 본 적이 없어서 미상이다.
        // `AuthError.toJSON()` 이 name·message·status·code 만 내놓으므로 토큰은 새지 않는다(§13).
        logger.error(
          'auth.getUser rejected the token',
          error === null ? 'no error returned, but user was null' : JSON.stringify(error),
        );
        throw new ApiError('E_AUTH_REQUIRED');
      }
      return data.user.id;
    },

    secrets: createSecrets(),
    log: logger,
    now: () => new Date(),
  };
}
