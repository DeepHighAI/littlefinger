# Development Status

Snapshot date: **2026-08-17 (KST)**. This records the locally verified SCR-A07, F-10 home-list,
SCR-A05 promise-detail, F-01 draft legal boundary, J-09, F-05 witness flow and self-leave,
F-09 trust profile, F-11 amend/cancel flow, and MOD-03 completion celebration. It also records the
remote MOD-03 migration and Edge Function deployment plus the completed 360x800 Android visual
comparison. Cross-account Android UAT remains a separate gate.

## Repository snapshot

- The locally verified MOD-03 implementation baseline is `main@4a5a4bb`, 136 commits ahead of
  `origin/main` before this deployment-status update.
- `.claude/settings.local.json` is local-only and must remain uncommitted.
- The local migration catalog includes the F-11 migrations
  `20260816202820_f11_amend_agreement.sql`,
  `20260816204242_f11_amend_notifications.sql`, and
  `20260817000003_witness_self_leave.sql`, plus the new MOD-03 migration
  `20260817100453_mod_03_completion_celebration.sql`; the last one is the latest local version and
  matches the version recorded by the remote Management API deployment.
  Notification inbox RPCs/functions, the dedicated home/detail/profile RPCs and Edge Functions,
  the internal `push-send` worker, durable notification outbox, fenced delivery/receipt RPCs,
  Vault nudge, and cron recovery configuration are implemented locally.

## Deployment snapshot

On **2026-08-17**, the target project `vepnrrmxvsytguocicfe` was re-authenticated and verified before
mutation. A dry run listed exactly 21 pending migrations, and the committed migrations from
`20260801000001_notification_push_fanout.sql` through
`20260817000002_schedule_j10_trust_profile.sql` were applied. A subsequent migration-list readback
showed the catalogs aligned at that verification point. The two F-11 migrations and the witness
self-leave migration were committed afterward and have not been applied remotely. The MOD-03
`20260817100453_mod_03_completion_celebration.sql` migration was subsequently applied and read back
from the remote migration catalog.

The 20 approved changed/new Edge Functions were deployed with Management API bundling (`--use-api`)
and read back as `ACTIVE`. `push-send` is the only one with `verify_jwt=false`; it authenticates the
internal `x-push-send-secret` header. The other 19 retain JWT verification. MOD-03 then added
`completion-celebration-claim` and `completion-celebration-shown` through the same authenticated
Management API bundling path; both were read back as version 1, `ACTIVE`, with `verify_jwt=true`.
The private `completion_celebrations` table has RLS enabled, denies direct `anon` and
`authenticated` SELECT, and grants access only to `service_role`. Both MOD-03 RPCs have empty
`search_path`, deny direct client execution, and grant execution only to `service_role`.

Seven expected cron jobs were read back as active, unique by name, and on their exact UTC schedules:
J-02, J-03, J-08, J-01/push delivery, notification retention, J-09, and J-10. The generated
`PUSH_SEND_SECRET` was stored only as an Edge Secret and matching Vault secret; Vault also contains
the worker URL. The first `lf-push-send` run after configuration succeeded at 05:00 KST and received
HTTP 200 from the Edge Function without timeout. It claimed six obsolete reminder rows and canceled
all six; no push ticket or receipt was pending.

## Firebase and EAS state

- **Configured (2026-07-30):** committed Firebase Android client configuration targets
  `com.littlefinger.app`, and committed EAS development/production build profiles target their
  respective environments.
- **Last locally verified (2026-08-01):** `npm run test --workspace=@littlefinger/mobile --
  config/firebase-config.test.js --runInBand` passed 3/3 tests for the client configuration,
  native assets, and EAS-upload inclusion.
- **Locally verified (2026-08-17):** Expo SDK dependency alignment and Android production export
  passed with 1,628 bundled modules after MOD-03. The latest export is at
  `C:\tmp\littlefinger-mod03-20260817-1810`.
- **Currently unverified:** Firebase Console credentials/project access, an EAS production build
  artifact, and foreground/background/terminated real-device FCM/Expo delivery.

## Completed locally

- **M0:** npm workspace/shared-domain foundation, Expo mobile baseline and design tokens,
  SCR-A01, Supabase schema/RLS, and operational scaffolding.
- **M1 core loop:** Kakao session/user provisioning, draft/create/invite/preview/approval flows,
  acceptance web SCR-W01--W03, fulfillment transitions and SCR-A06/SCR-W04.
- **F-08 core evidence:** private upload reservation, server-side image processing and lifecycle,
  attachment handling in mobile and web fulfillment screens, and purge scheduling support.
- **F-06 delivery:** notification contracts, transactional outbox producers, per-device fanout,
  J-01 dispatch and KST quiet-hour deferral, Expo ticket/receipt processing, fenced retries,
  Vault/cron recovery, and allowlisted Android notification navigation are implemented locally.
  Logged-out destinations use encrypted crash-safe storage with legacy ciphertext compatibility.
- **SCR-A07 notification inbox:** server-owned list/read/read-all contracts, retention scheduling,
  cursor pagination, race-safe optimistic read state, and allowlisted notification navigation are
  implemented locally.
- **F-10 SCR-A02 home list:** the dedicated participant-scoped API/RPC, three independently cached
  tabs, ACTIVE-only imminent section, 20-row cursor pagination, selected-tab refresh, card metadata,
  safe errors, and detail navigation are implemented locally. Imminent rows are excluded from the
  ordinary ACTIVE list. DRAFT remains the only card that opens the editor; every non-DRAFT card
  opens SCR-A05 before any state-specific action.
- **SCR-A05 promise detail:** a participant-only RPC/Edge boundary, strict public response parser,
  record fingerprint without a public integrity outcome, approval and participant history, evidence-safe
  fulfillment snapshots, and nine visual variants covering all ten non-DRAFT statuses are
  implemented locally. `DECLINED` and `CANCELED` intentionally share the neutral terminal visual
  family. Existing PENDING, CHECKING, DISPUTED, and COMPLETED actions are connected. ACTIVE and
  AMEND_PENDING now expose the symmetric F-11 request, withdrawal, decision, and read-only version
  history controls on both mobile SCR-A05 and web SCR-W04.
- **F-01 draft legal boundary:** versioned public terms/privacy routes, login-screen links on app and
  web, and server-owned idempotent `terms_agreements` recording are implemented locally. The copy is
  explicitly marked as a non-deployment draft and does not claim legal approval. Both public pages
  were structurally inspected at 360x800: the draft/version notice, every section, release
  placeholders, and disclaimer render without ads or horizontal overflow, and the document scrolls
  to its final content. There is no approved legal-page reference, so this is not a pixel-pass claim.
- **J-09 record integrity:** the weekly verifier records hash/cache mismatch lifecycles only in the
  server-only `integrity_incidents` table, keeps the outcome out of public API/SCR-A05, and replaces
  duplicate cron rows with one Sunday 05:30 KST job. The batch and scheduler are locally verified
  for same-time retries, permissions, empty `search_path`, and advisory-lock serialization.
- **F-05 core witness flow:** participant-scoped witness slots, one-time invite issuance/reissue,
  MOD-02 management from supported promise states, token redemption, LIMITED pre-activation and
  FULL post-activation SCR-W05 views, evidence-safe fulfillment claims, one-time confirmation
  signatures, account-route revisit, and NT-18 outbox intents are implemented locally. A JOINED
  witness can now leave without changing the promise: the participant row becomes WITHDRAWN, the
  historical WITNESS_SIGN row remains immutable, future detail/evidence access is revoked, and the
  witness slot becomes available for a different account. SCR-W05 distinguishes signed and unsigned
  warnings, retains one idempotency key across retry, and clears the protected detail after success.
  Raw invite tokens are returned once and stored only through the app's encrypted store.
- **F-09 trust profile and SCR-A08:** the signed-in user's keeper-scoped keep rate, four status
  counts, reminder preferences, and legal links are exposed through strict shared contracts and
  authenticated server-owned RPC/Edge boundaries. SCR-A08 is reachable from the account action on
  SCR-A02, contains no ads, and uses the immutable disclaimer. Current-device push token cleanup
  precedes local logout, and token aliases containing user UUID separators are encrypted without
  passing invalid keys to Android SecureStore. J-10 locally repairs active-user trust caches daily
  at 03:00 KST with duplicate-safe scheduling and advisory-lock serialization.
- **F-11 amend/cancel:** joined creators and partners can symmetrically request a seven-field AMEND
  or a two-stage-confirmed CANCEL from ACTIVE, withdraw their own pending request, or approve and
  decline the counterparty request. The database owns immutable proposed versions, contiguous
  activated version numbers, T-07--T-10 transitions, seven-day expiry, reminders, durable NT-15--17
  outbox intents, and read-only version history. Mobile MOD-01/SCR-A05 and web SCR-W04 render only
  changed fields, preserve one idempotency key until an authoritative refresh converges, promote
  pending counterparty decisions into response-needed ordering, and render no ads. Final local
  verification passed 1,718 Vitest tests and 452 mobile Jest tests, full typecheck, web production
  build, Expo dependency check, agent-doc synchronization, diff checks, and Android export.
- **MOD-03 completion celebration:** T-12 now captures immutable per-party before/after keep-rate
  snapshots only for new COMPLETED transitions. Authenticated claim and shown transactions fence
  once-only delivery with separate idempotency keys, while the app persists only encrypted
  PENDING/SHOWN UUID envelopes. SCR-A05 claims only for joined creators and partners after an
  authoritative COMPLETED detail load, acknowledges exposure from native `Modal.onShow`, and keeps
  failures independent from the detail screen. SCR-A06 replaces a successful COMPLETED submission
  with SCR-A05 only after evidence-draft cleanup. The token-only sheet covers changed, unchanged,
  first-aggregation, and still-aggregating keep-rate copy; it has a modal accessibility boundary,
  48 dp actions, text sharing, new-promise navigation, scrim/back dismissal, and no ad. Final local
  verification passed 1,792 Vitest tests and 500 mobile Jest tests, full typecheck, a 111-module web
  production build, Expo dependency check, agent-doc synchronization, diff checks, and a
  1,628-module Android export. A development build was then exercised on the existing Android AVD
  at a logical 360x800 viewport. All four rate states were captured and compared with the frozen
  MOD-03 reference. The sheet bounds, scrim, centered pinky, title/copy hierarchy, rate pill,
  full-width primary action, secondary share action, 48 dp minimum targets, and no-ad/no-overflow
  contract passed. The accessible close action and the three additional rate states are intentional
  implementation differences from the single frozen reference state.

## Known gaps

- The previously approved remote migration, Edge Function, Vault, and cron gates are complete
  through F-09. F-11 is local-only: its two migrations, four Edge Functions, AMEND_REMIND dispatch,
  and J-05 cron have not been deployed or remotely verified. Witness self-leave is also local-only:
  `20260817000003_witness_self_leave.sql` and `witness-leave` are not deployed.
- Two-account app/web UAT is pending a second Kakao account; automated and recorded remote checks
  do not replace it.
- **F-06 device UAT:** the committed migrations, Vault values, active `push-send`, unique cron, and
  successful HTTP invocation are remotely verified. A real Expo ticket/receipt and Android
  foreground/background/terminated delivery still require a development build and device token.
- **SCR-A07/F-10/SCR-A05 UAT:** the inbox, home-list, and promise-detail migrations/functions are
  remotely deployed and active. The SCR-A05 automated tests verify every state
  heading, common content, neutral DISPUTED claims, signed-evidence boundary, allowed actions, and
  no-ad rendering. The frozen nine-screen reference was checked structurally at the 360x800 design
  contract, but populated real-device screenshots require the deployed API and account data. This
  is not a pixel-pass claim.
- **F-01 release gate:** operator details, privacy officer details, overseas processing particulars,
  and legal review are intentionally unresolved. The current legal pages and recorded versions are
  non-deployment drafts and must not be treated as production consent documents.
- **J-09 UAT:** the migration, private incident permissions, and unique weekly cron are remotely
  verified. A deliberate production hash mismatch was not introduced; incident lifecycle behavior
  remains covered by automated tests. Email delivery remains out of MVP scope.
- **F-05 UAT:** the witness migration and five Edge Functions are remotely deployed and active.
  Cross-account Android-to-web
  invite, join, signature, evidence, and revisit UAT is still required. Automated tests and the
  Android production export passed. The signed-out SCR-W05 shell was inspected again at 360x800
  with no horizontal overflow, a 52 px CTA, and no ad. The self-leave RPC and Edge Function are not
  remote yet; authenticated LIMITED/FULL self-leave and MOD-02 still require deployed-account
  screenshots, so this is not a real-device pixel-pass claim.
- **F-09 UAT:** the two migrations, three Edge Functions, and unique J-10 cron are remotely deployed
  and verified. An Android emulator verified that session post-processing no longer raises an
  invalid SecureStore-key error and that `/profile` opens. Populated profile pixels, settings
  persistence, current-device token removal, and real-device logout remain external UAT and are not
  a pixel-pass claim.
- **F-11 UAT:** automated tests cover creator/partner symmetry, stale state, expiry validation,
  idempotent retries, response ordering, and both clients. A 1080x2400/420-dpi Android AVD reached
  the installed app splash but Android terminated `com.littlefinger.app` after a 6.5-second
  `failed to complete startup` ANR, so populated MOD-01/SCR-A05 screenshots and two-account web/app
  UAT remain unverified. The captured splash is
  `C:\tmp\littlefinger-f11-screen-1080x2400.png`; this is not a pixel-pass claim.
- **MOD-03 UAT:** the migration and both Edge Functions are remotely deployed and their database,
  privilege, status, and JWT boundaries are verified. The Android development build produced
  360x800 captures for changed, unchanged, first-aggregation, and still-aggregating states, and the
  visual contract passed against the frozen reference. Creator/partner independent once-only
  delivery still needs a two-account end-to-end UAT with a real COMPLETED transition; synthetic
  production data was not introduced for this check.

## Roadmap

1. **M4 local implementation:** the SCR-A02-only ad slot, accessibility pass, full acceptance
   checklist, and Google Play closed-testing preparation.
2. **Remote catch-up and UAT:** deploy and verify the local-only F-11 and witness self-leave
   migrations/functions, then run the remaining two-account and Android development-build flows.
3. **F-01 release:** replace draft placeholders only after operator input and legal review, then
   publish a new final legal version instead of re-labeling the recorded draft.

The next local product implementation stage is M4. Device and cross-account UAT remains an external
gate; F-01 final copy also requires operator input and legal review.
