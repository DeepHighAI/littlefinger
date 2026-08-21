# Handoff — current state after the i18n/deep-link pass and the repository cleanup

Date: 2026-08-22. This replaces every earlier handoff. `CLAUDE.md` §1-1 keeps exactly one, so
knowledge that outlives a session now goes to
[`docs/notes/environment-gotchas.md`](../notes/environment-gotchas.md) (permanent) instead of
accumulating here. The only other handoff kept is
[`2026-07-26-kakao-supabase-oauth-findings.md`](2026-07-26-kakao-supabase-oauth-findings.md),
because `CLAUDE.md` §6-1 and `supabase/config.toml` cite it as the source of truth for the
Dashboard auth config.

## Where the product stands

Feature-complete locally for the approved MVP scope. Status detail — implemented scope, remote
deployment state, verification results, release gates — lives in
[`docs/DEVELOPMENT_STATUS.md`](../DEVELOPMENT_STATUS.md); it is the living document and this file
does not duplicate it.

Shipped in the last pass (2026-08-20/21, commits `f1cd06d`…`cb23baa`, all pushed):

- **Korean/English client UI** (ADR 0006) — no i18n library; `Localized<T>` typed catalogs on both
  surfaces, registry-driven parity tests, cross-surface copy contract test. Device-locale detection
  is **ON**; `LOCALE_DETECTION_ENABLED` in `packages/shared/src/i18n.ts` is now the kill-switch that
  forces Korean everywhere if it is ever needed. Manual toggles: SCR-A08 row (app), fixed
  `LocaleSwitch` (web). Server-rendered copy — notification rows, error envelopes — stays Korean.
- **In-app invite deep link** (ADR 0007) — App Links open the app straight into review/approve/
  decline/amend (`surface='APP'` recorded); SCR-W01 carries an Android-only `intent://` CTA that both
  escapes KakaoTalk's in-app browser and falls back to the Play Store; witness tokens keep the
  browser hand-off.
- **Pretendard** verified on both surfaces; branded `+not-found` screen.

## What this cleanup pass changed

- New permanent note `docs/notes/environment-gotchas.md`; 14 superseded handoffs deleted (git history
  keeps them).
- `docs/superpowers/` (16 plans + 6 specs) and `docs/_archive/` (3 prior-revision specs) deleted.
- i18n leftovers fixed — SCR-W05, SCR-W01 and the in-app invite review were still rendering Korean
  labels/errors under an English locale; dead ko aliases and the `invite-link.ts` re-export shim
  removed.
- Drift corrected in `CLAUDE.md`/`AGENTS.md`, ADR 0006, `docs/DEVELOPMENT_STATUS.md`,
  `docs/qa/EC_TRACEABILITY.md`, `01_상위기획서.md`, `01_와이어프레임_디자인요청서.md`, and
  `supabase/config.toml` (two functions were missing their `verify_jwt` declaration).
- `CLAUDE.md` §1-1 now carries the retention rule that makes this stick: one handoff at a time, and
  durable knowledge moves to `docs/notes/` before the old file is deleted.
- Web redeployed after the i18n fixes; the live bundle carries them.

## Open items for the PO

1. **English legal texts and the English disclaimer are DRAFT** pending review — the Korean
   `LEGAL_DISCLAIMER` stays verbatim-immutable, the English pair does not have that status yet.
2. **Deep-link manual QA on a device** — [`docs/setup/deeplink-dev-qa.md`](../setup/deeplink-dev-qa.md).
   Note the two paths have different pass conditions: the intent CTA works with the local debug APK,
   plain-link auto-open needs an EAS-signed build (certificate, not code).
3. **M4: append the Play App Signing SHA-256** to `assetlinks.json` —
   [`docs/setup/assetlinks-play-signing.md`](../setup/assetlinks-play-signing.md). Skipping it makes
   store installs lose App Links silently.
4. Remaining release gates (Kakao two-account E2E, TalkBack, closed testing) are listed in
   `docs/DEVELOPMENT_STATUS.md` §"Exact next step".

## Starting a session from here

Read `CLAUDE.md` first (it outranks this file), then `docs/DEVELOPMENT_STATUS.md` for status and
`docs/notes/environment-gotchas.md` before debugging anything environmental. Verification is always
`npm test && npm run typecheck && npm run check:agents`.
