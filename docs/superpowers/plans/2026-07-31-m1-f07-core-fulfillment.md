# M1 F-07 Core Fulfillment Loop Implementation Plan

## Summary

Implement the final M1 core-loop feature from the specification: `SCR-A06`, `SCR-W04`, and the
`ACTIVE → CHECKING → terminal result` lifecycle. The second fulfillment response transaction owns
the result decision. J-02 and J-03 own scheduled CHECKING entry and timeout handling.

This scope includes:

- J-02 `ACTIVE → CHECKING` at the KST date boundary.
- Creator and partner fulfillment responses, one revision, and concurrency-safe result decisions.
- `COMPLETED`, `BROKEN`, `DISPUTED`, and `UNRESOLVED`.
- Unlimited DISPUTED recheck rounds.
- App SCR-A06, account-based web SCR-W04, minimal SCR-A02 status integration, and the SCR-W03
  account revisit link.
- Trust-profile data updates and INAPP notification records.

Evidence uploads, full SCR-A05, MOD-03, the notification inbox, push delivery, quiet hours, F-11,
and email collection are excluded.

## Public Contracts and Data Changes

- Add `ParticipantPromiseSummary`, fulfillment detail/submit/reopen request and response types,
  `FulfillmentCheckView`, validation fields `answer`, `comment`, and `revise`, and the endpoints
  `participant-promise-list`, `promise-fulfillment-detail`, `fulfillment-submit`, and
  `fulfillment-reopen`.
- Add the app route `/fulfillment/[promise_id]` and the web route `/promises`.
- Detail responses include the current round, deadline, caller response, counterpart submission
  state, and round history. An unsubmitted caller cannot read the counterpart answer.
- Add SQL functions:
  - `lf_participant_promise_list`
  - `lf_promise_fulfillment_detail`
  - `lf_fulfillment_submit`
  - `lf_fulfillment_reopen`
  - `lf_promises_enter_checking`
  - `lf_promises_close_due_checks`
  - `lf_recompute_trust_profile`
- Enable `pg_cron`. Register J-02 at `10 15 * * *` GMT and J-03 at `20 15 * * *` GMT with stable
  job names so repeated migrations cannot create duplicate jobs.

## TDD Tasks

### Task 1: Shared contracts and database lifecycle

- RED: unauthorized reads, pre-CHECKING submissions, NFC/comment validation, first submission,
  explicit one-time revision, revision limits, and revision after the counterpart response.
- RED: concurrent second submissions for KEPT/KEPT, NOT_KEPT/NOT_KEPT, and mismatched answers.
- GREEN: lock the promise row, save the current-round response, and decide the result only when
  the second response commits.
- `revise=true` is required to update an existing row. Same-key retries return the cached result;
  a new key cannot silently become a revision.
- `COMPLETED` and `BROKEN` update `closed_at`, KST daily metrics, and trust profiles in the same
  transaction.

### Task 2: J-02, J-03, and recheck rounds

- J-02 stores the scheduled KST midnight as `checking_started_at`, sets the exact seven-day
  deadline, and creates CHECK_REQ/CHECK_R1/CHECK_R2 schedules for 09:00 KST, +2 days, and +5 days.
- A first-round timeout becomes `UNRESOLVED`. A later-round mismatch or timeout remains
  `DISPUTED`.
- Reopening increments the round, sets a server-time-plus-seven-day deadline, and preserves every
  prior round.
- Running each batch twice for the same time must not duplicate transitions, schedules,
  notifications, or metrics.

### Task 3: Edge Functions and notifications

- Implement pure `handler.ts` files and thin `index.ts` entry points.
- Authenticate JWT, validate request shape, derive surface from `Origin`, call RPC, flatten unknown
  failures, and require idempotency for mutations.
- Add NT-09, NT-11 through NT-14, and NT-19 contracts and dedupe keys.
- Write INAPP rows only. Notification failure after a committed transition cannot fail the API
  response. NT-08/NT-10 delivery stays in M2.

### Task 4: App SCR-A06 and minimal home integration

- RED: answer selection, CTA state, optional comment, KST deadline, waiting state, one revision,
  terminal conflict, neutral DISPUTED claims, and reopen.
- Port SCR-A06 with the specification-required comment field and no evidence block.
- Merge participant summaries into SCR-A02. CHECKING opens SCR-A06; ACTIVE and terminal states are
  minimal status cards.
- Use label constants and theme tokens. Render no ads.

### Task 5: Web SCR-W04 and account revisit

- RED: session restoration, Kakao OAuth with `/promises` return, actionable ordering,
  submit/revise/reopen, and refresh restoration.
- Extract reusable web Kakao sign-in behavior from W01.
- Render account-based W04 cards and neutral result/history views.
- Add the SCR-W03 account revisit copy and `/promises` link.
- Keep AMEND_PENDING read-only in this scope.

## Verification and Delivery

- Run focused Vitest/PGlite/Jest tests after every RED/GREEN cycle.
- Run `npm test`, `npm run typecheck`, `npm run build:web`, `npm run check:agents`,
  `npx expo install --check`, Android production export, and `git diff --check`.
- Compare SCR-A06 and SCR-W04 against the 360×800 references. Record the omitted evidence block and
  added comment field as intentional differences.
- Commit atomic units directly to `main`.
- Apply the committed migration, deploy all four Edge Functions individually with `--use-api`, and
  never run `supabase config push`.
- Verify remote cron jobs, RPCs, Edge Functions, and idempotent batch execution.
- A real two-party UAT requires a second Kakao account. Without it, report automated validation and
  leave two-account UAT explicitly pending.
- Preserve and exclude `.claude/settings.local.json`.
