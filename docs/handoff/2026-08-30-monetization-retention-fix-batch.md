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

**Committed on `main` (2026-08-30), nothing deployed, nothing pushed:** `28f6e0d` ADR 0015 batch · `fc9fb1d` legal v6 · `b89159c` release runbook / smoke SQL / QA matrix / CI · `bf80b52` web no-end label fix · `b36760a` design-reference baselines.

## Verification state (last run this session)

`npm run typecheck` 5/5 · Vitest 109 files / 2,124 tests · jest-expo 78 suites / 807 tests ·
`check:agents` · `git diff --check` — all green (re-run after the last commit).

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

- **Legal:** Terms/Privacy `2026-08-30.1` are written and committed (migration `20260830000001`);
  external 법무 review runs in parallel — its feedback becomes `.2` and is required before **store
  publication** (not before internal testing). Data Safety runbook re-grounded.
- **Design baselines:** all seven surfaces now have `design-reference/` files (gallery entries,
  DESIGN.md log). PO previews them with `npm run preview`; two baseline-only slot tags in MOD-02
  (`무료 1` / `광고 1 · 잠김`) are marked `PO 확인 필요` in the file comment.
- **Operator release + device QA:** Play product, 4 AdMob units + SSV callback, EAS/Edge/Vault
  secrets, 0.2.0 production build, then the QA list in the release doc.

## Exact next step

1. PO fills the §1 console checklist in `docs/setup/monetization-retention-release.md` (Play product,
   license testers, internal track opt-in URL, 4 AdMob unit ids, SSV callback ×3, test device ids)
   and hands the values back; 법무 gets `/legal/terms` + `/legal/privacy` (v `2026-08-30.1`).
2. Engineer runs runbook §2 in order: secrets → Vault → EAS env → build → validate → internal track →
   `db push` (two migrations) → `functions deploy --use-api` → verification SQL → smoke SQL; records
   versionCode/function versions in `DEVELOPMENT_STATUS.md` "Remote deployment state".
3. Device QA per `docs/qa/ADR0015_DEVICE_QA.md`; push `main` to origin so the new CI gate runs.
