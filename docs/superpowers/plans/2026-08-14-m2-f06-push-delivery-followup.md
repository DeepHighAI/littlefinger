# M2 F-06 Push Delivery Follow-up Implementation Plan

> Approved by the PO on 2026-08-14. This plan follows `main@5f4e48f`.

## Goal

Complete the remaining F-06 push delivery path in two stages: first the durable server outbox, Expo ticket/receipt worker, and recovery scheduling; then Android notification receipt and allowlisted navigation. Local implementation and verification may complete while Supabase Management API access returns 403, but deployment and remote UAT must remain explicitly incomplete.

## Completed Baseline

- Notification contracts and per-device push fanout
- Recipient and device-token snapshot locking
- J-01 scheduled reminder dispatch and quiet-hour deferral
- Focused baseline tests: 38/38 passing

## Global Constraints

- Work on the explicitly authorized `main` branch and leave atomic commits.
- Follow strict TDD: RED, confirm the expected failure, minimal GREEN, regression, refactor.
- Shared TypeScript is the only renderer for notification titles and deeplinks. SQL stores only the event and template arguments.
- `PushNotificationData` serializes only `notification_id`, `deeplink`, and `promise_id`.
- Never log or return Expo tokens, payloads, secrets, promise content, or credentials.
- Internal `push-send` uses `verify_jwt=false` and authenticates only `x-push-send-secret`.
- Do not run `supabase config push`, do not push `origin`, and do not change or commit `.claude/settings.local.json`.
- Stop at local commits while Supabase migration/function listing returns Management API 403; do not claim deployment or UAT.
- User-facing strings remain Korean label constants. Code and documentation remain English; code comments remain Korean.

### Task 1: Documentation and Policy Alignment

- Update `docs/DEVELOPMENT_STATUS.md` to the 2026-08-14 `main` baseline.
- Update detailed specification section 8-3 so NT-04 is deferred to the next 08:00 KST during 21:00-08:00 KST quiet hours.
- Remove the stale “INAPP only” notification comment and correct stale F-07 test naming.
- Add `TODOS.md` with a P2/M infrastructure item for automatic alerts covering FAILED queues, stale leases, and cron failures after F-06 deployment.
- Reconcile the prior F-06 SDD ledger with commits `252809b` and `5f4e48f` without re-running completed implementation.
- Commit: `docs: refresh F-06 status and notification policy`

### Task 2: Durable Notification Outbox

- Add internal `notification_outbox` with status `PENDING | LEASED | PROCESSED | FAILED`.
- Store recipient, promise, event, template arguments, body snapshot, per-channel dedupe keys, attempt count, `lease_id`, lease expiry, next-attempt time, error code, and processing timestamps.
- Revoke all direct Data API access.
- Add `lf_notification_outbox_claim`, `lf_notification_outbox_record`, and `lf_notification_outbox_requeue`.
- Approval, decline, amend proposal, fulfillment submission, closure, and reopen transitions must create an outbox intent in the same transaction as the state change.
- Remove post-commit Edge `insertNotification` calls.
- Change J-01 so a schedule becomes `SENT` only when its outbox intent is committed.
- The consumer renders title/deeplink through the shared TypeScript contract before calling `lf_notification_fanout`.
- Retry the outbox after 60 seconds, 5 minutes, and 15 minutes; preserve it as `FAILED` after the third retry. Only the internal requeue RPC may retry a FAILED item.
- Cover atomicity, dedupe, all retry steps, FAILED, requeue, transition idempotency, and the J-01 no-loss regression with PGlite tests.
- Commit: `feat: add durable notification outbox`

### Task 3: Fenced Expo Push Delivery

- Add `lease_id` to `push_deliveries` and rotate it on every claim.
- Add `lf_push_claim_deliveries`, `lf_push_record_tickets`, `lf_push_claim_receipts`, `lf_push_record_receipts`, `lf_push_refresh_notification_status`, and `lf_schedule_push_send`.
- Ticket and receipt results are accepted only when the current `lease_id` matches; stale workers cannot mutate a delivery.
- `attempt_count` counts Expo send attempts only.
- Add a pure `push-send/handler.ts` and thin `index.ts`. Authenticate `x-push-send-secret` with `verify_jwt=false`.
- Per invocation, use this order and cap: receipts <=1,000, outbox <=100, due reminders <=200, new deliveries <=500.
- Apply a 45-second invocation budget and 10-second timeout per Expo HTTP request.
- Send in chunks of 100 and request receipts in chunks of 1,000.
- Retry only send attempts without a ticket after 60/300/900 seconds. Never resend after an Expo ticket ID exists.
- First eligible receipt lookup starts after 15 minutes. A missing receipt at that lookup becomes permanent `ReceiptUnavailable` failure.
- Delete the matching device token for `DeviceNotRegistered`.
- Retry HTTP 429/5xx, network failures, and `MessageRateExceeded`. Permanently fail payload and credential errors.
- Record each ticket/receipt result array and notification aggregation in one RPC transaction.
- Return only per-stage counts and keep logs free of secrets and payload data.
- Test secret authentication, stage order/caps, chunking, budgets, timeouts, retry/permanent errors, fencing, token reassignment, partial aggregate success, and safe logs.
- Add a PGlite plus real-handler integration test using mocked Expo HTTP for outbox -> ticket -> receipt -> notification aggregation.
- Commit: `feat: add fenced Expo push delivery`

### Task 4: Trigger and Cron Recovery

- On outbox INSERT, use `pg_net` with Vault `push_send_url` and `push_send_secret` to invoke `push-send`.
- Do not create a separate PUSH-row trigger; outbox is the sole notification producer.
- Add one idempotently replaced `*/10 * * * *` cron job that recovers outbox work, expired leases, unsent deliveries, and pending receipts through the same worker.
- Follow the official Supabase `pg_cron + pg_net + Vault` scheduled-function pattern.
- Add `[functions.push-send] verify_jwt = false` to `supabase/config.toml`.
- Verify repeated migration/job setup keeps one cron job and repeated worker execution is idempotent.
- Commit: `feat: schedule reliable push delivery`

### Task 5: Android Push Receipt and Navigation

- Define `NotificationDeeplink = 'SCR-A03' | 'SCR-A04' | 'SCR-A05' | 'SCR-A06'` and restrict serialized push data to the three approved fields.
- Register the foreground presentation handler during app module initialization.
- Handle cold start with `getLastNotificationResponseAsync()` and runtime taps with a response listener, then clear the native last response.
- Navigate each `notification_id` at most once per process.
- Allowlist routes: SCR-A03 -> `/promise/edit`, SCR-A04 -> `/invite`, SCR-A06 -> `/fulfillment/[promise_id]`, SCR-A05 -> `/home`.
- Ignore invalid UUIDs, unknown screens, arbitrary URLs, or extra payload navigation fields and keep the current/home route.
- While logged out, encrypt the approved destination through `LargeSecureStore`; restore it exactly once after session recovery.
- Test foreground, background/runtime tap, cold start, duplicate IDs, invalid UUID, unknown screen, arbitrary URL, logged-out persistence, and one-time post-login restoration with mobile Jest.
- Remote notification UAT must use an Android development build, not Expo Go.
- Commit: `feat: handle Android push navigation`

### Task 6: Verification and Deployment Gate

- Run focused shared, PGlite, Edge, integration, and mobile tests.
- Run `npm test`, `npm run typecheck`, `npm run build:web`, `npm run check:agents`, `npx expo install --check`, Android production export, and `git diff --check`.
- Perform a broad final code review covering the entire follow-up diff.
- If Supabase Management API still returns 403, stop before migration, secrets, Vault, function deployment, cron verification, and Android UAT. Report these as incomplete.
- Once access is restored in a later authorized run: re-read remote migration/function lists, apply committed migrations, set Edge/Vault secrets without printing values, deploy `push-send --use-api`, verify one cron job and private tables, then run Android foreground/background/terminated UAT.

## Excluded

- SCR-A07 inbox and read state
- SCR-A08 reminder-settings UI
- Full SCR-A05 detail
- Email collection or delivery
- NT-05 and NT-15 through NT-18
- F-01 terms and legal documents
- Automated operational alert implementation
- `.claude/settings.local.json`
