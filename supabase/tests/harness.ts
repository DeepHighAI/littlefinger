import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';

/**
 * 실제 Postgres 위에서 RLS 를 검증하기 위한 하니스.
 *
 * PGlite 는 Postgres 를 WASM 으로 빌드한 것이라 Docker 도 서버도 필요 없다.
 * 구조 검사(schema.test.ts)와 달리 여기서는 **정책이 실제로 걸리는지**를 본다 —
 * `using` 과 `with check` 를 바꿔 쓴 실수처럼, SQL 을 읽어서는 못 잡는 것들이 여기서 걸린다.
 *
 * 실제 Supabase 프로젝트가 해 주는 것 중 마이그레이션에 없는 두 가지를 여기서 재현한다.
 * 1. `auth` 스키마와 `auth.uid()` — 세션 설정에서 현재 사용자를 읽는다.
 * 2. `authenticated` / `anon` 역할과 public 스키마 기본 권한.
 * 이 둘은 Supabase 프로젝트 초기화가 만들어 주는 것이라 마이그레이션에 넣지 않는다.
 */

const MIGRATIONS_DIR = join(__dirname, '../migrations');

/**
 * Supabase 의 `auth.uid()` 를 흉내낸다.
 * 원본은 JWT 클레임에서 sub 를 꺼내지만, 여기서는 세션 GUC 로 대신한다.
 */
const AUTH_SHIM = `
  create schema if not exists auth;

  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text
  );

  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  -- Supabase 프로젝트가 기본으로 만들어 두는 역할들.
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
`;

/** Supabase 는 public 스키마의 새 테이블에 대해 이 권한을 기본으로 준다. RLS 가 실제 관문이다. */
const GRANTS = `
  grant usage on schema public to anon, authenticated, service_role;
  grant all on all tables in schema public to anon, authenticated, service_role;
  grant all on all sequences in schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
  grant select on auth.users to anon, authenticated, service_role;
`;

export interface TestDb {
  /** 수퍼유저로 실행한다. RLS 를 우회하므로 **준비 작업에만** 쓴다. */
  asAdmin(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  /** 로그인한 사용자로 실행한다. RLS 가 걸린다. */
  asUser<T = Record<string, unknown>>(
    userId: string,
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  /** 로그인하지 않은 방문자로 실행한다. */
  asAnon<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

function readMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
}

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();

  await db.exec(AUTH_SHIM);
  for (const migration of readMigrations()) {
    await db.exec(migration);
  }
  await db.exec(GRANTS);

  async function runAs<T>(
    role: string,
    userId: string | null,
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }> {
    // 역할과 세션 설정은 트랜잭션 안에서만 바꾼다. 그래야 테스트끼리 새지 않는다.
    await db.exec('begin');
    try {
      await db.exec(`set local role ${role}`);
      await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? '']);
      const result = await db.query<T>(sql, params);
      await db.exec('commit');
      return { rows: result.rows };
    } catch (error) {
      await db.exec('rollback');
      throw error;
    }
  }

  return {
    asAdmin: (sql, params) =>
      db.query(sql, params).then((r) => ({ rows: r.rows as Record<string, unknown>[] })),
    asUser: (userId, sql, params) => runAs('authenticated', userId, sql, params),
    asAnon: (sql, params) => runAs('anon', null, sql, params),
    close: () => db.close(),
  };
}

/** 테스트용 사용자 하나를 만든다. `auth.users` 와 `public.users` 를 함께 채운다. */
export async function createUser(db: TestDb, nickname: string): Promise<string> {
  const { rows } = await db.asAdmin(`insert into auth.users default values returning id`);
  const id = String((rows[0] as { id: string }).id);
  await db.asAdmin(
    `insert into public.users (id, kakao_id, nickname, primary_surface)
     values ($1, $2, $3, 'APP')`,
    [id, `kakao-${nickname}-${id.slice(0, 8)}`, nickname],
  );
  return id;
}

/** 약속 하나와 참여자 행을 만든다. 준비 작업이므로 RLS 를 우회한다. */
export async function createPromise(
  db: TestDb,
  options: { creatorId: string; partnerId?: string; witnessId?: string; status?: string },
): Promise<string> {
  const status = options.status ?? 'DRAFT';
  const { rows } = await db.asAdmin(
    `insert into public.promises (creator_id, status, title, body, category, end_date, keeper)
     values ($1, $2::public.promise_status, '매일 걷기', '매일 30분 걷기로 했다', 'HABIT',
             current_date + 7, 'BOTH')
     returning id`,
    [options.creatorId, status],
  );
  const promiseId = String((rows[0] as { id: string }).id);

  await db.asAdmin(
    `insert into public.promise_participants (promise_id, user_id, role, status)
     values ($1, $2, 'CREATOR', 'JOINED')`,
    [promiseId, options.creatorId],
  );

  if (options.partnerId !== undefined) {
    await db.asAdmin(
      `insert into public.promise_participants (promise_id, user_id, role, status)
       values ($1, $2, 'PARTNER', 'JOINED')`,
      [promiseId, options.partnerId],
    );
  }

  if (options.witnessId !== undefined) {
    await db.asAdmin(
      `insert into public.promise_participants (promise_id, user_id, role, status)
       values ($1, $2, 'WITNESS', 'JOINED')`,
      [promiseId, options.witnessId],
    );
  }

  return promiseId;
}
