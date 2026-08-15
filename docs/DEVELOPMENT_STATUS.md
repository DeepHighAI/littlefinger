# Development Status

Snapshot date: **2026-08-15 (KST)**. This records the locally verified F-06 implementation; it is
not a claim that the migrations, Edge Function, cron, or Android development build are deployed.

## Repository snapshot

- Branch `main` is 54 commits ahead of `origin/main` at `eb79d06`.
- `.claude/settings.local.json` is local-only and must remain uncommitted. The approved
  `2026-08-14-m2-f06-push-delivery-followup.md` plan is included with this documentation update.
- The local migration catalog ends at `20260815000005_harden_push_worker.sql`. The internal
  `push-send` Edge Function, durable notification outbox, fenced delivery/receipt RPCs, Vault nudge,
  and cron recovery configuration are implemented locally.

## Deployment snapshot

The last live verification recorded in repository handoffs is **2026-07-30**: migrations through
`20260730000011_user_provisioning.sql` were local/remote aligned, and the live create -> invite ->
preview -> approve path was exercised. Earlier handoffs also record the deployed invitation
functions and `invite-preview` access controls.

On 2026-08-15, read-only `supabase migration list` and `supabase functions list` both returned
Management API **403** for the active CLI account. Consequently, do **not** infer that the local
F-06, F-07, or F-08 migrations/functions are deployed. Restore the correct Supabase account before
deployment verification or any production mutation.

## Firebase and EAS state

- **Configured (2026-07-30):** committed Firebase Android client configuration targets
  `com.littlefinger.app`, and committed EAS development/production build profiles target their
  respective environments.
- **Last locally verified (2026-08-01):** `npm run test --workspace=@littlefinger/mobile --
  config/firebase-config.test.js --runInBand` passed 3/3 tests for the client configuration,
  native assets, and EAS-upload inclusion.
- **Locally verified (2026-08-15):** Expo SDK dependency alignment and Android production export
  passed with 1,587 bundled modules.
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

## Known gaps

- Production deployment and live verification of the current F-07/F-08 local state are pending the
  Supabase account-access fix.
- Two-account app/web UAT is pending a second Kakao account; automated and recorded remote checks
  do not replace it.
- **F-06 deployment/UAT:** the committed migrations, Vault values, `push-send`, single cron job,
  Expo receipt transitions, and Android foreground/background/terminated delivery still require
  remote verification after the Management API 403 is resolved.
- **J-09** weekly content-hash verification and **F-01** legal URLs, legal copy, and terms-agreement
  recording are incomplete. Email delivery remains out of MVP scope.
- SCR-A07 inbox/read state, F-10 plus full SCR-A05 detail, and SCR-A08 reminder-settings/profile UI
  remain separate incomplete work.

## Roadmap

1. **SCR-A07:** add the notification inbox, server-owned read state, read-all action, retention,
   unread emphasis, and allowlisted item navigation from F-06 section 4-6-3.
2. **F-10 / SCR-A05:** complete the home list and the full promise-detail variants.
3. **F-01:** complete legal URLs, legal copy, and terms-agreement recording; implement J-09.
4. **M3:** witness flows, keep-rate profile/SCR-A08, amend/cancel UI, and MOD-03.
5. **M4:** the SCR-A02-only ad slot, accessibility pass, full acceptance checklist, and Google Play
   closed testing.

The next local implementation step is the prepared
[SCR-A07 notification inbox plan](superpowers/plans/2026-08-15-m2-scr-a07-notification-inbox.md).
F-06 deployment and device UAT remain the first external gate once the correct Supabase account is
available.
