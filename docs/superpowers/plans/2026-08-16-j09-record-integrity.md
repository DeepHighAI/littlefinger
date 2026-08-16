# J-09 Record Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a weekly, idempotent integrity batch that verifies activated version hashes and read-cache consistency while keeping incidents private and source records immutable.

**Architecture:** A service-role-only Postgres function checks every current activated version under a transaction advisory lock, updates the existing verification timestamp, and maintains private incident lifecycles. A single `pg_cron` job invokes the function. The promise-detail Edge boundary strips the legacy live integrity outcome, and SCR-A05 removes its user-facing badge.

**Tech Stack:** PostgreSQL, pg_cron, PGlite, TypeScript, Vitest, React Native, jest-expo, Supabase Edge Functions.

## Global Constraints

- Check current versions with non-null `activated_at`; exclude never-activated DRAFT, PENDING, and DECLINED versions.
- Verify both `promise_versions.content_hash` and the eight cached content fields on `promises`.
- `promise_versions` and `promises` content fields remain untouched, even on failure.
- Incident kinds are exactly `HASH_MISMATCH` and `CACHE_MISMATCH`.
- One lifecycle row exists for each `(promise_id, version_id, kind)`; repeat detection refreshes it and a later pass resolves it.
- Users receive no notification, badge, API field, or log detail about failures.
- The batch result contains only `checked_count`, `failed_count`, and `resolved_count`.
- Schedule exactly one job at `30 20 * * 6` UTC, Sunday 05:30 KST.
- No automatic repair, operator dashboard, remote deployment, `supabase config push`, `origin` push, or `.claude/settings.local.json` changes.

---

### Task 1: Private incident lifecycle and J-09 batch

**Files:**
- Create: `supabase/migrations/20260816000004_j09_integrity_verification.sql`
- Create: `supabase/tests/promise-integrity.test.ts`
- Modify: `supabase/tests/schema.test.ts`
- Modify: `supabase/tests/rls.test.ts`

**Interfaces:**
- Consumes: `public.lf_content_hash(...)`, `promises.current_version_id`, and `promise_versions` content.
- Produces: `lf_verify_promise_integrity(p_now timestamptz default now()) returns jsonb` and private `integrity_incidents` rows.

- [ ] **Step 1: Write the failing valid-record and exclusion tests**

```ts
test('checks current activated versions and skips never-activated versions', async () => {
  const active = await createActivatedPromise('ACTIVE');
  const pending = await createPendingPromise();
  const result = await verify('2026-08-16T20:30:00Z');
  expect(result).toEqual({ checked_count: 1, failed_count: 0, resolved_count: 0 });
  expect(await verifiedAt(active.id)).toBe('2026-08-16T20:30:00.000Z');
  expect(await verifiedAt(pending.id)).toBeNull();
});
```

Table-drive ACTIVE, AMEND_PENDING, CHECKING, COMPLETED, BROKEN, DISPUTED, UNRESOLVED, and CANCELED as included current activated versions. Keep PENDING and DECLINED excluded when `activated_at` is null.

- [ ] **Step 2: Write failing mismatch and immutability tests**

Mutate a version body through the admin fixture after activation and expect one `HASH_MISMATCH`. Mutate only the promise cache and expect one `CACHE_MISMATCH` with the exact changed field name. Mutate both and expect two incidents but `failed_count: 1`. Snapshot version content, stored hash, and cache content before the run; assert J-09 changes none of them.

- [ ] **Step 3: Write failing lifecycle, permission, and atomicity tests**

```ts
test('deduplicates, refreshes, resolves, and reopens one incident row', async () => {
  const promise = await createActivatedPromise('ACTIVE');
  await corruptCache(promise.id, 'title');
  await verify('2026-08-16T20:30:00Z');
  await verify('2026-08-16T20:30:00Z');
  expect(await incidents(promise.id)).toHaveLength(1);
  await restoreCacheFromVersion(promise.id);
  expect(await verify('2026-08-23T20:30:00Z')).toMatchObject({ resolved_count: 1 });
  await corruptCache(promise.id, 'body');
  await verify('2026-08-30T20:30:00Z');
  expect(await incidents(promise.id)).toMatchObject([{ resolved_at: null }]);
});
```

Assert `anon` and `authenticated` cannot select or mutate incidents or execute the batch. Add a temporary `before insert or update` trigger on `integrity_incidents` that raises `J09_TEST_FAILURE`, run the batch against a known mismatch, and assert both the incident write and `hash_verified_at` roll back; then drop the test trigger. Run overlapping calls with `Promise.all` and assert stable final state plus the advisory-lock contract.

- [ ] **Step 4: Run focused tests and verify RED**

Run: `npx vitest run supabase/tests/promise-integrity.test.ts supabase/tests/schema.test.ts supabase/tests/rls.test.ts`

Expected: FAIL because the table and batch do not exist.

- [ ] **Step 5: Implement the incident table**

```sql
create table public.integrity_incidents (
  id uuid primary key default gen_random_uuid(),
  promise_id uuid not null references public.promises(id) on delete cascade,
  version_id uuid not null references public.promise_versions(id),
  kind text not null check (kind in ('HASH_MISMATCH', 'CACHE_MISMATCH')),
  stored_hash char(64) not null,
  computed_hash char(64) not null,
  mismatch_fields text[] not null default '{}',
  first_detected_at timestamptz not null,
  last_detected_at timestamptz not null,
  resolved_at timestamptz,
  unique (promise_id, version_id, kind)
);

alter table public.integrity_incidents enable row level security;
create index integrity_incidents_version_id_idx
  on public.integrity_incidents (version_id);
revoke all privileges on table public.integrity_incidents from public, anon, authenticated;
grant select, insert, update on table public.integrity_incidents to service_role;
```

- [ ] **Step 6: Implement the minimal batch**

The function uses `pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lf-j09-integrity', 0))`, an empty `search_path`, qualified object names, and a deterministic order by promise UUID. For cache mismatches, build `mismatch_fields` from literal field comparisons for `title`, `body`, `category`, `end_date`, `keeper`, `reward`, `penalty`, and `current_version_id`. Compute the cache hash with the current version number only for safe incident metadata; exact field equality decides the cache result.

Use this lifecycle upsert:

```sql
insert into public.integrity_incidents (..., resolved_at)
values (..., p_now, p_now, null)
on conflict (promise_id, version_id, kind) do update
set stored_hash = excluded.stored_hash,
    computed_hash = excluded.computed_hash,
    mismatch_fields = excluded.mismatch_fields,
    last_detected_at = excluded.last_detected_at,
    resolved_at = null;
```

Resolve only the selected current version and check kind that now passes. Update `promises.hash_verified_at = p_now` after incident operations. Return literal count keys. Revoke the function from `public`, `anon`, and `authenticated`; grant only `service_role`.

- [ ] **Step 7: Verify GREEN and hash regressions**

Run the focused command from Step 4.

Run: `npx vitest run supabase/tests/hash.test.ts supabase/tests/promise-approve.test.ts supabase/tests/promise-detail.test.ts`

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260816000004_j09_integrity_verification.sql supabase/tests/promise-integrity.test.ts supabase/tests/schema.test.ts supabase/tests/rls.test.ts
git commit -m "feat: add J-09 integrity verification batch"
```

---

### Task 2: Remove integrity outcomes from the public detail boundary

**Files:**
- Modify: `packages/shared/src/promise-detail.ts`
- Modify: `packages/shared/src/promise-detail.test.ts`
- Modify: `supabase/functions/promise-detail/handler.ts`
- Modify: `supabase/tests/edge-promise-detail.test.ts`
- Modify: `supabase/tests/promise-detail.test.ts`
- Modify: `apps/mobile/src/lib/promise-detail-api.test.ts`
- Modify: `apps/mobile/src/app/promise/[promise_id].tsx`
- Modify: `apps/mobile/src/screens/scr-a05-promise-detail.test.tsx`
- Modify: `apps/mobile/src/screens/scr-a05-labels.ts`

**Interfaces:**
- Consumes: the existing service-only RPC payload, which still contains `integrity_status`.
- Produces: a public `PromiseDetailResponse` with no integrity outcome and an SCR-A05 without integrity labels.

- [ ] **Step 1: Write failing public-boundary tests**

Change the canonical response fixture to omit `integrity_status`. Assert `asPromiseDetailResponse` accepts that shape and rejects an extra `integrity_status` field. In the Edge test, keep the RPC fixture's internal field but assert the HTTP JSON omits it. In the screen test, assert no `기록 일치`, `기록 불일치`, or `확정 전 기록` text appears while the fingerprint remains visible.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run packages/shared/src/promise-detail.test.ts supabase/tests/edge-promise-detail.test.ts`

Run: `npm run test --workspace=@littlefinger/mobile -- src/lib/promise-detail-api.test.ts src/screens/scr-a05-promise-detail.test.tsx --runInBand`

Expected: FAIL because the shared parser and screen still require and render `integrity_status`.

- [ ] **Step 3: Remove the public field and strip the internal RPC value**

Remove `PromiseDetailIntegrity`, the `integrity_status` property, parser key, and status coupling from `promise-detail.ts`. Add a private Edge projection:

```ts
function publicPayload(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const { integrity_status: _internalIntegrity, ...publicValue } = value as Record<string, unknown>;
  return publicValue;
}
```

Call `asPromiseDetailResponse(publicPayload(await deps.rpc(...)))`. Remove integrity labels, label constants, and the integrity card from SCR-A05. Keep `current_version.fingerprint` and the rest of the confirmation content unchanged.

- [ ] **Step 4: Verify GREEN and detail regressions**

Run both focused commands from Step 2.

Run: `npx vitest run supabase/tests/promise-detail.test.ts supabase/tests/edge-promise-home-list.test.ts`

Expected: all tests PASS; public responses contain no internal outcome.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/promise-detail.ts packages/shared/src/promise-detail.test.ts supabase/functions/promise-detail/handler.ts supabase/tests/edge-promise-detail.test.ts supabase/tests/promise-detail.test.ts apps/mobile/src/lib/promise-detail-api.test.ts apps/mobile/src/app/promise/[promise_id].tsx apps/mobile/src/screens/scr-a05-promise-detail.test.tsx apps/mobile/src/screens/scr-a05-labels.ts
git commit -m "fix: keep integrity outcomes internal"
```

---

### Task 3: Schedule one weekly J-09 job

**Files:**
- Create: `supabase/migrations/20260816000005_schedule_j09_integrity.sql`
- Modify: `supabase/tests/promise-integrity.test.ts`
- Modify: `supabase/tests/schema.test.ts`

**Interfaces:**
- Consumes: `lf_verify_promise_integrity()` from Task 1 and the existing PGlite `cron.job` catalog.
- Produces: `lf_schedule_promise_integrity()` and one `littlefinger-j09-integrity` cron row.

- [ ] **Step 1: Write failing scheduler tests**

```ts
test('registers one Sunday 05:30 KST job and replaces duplicates', async () => {
  await db.asService('select public.lf_schedule_promise_integrity()');
  await db.asService('select public.lf_schedule_promise_integrity()');
  const { rows } = await db.asAdmin(
    `select jobname, schedule, command from cron.job where jobname = 'littlefinger-j09-integrity'`,
  );
  expect(rows).toEqual([{
    jobname: 'littlefinger-j09-integrity',
    schedule: '30 20 * * 6',
    command: 'select public.lf_verify_promise_integrity();',
  }]);
});
```

Assert client roles cannot execute the scheduler and that its function definition contains an advisory transaction lock.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run supabase/tests/promise-integrity.test.ts supabase/tests/schema.test.ts`

Expected: FAIL because the scheduler does not exist.

- [ ] **Step 3: Implement the scheduler migration**

```sql
create or replace function public.lf_schedule_promise_integrity()
returns void language plpgsql security definer set search_path = ''
as $$
declare v_job_id bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lf-j09-integrity-scheduler', 0)
  );
  if pg_catalog.to_regprocedure('cron.schedule(text,text,text)') is null then return; end if;
  for v_job_id in select jobid from cron.job where jobname = 'littlefinger-j09-integrity'
  loop perform cron.unschedule(v_job_id); end loop;
  perform cron.schedule(
    'littlefinger-j09-integrity',
    '30 20 * * 6',
    'select public.lf_verify_promise_integrity();'
  );
end;
$$;
```

Revoke from client roles, grant `service_role`, and call the scheduler once at migration end.

- [ ] **Step 4: Verify GREEN and two-run idempotency**

Run the focused command from Step 2.

Run the batch twice at the same `p_now` and assert identical counts, one incident per kind, and one cron job.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260816000005_schedule_j09_integrity.sql supabase/tests/promise-integrity.test.ts supabase/tests/schema.test.ts
git commit -m "feat: schedule weekly record integrity checks"
```

---

### Task 4: J-09 verification and status

**Files:**
- Modify: `docs/DEVELOPMENT_STATUS.md`

**Interfaces:**
- Consumes: all J-09 deliverables.
- Produces: accurate local verification and remote deployment gates.

- [ ] **Step 1: Run the complete verification matrix**

Run:

```bash
npm test
npm run typecheck
npm run build:web
npm run check:agents
npx expo install --check
npx expo export --platform android --output-dir C:\tmp\littlefinger-j09-20260816
git diff --check
```

Expected: every command exits 0. Record actual test and module counts.

- [ ] **Step 2: Update development status**

Record local J-09 completion, internal-only incidents, the removed public integrity outcome, and the exact cron schedule. Keep remote migration, cron inspection, two-run remote execution, incident permission verification, and operator workflow as incomplete gates while Management API access returns 403.

- [ ] **Step 3: Verify and commit the status update**

Run: `git diff --check && npm run check:agents`

```bash
git add docs/DEVELOPMENT_STATUS.md
git commit -m "docs: record J-09 integrity status"
```
