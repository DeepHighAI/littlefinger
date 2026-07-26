# Handoff — B1-1: content_hash and the record fingerprint

Date: 2026-07-26. Follows `2026-07-26-m0-5-backend-schema.md`. Stopped at the 70% context rule.

## Status

**B1-1 complete.** `npm test` → Vitest **308 passed**, jest-expo **137 passed**. Typecheck clean.
Pushed to `DeepHighAI/littlefinger`.

B1-2 … B1-6 are untouched and specified below.

## The architecture decision that governs the rest of the backend

**Transactional logic goes in Postgres functions; Edge Functions stay thin.** PO-approved
2026-07-26, and it deviates from `04` §7-3 deliberately — record this for the Codex review.

Three reasons, in order of weight:

1. `02` §4-3-5 requires the ten approval steps to run in **one transaction with full rollback**
   (EC-C02). The Supabase JS client cannot span statements in a transaction, so an RPC is not a
   convenience here — it is the only way to meet the rule.
2. This environment has **neither Deno nor Docker**, so `supabase functions serve` cannot run. Logic
   placed in an Edge Function would be unverifiable. Logic in Postgres runs under PGlite.
3. §7-3's concurrency rules — conditional UPDATE, `SELECT … FOR UPDATE`, partial unique indexes —
   are database mechanisms. They belong next to the data.

`04` §7-3's stated purpose is that a client cannot forge a hash or a transition. A Postgres function
is further inside than an Edge Function, so the purpose is served more strongly, not less.
**Write ADR 0003** recording this before the backend is submitted for review.

Deployment is unaffected: `supabase functions deploy --use-api` bundles server-side without Docker.

## What was built

| Path | What |
|---|---|
| `supabase/migrations/…_content_hash.sql` | `lf_content_hash()` and `lf_fingerprint()` |
| `supabase/tests/reference/content-hash.ts` | independent TypeScript oracle — **test-only, never shipped** |
| `supabase/tests/hash.test.ts` | cross-checks the two implementations |

`jsonb_build_object` is unusable for this: it reorders keys alphabetically and §4-4-2 fixes the
order as `title, body, category, end_date, keeper, reward, penalty, version_no`. The object is
assembled by hand; `to_jsonb` is borrowed only to escape individual string values, which keeps
quote and backslash handling identical on both sides.

The fingerprint is `upper(hash[0..4])-upper(hash[4..8])-version` — PO decision, since `02` never
specifies it. The first eight characters match §4-11-4's version-history display.

## Why the verification is worth trusting

Two implementations read the spec independently and are compared. That is the whole point — a
single implementation testing itself cannot reveal a misread rule.

It caught two real defects already:

- **`lpad` truncates.** `lpad('123', 2, '0')` is `'12'`, so version 123 rendered as `A3F9-77C2-12`
  and collided with version 12. Amend rounds are unlimited (S-10), so three digits are reachable.
- **Normalization was only covered for `title`.** Mutation testing removed `btrim`/`normalize` from
  `body` and the suite stayed green. All four normalized fields are now guarded individually;
  removing normalization from any one fails two tests.

Verified caught: key reorder (6 failures), per-field normalization removal (2 each), oracle drift
on `version_no` type (7). Verified *not* caught before the fix: `body` normalization — which is
exactly why the mutation pass runs.

## The exact next step

**B1-2 — Idempotency-Key store.** `02` §7-3.6: every state-changing request carries an
`Idempotency-Key` UUID header; the server caches the result for **10 minutes** and returns an
identical response for a repeat. EC-C01 requires the repeat to produce **no second `approvals`
row** — the cache must short-circuit before the transaction, not after.

Table `idempotency_keys(key, user_id, endpoint, response jsonb, created_at)`, RLS on with **no
policy** (server-only, matching the `reminder_schedules` pattern already in the RLS migration).

Write the failing test first: same key twice → second returns the cached body and writes nothing;
an expired key re-executes; another user's key cannot be reused.

Then B1-3 `lf_invite_resolve`, B1-4 `lf_promise_approve`, B1-5 decline / amend-suggest, B1-6 the
four Edge Function shells. Full detail in the approved plan at
`C:\Users\batis\.claude\plans\docs-04-ai-agent-md-sprightly-river.md`.

For B1-4, the ten steps and their error codes are transcribed in this session's research; the two
non-obvious ones: step 9 (notification) runs **outside** the transaction (EC-C02), and the creator's
`approvals` row is written by the approve transaction with `acted_at` set to the **invite dispatch
time** (§4-3-6) — T-02's "예약 기록" wording is not a second writer.

## Still open

- **Actions secrets are still unset**, so keep-alive does not run and Supabase Free pauses after
  7 idle days. See `docs/setup/github-actions-secrets.md`.
- `supabase db push` stays deferred until the Edge Functions are done — PO decision.
- **NT-04 / NT-05 quiet-hours classification** is missing from §8-3. Default chosen: send
  immediately, because NT-04 exists to warn 12 hours before expiry and deferring it to 08:00 would
  defeat it. Confirm when notifications are built.
- Blinded-evidence copy differs between §4-8 and EC-F06. Decide during the evidence work.
