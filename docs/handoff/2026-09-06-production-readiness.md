# Production readiness handoff

## Goal of the session and current status

The PO requested the remaining launch-critical work: real UMP/reward verification, refund-driven
permanent-access revocation, P6/P7 redesign completion, and a final signed AAB with Play-delivered
verification. The refund path and application convergence are closed. P6/P7 implementation and
the current source gates are closed. The release is still **not approved** because AdMob app
verification/app-ads.txt propagation prevents successful real UMP and rewarded SSV evidence, and
the new signed AAB/Play-delivered installation gate has not yet been completed.

Work is on `main` in `C:/DEV/littlefinger`. The Play-installed app remains 0.3.0/code 23 and keeps
its session. No production rollout, Firebase deployment, schema change or direct entitlement edit
was performed. Durable details are in `docs/qa/PRODUCTION_READINESS.md` and the latest section of
`docs/DEVELOPMENT_STATUS.md`.

## Files created/modified (paths)

- Mobile consent/ad fencing, privacy option and tests under `apps/mobile/src/` and
  `apps/mobile/config/`.
- P6 Home/detail/sheet changes and tests under `apps/mobile/src/app/`, `components/`, `screens/`
  and `theme/`.
- P7 acceptance-web screens, tests and new `apps/web/src/components/LfMascot.tsx`; deleted legacy
  `LfPinky.tsx`; updated `apps/web/index.html`, `app.html` and web tokens.
- Generated web brand files under `apps/web/public/brand/`; generator updated at
  `tools/export-brand-icons.js`; `.gitignore` now tracks this public directory.
- Canonical token retirement in `design-reference/styles/tokens.css`.
- Android bundle verifier and tests: `tools/verify-android-bundle.js`, its test, and package script.
- Documentation: `docs/qa/PRODUCTION_READINESS.md`, `docs/qa/ADR0015_DEVICE_QA.md`,
  `docs/setup/production-readiness-po-actions.md`, `docs/notes/environment-gotchas.md`,
  `docs/DEVELOPMENT_STATUS.md`, `CLAUDE.md` and generated `AGENTS.md`.
- This handoff replaces `2026-09-05-production-readiness.md`; the cited Kakao findings reference
  remains as the documented directory exception.
- Gitignored evidence under `dist/`, including refund UI, native 360dp/font-scale captures, web
  privacy capture, fixture APK, UMP probe materials and local source maps.

## Decisions made + why

Production rejects Google test publisher IDs, consent operations are serialized, and ad instances
are invalidated while privacy state changes. UMP privacy options remain visible only when the SDK
reports REQUIRED. Rewards remain server-granted through SSV; client earned events never grant.

The refunded order was reconciled through one ordinary `purchase-reconcile` worker invocation,
using the existing Vault-configured production path. No ledger or entitlement row was edited to
manufacture the result, and no other order was refunded.

P6 keeps the PO-approved one-page onboarding. Home history is the third filter (`지난 약속`) and
the weekly heading is personalized. P7 uses the existing approved E1 assets through reusable
mascot primitives. Nine unconsumed retired tokens were removed from all production token targets.
No legal copy, business policy, grant logic or frozen disclaimer changed.

Separate QA packages preserved the Play installation and were removed after use. Fixture evidence
proves layout only; real SDK/Billing evidence is labeled separately. Java 21 is required for local
Android builds because Java 25 fails in react-native-worklets; this is permanently recorded in the
environment notes.

## Verification state (what passed, what did not)

Passed: full Vitest 114 files/2,179 tests; jest-expo 84 suites/912 tests; five-project typecheck;
web production build; `check:agents`; `git diff --check`. P6 physical layout passed on SM-N981N at
exactly 360x800 dp and font scale 1.0/1.5 after fixing the discovered history-chip overflow. P7
Home, expired-link and privacy routes passed browser inspection; W01-W05 component tests cover
authenticated behavior. A fresh every-state screenshot matrix was not repeated.

Refund passed end to end. Worker response was HTTP 200,
`{"checked_count":1,"revoked_count":1}`. The scoped target is purchases=1, revoked=1,
buyer_permanent=false at `2026-09-05 16:21:12.882449+00`. A code 23 cold start shows ordinary
expiry `2026-10-07 00:00 (KST)` and `보관 기간 늘리기`, with no `영구 보관 중`.

Real UMP execution did not pass the user-visible consent gate: production app ID + corrected
isolated test hash + forced EEA still returned NOT_REQUIRED/no form, and privacy re-open reported
that a form is not required. The real code 23 RETENTION_30D request failed with Mobile Ads load
code 2 after about one minute; there is no SSV grant. This is not successful reward evidence.

The final signed AAB and Play-delivered installation are not yet verified. Earlier code 23 excludes
the current changes. The web build succeeds with a non-fatal 614.70 kB chunk-size warning.

## Blocked / PO-confirmation items

No further PO action is needed for the European message or the refunded order; do not publish the
message again or refund another purchase. The developer website was set September 5 23:15 KST and
opens from the public Play listing. AdMob still shows `검토 필요`; its app-ads.txt table has not
discovered the app and the console says domain changes may take up to seven days. Recheck after the
crawler propagates. Actual UMP choice/re-open and rewarded SSV remain blocked on that external
AdMob readiness state.

The documented `apps/mobile/.secrets/play-service-account.json` is absent, so automated EAS submit
cannot install a new bundle through the Play internal track. A signed AAB can still be built with
remote EAS credentials, but Play-delivered verification requires either the key or a manual internal
track upload. Do not publish to production merely to satisfy this gate.

Creator-side permanent purchase, interrupted purchase recovery and two-party FINISH remain broader
scenario coverage, not regressions found in this pass. Do not make a real-money purchase or mutate
production retention records to simulate expiry.

## The exact next step

Build the production AAB from the fully verified current source with remote EAS credentials. Record
the build ID, git commit, version code, artifact URL, byte size and SHA-256. Download it and run the
bundle verifier, bundletool validation, signing-certificate, manifest/permission/SDK/ABI, AdMob ID,
App Links, debug/mock/source-map and secret checks. Do not call it final if any check fails.

Upload that exact AAB only to the Play **internal** track as a draft, using the missing service key
if supplied or a manual console upload by the PO. Install through Play, confirm installer/source
version and smoke-test session, Home, Profile privacy entry, promise detail/retention and Billing.
Production rollout remains prohibited until AdMob app verification permits an actual EEA UMP form
choice/re-open and a real test-device rewarded ad produces one server SSV grant idempotently.
