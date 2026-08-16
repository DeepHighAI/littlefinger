# Development Status

Snapshot date: **2026-08-17 (KST)**. This records the locally verified SCR-A07, F-10 home-list,
SCR-A05 promise-detail, F-01 draft legal boundary, J-09, F-05 witness flow, and F-09 trust profile,
plus the remote database, Edge Function, Vault, and cron verification completed on the same date.
Android development-build UAT remains a separate gate.

## Repository snapshot

- The F-09 trust-profile baseline is `main@f5efc64`, 110 commits ahead of `origin/main` before this
  documentation update.
- `.claude/settings.local.json` is local-only and must remain uncommitted.
- The local migration catalog ends at `20260817000002_schedule_j10_trust_profile.sql`.
  Notification inbox RPCs/functions, the dedicated home/detail/profile RPCs and Edge Functions,
  the internal `push-send` worker, durable notification outbox, fenced delivery/receipt RPCs,
  Vault nudge, and cron recovery configuration are implemented locally.

## Deployment snapshot

On **2026-08-17**, the target project `vepnrrmxvsytguocicfe` was re-authenticated and verified before
mutation. A dry run listed exactly 21 pending migrations, and the committed migrations from
`20260801000001_notification_push_fanout.sql` through
`20260817000002_schedule_j10_trust_profile.sql` were applied. A subsequent migration-list readback
showed the local and remote catalogs aligned.

The 20 approved changed/new Edge Functions were deployed with Management API bundling (`--use-api`)
and read back as `ACTIVE`. `push-send` is the only one with `verify_jwt=false`; it authenticates the
internal `x-push-send-secret` header. The other 19 retain JWT verification.

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
  passed with 1,618 bundled modules after the F-09 trust-profile changes.
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
  family. Existing PENDING, CHECKING, DISPUTED, and COMPLETED actions are connected; F-11 mutation
  and version-history controls remain absent rather than acting as placeholders.
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
  signatures, account-route revisit, and NT-18 outbox intents are implemented locally. Raw invite
  tokens are returned once and stored only through the app's encrypted store. Witness self-leave is
  intentionally deferred.
- **F-09 trust profile and SCR-A08:** the signed-in user's keeper-scoped keep rate, four status
  counts, reminder preferences, and legal links are exposed through strict shared contracts and
  authenticated server-owned RPC/Edge boundaries. SCR-A08 is reachable from the account action on
  SCR-A02, contains no ads, and uses the immutable disclaimer. Current-device push token cleanup
  precedes local logout, and token aliases containing user UUID separators are encrypted without
  passing invalid keys to Android SecureStore. J-10 locally repairs active-user trust caches daily
  at 03:00 KST with duplicate-safe scheduling and advisory-lock serialization.

## Known gaps

- The remote migration, approved Edge Function, Vault, and cron configuration gates are complete,
  but feature-level cross-account and real-device UAT is still pending.
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
  Android production export passed. The signed-out SCR-W05 shell was inspected at 360x800 with no
  horizontal overflow, a 52 px CTA, and no ad. Authenticated FULL data and MOD-02 still require
  deployed-account screenshots, so this is not a real-device pixel-pass claim.
- **F-09 UAT:** the two migrations, three Edge Functions, and unique J-10 cron are remotely deployed
  and verified. An Android emulator verified that session post-processing no longer raises an
  invalid SecureStore-key error and that `/profile` opens. Populated profile pixels, settings
  persistence, current-device token removal, and real-device logout remain external UAT and are not
  a pixel-pass claim.
- F-11 amend/cancel mutations, witness self-leave, and the version-history screen remain M3 work
  and are intentionally not exposed by SCR-A05 yet.

## Roadmap

1. **F-01 release:** replace draft placeholders only after operator input and legal review, then
   publish a new final legal version instead of re-labeling the recorded draft.
2. **M3:** witness self-leave, amend/cancel UI, and MOD-03.
3. **M4:** the SCR-A02-only ad slot, accessibility pass, full acceptance checklist, and Google Play
   closed testing.

The next product implementation step is F-11 amend/cancel agreement, followed by witness
self-leave and MOD-03. Device and cross-account UAT remains an external gate; F-01 final copy also
requires operator input and legal review.
