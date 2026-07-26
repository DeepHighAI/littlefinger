import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';

import { INVITE_TTL_HOURS } from '../../packages/shared/src/config.js';

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
  -- **UTC 로 고정한다.** PGlite 는 머신 시간대를 물려받는데, 개발 머신이 한국이면
  -- 세션 시간대가 KST 가 되어 now()::date 와 (now() at time zone 'Asia/Seoul')::date 가
  -- 같은 값이 된다 — 즉 KST 변환을 통째로 빼먹어도 테스트가 전부 통과한다.
  -- Supabase Postgres 는 UTC 로 돌기 때문에 그 버그는 배포 후에야 드러난다.
  -- 변이 테스트로 실제 확인한 구멍이다(M20·M21).
  set time zone 'UTC';

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

  -- Supabase 는 public 스키마에 이 기본 권한을 걸어 둔다. 그래서 새로 만든 함수는
  -- **아무 것도 안 해도 클라이언트가 부를 수 있다**. 마이그레이션보다 먼저 걸어야
  -- 이후에 생성되는 함수에 적용된다 — 서버 전용 함수의 revoke 가 실제로 필요한지
  -- 여기서 재현하지 않으면 로컬에서만 안전해 보인다.
  alter default privileges in schema public
    grant all on functions to anon, authenticated, service_role;
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

/**
 * 약속 하나와 참여자 행을 만든다. 준비 작업이므로 RLS 를 우회한다.
 *
 * **버전 행(v1)도 같이 만든다.** T-01 이 약속과 v1 을 함께 생성하고 DRAFT 수정은 v1 을
 * 덮어쓰므로, 확정 이전에도 `promise_versions` 행은 이미 존재한다 —
 * `content_hash` 가 NOT NULL 인 것이 그 사실을 스키마 수준에서 못박는다.
 * 버전 행 없는 약속은 실제로 존재할 수 없으므로 픽스처도 만들지 않는다.
 */
export async function createPromise(
  db: TestDb,
  options: {
    creatorId: string;
    partnerId?: string;
    witnessId?: string;
    status?: string;
    /** 종료일 = KST 오늘 + n. 음수면 이미 지난 약속이다(EC-B10). */
    endDateOffsetDays?: number;
  },
): Promise<string> {
  const status = options.status ?? 'DRAFT';
  const { rows } = await db.asAdmin(
    `insert into public.promises (creator_id, status, title, body, category, end_date, keeper,
                                 reward, penalty)
     values ($1, $2::public.promise_status, '매일 걷기', '매일 30분 걷기로 했다', 'HABIT',
             (now() at time zone 'Asia/Seoul')::date + $3::int, 'BOTH',
             '커피 한 잔', '설거지 1주일')
     returning id`,
    [options.creatorId, status, options.endDateOffsetDays ?? 7],
  );
  const promiseId = String((rows[0] as { id: string }).id);

  await db.asAdmin(
    `insert into public.promise_versions
       (promise_id, version_no, title, body, category, end_date, keeper, reward, penalty,
        content_hash, created_by)
     select p.id, 1, p.title, p.body, p.category, p.end_date, p.keeper, p.reward, p.penalty,
            public.lf_content_hash(p.title, p.body, p.category, p.end_date, p.keeper,
                                   p.reward, p.penalty, 1),
            p.creator_id
       from public.promises p
      where p.id = $1`,
    [promiseId],
  );

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

/**
 * 초대 하나를 만들고 **토큰 해시**를 돌려준다. 서버는 원문 토큰을 절대 갖지 않으므로
 * (04 §12-8) 테스트도 해시만 들고 다닌다.
 *
 * `status` 와 `expiresInSeconds` 를 따로 받는 이유: 둘은 실제로 어긋날 수 있다.
 * J-04 는 30분마다 돌기 때문에 `status='PENDING'` 인데 `expires_at` 은 이미 지난
 * 구간이 존재한다(02 §7-2). 그 조합을 만들 수 없으면 그 창을 테스트할 수 없다.
 */
export async function createInvitation(
  db: TestDb,
  options: {
    promiseId: string;
    createdBy: string;
    targetRole?: 'PARTNER' | 'WITNESS';
    status?: 'PENDING' | 'USED' | 'EXPIRED' | 'REVOKED';
    expiresInSeconds?: number;
  },
): Promise<string> {
  const tokenHash = createHash('sha256').update(randomUUID()).digest('hex');
  await db.asAdmin(
    `insert into public.invitations
       (promise_id, target_role, token_hash, created_by, expires_at, status)
     values ($1, $2::public.participant_role, $3, $4,
             now() + make_interval(secs => $5), $6::public.invitation_status)`,
    [
      options.promiseId,
      options.targetRole ?? 'PARTNER',
      tokenHash,
      options.createdBy,
      options.expiresInSeconds ?? INVITE_TTL_HOURS * 3600,
      options.status ?? 'PENDING',
    ],
  );
  return tokenHash;
}
