# Development Status

Snapshot date: **2026-08-17 (KST)**. This records the locally verified SCR-A07, F-10 home-list,
SCR-A05 promise-detail, F-01 draft legal boundary, J-09, F-05 witness flow, and F-09 trust profile;
it is not a claim that the migrations, Edge Functions, cron, or Android development build are
deployed.

## Repository snapshot

- The F-09 trust-profile baseline is `main@de2afee`, 109 commits ahead of `origin/main` before this
  documentation update.
- `.claude/settings.local.json` is local-only and must remain uncommitted.
- The local migration catalog ends at `20260817000002_schedule_j10_trust_profile.sql`.
  Notification inbox RPCs/functions, the dedicated home/detail/profile RPCs and Edge Functions,
  the internal `push-send` worker, durable notification outbox, fenced delivery/receipt RPCs,
  Vault nudge, and cron recovery configuration are implemented locally.

## Deployment snapshot

The last live verification recorded in repository handoffs is **2026-07-30**: migrations through
`20260730000011_user_provisioning.sql` were local/remote aligned, and the live create -> invite ->
preview -> approve path was exercised. Earlier handoffs also record the deployed invitation
functions and `invite-preview` access controls.

On 2026-08-17, the read-only `supabase migration list` gate still returned Management API **403**
for the active CLI account. The check stopped there without reading the function list or making a
remote mutation. Consequently, do **not** infer that the local F-05--F-10, SCR-A07, or SCR-A08
migrations/functions are deployed. Restore the correct Supabase account before deployment
verification or any production mutation.

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

- Production deployment and live verification of the current F-07/F-08 local state are pending the
  Supabase account-access fix.
- Two-account app/web UAT is pending a second Kakao account; automated and recorded remote checks
  do not replace it.
- **F-06 deployment/UAT:** the committed migrations, Vault values, `push-send`, single cron job,
  Expo receipt transitions, and Android foreground/background/terminated delivery still require
  remote verification after the Management API 403 is resolved.
- **SCR-A07/F-10/SCR-A05 deployment/UAT:** the inbox, home-list, and promise-detail
  migrations/functions are not remotely verified. The SCR-A05 automated tests verify every state
  heading, common content, neutral DISPUTED claims, signed-evidence boundary, allowed actions, and
  no-ad rendering. The frozen nine-screen reference was checked structurally at the 360x800 design
  contract, but populated real-device screenshots require the deployed API and account data. This
  is not a pixel-pass claim.
- **F-01 release gate:** operator details, privacy officer details, overseas processing particulars,
  and legal review are intentionally unresolved. The current legal pages and recorded versions are
  non-deployment drafts and must not be treated as production consent documents.
- **J-09 deployment gate:** the local migration, private incident permissions, and single weekly cron
  have not been applied or read back remotely because the Management API still returns 403.
  Email delivery remains out of MVP scope.
- **F-05 deployment/UAT:** the witness migration and five Edge Functions have not been applied or
  read back remotely because the Management API still returns 403. Cross-account Android-to-web
  invite, join, signature, evidence, and revisit UAT is still required. Automated tests and the
  Android production export passed. The signed-out SCR-W05 shell was inspected at 360x800 with no
  horizontal overflow, a 52 px CTA, and no ad. Authenticated FULL data and MOD-02 still require
  deployed-account screenshots, so this is not a real-device pixel-pass claim.
- **F-09 deployment/UAT:** the two migrations, three Edge Functions, and J-10 cron have not been
  applied or read back remotely because the Management API still returns 403. An Android emulator
  verified that session post-processing no longer raises an invalid SecureStore-key error and that
  `/profile` opens; the screen then showed its retry state because the remote profile function is
  not deployed. Populated profile pixels, settings persistence, current-device token removal, and
  real-device logout therefore remain external UAT and are not a pixel-pass claim.
- F-11 amend/cancel mutations, witness self-leave, and the version-history screen remain M3 work
  and are intentionally not exposed by SCR-A05 yet.

## Roadmap

1. **F-01 release:** replace draft placeholders only after operator input and legal review, then
   publish a new final legal version instead of re-labeling the recorded draft.
2. **M3:** witness self-leave, amend/cancel UI, and MOD-03.
3. **M4:** the SCR-A02-only ad slot, accessibility pass, full acceptance checklist, and Google Play
   closed testing.

The next product implementation step is the remaining M3 scope. F-01/J-09, F-05/F-06/F-09,
SCR-A07, F-10, and SCR-A05 deployment/device UAT remain the first external gate once the correct
Supabase account is available; F-01 final copy additionally requires operator input and legal
review.
