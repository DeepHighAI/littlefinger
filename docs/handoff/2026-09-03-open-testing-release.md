# Handoff — open testing release (code 21)

Date: 2026-09-03
Replaces: `2026-08-30-monetization-retention-fix-batch.md` (its content lives in
`docs/DEVELOPMENT_STATUS.md`; ADR 0015 is deployed, so `docs/plans/` is now empty).

## Goal and status

Get `com.littlefinger.app` 0.2.0 onto the Play **open testing** track and submitted for Google's
first review. The console was read end to end (see `DEVELOPMENT_STATUS.md` "Open testing release
(2026-09-03)"); the engineer half is done up to the build, the PO half is a written step list.

Done this session:
- Code 21 source `711e181` — `android.blockedPermissions` (CAMERA · RECORD_AUDIO ·
  SYSTEM_ALERT_WINDOW) + startup `Promise.all` `.catch`; tests lock both. Pushed to `origin/main`.
- Runbooks: `docs/setup/open-testing-release.md` (engineer) and
  `docs/setup/open-testing-po-guide.md` (PO console steps, values, hand-back block).
- Docs caught up: listing doc (screenshots 8/8, category/tags per PO, 광고 ID + app-access rows,
  permission findings), status file (console findings, code 20 provenance, backlog), QA docs
  (code 20 provenance, name anonymized, EC 66), README gates, CLAUDE.md §10/§11 (org account →
  open testing), stale plan/handoff removed, unreferenced `design-reference/screenshots/` removed.

## Verification state

At `711e181`: Vitest 110 files / 2,142 tests · jest-expo 80 suites / 824 tests · five-project
`typecheck` · `git diff --check` — PASS. Local `expo prebuild` shows `tools:node="remove"` for the
three permissions. EAS production build `4ab9e13d-7c8e-48ab-9b67-c7d2f2ae4889` (versionCode 21,
from `711e181`) FINISHED and was validated: `dist/littlefinger-open-v0.2.0-code21.aab`,
83,253,576 B, SHA-256 `60ACD27C…EFE38D`, the three permissions absent, host/AdMob id/ABIs/signature
correct — full record in `DEVELOPMENT_STATUS.md` "Build 0.2.0 / versionCode 21".

## Blocked / PO items

All in `open-testing-po-guide.md` §1–§10, hand-back block §12. Blockers: 광고 ID declaration (locks
게시 개요), GCP consent screen → In production. Decisions still open: proceed without legal
`2026-08-30.2` (§8-1), N-1 record (§8-2).

## Exact next step

1. Done — the code 21 AAB is validated and recorded; it sits in `dist/` on the PO's machine with
   its SHA-256 in `DEVELOPMENT_STATUS.md`.
2. PO works through `open-testing-po-guide.md` §1–§9 and returns the §12 block. §4's production
   switch is already done; the open brand-verification items are the Search Console HTML tag
   (engineer adds it to `apps/web/index.html` and redeploys `hosting:web` when the value arrives)
   and the branding name fix (`리틀핑거`). The public home page at `/` is deployed.
3. Engineer runs `open-testing-release.md` §4-1 (password grant must be 4xx) after guide §5, then
   the PO submits (§10). Record the submission time in `DEVELOPMENT_STATUS.md`.
4. After approval: guide §11 and the backlog in `DEVELOPMENT_STATUS.md` "After open testing".
