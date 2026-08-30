# Handoff — monetization/retention batch after review, fix batch and leftover audit

Date: 2026-08-30 (session started 2026-08-29)
Replaces: `2026-08-22-cleanup-and-current-state.md` (its content lives in `docs/DEVELOPMENT_STATUS.md`).

## Goal and status

Codex implemented ADR 0015 (rewarded-ad witness/duration/retention grants, `promise_permanent_access`
₩2,000, per-participant retention with hard purge + keepRate aggregates, no-end promises with FINISH
agreement T-19…T-21, A02 in-feed banner). This session reviewed it, the PO accepted the design as the
baseline (rejecting only the no-fill fallback), and two batches landed locally:

1. **Fix batch** — 7 blocking defects + ~25 should-fix items (see `DEVELOPMENT_STATUS.md` "Review and
   fix batch").
2. **Leftover audit + closure** — PO decisions: dead codes `E_REWARD_PENDING`/`E_PURGING` deleted;
   J-08's 365-day evidence deletion retired (evidence dies with the record or on user removal —
   `EVIDENCE_RETENTION_DAYS` removed, `purge_after` is legacy-null); `benefit` module renamed to
   `entitlement`; expired access disappears silently (as designed). Spec `02` v1.3 / `04` v1.2 caught
   up (error table, screen table incl. MOD-04/05, new tables/enums, §6-5, J-08/J-11, NT-15/16 FINISH,
   quiet hours, §9 rows, EC-J/K/L ×9, §11-3, §13). Tests: no-end lifecycle (approve → no D-n
   reminders, J-02 never moves it), EC-tagged tests, config twins cross-check, evidence tests
   rewritten, mobile FINISH flow + monetization-native/api tests, banner consent gate.

**Nothing is committed or deployed.** Working tree: ~120 changed/new files.

## Verification state (last run this session)

`npm run typecheck` 5/5 · Vitest 109 files / 2,124 tests · jest-expo 78 suites / 807 tests ·
`check:agents` · `git diff --check` — all green.

## Files that matter

- `supabase/migrations/20260829103504_rewarded_ads_retention_bm.sql` — the ONLY migration of the
  batch, **not applied** to the linked project; it has been edited in place repeatedly (fallback
  removal, FK/CHECK fix, purge fixes, min_app_version 0.2.0, J-08 retirement at the tail). If it is
  ever applied before the next change, further SQL goes into a new `202608xx…` file.
- `docs/adr/0015-rewarded-benefits-and-personal-retention.md` — decision record (D2 ordering, D6
  locked rule, TTL by signed timestamp).
- `docs/plans/2026-08-29-rewarded-ads-keep-forever-and-banner.md` — accepted scope; delete when
  ADR 0015 is deployed (CLAUDE.md §1-1 rule).
- `docs/setup/monetization-retention-release.md` — operator runbook (build 0.2.0 first, then
  migration, then `functions deploy --use-api`; production-profile QA).
- `docs/notes/environment-gotchas.md` — PGlite single-connection note (deadlock test is
  definition-order only).

## Blocked / PO items (all in the plan file's "PO 확인 필요" and DEVELOPMENT_STATUS)

- **Legal (release blocker, 법무):** privacy policy v6 (rewarded/banner ads, SSV pseudonymous id,
  purchases, retention/purge), terms 유료 서비스·환불·청약철회 clause, Play Data Safety re-submit.
  `apps/web/src/legal/legal-content.ts` still says evidence is kept 365 days.
- **Design baselines (PO approval):** none of the seven new UI surfaces has a `design-reference/`
  file (MOD-05 entitlement sheet, MOD-02 locked row, A02 banner, A05 retention/FINISH, A03/MOD-01
  no-end, W04 FINISH tab, W05 no-end).
- **Operator release + device QA:** Play product, 4 AdMob units + SSV callback, EAS/Edge/Vault
  secrets, 0.2.0 production build, then the QA list in the release doc.

## Exact next step

1. Commit the working tree as one change (`feat: rewarded benefits, permanent access, retention purge (ADR 0015)`)
   after `npm test && npm run typecheck && npm run check:agents`.
2. Hand the legal items to 법무 with the three documents above; in parallel produce the
   design-reference baselines for PO preview (`npm run preview`).
3. Only after both: operator release per `docs/setup/monetization-retention-release.md`.
