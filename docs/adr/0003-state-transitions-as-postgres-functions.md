# ADR 0003 — Run state transitions as Postgres functions, not as Edge Function logic

- Status: Accepted
- Date: 2026-07-26
- Amends: `04_AI-Agent_코딩가이드` §7-3, which places this logic inside Edge Functions
- Deciders: PO (대표)

## Context

`02_세부기능명세서` EC-C02 requires the confirmation transition to be **all-or-nothing**: "알림/푸시
이외의 모든 단계는 하나의 트랜잭션. 실패 시 전체 롤백." §4-3-5 then lists ten steps that must land
together — a conditional status update, a participant row, two `approvals` rows, a version
activation with its `content_hash`, the invitation being consumed, four reminder schedules, and a
metrics counter.

Two of those tables are append-only by policy (`approvals`, `promise_versions`) and have no UPDATE
or DELETE policy at all. **A partial write there cannot be repaired** — there is no path, at any
privilege level, that removes a row once it exists. So "roll back on failure" is not a quality
goal here; it is the only way the records of two people stay consistent with each other.

`04` §7-3 assumed this logic would live in an Edge Function calling Supabase. It cannot: the
supabase-js client issues one statement per call over PostgREST, each in its own implicit
transaction. There is no `begin`/`commit` around a sequence of client calls, and no `SELECT … FOR
UPDATE` — which §7-3.3 requires by name for invite acceptance. An Edge Function written that way
would satisfy every step of §4-3-5 and still violate EC-C02 on the first mid-sequence failure.

## Decision

**Each state transition is a single Postgres function (`lf_*`), called by a thin Edge Function.**

The function boundary is the transaction boundary. Postgres opens a transaction for the call and
commits it on return, so every statement inside — locks included — is one atomic unit, and any
`raise` rolls the whole thing back.

The split of responsibility:

| Layer | Owns |
|---|---|
| Edge Function | JWT → `user_id`, request shape, calling the RPC, mapping the raised message to the `02` §2-3 error code and HTTP status, and sending notifications **after** the commit |
| Postgres function | Locking, every guard, every write, the response payload |

Consequences that follow from putting the boundary there:

1. **Notifications stay outside.** EC-C02 exempts them, and they are not rollback-able. The RPC
   writes no `notifications` row; it returns a payload rich enough (partner nickname, profile image)
   for the shell to build the notification without a second query.
2. **`content_hash` is generated inside the RPC** (`lf_content_hash`), not in the Edge Function as
   `04` §7-3 says. The intent of that clause is that a client cannot forge the hash. Postgres is
   further inside than the Edge Function, and being in the same transaction means the hash and the
   status transition cannot diverge.
3. **Every `lf_*` function is `SECURITY INVOKER`, not `DEFINER`.** `service_role` already holds
   `BYPASSRLS`, so `DEFINER` buys nothing for the intended caller. What it would buy is a much worse
   failure mode: if a `grant execute` ever leaks to `anon` or `authenticated`, an INVOKER function
   returns empty results under RLS, while a DEFINER function returns everything.
4. **`revoke` must name three roles, not one.** Supabase runs `alter default privileges in schema
   public grant all on functions to anon, authenticated, service_role`, so those roles hold EXECUTE
   independently of `PUBLIC`. `revoke … from public` alone leaves a server-only function callable
   with the `anon` key. Every server-only function is revoked `from public, anon, authenticated`
   and granted only to `service_role`, and the tests assert this per function with
   `has_function_privilege` — a behavioural "it threw" check is satisfied by a neighbouring
   function's revoke and hides a missing one.

## Consequences

**What this costs.** Business rules now live in SQL, which is harder to unit-test than TypeScript
and cannot import `packages/shared`. Any policy number or rule that exists on both sides —
`IDEMPOTENCY_TTL_MIN`, `REMINDER_OFFSETS_DAYS`, `REMINDER_SEND_HOUR_KST`, the `§2-3` input
normalization rule, the `§5-3` length limits — is duplicated. The mitigation is a cross-check test
per pair: `supabase/tests/*.test.ts` runs the SQL against the TypeScript definition and fails when
they drift. `lf_normalize_input` is compared to `normalizeInput` output-for-output rather than by
reading its constants, because agreement is the property that matters.

**What it buys beyond atomicity.** The rules apply to every caller. A future admin script, a batch
job, or a second Edge Function cannot reach a transition without passing the same guards, because
the guards are not in the caller.

**What it does not fix.** PGlite, the test harness, is a single in-process connection, so no two
transactions can interleave. The concurrency cases (EC-B06 simultaneous accept, EC-C01 double tap,
EC-C03 revoke racing accept) are covered only by sequential reproduction plus structural assertions
on the locks and unique indexes. `02` §13 requires them to be verified with parallel requests —
that remains an open acceptance item until a test drives two real `pg` clients after `db push`.

**Where the transaction boundary does not stretch.** Anything the RPC cannot roll back stays out of
it: push delivery, storage writes, and third-party calls. If one of those has to happen as part of
a transition, it happens after the commit and is made idempotent by its own key.
