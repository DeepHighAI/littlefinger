# Handoff — i18n(ko/en) + in-app invite deep link + Pretendard: Phases 0–7 done, 8–10 remain

## Goal and current status

PO-approved plan at `C:\Users\batis\.claude\plans\firebase-hosting-fizzy-waterfall.md`
(read it first — phases, design decisions, glossary all there; ADR 0006/0007 in `docs/adr/`
carry the durable rationale). Session verification state at handoff: `npm test` (vitest 96
files + jest 68 suites/653 tests) PASS, `npm run typecheck` PASS, `check:agents` PASS, tree
clean at `125760f`. All work below is committed on local `main` and **pushed through
`acfb795`; commits after that are local-only** — push when PO asks.

## Done this session (commit per phase)

- **Phase 0**: web deployed twice to Firebase Hosting (Part K fonts/meta + Phase 4 store
  nudge live at littlefinger-app-philwoo.web.app). `firebase login` already valid.
- **Phase 1** `f1cd06d`: `+not-found.tsx` branded screen + font doc fixes.
- **Phase 2** `da4fbb4`: `packages/shared/src/i18n.ts` (Locale/Localized/resolveLocale/
  catalogKeyPaths/LOCALE_STORAGE_KEY/**LOCALE_DETECTION_ENABLED=false**/resolveInitialLocale)
  + `app-links.ts` (package/store-URL/invitePathOf/buildInviteWebUrl/**buildInviteAppIntentUri**)
  + mobile consolidation.
- **Phase 3** `50d4e27`: LocaleProviders (mobile: expo-localization+AsyncStorage, splash-gated
  via onReady; web: navigator.languages+localStorage+html lang), wired in `_layout.tsx` and
  `App.tsx`. Global jest mocks for AsyncStorage/expo-localization in `src/test/jest-setup.js`.
- **Phase 4** `7a834d9`: SCR-W01 "앱에서 계속하기" intent CTA (Android UA, store fallback,
  웹으로 계속하기 divider) + scr-w01-labels.ts + W03 store URL via shared builder. Deployed.
- **Phase 5** `2400d05`: in-app invite review — `callMobileFunctionPublic(+Native)`,
  `invite-review-api/-native/-state/-labels`, reworked `app/i/[token].tsx`
  (resolve→landing(login)→review→approve/decline/amend; witness→browser hand-off),
  root-layout `/i/` invariants pinned, EC-I01 traceability → `invite-review.test.tsx`.
- **Phase 6** `5d42fb6`: shared `*_BY_LOCALE` pairs (status/category/role/keeper/legal-doc
  labels, ERROR_MESSAGE, LEGAL_DISCLAIMER — ko is the SAME object as the legacy const),
  validators + `formatKstDate` + `completionKeepRateLabel` take `locale = 'ko'`.
  `i18n-maps.test.ts` guards identity + parity.
- **Phase 7 (web)** `125760f`: W01–W06 + response-complete + legal ALL converted to
  `useLabels` catalogs. LfDisclaimer renders `LEGAL_DISCLAIMER_BY_LOCALE[locale]` (still no
  text prop). `api-failure.ts`: `messageForFailure(failure, locale='ko')`,
  `INTERNAL_MESSAGE_BY_LOCALE`. W02 stores `failure` objects (not rendered strings) in
  RETRY/ActionError so language switches re-render errors. legal-content.ts has full en
  DRAFT translation with ko aliases kept. **Exception: `scr-w04-participant-promises.tsx`
  screen is NOT yet converted** — its complete bilingual catalog `scr-w04-labels.ts` exists
  (185 lines, key names chosen by the agent that wrote it; read it, then swap the screen's
  ~14 consts + 2 maps + inline JSX to `useLabels(SCR_W04_LABEL)` following the W02 pattern).
- Mobile Phase-8 head start: `profile-nickname` converted (pattern proof), and
  `localizedApiMessage(error, locale)` added to `mobile-api.ts` (not yet adopted by screens).

## Context that saves the next session real time

- **7 parallel conversion subagents died at the account usage limit (resets 21:00 KST)**;
  their finished artifacts (all web label files incl. W04, legal-content en, W05 labels) were
  kept and integrated; unfinished screen edits were completed by hand. If relaunching agents,
  the exact per-cluster prompts (glossary, verify commands, ownership lists) are in this
  session's transcript around the Phase 7/8 dispatch.
- ko must stay byte-identical until Phase 9 — tests intentionally keep asserting Korean
  literals. `LOCALE_DETECTION_ENABLED` in `packages/shared/src/i18n.ts` is the single switch.
- en copy cross-surface contract: app `INVITE_REVIEW_LABEL` unavailable*/done* strings ===
  web `SCR_W06_LABEL.reasonBody`/`RESPONSE_COMPLETE_LABEL.outcomeMessage` (byte-equal).
  A future parity test should pin this.

## Exact next steps (in order)

1. **Finish Phase 7**: convert `scr-w04-participant-promises.tsx` to its existing catalog
   (largest file; sub-components → own useLabels; `messageForFailure(f, locale)`;
   `*_BY_LOCALE[locale]` maps; `formatKstDate(date, locale)`). Then create
   `apps/web/src/labels-registry.ts` (array of all 8 web catalogs) +
   `i18n-parity.test.ts` (catalogKeyPaths(ko)===paths(en) per entry + fs check that every
   `*-labels.ts` under apps/web/src is registered). Verify + commit.
2. **Phase 8 (mobile bulk)** — remaining after profile-nickname: convert labels files
   scr-a02/a05(+MOD_01, +scr-a05-detail-state copy)/a06/a07(relative-time fns)/a08/
   mod-02(Intl locale param, keep Asia/Seoul)/mod-03 + consumers (home, promise detail,
   fulfillment, notifications, profile, sheets); extract in-file labels (invite.tsx,
   promise/edit.tsx, blocked-users.tsx, index.tsx→login-labels; onboarding, update-required);
   `promise-draft.ts` chips take locale; `push-registration-native.ts` channel name via
   `getCurrentLocale()`; mobile labels-registry + parity jest test. Screen tests keep
   asserting ko. Sub-commit per cluster. (3 ready-made agent prompts in transcript.)
3. **Phase 9**: flip `LOCALE_DETECTION_ENABLED` to true; add SCR-A08 언어 row (ko/en
   segmented, 48dp, text+state) and web `LocaleSwitch.tsx` caption in App shell; tests:
   en device renders en, override persists, html lang flips.
4. **Phase 10**: spec amendments (02 §4-3-1 store-nudge wording, EC-I01 in-app flow note,
   01 P6 note), CLAUDE.md §1-2 language row + §8-2 disclaimer per-locale (5 sites) + §5-2
   table rows (i18n.ts, app-links.ts) → `npm run sync:agents`; ops doc for M4 assetlinks
   Play-signing append; then `firebase deploy --only hosting` after Phases 7/9 web changes;
   push all commits.
5. Report to PO in Korean; flag: en legal texts/disclaimer are DRAFT pending 법무 검토;
   dev-build App Links manual QA (Chrome tap + KakaoTalk intent CTA) still to run (01 §11).

## Blocked / PO items

- 법무 검토: en legal drafts + en disclaimer (before launch).
- M4: Play App Signing SHA-256 append to assetlinks.json (ops doc to be written in Phase 10).
- Web LocaleSwitch placement/styling: implemented per plan default — flag to PO at review.
