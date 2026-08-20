import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createTestDb, type TestDb } from './harness.ts';

/**
 * Supabase Security/Performance Advisor 가 짚는 세 가지를 저장소 차원에서 못박는다
 * (20260820000004).
 *
 * 1. search_path 미고정 함수 — 같은 이름을 먼저 찾는 스키마를 심으면 함수 내부 참조가
 *    바꿔치기된다. 이 저장소 함수 본문은 전부 `public.` 정규화라 `''` 고정이 안전하다.
 * 2. RLS 의 bare `auth.uid()` — 행마다 재평가된다. `(select auth.uid())` 는 init-plan 으로
 *    한 번만 돈다.
 * 3. 정책이 부여하지 않는 동사의 grant — TRUNCATE 는 RLS 를 **거치지 않으므로** grant 가
 *    남아 있으면 정책과 무관하게 표가 비워질 수 있다. REFERENCES·TRIGGER 도 클라이언트
 *    역할에는 쓸 일이 없다.
 */

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
}, 120_000);

afterAll(async () => {
  await db.close();
});

describe('보안 하드닝 기준선', () => {
  test('public 스키마의 모든 함수가 search_path 를 고정한다', async () => {
    const { rows } = await db.asAdmin(`
      select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prokind = 'f'
        and (p.proconfig is null or not exists (
          select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
      order by 1
    `);
    expect(rows.map((row) => row['signature'])).toEqual([]);
  });

  test('RLS 정책 어디에도 bare auth.uid() 가 없다', async () => {
    const { rows } = await db.asAdmin(`
      select tablename, policyname, coalesce(qual, '') as qual,
             coalesce(with_check, '') as with_check
      from pg_policies
      where schemaname = 'public'
      order by tablename, policyname
    `);
    const bare = rows.filter((row) => {
      const expression = `${String(row['qual'])} ${String(row['with_check'])}`;
      // init-plan 형태 `( SELECT auth.uid() … )` 를 지우고도 남는 호출이 bare 다.
      return /auth\.uid\(\)/u.test(
        expression.replace(/\(\s*select\s+auth\.uid\(\)[^)]*\)/giu, ''),
      );
    });
    expect(bare.map((row) => `${String(row['tablename'])}/${String(row['policyname'])}`)).toEqual(
      [],
    );
  });

  test('anon·authenticated 의 표 권한은 permissive 정책이 부여한 동사뿐이다', async () => {
    const { rows: grants } = await db.asAdmin(`
      select table_name, grantee, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated')
    `);
    const { rows: policies } = await db.asAdmin(`
      select tablename, cmd
      from pg_policies
      where schemaname = 'public' and permissive = 'PERMISSIVE'
    `);

    const allowed = new Map<string, Set<string>>();
    for (const policy of policies) {
      const table = String(policy['tablename']);
      const verbs =
        policy['cmd'] === 'ALL'
          ? ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
          : [String(policy['cmd'])];
      const set = allowed.get(table) ?? new Set<string>();
      for (const verb of verbs) set.add(verb);
      allowed.set(table, set);
    }

    const unbacked = grants.filter((grant) => {
      const verb = String(grant['privilege_type']);
      // RLS 는 이 세 동사를 다루지 않는다 — 클라이언트 역할에는 무조건 금지.
      if (verb === 'TRUNCATE' || verb === 'REFERENCES' || verb === 'TRIGGER') return true;
      return !(allowed.get(String(grant['table_name'])) ?? new Set()).has(verb);
    });
    expect(
      unbacked
        .map(
          (grant) =>
            `${String(grant['grantee'])}:${String(grant['table_name'])}.${String(grant['privilege_type'])}`,
        )
        .sort(),
    ).toEqual([]);
  });
});
