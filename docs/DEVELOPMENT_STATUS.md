# Development Status

Snapshot date: **2026-08-01 (KST)**. This is an execution-time status record, not a claim that every
local commit is deployed.

## Repository snapshot

- Branch: `main`, 36 commits ahead of `origin/main` at `edc0917`.
- Untracked at capture: `.claude/settings.local.json` (local-only; must remain uncommitted) and
  `docs/superpowers/plans/2026-08-01-m2-f06-push-delivery.md` (the approved F-06 plan).
- The local migration catalog ends at `20260731150357_relocate_pg_net_extension.sql`; local Edge
  Function directories include the fulfillment and evidence paths.

## Deployment snapshot

The last live verification recorded in repository handoffs is **2026-07-30**: migrations through
`20260730000011_user_provisioning.sql` were local/remote aligned, and the live create -> invite ->
preview -> approve path was exercised. Earlier handoffs also record the deployed invitation
functions and `invite-preview` access controls.

On 2026-08-01, read-only `supabase migration list` and `supabase functions list` both returned
Management API **403** for the active CLI account. Consequently, do **not** infer that the local
F-07 or F-08 migrations/functions are deployed. Restore the correct Supabase account before
deployment verification or further production mutation.

## Completed locally

- **M0:** npm workspace/shared-domain foundation, Expo mobile baseline and design tokens,
  SCR-A01, Supabase schema/RLS, and operational scaffolding.
- **M1 core loop:** Kakao session/user provisioning, draft/create/invite/preview/approval flows,
  acceptance web SCR-W01--W03, fulfillment transitions and SCR-A06/SCR-W04.
- **F-08 core evidence:** private upload reservation, server-side image processing and lifecycle,
  attachment handling in mobile and web fulfillment screens, and purge scheduling support.

## Known gaps

- Production deployment and live verification of the current F-07/F-08 local state are pending the
  Supabase account-access fix.
- Two-account app/web UAT is pending a second Kakao account; automated and recorded remote checks
  do not replace it.
- F-06 PUSH delivery, notification inbox/read state, reminder-settings UI, and the full SCR-A05
  detail screen are not implemented. Email delivery remains out of MVP scope.

## Roadmap

1. **M2:** F-06 reminders, PUSH delivery, quiet hours, notification inbox, home-list refinement,
   and SCR-A05 status variants.
2. **M3:** witness flows, keep-rate profile, amend/cancel UI, and MOD-03.
3. **M4:** the SCR-A02-only ad slot, accessibility pass, full acceptance checklist, and Google Play
   closed testing.

The next implementation step is the approved [F-06 push delivery plan](superpowers/plans/2026-08-01-m2-f06-push-delivery.md).
