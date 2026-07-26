# Handoff — B1-2 · B1-3 · B1-4

Date: 2026-07-26. Follows `2026-07-26-b1-content-hash.md`. Stopped at the 70% context rule.

## Status

**B1-2, B1-3, B1-4 complete.** `npm test` → Vitest **422 passed** (14 files), jest-expo **137
passed**. `npm run typecheck` clean. `npm run check:agents` clean. Three commits on `main`,
not yet pushed.

B1-5 (decline / amend-suggest) and B1-6 (Edge Function shells) are untouched.

| Migration | What |
|---|---|
| `…0004_idempotency.sql` | `idempotency_keys` + `lf_idempotency_begin` / `finish` / `ttl_minutes` |
| `…0005_invite_resolve.sql` | `lf_invite_resolve(token_hash)` — pre-login minimum info |
| `…0006_promise_approve.sql` | `lf_promise_approve(...)` — the §4-3-5 ten steps |

Test files: `idempotency.test.ts` (30), `invite-resolve.test.ts` (31), `promise-approve.test.ts` (45).
`harness.ts` gained `createInvitation`, a v1 `promise_versions` row in `createPromise`, an
`endDateOffsetDays` option, Supabase's default function privileges, and a UTC session pin.

## Four findings that will bite again

**1. `revoke … from public` does not close a function.** Supabase runs
`alter default privileges in schema public grant all on functions to anon, authenticated,
service_role`, so those two roles hold EXECUTE independently of PUBLIC. Every server-only function
needs `from public, anon, authenticated`. The harness now reproduces the default grant, so the
tests can see it. **Assert privileges per function** with `has_function_privilege` — a behavioural
"it threw" check is satisfied by a neighbouring function's revoke and hides a missing one.

**2. The test harness inherited KST and hid every timezone bug.** PGlite takes the machine
timezone; on a Korean machine `now()::date` equals `(now() at time zone 'Asia/Seoul')::date`, so
dropping the KST conversion entirely left the suite green. Supabase runs in UTC. `harness.ts` now
pins `set time zone 'UTC'`. Note the value assertion alone is still not enough — UTC and KST dates
differ only 9 hours a day, so `promise-approve.test.ts` also asserts the function body contains no
`current_date` and no `now()::date`.

**3. Expiry is decided by the clock, not by `invitations.status`.** J-04 sweeps every 30 minutes
(`02` §7-2), so a token sits at `status='PENDING'` with `expires_at` already past for up to half an
hour. `lf_invite_resolve` and `lf_promise_approve` share the identical order — stored status first
(REVOKED → USED → EXPIRED), clock last — because a landing screen and an approve call that disagree
about one token leave the user unable to accept a link that visibly opens.

**4. Two joins that look right and are not.** The creator comes from `promises.creator_id`, not
`invitations.created_by` — `02` §4-5-2 lets the partner send witness invitations, so `created_by`
names the wrong person, and only on witness links. The title comes from the `promises` cache, not
`promise_versions` via `current_version_id` — that column is empty before ACTIVE, so the join turns
every pending invite into `E_NOT_FOUND`.

## Decisions taken (not in the spec — flag these at the Codex review)

| # | Decision | Why |
|---|---|---|
| D-a | Idempotency key mismatch (wrong user or endpoint) → `E_FORBIDDEN` | The key is not the caller's to use. One rule for both cases; either way the client must resend with a fresh key |
| D-b | `lf_invite_resolve(token_hash)` keeps ONE parameter | `02` §4-3-3 is pre-login. EC-B02's participant redirect needs an identity and belongs to the post-login route |
| D-c | Server-only RPCs are SECURITY **INVOKER** | All five shipped ones are; `service_role` has BYPASSRLS so definer adds nothing and turns a future stray grant into a full leak instead of an empty result. Deviates from the plan's D1 wording |
| D-d | `lf_promise_approve` rejects WITNESS tokens with `E_FORBIDDEN` | `02` §4-5-1: "증인의 서명 여부는 상태 전이에 어떠한 영향도 주지 않는다". Witness acceptance is a different action (M3). The raise rolls back, so the witness invite stays PENDING and remains usable |
| D-e | End-date guard passes when `end_date >= today (KST)` | CHECKING starts at 00:00 KST the **day after** end_date (`02` §2-2), so the end date itself is still a day to keep. `validation.ts`'s `D >= 1` docstring claims T-03 re-validation — that claim is wrong and the docstring should be corrected |
| D-f | EC-B10 raises `E_VALIDATION` | The spec assigns no code. Sibling case EC-E03 uses it; the other three step-2 codes are all 422. `E_STATE_CONFLICT` would be a lie — the calendar moved, not the state |
| D-g | `E_BLOCKED` checks **both** directions | §4-3-5 says "차단 관계 없음" — a relation, not a direction |
| D-h | Creator's `approvals` row: `surface='APP'`, `ip_hash`/`ua_hash` NULL | Those were never collected at invite dispatch. Copying the accepter's values would plant a record of a request the creator never made |
| D-i | Creator's `acted_at` = the **accepted** invitation's `created_at` | Resends revoke the previous token, so only the accepted link represents live consent |
| D-j | Approve also cancels pending `INVITE_EXPIRE_SOON` reminders | Not in the ten steps. §8-2 cancels only on terminal transitions and ACTIVE is not terminal, so J-01 would send "초대가 곧 만료돼요" for an already-confirmed promise |
| D-k | Step 10 increments `activated_count` only | §4-3-5 names only that counter. J-07 also updates `daily_metrics`, so incrementing both places would double-count |

## What the tests cannot prove here

PGlite is a single in-process connection, so **no two transactions can interleave**. EC-B06
(simultaneous accept), EC-C01 (double tap) and EC-C03 (revoke racing accept) are covered only by
sequential reproduction plus structural assertions (`for update of` and `used_at is null` source
tripwires, the `promise_participants` partial unique indexes, the `idempotency_keys` primary key).

`02` §13 requires these to be verified with parallel requests, and `02` §11-1 marks the
confirmation transaction P0. **This is an unmet acceptance item**, not a passed one. After
`supabase db push`, add `supabase/tests/concurrency.pg.test.ts` driving two real `pg` clients.

Also untested here: the §11-2 p95 budget, and the actual delivery/retry of step 9 (that lives in
the B1-6 shell).

## Mutation testing

Every guard was broken one at a time and the suite re-run: **B1-2 eleven mutations, B1-3 fifteen,
B1-4 twenty-eight — all caught.** Four escaped on the first pass and each exposed a real gap:
the per-function privilege assertion (finding 1), the UTC pin and the date-source tripwire
(finding 2), a `stable` declaration no behavioural test could observe (`pg_proc.provolatile`), and
the `used_at is null` conditional that only matters under real concurrency.

## The exact next step

**B1-5 — `lf_promise_decline` and `lf_promise_amend_suggest`.** Same token, two endings:
T-04 → `DECLINED`, T-05 → `DRAFT`. Both consume the invitation (`USED`), write an `approvals` row
(`DECLINE` / `AMEND_SUGGEST`), and notify the creator. Amend-suggest additionally records the
partner's `user_id` in `promise_participants` and requires a 5–300 character comment.

Reuse the shape of `lf_promise_approve`: idempotency claim first, `for update of i` on the
invitation, identical status-before-clock guard order, notification left to the shell. The
`E_SELF_INVITE` / `E_BLOCKED` / witness guards apply the same way; the end-date guard does **not**
(declining an expired-end-date promise must stay possible — confirm against `02` §4-3-4).

Then B1-6, the four Edge Function shells, whose only jobs are JWT → validate → RPC → map the
Postgres error message to the `02` §2-3 code and HTTP status. `_shared/errors.ts` imports
`packages/shared/src/errors.ts` by relative path — it does not copy it.

## PO 확인 필요 (carried forward + new)

1. **`token_hash` pepper.** `02` §6-2 says `SHA-256(token)`; the schema comment and `04` §9 say
   `SHA-256(token + pepper)`. Does not block the RPCs — they receive a finished `char(64)` — but if
   the issuing path and the resolving path disagree, **every valid link fails as `E_NOT_FOUND` with
   no other symptom**. Must be settled before B1-6.
2. **ADR 0003 is still unwritten.** It must record the Postgres-RPC architecture (the deliberate
   `04` §7-3 deviation) and D-c above. Needed before the Codex review.
3. **`notifications.dedupe_key` format.** `{promise_id}:{type}:{yyyymmdd}` breaks the moment one
   event produces a row per channel — NT-01 is PUSH + INAPP to the creator, so the second insert
   violates the UNIQUE. Suggest `{promise_id}:{type}:{user_id}:{channel}:{yyyymmdd}` (KST).
   B1-6 scope, but decide before writing the shell.
4. **SCR-W06 copy.** The approved markup merges expired and used into one sentence and names the
   creator; `02` §4-3-3 requires per-reason copy. The RPCs return no payload on any failure path.
5. **SCR-W01 headline addresses the recipient by name** — unbuildable pre-login, no such field
   exists. Default: drop the vocative.
6. Carried over, unchanged: **Actions secrets still unset** (keep-alive not running, Supabase Free
   pauses after 7 idle days); `supabase db push` deferred until the Edge Functions are done;
   NT-04/NT-05 quiet-hours classification missing from §8-3; blinded-evidence copy differs between
   §4-8 and EC-F06.
