# M3 F-09 Trust Profile and SCR-A08 Design

**Date:** 2026-08-17

**Status:** Approved for planning
**Scope:** Personal trust profile, reminder preferences, legal links, safe logout, and J-10

## Goal

Complete the app-only SCR-A08 flow. A signed-in user can inspect their own promise keep rate,
review the counts excluded from that rate, change reminder preferences, open the public legal
documents, read the fixed disclaimer, and log out without leaving the current device registered for
push notifications.

This work exposes no other user's trust profile. It does not add badges, rankings, email reminders,
block management, account withdrawal, or F-11 amendment actions.

## Chosen Architecture

Use dedicated Edge Functions backed by transaction RPCs. This design keeps profile privacy,
reminder rescheduling, idempotency, and device-token removal on the server.

The rejected alternatives are:

1. **Direct RLS reads and updates.** This would reduce the number of functions, but it could not
   update preferences and future schedules atomically.
2. **One action-based profile endpoint.** This would reduce the number of slugs, but it would mix
   read, preference mutation, and device lifecycle contracts in one handler.

The selected endpoints are:

- `trust-profile`: read the current user's profile and effective reminder preferences;
- `trust-profile-settings-update`: replace the complete reminder preference set and reschedule
  future promise reminders; and
- `device-token-unregister`: remove the current device's Expo token before local sign-out.

Each handler remains a pure `handler.ts` plus a thin `index.ts`. All three validate the Supabase JWT.
The two mutations also require a UUID `Idempotency-Key`.

## Public Contracts

The shared package adds these contracts:

- `ReminderHour = '09' | '12' | '20'`;
- `ReminderPreferences { remind_d7; remind_d3; remind_d1; remind_dday; remind_hour }`;
- `TrustProfileDetailResponse` with the current user's public profile fields, all trust counts,
  `keep_rate`, `updated_at`, and effective reminder preferences;
- `TrustProfileSettingsUpdateRequest { reminders }` and
  `TrustProfileSettingsUpdateResponse { reminders; updated_at }`; and
- `DeviceTokenUnregisterRequest { expo_push_token }` and
  `DeviceTokenUnregisterResponse { removed }`.

`TrustProfile` gains `activeCount`, which SCR-A08 displays as the ongoing count. The API uses the
repository's snake-case wire format and strict boundary parsers. It rejects unknown keys and never
returns `kakao_id`, email fields, `primary_surface`, or another user's identifier.

## Database Transactions

The migration adds three RPCs and one batch function:

### `lf_my_trust_profile`

The function requires an ACTIVE user and returns only that user's nickname, profile image, trust
cache, and effective reminder preferences. A missing cache row yields zero counts and a null
`keep_rate`; a read does not trigger a full recomputation. Fulfillment transitions already update
the cache in real time, and J-10 repairs drift.

An empty `notification_pref` object resolves to the documented defaults: all four reminders on and
hour `09`.

### `lf_trust_profile_settings_update`

The function locks the user row, validates the full preference object, runs the repository's
idempotency protocol, and replaces only the five allowed keys. It preserves unrelated future
preference keys.

When `remind_hour` changes, the same transaction recalculates `fire_at` for the user's PENDING
`D7`, `D3`, `D1`, and `DDAY` rows from each promise's current `end_date` in `Asia/Seoul`. If the new
time is already past, J-01 processes the row on its next run. Toggling a reminder does not delete a
schedule; J-01 consults the current preference when the schedule becomes due. This preserves the
ability to turn a future reminder back on.

### `lf_device_token_unregister`

The function deletes only the row whose `user_id` and Expo token both match the authenticated user.
A repeated idempotency key replays the first response. Another user's token remains undisclosed and
unchanged.

### `lf_recompute_all_trust_profiles`

J-10 takes one transaction advisory lock, scans ACTIVE users in UUID order, and calls the existing
per-user recomputation function. Two runs at the same instant produce the same rows and counts. The
function executes only as `service_role`.

A scheduler migration replaces any existing `lf-j10-trust-profile-recompute` job and registers one
cron entry at `0 18 * * *` UTC, which is 03:00 KST.

All new `SECURITY DEFINER` functions use an empty `search_path`, qualify every relation, and revoke
execution from `PUBLIC`, `anon`, and `authenticated`.

## Mobile Data Flow

The protected route `/profile` loads `trust-profile` through the existing authenticated mobile API
boundary. The home app bar exposes separate 48 dp notification and profile actions.

Changing a switch or reminder hour sends the complete next preference set with a fresh idempotency
key. The screen disables preference controls until the server responds. A failed update restores
the last confirmed set and shows a retryable error. Reload generations fence stale responses, so a
late initial request cannot overwrite a successful update.

Logout follows this order:

1. Read the last successfully registered Expo token from a user-scoped `LargeSecureStore` entry.
2. If the cache is absent on an upgraded installation, create the Android notification channel and
   attempt to resolve the current token with the configured EAS project ID without requesting
   permission.
3. Call `device-token-unregister` and require a successful response.
4. Sign out through Supabase Auth and remove the encrypted token cache.

The registration path writes the encrypted cache only after the server accepts the token. This
keeps logout correct when Android notification permission is revoked after registration. If token
resolution, unregister, or sign-out fails, the app keeps the session and asks the user to retry;
it does not silently leave a server token attached to a signed-out device. Non-Android clients do
not register Expo tokens and therefore skip the unregister step.

## SCR-A08 Presentation

SCR-A08 ports the frozen profile reference with the repository's token layer and existing
components:

- app bar title and back action;
- current Kakao nickname and avatar;
- an accessible keep-rate ring showing a percentage or `집계 중`;
- completed, broken, disputed, unresolved, and active counts;
- four labeled reminder switches;
- a 09:00, 12:00, or 20:00 KST picker;
- terms and privacy links through `openLegalDocument`;
- `LfDisclaimer`, which renders the immutable `LEGAL_DISCLAIMER`; and
- a logout action with confirmation and retry feedback.

The screen contains no email reminder control and no ad slot. It never shows another participant's
rate. The explicit reminder controls, back action, error states, and logout action are intentional
differences from the frozen reference.

## Error and Privacy Rules

- Unauthenticated requests return the existing authentication error shape.
- Inactive users receive the existing forbidden response.
- Unknown failures flatten to the shared internal-error copy.
- The server logs no Expo token, profile payload, or reminder values.
- Settings validation identifies only the allowed field; it exposes no table or column name.
- Logout never removes another device's token.

## TDD and Verification

Implementation proceeds in these independent RED-GREEN units:

1. shared contracts, strict parsers, and `activeCount`;
2. profile read, settings mutation, rescheduling, unregister, and J-10 transactions;
3. three Edge Function boundaries;
4. mobile API and safe logout orchestration;
5. SCR-A08, home entry, reminder interaction, and race handling; and
6. cron, full regression, Android export, and 360x800 visual comparison.

Focused tests cover keeper-scoped counts, minimum sample behavior, default preferences, preference
validation, atomic schedule changes, idempotent retries, cross-user token protection, J-10 duplicate
runs, JWT/error boundaries, update races, logout failures, legal links, 48 dp controls, and no-ad
rendering.

The final local gate runs `npm test`, `npm run typecheck`, `npm run build:web`,
`npm run check:agents`, `npx expo install --check`, Android production export, and
`git diff --check`. Remote migration and function deployment remain blocked until the Supabase
Management API account can read the project without 403.

## Deferred Work

- block-list management;
- account withdrawal and record anonymization;
- email reminders;
- badges, rankings, and public or partner trust rates;
- F-11 amendment and cancellation flows;
- remote deployment and real-device UAT while Management API access remains blocked.
