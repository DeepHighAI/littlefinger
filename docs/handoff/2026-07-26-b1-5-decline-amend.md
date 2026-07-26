# Handoff — B1-5 (+ ADR 0003)

Date: 2026-07-26. Follows `2026-07-26-b1-invite-approve.md`.

## Status

**B1-5 complete.** `npm test` → Vitest **543 passed** (15 files, 121 new), jest-expo **137 passed**.
`npm run typecheck` clean, `npm run check:agents` clean. Committed to `main` as
`13248cb feat: add the decline and amend-suggest transitions`. Not pushed.

**ADR 0003 written** — closes item 2 of the previous handoff's PO list. B1-6 (Edge Function shells)
is untouched.

| File | What |
|---|---|
| `…0007_promise_decline_amend.sql` | `lf_normalize_input`, `lf_invite_lock_for_response`, `lf_promise_decline` (T-04), `lf_promise_amend_suggest` (T-05) |
| `supabase/tests/promise-decline-amend.test.ts` | 121 tests |
| `docs/adr/0003-state-transitions-as-postgres-functions.md` | the Postgres-RPC architecture and its four consequences |

## The one thing that must not regress

**Neither function checks the end date.** EC-B10 disables the approve button when the end date has
passed and offers [종료일 변경 요청하기] — which *is* the amend-suggest flow. A end-date guard here
closes the only exit and traps the promise in PENDING forever. Three tests hold this: amend and
decline both succeed at `endDateOffsetDays: -1`, and approve on the same fixture still raises
`E_VALIDATION`. Mutation M22 (adding the guard) is caught.

## Decisions taken (not in the spec — flag these at the Codex review)

| # | Decision | Why |
|---|---|---|
| D-l | `DECLINE` sets `promises.closed_at` | T-04's side-effect list omits it, but §2-4 makes DECLINED a **완전 종결** state and §6-2 defines the column as "종결 시각". Leaving it null creates a terminal row with no terminal time |
| D-m | Both actions write the **recomputed** `content_hash` and `version_id` into their `approvals` row | Not required by T-04/T-05. After T-05 the creator rewrites v1 in place, so this row becomes the only record of *which text* was objected to. The DRAFT hash is client-supplied and untrusted, so it is recomputed |
| D-n | Guards extracted to `lf_invite_lock_for_response`; **`lf_promise_approve` still has its own copy** | The order must be identical across all three or a landing screen and a response call disagree about one token. Approve is already shipped and mutation-tested, and its `for update of` tripwire test points at its own body — folding it in now means rewriting the most expensive function to accommodate a refactor. A cross-RPC test runs all three over nine token states instead. **Follow-up: fold approve in and relocate the tripwire** |
| D-o | `lf_normalize_input` ports §2-3 into SQL | The RPC stores the field, so it owns what gets stored — it cannot assume the caller normalized. Cross-checked against `normalizeInput` output-for-output over 15 adversarial inputs rather than by comparing constants |
| D-p | Length validation runs **after** the token and responder guards | Same position approve gives its end-date check. Someone who wrote a long reason on an expired link needs to hear "expired", not "too long" |
| D-q | Decline cancels **all** PENDING schedules; amend cancels only `INVITE_EXPIRE_SOON` | §8-2 cancels everything on a terminal transition, and DECLINED is terminal. DRAFT is not, so amend only kills the one notification that became a lie — the invitation it refers to is consumed (same reasoning as D-j) |
| D-r | Amend records the partner as `PARTNER` / **`INVITED`**, `joined_at` null | T-05 requires the user_id "재발송 시 직접 알림용". They have not joined; `JOINED` would make a DRAFT promise look like it already has a partner |
| D-s | Neither touches `daily_metrics` nor creates D-7/D-3/D-1/D-Day rows | Both are ACTIVE-transition effects (§4-3-5 step 8·10). Tests assert the counters and the schedule table stay untouched |
| D-t | Length violations raise `E_VALIDATION` | §2-3 assigns 422 to field validation. Consistent with EC-B10's code (D-f) |
| D-u | Idempotency endpoints are `promise-decline` and `promise-amend` | Matches `04` §7-3's function names. They must differ — sharing one lets a decline response leak into an amend request (mutation M30) |

## Mutation testing — 34 mutations, 34 caught

Three escaped on the first pass and each was a real hole, not a false alarm:

1. **M14 · M24 — the participant `UPDATE` branch was never executed.** Every test hit the `INSERT`
   branch because no PARTNER row existed yet. The update path only runs on the second round
   (amend → resend → respond), and the test that walked it asserted only "no error". It now asserts
   the resulting `user_id` and status.
2. **M30 — the endpoint-mismatch test proved nothing.** It called decline and amend with the same
   key but **different users**, so `lf_idempotency_begin` raised `E_FORBIDDEN` on the user check
   alone; the endpoint could have been ignored entirely. Rewritten to reuse one partner across two
   promises.

Also caught, worth knowing they bite: NFC→NFD, control-strip removal, `btrim`-equivalent trimming,
clock-before-status ordering, one-directional block check, lock removal, unconditional state
UPDATE, `used_at is null` removal, counting length before normalizing, and a single missing
`revoke` line.

## What the tests still cannot prove

Unchanged from B1-4: PGlite is one in-process connection, so EC-B06 / EC-C01 / EC-C03 have no real
parallel coverage — only sequential reproduction plus structural assertions. `02` §13 requires
parallel verification. **Still an unmet acceptance item.** After `supabase db push`, add
`supabase/tests/concurrency.pg.test.ts` driving two real `pg` clients, and cover all three RPCs.

## The exact next step

**B1-6 — the Edge Function shells.** `invite-resolve`, `promise-approve`, `promise-decline`,
`promise-amend`. Each does JWT → validate → RPC → map the raised Postgres message to the `02` §2-3
code and HTTP status. `_shared/errors.ts` imports `packages/shared/src/errors.ts` by relative path;
it does not copy it. Notifications (NT-01·NT-02·NT-03) are built from the RPC payload **after** the
commit — every payload already carries the partner's nickname and profile image for exactly this.

Settle PO items 1 and 2 below before writing the shells.

## PO 확인 필요

**New:**

1. **재발송 대상이 바뀌면 새 상대는 참여할 수 없다.** T-05 records the amend-suggester's `user_id`
   as the PARTNER row. If the creator then sends the new link to a *different* person, that person
   gets `E_DUPLICATE_ROLE` — the single-partner unique index leaves no seat. Inherited from approve
   (shipped in B1-4), so this is not new behaviour, but nothing in `02` covers it. Options: replace
   the row when the promise is back in DRAFT, or keep it and give SCR-A03 an explicit "다른 사람에게
   보내기" action.
2. **EC-B09's 3-day DRAFT reminder has no `reminder_kind`.** The enum has `AMEND_REMIND` (for F-11
   `amend_requests`, per §8-2) but nothing for "작성 중인 약속이 있습니다" after a 수정 제안.
   §8-2's schedule table does not list it either. **Not implemented** — anything outside the
   transition table is not implemented. Needs either a new enum value or a decision to drop EC-B09's
   reminder.
3. **A DECLINED promise can still hold a live witness invitation.** T-04 consumes only the token
   that was used. A PENDING witness token on a terminal promise still resolves on SCR-W01 (title +
   creator nickname); EC-D04 blocks the actual join with `E_STATE_CONFLICT`. Minor, but the spec
   never says whether terminal transitions revoke sibling invitations.

**Carried forward, unchanged:**

4. **`token_hash` pepper** — `02` §6-2 says `SHA-256(token)`, the schema comment and `04` §9 say
   `SHA-256(token + pepper)`. Must be settled before B1-6: if the issuing and resolving paths
   disagree, every valid link fails as `E_NOT_FOUND` with no other symptom.
5. **`notifications.dedupe_key` format** — `{promise_id}:{type}:{yyyymmdd}` breaks as soon as one
   event produces a row per channel (NT-01 is PUSH + INAPP to the creator → UNIQUE violation).
   Suggest `{promise_id}:{type}:{user_id}:{channel}:{yyyymmdd}` (KST). Decide before writing the shell.
6. **SCR-W06 copy** — the approved markup merges expired and used into one sentence and names the
   creator; `02` §4-3-3 requires per-reason copy. The RPCs return no payload on any failure path.
7. **SCR-W01 headline addresses the recipient by name** — unbuildable pre-login. Default: drop the
   vocative.
8. **Actions secrets still unset** — keep-alive not running, Supabase Free pauses after 7 idle days.
9. `supabase db push` deferred until the Edge Functions are done; NT-04/NT-05 quiet-hours
   classification missing from §8-3; blinded-evidence copy differs between §4-8 and EC-F06.
