# Development Status

Snapshot date: **2026-08-14 (KST)**. This is the **F-06 follow-up baseline**, not a claim that
every local commit is deployed; later commits naturally move the branch beyond this recorded point.

## Repository snapshot

- At this baseline, branch `main` is 41 commits ahead of `origin/main` at `5f4e48f`.
- `.claude/settings.local.json` is local-only and must remain uncommitted. The approved
  `2026-08-14-m2-f06-push-delivery-followup.md` plan is included with this documentation update.
- The local migration catalog ends at `20260801000003_dispatch_due_reminders.sql`; local Edge
  Function directories include the fulfillment, evidence, and device-token paths. `push-send` is
  not implemented yet.

## Deployment snapshot

The last live verification recorded in repository handoffs is **2026-07-30**: migrations through
`20260730000011_user_provisioning.sql` were local/remote aligned, and the live create -> invite ->
preview -> approve path was exercised. Earlier handoffs also record the deployed invitation
functions and `invite-preview` access controls.

On 2026-08-01, read-only `supabase migration list` and `supabase functions list` both returned
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
- **Currently unverified:** Firebase Console credentials/project access, an EAS production build
  artifact, and real-device FCM/Expo delivery have not been verified in this snapshot.

## Completed locally

- **M0:** npm workspace/shared-domain foundation, Expo mobile baseline and design tokens,
  SCR-A01, Supabase schema/RLS, and operational scaffolding.
- **M1 core loop:** Kakao session/user provisioning, draft/create/invite/preview/approval flows,
  acceptance web SCR-W01--W03, fulfillment transitions and SCR-A06/SCR-W04.
- **F-08 core evidence:** private upload reservation, server-side image processing and lifecycle,
  attachment handling in mobile and web fulfillment screens, and purge scheduling support.
- **F-06 baseline:** notification contracts and per-device PUSH fanout, recipient and device-token
  snapshot locking, and J-01 due-reminder dispatch with KST quiet-hour deferral. These local
  changes are in `495d64d`, `252809b`, and `5f4e48f` respectively.

## Known gaps

- Production deployment and live verification of the current F-07/F-08 local state are pending the
  Supabase account-access fix.
- Two-account app/web UAT is pending a second Kakao account; automated and recorded remote checks
  do not replace it.
- **F-06** durable outbox, Expo ticket/receipt delivery, retry recovery, worker scheduling, and
  validated Android notification navigation are not implemented. It does not include the inbox,
  reminder-settings UI, full detail, or legal work.
- **J-09** weekly content-hash verification and **F-01** legal URLs, legal copy, and terms-agreement
  recording are incomplete. Email delivery remains out of MVP scope.
- SCR-A07 inbox/read state, F-10 plus full SCR-A05 detail, and SCR-A08 reminder-settings/profile UI
  remain separate incomplete work.

## Roadmap

1. **F-06:** add durable delivery, Expo ticket/receipt handling, recovery scheduling, and validated
   Android navigation on top of the completed reminder fanout and quiet-hour baseline.
2. **SCR-A07:** add the notification inbox and read state.
3. **F-10 / SCR-A05:** complete the home list and the full promise-detail variants.
4. **F-01:** complete legal URLs, legal copy, and terms-agreement recording; implement J-09.
5. **M3:** witness flows, keep-rate profile/SCR-A08, amend/cancel UI, and MOD-03.
6. **M4:** the SCR-A02-only ad slot, accessibility pass, full acceptance checklist, and Google Play
   closed testing.

The next implementation step is the approved [F-06 push delivery follow-up plan](superpowers/plans/2026-08-14-m2-f06-push-delivery-followup.md).
