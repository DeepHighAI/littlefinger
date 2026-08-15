# M2 SCR-A07 Notification Inbox Implementation Plan

## Goal

Build the authenticated Android notification inbox defined by detailed specification section
4-6-3. The screen lists the current user's INAPP notifications newest first, distinguishes unread
items without relying on color alone, marks one or all items as read through server-owned APIs,
and navigates only to the existing allowlisted app routes.

F-06 remote deployment and Android push UAT remain gated by the Supabase Management API 403. This
plan may complete locally without claiming that live notifications reach a device.

## Shared contract and policy

- Add `NOTIFICATION_RETENTION_DAYS = 90` to shared policy configuration.
- Add `NotificationInboxItem`, `NotificationInboxListRequest/Response`,
  `NotificationReadRequest/Response`, and `NotificationReadAllResponse`.
- Inbox items expose only `notification_id`, `promise_id`, event, title, body, allowlisted
  deeplink, `created_at`, and `read_at`. Dedupe keys, delivery failures, tokens, and internal
  channel state never leave the server.
- Add `notification-inbox`, `notification-read`, and `notification-read-all` endpoint slugs.
- Reuse the same deeplink-to-route mapping as push navigation so the inbox cannot acquire a second
  routing policy.

## TDD sequence

### Task 1: Contracts and database RPCs

- RED: list isolation, INAPP-only filtering, newest-first ordering, 90-day boundary, cursor
  pagination, unread count, non-owner read rejection, repeated single read, and repeated read-all.
- GREEN: add SECURITY DEFINER RPCs with an empty search path:
  `lf_notification_inbox_list`, `lf_notification_read`, and `lf_notification_read_all`.
- Direct UPDATE remains unavailable to `authenticated`; only the read RPCs mutate `status/read_at`.
- Add an idempotent daily retention function and one replace-by-name cron job that deletes
  notifications older than 90 days. Run it twice at the same time in PGlite tests.

### Task 2: Edge Functions and mobile API

- RED: JWT validation, request shape, UUID idempotency header for mutations, not-found flattening,
  unknown-error flattening, and response privacy.
- GREEN: implement pure `handler.ts` plus thin `index.ts` for the three endpoints and add mobile
  API wrappers. List is read-only; single-read and read-all use `Idempotency-Key`.
- A read failure never fabricates local server state. The item may still navigate, and a later list
  refresh shows the authoritative unread state.

### Task 3: SCR-A07 mobile screen

- RED: loading, empty, retryable error, newest-first sections, KST today/yesterday/earlier grouping,
  relative time, unread text/dot emphasis, single read, read-all, duplicate tap suppression, and
  allowlisted navigation.
- Port the approved 360x800 notification list using existing tokens and `LfAppBar`/`LfIcon`.
- Add `/notifications` to the protected stack and a 48dp notification action in SCR-A02.
- Item taps optimistically remove unread emphasis and navigate immediately while the read request
  runs. A rejected request is reconciled on the next refresh.
- SCR-A05's top badge remains part of the full SCR-A05 implementation; no placeholder badge is
  added here.

### Task 4: Verification and deployment gate

- Run focused PGlite, Edge Vitest, and mobile Jest suites through RED -> GREEN -> refactor.
- Run `npm test`, `npm run typecheck`, `npm run build:web`, `npm run check:agents`,
  `npx expo install --check`, Android production export, and `git diff --check`.
- Compare SCR-A07 at 360x800 against the frozen design reference. Record empty/error/older-date
  states as intentional additions.
- Commit contracts/database, Edge/mobile API, and screen work atomically on `main`.
- Do not deploy while migration/function listing returns 403. After access is restored, apply the
  committed migration, deploy the three functions with `--use-api`, verify one retention cron and
  RLS, then perform development-build UAT.

## Excluded

- SCR-A08 reminder settings
- Full SCR-A05 and its unread badge
- Email delivery
- NT-15 through NT-18 producers
- Operational alerting for failed queues and stale leases
- `supabase config push`, an unsolicited origin push, or changes to
  `.claude/settings.local.json`
