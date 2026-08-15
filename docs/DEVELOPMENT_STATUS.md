# Development Status

Snapshot date: **2026-08-16 (KST)**. This records the locally verified SCR-A07, F-10 home-list,
and SCR-A05 promise-detail implementation; it is not a claim that the migrations, Edge Functions,
cron, or Android development build are deployed.

## Repository snapshot

- The SCR-A05 feature baseline is `main@22e6ade`, 79 commits ahead of `origin/main` before this
  documentation update.
- `.claude/settings.local.json` is local-only and must remain uncommitted.
- The local migration catalog ends at `20260816000002_promise_detail.sql`. Notification inbox
  RPCs/functions, the dedicated home/detail RPCs and Edge Functions, the internal `push-send`
  worker, durable notification outbox, fenced delivery/receipt RPCs, Vault nudge, and cron recovery
  configuration are implemented locally.

## Deployment snapshot

The last live verification recorded in repository handoffs is **2026-07-30**: migrations through
`20260730000011_user_provisioning.sql` were local/remote aligned, and the live create -> invite ->
preview -> approve path was exercised. Earlier handoffs also record the deployed invitation
functions and `invite-preview` access controls.

On 2026-08-16, the read-only `supabase migration list` gate still returned Management API **403**
for the active CLI account. The check stopped there without reading the function list or making a
remote mutation. Consequently, do **not** infer that the local F-06, F-07, F-08, SCR-A07, or F-10
migrations/functions are deployed. Restore the correct Supabase account before deployment
verification or any production mutation.

## Firebase and EAS state

- **Configured (2026-07-30):** committed Firebase Android client configuration targets
  `com.littlefinger.app`, and committed EAS development/production build profiles target their
  respective environments.
- **Last locally verified (2026-08-01):** `npm run test --workspace=@littlefinger/mobile --
  config/firebase-config.test.js --runInBand` passed 3/3 tests for the client configuration,
  native assets, and EAS-upload inclusion.
- **Locally verified (2026-08-16):** Expo SDK dependency alignment and Android production export
  passed with 1,604 bundled modules after adding SCR-A05.
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
  current-version integrity verification, approval and participant history, evidence-safe
  fulfillment snapshots, and nine visual variants covering all ten non-DRAFT statuses are
  implemented locally. `DECLINED` and `CANCELED` intentionally share the neutral terminal visual
  family. Existing PENDING, CHECKING, DISPUTED, and COMPLETED actions are connected; F-11 mutation,
  witness invite, and version-history controls remain absent rather than acting as placeholders.

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
- **J-09** weekly content-hash verification and **F-01** legal URLs, legal copy, and terms-agreement
  recording are incomplete. Email delivery remains out of MVP scope.
- SCR-A08 reminder-settings/profile UI remains incomplete. F-11 amend/cancel mutations, witness
  actions, and the version-history screen remain M3 work and are intentionally not exposed by
  SCR-A05 yet.

## Roadmap

1. **F-01:** complete legal URLs, legal copy, and terms-agreement recording; implement J-09.
2. **M3:** witness flows, keep-rate profile/SCR-A08, amend/cancel UI, and MOD-03.
3. **M4:** the SCR-A02-only ad slot, accessibility pass, full acceptance checklist, and Google Play
   closed testing.

The next local implementation step is F-01 legal/terms completion and J-09 content-hash
verification. F-06, SCR-A07, F-10, and SCR-A05 deployment/device UAT remain the first external gate
once the correct Supabase account is available.
