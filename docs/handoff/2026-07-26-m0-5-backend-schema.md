# Handoff — M0-5: Supabase schema, RLS, keep-alive

Date: 2026-07-26. Follows `2026-07-26-m0b-mobile-port.md`.

## Status

**M0-5 complete. M0 as a whole is complete.** `npm test` → **383 tests green**
(Vitest 246, jest-expo 137). `npm run typecheck` clean.

This is the **start** of the backend surface, not the end of it — see the Codex gate below.

## What was built

| Path | What |
|---|---|
| `supabase/migrations/…_initial_schema.sql` | 18 tables, 18 enums, indexes, partial unique constraints |
| `supabase/migrations/…_rls.sql` | RLS on every table + 2 security-definer helpers |
| `supabase/tests/schema.test.ts` | structural verification without a database |
| `supabase/config.toml` | local dev config, Kakao provider, redirect allowlist |
| `.github/workflows/supabase-keepalive.yml` | daily ping — the free plan pauses after 7 days idle |
| `.github/workflows/supabase-backup.yml` | weekly `db dump`, 90-day artifacts |

## Design decisions the spec did not make

1. **`public.users.id` references `auth.users(id)`.** The spec describes `users` standalone, but
   Supabase Auth owns identity, and tying the ids is what lets RLS compare `auth.uid()` directly
   instead of joining on every policy.
2. **Client policies open almost nothing but SELECT.** Every transition, hash and token comparison
   is an Edge Function under `service_role`, which bypasses RLS. Opening client writes "just in
   case" would create a second path into state the spec says only the server may touch.
3. **Two `security definer` helpers** (`is_promise_participant`, `can_read_promise`). Policies on
   `promise_participants` that query `promise_participants` recurse infinitely under RLS; a
   definer function is the standard escape.
4. **`can_read_promise` encodes the witness rule** — witnesses see the full text only from ACTIVE
   onward (§9), so the function excludes DRAFT and PENDING for them.
5. **Unblocking has no policy.** §9 lists 신고·차단 as allowed but says nothing about undoing a
   block. Rather than invent it, `blocks` is insert-only from the client.

## Verification, and its limits

Structural tests read the migration SQL and enforce, without a database:
RLS enabled on all 18 tables · no UPDATE/DELETE policy on the four append-only tables ·
DELETE only for DRAFT promises and own device tokens · `token`/`ip`/`user_agent` exist only as
`_hash` columns · evidence stores a bucket key, never a URL · every enum matches
`packages/shared` · `promises` UPDATE and DELETE both constrained to `'DRAFT'`.

**Mutation testing found a real hole.** Changing `promises` SELECT to `using (true)` — which leaks
the existence of a promise to non-participants, the single most damaging failure in this schema —
passed every test. Guards were added; that change now fails three tests, as does the same change on
`notifications`. Other mutations verified as caught: an UPDATE policy on `approvals`, RLS disabled
on `users`, a plaintext `token` column, and a missing enum value.

**What this does not cover: the policies have never run.** Docker Desktop was not running, so
`supabase start` was unavailable. These tests check that the SQL *says* the right thing, not that
Postgres *does* the right thing. Confusable pairs — `using` vs `with check`, a policy that is
correct but unreachable, `security definer` search_path issues — would pass.

**Next session, if Docker Desktop is running:** `npx supabase start`, apply migrations, then write
integration tests that authenticate as a non-participant and assert an empty result rather than an
error. That is the test that actually proves existence-hiding works.

## The Codex verification gate

The PO asked to be told the moment backend development finishes, so they can run an independent
**Codex agent** verification pass. **M0-5 is the start of the backend, not the finish.** Still
outstanding before that gate:

- Edge Functions (`04` §7-3): `invite-resolve`, `promise-approve` (state transition + `content_hash`),
  `promise-decline` / `-amend` / `-cancel`, `fulfillment-submit` (the COMPLETED/BROKEN/DISPUTED
  verdict), `evidence-sign-url`, `push-send` with quiet hours
- `pg_cron` batch jobs J-01…J-10, each idempotent across two runs in a day
- Storage bucket for evidence: private, EXIF stripped, 10-minute signed URLs

Report at that point with file-by-file detail, quoted test output, `02` §13 coverage, and anything
skipped — then **wait**. Do not roll into M1.

## Blocked / needs the PO

1. **GitHub Secrets for the workflows** — `SUPABASE_URL`, `SUPABASE_ANON_KEY` for keep-alive;
   `SUPABASE_DB_URL` for the backup. The workflows are committed but inert until these exist.
   Deliberately, keep-alive uses only the anon key — it reads `app_configs`, the one publicly
   readable table.
2. **The repo has no GitHub remote yet**, so neither workflow can run.
3. **Migrations have not been applied to the live project.** `supabase link` then `supabase db push`
   — the PO's call whether to do that now or after the Edge Functions land.
4. **Verify the anon key type** — legacy `anon` JWT or newer `sb_publishable_...`. `.env` and the
   keep-alive workflow both assume `anon`.
