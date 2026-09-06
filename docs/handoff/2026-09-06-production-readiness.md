# Production readiness handoff

## Goal of the session and current status

The PO requested the remaining launch-critical work: real UMP/reward verification, refund-driven
permanent-access revocation, P6/P7 redesign completion, and a final signed AAB with Play-delivered
verification. The refund path and application convergence are closed. P6/P7 implementation,
current source gates, the signed code 24 AAB and Play-delivered installation are closed. The
release is still **not approved** because AdMob app verification/app-ads.txt propagation prevents
successful real UMP and rewarded SSV evidence.

Work is on `main` in `C:/DEV/littlefinger`. The physical device now has Play-delivered 0.3.0/code
24 and keeps its session. No production-track rollout, Firebase deployment, schema change or
direct entitlement edit was performed. Durable details are in `docs/qa/PRODUCTION_READINESS.md`
and the latest section of `docs/DEVELOPMENT_STATUS.md`.

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
  privacy capture, fixture APK, UMP probe materials, code 24 AAB inspection, Play installation /
  Billing captures, interrupted-purchase recovery, TalkBack/accessibility hierarchy, actual-app
  360x800 dp/font-scale 1.5 captures and local source maps.

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

Final artifact passed. EAS build `8ab2a75f-f581-4138-a660-a0a368151c3d` produced 0.3.0/code 24
from `938811b`. The 85,560,762-byte AAB SHA-256 is
`42616C53DDD4AE1413FE645BC0B356094AB0E7210AF749219C8FECEFA4FFEDEF`; bundletool, JAR signature,
certificate, manifest/permission/SDK/ABI/AdMob/App-Link, source-map/debug/mock and secret checks
passed. Play internal release 15 was published at 02:13 KST. The SM-N981N updated through Play at
02:15 KST and reports code 24 with installer `com.android.vending`. Session, redesigned Home,
refund-derived ordinary retention, and the real Billing product sheet passed; purchase was canceled.

Partner-side interrupted permanent-purchase recovery passed on the Play-delivered code 24 app. The
app process was stopped while Billing was open, and no-charge test order
`GPA.3399-5562-9509-45980` completed while the app was absent. No new server row existed before
relaunch. Opening retention after relaunch reconciled exactly one new purchase
(`c4e91129-dad9-40e9-b397-3194b1a3d14e`), set `partner_permanent=true`, and survived another cold
start as `영구 보관 중`. The scoped two-row ledger has one active and one older revoked purchase
across two distinct orders. Do not refund the new order without explicit PO direction.

Google OAuth sign-out, signed-out cold restart and re-login passed. TalkBack focus order and labels
were inspected on representative Home, detail and fulfillment controls without submitting a
fulfillment result. The actual Play app passed 360x800 dp/font-scale 1.5 reflow for Home,
notifications, full Profile and the fulfillment form. The device was restored to physical
1080x2400, density 450, font scale 1.0, with accessibility disabled.

Real UMP execution did not pass the user-visible consent gate: production app ID + corrected
isolated test hash + forced EEA still returned NOT_REQUIRED/no form, and privacy re-open reported
that a form is not required. The real code 23 RETENTION_30D request failed with Mobile Ads load
code 2 after about one minute; there is no SSV grant. This is not successful reward evidence.

The Play-delivered code 24 rewarded retry created one new PENDING RETENTION_30D intent at
`2026-09-05 17:18:00.099973+00`, left the benefit locked and produced no grant. This is expected
fail-closed behavior, not successful rewarded/SSV verification. The web build succeeds with a
non-fatal 614.70 kB chunk-size warning.

The public app-ads endpoint is now reachable and consistent on both legacy and current domains:
`https://littlefinger-app.web.app/app-ads.txt` and
`https://littlefinger-app-philwoo.web.app/app-ads.txt`.
Both currently return:
`google.com, pub-9625042173735017, DIRECT, f08c47fec0942fa0` (checked at
`2026-09-06 11:54:03 KST`).

## Blocked / PO-confirmation items

No further PO action is needed for the European message or the refunded order; do not publish the
message again or refund another purchase. The developer website was set September 5 23:15 KST and
opens from the public Play listing. AdMob still shows `검토 필요`; its app-ads.txt table has not
discovered the app and the console says domain changes may take up to seven days. Recheck after the
crawler propagates. Actual UMP choice/re-open and rewarded SSV remain blocked on that external
AdMob readiness state.

The documented `apps/mobile/.secrets/play-service-account.json` remains absent, but manual Play
Console upload closed the internal-track installation gate. Future automated submits still require
that key. Do not publish to production merely to repeat this gate.

Creator-side permanent purchase and two-party FINISH remain broader scenario coverage. The PO
explicitly skipped the Kakao login required for the creator account in this run, so both are
recorded as skipped rather than failed. Partner interrupted-purchase recovery is closed. Do not
make a real-money purchase or mutate production retention records to simulate expiry.

## The exact next step

Recheck the AdMob app and app-ads.txt table after crawler propagation (first meaningful check after
September 6 23:15 KST; investigate if absent after September 12 23:15 KST). Once verification is
ready, use the Play code 24 test installation and forced-EEA debug geography to record an actual UMP
choice plus privacy-options re-open. Then complete one real rewarded ad and prove exactly one
`ADMOB_SSV` grant for its intent, including duplicate-callback idempotence. Production-track
promotion remains prohibited until both pieces of evidence pass.
