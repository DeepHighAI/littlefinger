# Handoff — security review, login layout, invitation brand (2026-09-05)

## Goal of the session and current status

Work is on primary checkout `C:/DEV/littlefinger`, `main` at product commit `a9478a3`, pushed.
The PO authorized web deployment, a new app build, commit and push on September 5, then selected
APK only. Firebase target `web` is deployed; published HTML, JS and E-1 image match the local build.
EAS preview APK build `c9479ab1-c269-42d6-a86a-36d1a39de9fb` finished (0.3.0 / code 22).
Artifact: `dist/littlefinger-0.3.0-22-a9478a3.apk`; full hash and remote download URL are in
DEVELOPMENT_STATUS. ARM64, APK v2 signature, package/version and invitation App Links passed.
Read AGENTS.md, this file, then
`docs/notes/environment-gotchas.md` before continuing.

The earlier security fixes and PKCE change are already committed; both September 5 migrations
are already in production. Their permanent record is in `docs/DEVELOPMENT_STATUS.md`.

Current follow-up addressed the PO's S25 login text clipping and outdated invitation-web mark.
The layout changes and E-1 image are implemented, verified and released. The PO confirmed S25
display is correct. Bug 4 could not be reproduced; the PO will report a recurrence. Investigation
is deferred, not declared fixed. The PO now requests main commit/push and a Play-upload AAB.

The PO corrected Bug 4's time to **September 3 after 17:35 KST**, explicitly NOT September 5
09:57. September 3 has a WEB PARTNER APPROVE at 17:36:23 for `3efb18e4`. The requested historical
log window returned only September 4 events, so original post-approval requests cannot be traced.
The separate September 5 case `b5c21250` succeeded through approval and same-user home requests.
Its pinned-only response passes the current parser/reducer and native screen test. These facts
must not be conflated into a claim that the original incident is fixed.

## Files created / modified

- `apps/mobile/src/app/index.tsx`: scrollable login; legal/consent text gets explicit row width.
- `apps/mobile/src/components/LfButton.tsx`: full-width label container fills available row width.
- `apps/mobile/src/screens/scr-a02-home.test.tsx`: pinned-only response regression test.
- `apps/web/src/screens/scr-w01-invite-landing.tsx`: shared badge uses E-1 master and mascot tile.
- `apps/web/src/screens/scr-w01-invite-landing.test.tsx`: expected E-1 asset and classes.
- `docs/DEVELOPMENT_STATUS.md`: permanent investigation, PO correction, UI changes and checks.
- `docs/notes/environment-gotchas.md`: Management API log syntax and response-body limits.
- This handoff.

Visual artifacts are in
`C:/Users/batis/.codex/visualizations/2026/09/05/01a06f2f-14db-72e0-9f37-15d9d2329be0/`:
`login-font-1-after.png`, `login-font-15-after.png`, `invite-e1-production.png`.
No design-reference file, applied migration or production data changed.

## Decisions made + why

- Give block-button labels, legal links and consent text actual available width: the previous
  intrinsic/shrink-only sizing still clipped text in the PO's S25 screenshot. Keep font scaling,
  text strings and legal-consent gating; allow vertical reflow with ScrollView.
- Reuse `mascot-face-e1.png` and existing `.lf-mascot-tile` / `.lf-mascot--lg` classes: the approved
  artwork and tokens already exist, but the shared invitation badge still used the legacy mark.
- Do not invent a Bug 4 fix: the original incident and later healthy trace are distinct, and
  historical response bodies are unavailable. Do not repeat provider/RLS/retention investigations.

## Verification state

Passed `npm run typecheck` (five projects), `npm test` (Vitest 113 files / 2,163 tests;
jest-expo 82 suites / 897 tests), `npm run check:agents`, and `git diff --check`.
`npm run build:web` passed; the existing >500 kB chunk warning remains.
Focused checks: web landing 38 tests; native login/components 107 tests; home 13 tests.

Visual verification: existing Android API 36.1 development client on test emulator, current
release-mode JS (`expo start --dev-client --no-dev`), 360dp width, font scales 1.0 and 1.5.
All login/legal labels are complete; consent wraps at 1.5. Compared to the PO's clipped image.
The development-tool bubble is visible in captures; this is not an installed S25 release test.
The emulator font scale was restored to 1.0. No real device was touched.

Web: production build served locally with synthetic invite data; E-1 image loads, no horizontal
overflow or page errors, test login absent. Local HTTP omits the HTTPS-only app-intent CTA.
This is a display check, not a new two-provider OAuth approval reproduction.

## Blocked / PO-confirmation items

- Bug 4: wait for a recurrence report; current logs cannot establish the original cause.
- S25 login display was confirmed by the PO; this gate is closed.
- Existing PO-only gates remain: device QA, EC-A02 retry-removal policy and Play Console/upload.
  Deployment, APK build, commit and push are authorized; do not request permission again.
- The previous sideload QA APK is still
  `apps/mobile/android/app/build/outputs/apk/release/littlefinger-qa-20260905-9fddd48.apk`.
  It does NOT contain this session's layout changes and must not be presented as the new fix.

## The exact next step

Commit/push the PO confirmation, run the production EAS AAB build from main, then validate its
bundle, signature, version, App Links and production ad configuration. Record the artifact and
push the release record. Do not submit to Play as part of this packaging request.
If they continue Bug 4, use the corrected September 3 timeline in DEVELOPMENT_STATUS and obtain
incident-specific artifact/tab/promise evidence; do not investigate the unrelated September 5
09:57 approval again. Never edit an applied migration or the frozen design-reference baseline.
