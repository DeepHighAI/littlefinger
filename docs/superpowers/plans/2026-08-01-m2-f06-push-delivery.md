# M2 F-06 Push Notification Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or
> superpowers:executing-plans to implement this plan task-by-task. Every behavior change follows
> RED -> expected failure -> GREEN -> regression -> refactor.

**Goal:** Connect existing reminder schedules and Expo push tokens to reliable Android push
delivery, receipt processing, retries, quiet hours, and validated app navigation.

**Architecture:** Postgres owns notification fanout, due-reminder idempotency, delivery leases, and
aggregate status. An internal `push-send` Edge Function claims work, calls the Expo Push API, and
records tickets and receipts. The Android client validates screen IDs and promise IDs before
navigating, and encrypted storage preserves a pending target across authentication.

**Tech Stack:** PostgreSQL 17, Supabase Edge Functions, pg_cron, pg_net, Vault, Expo Push Service,
Expo SDK 57, React Native, Expo Router, TypeScript, PGlite, Vitest, and jest-expo.

## Global Constraints

- Write `docs/DEVELOPMENT_STATUS.md` before F-06 production code and keep project documents in English.
- Store no email delivery behavior in this scope; MVP delivery is PUSH plus INAPP only.
- Never expose push tables or internal RPCs through the Data API.
- Never log Expo tokens, notification payloads, promise titles, or internal secrets.
- Use KST for quiet-hour and reminder-date decisions; store timestamps as UTC.
- Preserve transition success when notification fanout or push delivery fails.
- Never run `supabase config push`; deploy Edge Functions with `--use-api`.
- Leave `.claude/settings.local.json` untouched and uncommitted.

---

### Task 1: Development Status and Roadmap

**Files:**
- Create: `docs/DEVELOPMENT_STATUS.md`

- [ ] Record the execution-time branch, origin divergence, untracked files, verified deployment
      snapshot, completed M0/M1/F-08 work, known incomplete work, two-account UAT gap, and M2-M4 order.
- [ ] Keep the document concise and mark snapshot facts with the verification date.
- [ ] Run `git diff --check` and commit as `docs: summarize development status and roadmap`.

### Task 2: Notification Contracts and Push Fanout

**Files:**
- Modify: `packages/shared/src/notification.ts`, `packages/shared/src/config.ts`
- Modify: `supabase/functions/_shared/notify.ts`, `supabase/functions/_shared/deps.ts`
- Create: additive migration and focused PGlite/shared tests

**Interfaces:**
- Add scheduled events NT-04 through NT-08 and NT-10 with canonical titles and screen IDs.
- Add validated push data `{ notification_id, deeplink, promise_id }`.
- Add `push_delivery_status` and private `push_deliveries` storage.
- Add `lf_notification_fanout` so INAPP is immediately SENT and PUSH exists only when tokens exist.

- [ ] Write and run failing tests for event contracts, channel-specific dedupe, zero/one/three-token
      fanout, duplicate fanout, and direct-access denial.
- [ ] Implement the minimum shared contract, migration, and Edge notification fanout refactor.
- [ ] Run focused tests, type checking, regressions, and commit as
      `feat: add notification push fanout`.

### Task 3: J-01 Due Reminder Dispatch

**Files:**
- Extend the Task 2 migration or add a following additive migration
- Add focused PGlite tests

**Interfaces:**
- Add `lf_dispatch_due_reminders(p_now timestamptz, p_limit integer)`.
- Map D7/D3/D1 to NT-06, DDAY to NT-07, CHECK_REQ to NT-08, CHECK_R1/R2 to
  NT-10, and INVITE_EXPIRE_SOON to NT-04.

- [ ] Write and run failing tests for not-due rows, due rows, explicit preference opt-out, missing
      tokens, 21:00-08:00 KST deferral, duplicate execution, and concurrent claims.
- [ ] Keep deferred schedules PENDING at the next 08:00 KST; cancel explicit opt-outs; mark SENT
      only after fanout commits. Leave AMEND_REMIND pending for F-11.
- [ ] Run focused tests and regressions and commit as
      `feat: dispatch scheduled promise reminders`.

### Task 4: Expo Tickets, Receipts, and Recovery Scheduling

**Files:**
- Create: `supabase/functions/push-send/handler.ts`, `supabase/functions/push-send/index.ts`
- Create: push runtime dependency module and Edge tests
- Modify: migration/config for internal function, pg_net trigger, Vault-backed cron

**Interfaces:**
- Add `lf_push_claim_deliveries`, `lf_push_record_tickets`, `lf_push_claim_receipts`,
  `lf_push_record_receipts`, `lf_push_refresh_notification_status`, and `lf_schedule_push_send`.
- Authenticate with `PUSH_SEND_SECRET`; optionally send `EXPO_ACCESS_TOKEN` when configured.

- [ ] Write and run failing tests for secret authentication, two-minute leases, 100-message chunks,
      ticket parsing, 15-minute receipt eligibility, 1,000-receipt chunks, three retries after the
      initial attempt, retryable/permanent errors, invalid-token deletion, safe logs, and aggregate
      notification status.
- [ ] Implement direct Expo HTTP calls, backoffs of 60/300/900 seconds, and receipt processing.
- [ ] Trigger prompt dispatch after PUSH insert and add one `*/10 * * * *` recovery cron job.
- [ ] Run focused tests, bundle/type checks, regressions, and commit the worker and scheduling in
      reviewable atomic commits.

### Task 5: Android Receipt Handling and Navigation

**Files:**
- Create: focused notification contract/navigation modules and Jest tests under `apps/mobile/src`
- Modify: `apps/mobile/src/app/_layout.tsx`

**Interfaces:**
- SCR-A03 -> `/promise/edit`; SCR-A04 -> `/invite`; SCR-A06 ->
  `/fulfillment/[promise_id]`; SCR-A05 -> `/home` until the detail screen exists.

- [ ] Write and run failing tests for foreground display, foreground/background/cold-start taps,
      duplicate IDs, malformed UUIDs, unknown screen IDs, arbitrary URLs, signed-out persistence,
      and post-login restoration.
- [ ] Register the foreground handler early, validate all push data, and store pending navigation
      only through `LargeSecureStore`.
- [ ] Run focused Jest, type checking, Expo dependency checks, and commit as
      `feat: handle Android push navigation`.

### Task 6: Verification, Deployment, and UAT

- [ ] Run focused contract, PGlite, Edge, and mobile tests.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build:web`, `npm run check:agents`,
      `npx expo install --check`, Android production export, and `git diff --check`.
- [ ] Apply committed migrations and configure `push_send_url`/`push_send_secret` in Vault plus
      `PUSH_SEND_SECRET` in Edge secrets without printing values.
- [ ] Deploy `push-send` with `--use-api`; never run `supabase config push`.
- [ ] Verify one cron job, private Data API access, double-run idempotency, ticket/receipt state,
      and Android foreground/background/terminated delivery and navigation.
- [ ] Treat real DeviceNotRegistered timing as non-deterministic: automated receipt fixtures are
      mandatory, and real observation is reported separately.

## Excluded

- Email collection or EMAIL delivery
- SCR-A07 inbox and read state
- SCR-A08 reminder settings UI
- Full SCR-A05 detail
- NT-05 and NT-15 through NT-18
- F-01 legal URLs, legal copy, and terms agreement recording
