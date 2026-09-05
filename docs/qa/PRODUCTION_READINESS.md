# Production readiness review

Snapshot: 2026-09-06 KST. **NOT READY: implementation gates pass, but AdMob UMP/SSV and the final
Play-delivered artifact gate remain open.**

## September 6 implementation and device closure

- The normal production `purchase-reconcile` worker was invoked once for the explicitly confirmed
  refund path. It returned HTTP 200 with `checked_count=1` and `revoked_count=1`. A scoped read then
  found purchases=1, revoked=1 and buyer_permanent=false for the September 5 21:45 KST target.
  No direct purchase, entitlement or retention row was changed.
- Cold-started the Play-installed code 23 app and reopened the target promise. The former
  `영구 보관 중` state is gone; it shows ordinary expiry `2026-10-07 00:00 (KST)` and
  `보관 기간 늘리기`. Evidence: `dist/play-after-refund-bottom.png` and matching UI XML.
- Completed P6 native scope: personalized weekly Home summary, three state/history chips and final
  detail-token consumers. Physical fixture checks passed at exactly 360x800 dp, font scale 1.0 and
  1.5; the 1.5 overflow found in the first pass was fixed with the shorter `지난 약속` label and
  wrapping chips. Evidence: `dist/readiness-home-360dp-font1.png` and
  `dist/readiness-home-360dp-font1.5.png`.
- Completed P7 web scope: E1 mascot primitives replace the legacy pinky component; W01-W06 use the
  approved pastel card/status hierarchy; favicon 32/192, Apple touch 180 and 1200x630 OG assets are
  generated into `apps/web/public/brand/`. Home, W06 and privacy were browser-inspected; automated
  component tests cover authenticated W01-W05 behavior. This pass did not recreate every possible
  authenticated/status screenshot.
- Removed nine retired design tokens from the canonical reference, mobile and production web token
  targets. Current mobile token parity is exact at 176 entries.
- Full verification passed: Vitest 114 files/2,179 tests; jest-expo 84 suites/912 tests; five-project
  typecheck; web production build; `check:agents`; and `git diff --check`. Web output is 614.70 kB
  (179.75 kB gzip) with the existing non-fatal chunk warning.
- A real isolated UMP request with the production app ID, correct test-device hash and forced EEA
  geography still returned NOT_REQUIRED/no form; the privacy form was not required. The earlier
  real rewarded request still ended with Mobile Ads code 2 and no SSV grant. AdMob app verification
  remains pending while app-ads.txt discovery propagates, so neither actual consent choice/re-open
  nor reward grant can be marked passed.
- Disposable QA packages were removed and device density/font scale restored. The original Play
  package and session remain. No production rollout was performed.

## Production-mode bundle verification follow-up

- Added `npm run verify:android-bundle -- <source-map>` with 14 passing regression tests.
  It requires the bounded query parser, consent wrapper, actual AdMob and IAP modules; rejects
  old query-string/decode-uri-component modules and known readiness/mock source paths.
  This is module-inclusion evidence, not a complete secret scan or proof of runtime consent.
- Exported current Android source with `EAS_BUILD_PROFILE=production`, Hermes and source maps;
  normal Expo Router entry and unchanged Metro configuration. Export passed (2239 modules).
  Used only EXPO_PUBLIC values from root .env plus the six documented production AdMob IDs in
  the command environment. No environment file or remote EAS configuration was changed.
  Initial export correctly failed for missing local AdMob variables; a helper attempt also
  failed because dotenv was not installed, then used Node's built-in parseEnv.
- `verify:android-bundle` output: `Android 번들 모듈 검증 통과: 2182개 소스`.
  Artifact: `dist/readiness-production-export/_expo/static/js/android/entry-26fea2904c28fc6abc833f14599f01eb.hbc`.
  SHA256: `E67F54F02BEF24D5EF3A3FD863393A30348BF050DAB2F2DFD0FE5446D268DB63`.
  Keep source maps local/gitignored; they contain source text and must not be uploaded publicly.
  Repeat this check on the map belonging to the final signed artifact. This export is not an AAB.
- Baseline full `npm test` exited 0 (113 Vitest files/2163 tests; 84 Jest suites/918 tests).
  New verifier separately passed 1 file/14 tests. Post-edit five-project typecheck, check:agents,
  and git diff --check passed. Web production build passed; 612.84 kB chunk warning remains.
- Android export also includes multiple icon font families and the full Material Symbols font
  alongside the subset. Review import reachability for size reduction before the final artifact;
  do not delete assets solely from this inventory. No UI was changed in this follow-up.
- Latest `adb devices` returned no attached devices. Physical QA cannot resume until reconnected.
  No signed AAB, production deployment, store upload, new purchase/refund or live worker mutation.

Remaining release work, in order:

1. Reconnect phone; verify target refund through real reconciliation (next schedule September 6,
   12:17 KST), then app state. Do not manually insert a revocation or refund another order.
2. Complete accepted P6 native batches and P7 acceptance-web redesign with required visual checks.
3. After AdMob verification, prove actual UMP choice/re-open and rewarded SSV grants on a test
   device; complete creator/interruption purchase and two-party scenarios.
4. Build signed AAB from finished source, inspect manifest/permissions/signing/ABIs/assets/debug
   exclusion/secrets and matching source map, then verify Play-delivered installation and flows.
   Retain existing privacy/store-console/business gates; passing local tests is not release approval.

## PO console confirmation and read-only refund diagnosis

- Website setup completed September 5 at 23:15 KST; PO confirmed the public Play listing opens
  the website. The app-ads.txt table is empty, and the console explicitly allows up to seven days
  for domain-change detection. Do not repeat website setup or infer a file mismatch from no row.
  Suggested first recheck September 6 at 23:15 KST; investigate if still absent September 12 at
  23:15 KST. This is a recheck window, not a promised approval time or a scheduled monitoring job.
- PO confirmed the European message is published, Littlefinger selected, targeting EEA/UK/Switzerland,
  publication date September 5. Actual UMP form remains unverified; do not ask for publication again.
- PO confirmed the target permanent test order was refunded with revocation selected at
  September 5, 13:47:19 UTC / 22:47:19 KST. App still displays permanent access.
- Read-only scoped ledger query: purchases=1, revoked=0, buyer_permanent=true. This is not merely
  a stale UI label: the server entitlement has not been revoked yet.
- Live cron: lf-purchase-reconcile active=true, schedule `17 3 * * *`; latest launch September 5
  03:17 UTC, before the refund. Next scheduled launch is September 6, 03:17 UTC / 12:17 KST.
  Cron succeeded means the dispatch SQL succeeded, not proof the HTTP worker processed refunds.
  No manual worker invocation, schedule change or direct entitlement write was performed.
- PO screenshot separately shows AdMob Requires review / Verify app to lift limit / limited ads.
  This is an app verification/readiness gate, not proof the European message is unpublished or
  the cause of the earlier ad load code 2. Follow app-ads.txt verification then readiness review.

## Second device follow-up — September 5, 21:30–22:05 KST

- Real UMP SDK probe built as a separate debug-signed `com.littlefinger.app.umpqa` release APK,
  with the documented production AdMob app ID. Manifest and source-map inspection confirmed
  the real SDK, product `showAdsPrivacyOptions` wrapper and no GMA mock. No ad was requested in
  this probe. Build passed in 2m17s, then 1m36s after correcting the probe's debug-device hash.
- The Play app's hash is `278D76522FF9E640A4DB636E0016313E`; the isolated debug-signed app's
  SDK reported `79901B55E3D757DF18BC3512863B7EC5`. Do not reuse the first hash for the second
  installation. Both the initial ordinary-region request and subsequent EEA requests using the
  corrected hash returned `NOT_REQUIRED`, `isConsentFormAvailable=false`, `canRequestAds=true`.
  Reset was limited to the isolated QA app. Product privacy re-open returned
  `Privacy options form is not required.` **No actual EEA form/choice/re-open success was proven.**
  Published European-regulations message/app association and the isolated-package condition need
  investigation. Do not infer a production privacy defect solely from this probe. PO was asked
  for the AdMob message screen; no answer received at this checkpoint.
- Installed Play code 23: a real RETENTION_30D attempt created one intent at
  `2026-09-05 12:43:27.11656 UTC`. Mobile Ads reached its load request, then reported
  `Ad failed to load : 2` about one minute later. UI stayed locked; recent ADMOB_SSV grants=0.
  Read-only device diagnostics found validated Wi-Fi and no configured private DNS override.
  This is an unsuccessful ad load, **not** successful rewarded/SSV verification.
- Same code 23, partner role: Play Billing explicitly showed the always-approved test card and
  no-charge notice for `promise_permanent_access` / KRW 2,000. A no-charge order completed at
  `2026-09-05 12:45:18.741689 UTC` (21:45 KST). UI applied permanent access, and a cold restart
  retained `영구 보관 중`. Scoped ledger: one purchase/order/token, granted_slots=0, buyer access
  true, creator access false, no revocation at the last probe. Captures:
  `dist/readiness-permanent-purchased.png`, `dist/readiness-permanent-cold.png`.
  This is partner-side code 23 evidence, not creator/interruption/new-artifact evidence.
- Refund remains **NOT RUN**. The documented local Play service-account file is absent, and no
  Chrome MCP console connection is available. PO was asked to refund/revoke only the 21:45 KST
  no-charge permanent order in Play Console, not earlier purchases. No refund confirmation received.
  Do not fabricate revocation through a database write; verify the real reconciliation path after
  console refund. The test purchase remains effective at the last read.
- Found a real UI defect: after unavailable rewarded ads followed by successful permanent purchase,
  MOD-05 retained its locked message/irrelevant ad pitch and clipped purchase confirmation at the
  bottom. Fixed visibility from server-returned `permanent`; added a shrinking ScrollView and
  safe-area bottom padding. Added regression coverage, without changing grants or legal copy.
- Advanced **MOD-05 only** in P6: purchase offer now uses the frozen gallery's yellow tilted
  sticker and plain inventory trailing icon; current entitlement has the appropriate status icon.
  Removed obsolete sheet styles. Shared LfSheet title gets bounded flex width so long titles wrap
  without moving Close off-screen. LfButton now explicitly defaults its accessible name to its
  label (caller override preserved), preventing decorative glyphs from changing the button name.
- Physical layout fixture used real components/fonts with mocked purchase/backend. Compared
  pre-fix purchased screen against corrected result; ko 360dp font1/1.5 and en 360dp font1.5
  passed layout inspection. Long English content scrolls to the complete purchase button with
  Close retained. English duration title wraps to two lines. Simulated unavailable-ad → purchase
  removes stale lock/ad pitch and leaves readable success. These are **layout**, not Billing,
  evidence. Captures: `dist/readiness-entitlement-ko-1.png`, `...-ko-1_5.png`, `...-en-1_5.png`,
  `...-en-1_5-scrolled.png`, `...-purchased-1_5.png`, `dist/readiness-duration-en-1_5.png`.
  Frozen HTML/CSS was inspected; no new full browser-gallery visual audit was run.
- Full `npm test`: **113 Vitest files / 2163 tests**, **84 Jest suites / 918 tests**, exit 0.
  Earlier failures were missing safe-area test context and decorative-icon accessible naming;
  fixed with partial mocks preserving SafeAreaView and an explicit button label, not weaker assertions.
  Typecheck/check:agents/diff checks passed before final documentation. No web source changed.
- QA packages `.umpqa` and `.readinessqa` were uninstalled; original Play app/session retained.
  Density restored to 450; font scale 1.0. Generated manifest and Metro temporary wiring restored.
  Probe/layout APKs under `dist/` have explicit non-release names; no generic app-release.apk left.
  The layout APK predates the final accessibility-label-only fix; full source tests include that fix.
  **No new production AAB, upload or deployment.** P6 other screens, P7 web and final artifact gates
  are still open. Passing this sheet or these tests does not close the production-readiness request.

## Follow-up on September 5 (evening)

- Implemented localized Profile ad privacy settings when UMP reports REQUIRED, independent of
  exposure flags. Focus refresh uses cached requirement status when offline. Repeated presses
  share one operation; failure is visible and retryable. UMP operations are serialized.
- Opening privacy options invalidates existing and pending ads. Native ads are destroyed, banner
  children unmount, and readiness results from an earlier consent generation fail closed. Closing
  the form causes a fresh consent check, including after errors. A banner disabled/re-enabled after
  no-fill no longer retains stale ready/loaded/failed state. Rewards remain server-granted only.
- Updated ten transitive lockfile entries within their existing allowed ranges: xmldom 0.8.15 /
  0.9.12, brace-expansion 1.1.18 / 5.0.9, js-yaml 3.15.2 / 4.3.2 and nanoid 3.3.18. No manifest
  dependency ranges, Expo version or SDK versions changed. `npm audit --omit=dev` decreased from
  25 (8 high / 17 moderate) to **21 (5 high / 16 moderate)**. Remaining roots include image-size,
  decode-uri-component and uuid; parent propagation is still not an exploitability count.
- Corrected the stale Q-5 gate: DEVELOPMENT_STATUS's August 23 PO decision and the typed labels
  both confirm **single-page onboarding, option (b)**. Do not add pages 2–3 as missing work.
  CLAUDE.md was corrected and AGENTS.md regenerated through `npm run sync:agents`.
- Physical SM-N981N is connected and unlocked. Installed package is 0.3.0 / code 23, installer
  `com.android.vending`. Home and Profile navigation worked; the slot sheet showed server-backed
  usage 3 / 8 and the ₩1,000 action. The Play Billing sheet then explicitly showed
  `테스트 카드, 항상 승인` and `테스트 주문이므로 청구되지 않습니다`. One no-charge test purchase
  was completed at 20:46 KST: the app showed `슬롯이 추가됐어요` and usage **3 / 9**. A scoped
  recent-ledger aggregate returned exactly one row, one distinct order, one distinct token and
  granted_slots=1 (created 11:46:59 UTC). No account was logged out and the Play installation was
  not replaced. Cold restart retained 3 / 9, and the ledger still held one recent row/token/grant.
  This verifies code 23, not the newly modified sources.
- Live read-only worker audit: previous six-hour window had 67 HTTP responses, all 200, no
  timeout/transport error. Response shapes: push-send 37, account-delete-retry 24, retention 6.
  Retention failed_count=0 with no purge jobs; account deletion retry_count=0 with no deletions;
  push failed counters=0 with no ticketed/delivered items. These are idle-worker health signals,
  **not** populated-workflow E2E proof. Daily purchase-reconcile was outside this retained window.
  Latest 100 Edge HTTP log entries also had only 200/204. Stage-caught errors still require
  console-log evidence; HTTP 200 alone is insufficient for push workers.

Verification at this checkpoint: focused 5 Jest suites / 53 tests; full mobile 83 suites / 915
tests, followed by a separate native-consent integration test (1 / 1); five-project typecheck
passed. **Post-lockfile full `npm test`: 113 Vitest files / 2163 tests and 84 Jest suites / 916
tests passed.** Typecheck, web build and check:agents also passed. Web output remains 612.84 kB
(179.18 kB gzip). A later SDK-initialization race assertion and full mobile rerun also passed
(84 / 916), followed by typecheck. No new production AAB or real UMP/SSV result is claimed here.
Slot purchase evidence is explicitly scoped to installed code 23.

Physical layout verification used a separately signed `.readinessqa` fixture APK with the actual
Profile component, real fonts/tokens and mocked router/backend/ads APIs. Initial fixture builds
failed due to Gradle extension resolution and an ignored Expo bundleConfig; a first fixture launch
crashed because real router hooks were not substituted. These were **QA harness failures**, not
production-app crashes. Corrected source-map checks confirmed fixture mocks included and real
router/backend wrappers absent. Final fixture build succeeded in 2m15s. Temporary metro.config.js
wiring was restored exactly after bundling; no fixture hook is retained in product source.

Verified on SM-N981N at width 360dp: Korean font scale 1.0 and 1.5, English font scale 1.5. New
privacy row did not clip or overlap adjacent legal rows and remained 144px / 48dp high. Pressing it
opened the explicitly labeled mock form. Screenshots under gitignored `dist/`:
`readiness-privacy-ko-360-font1.png`, `readiness-privacy-ko-360-font1_5.png`,
`readiness-privacy-en-360-font1_5.png`. A fixture form is **not** live UMP evidence.
Visual comparison against installed code 23's legal card (`readiness-privacy-baseline-code23-360-font1.png`)
confirmed the existing legal rows, card tokens and disclaimer were retained with the additional
privacy row. The device density was restored from the temporary 480 override to physical 450;
font scale restored to 1.0. The disposable `.readinessqa` package was uninstalled; the Play app,
session and its test-purchased slot remain. QA APKs are explicitly named fixture-only and are not
release artifacts. The generic app-release.apk was renamed to prevent accidental distribution.

Remaining dependency reachability review:

- `image-size@1.2.1` is used by Metro's `src/Assets.js` on build-time asset bytes. It is not used
  by the product's runtime evidence-upload code. Reviewed repository assets are the current input
  boundary; untrusted assets can still attack builds. A supported Metro/dependency upgrade remains
  preferable to an untested major-version override.
- `uuid@7.0.3` comes from xcode; `xcode/lib/pbxProject.js` calls `uuid.v4()` for generated project
  IDs. The reported buffer-bound advisory concerns v3/v5/v6 with caller-provided buffers, not
  this inspected call. This is build tooling, not the application's UUID generator.
- `decode-uri-component@0.2.2` comes through Expo Router's query-string. The existing
  `metro.safe-query-resolver.js` substitutes the bounded local parser for every query-string
  import; its regression tests passed in this run. Verify substitution in the final production
  artifact, not only the QA fixture bundle. The vulnerable lockfile entry still exists.

The PO requested a thorough production review including implementation of missing features and
bugs, completion of the approved redesign, useful code improvements, security/privacy review,
AdMob and paid-product verification, and discovery/featuring opportunities. This first pass does
not close that request. Do not submit the existing code 23 AAB as a fully reviewed release.

## Implemented in this pass

- Production AdMob configuration rejects Google's test publisher for the app ID and all five ad
  units. Previously valid-format test IDs passed the production build gate. Six regression cases
  cover accidental test configuration; preview/development still use test IDs.
- Concurrent ad readiness requests share one in-flight consent operation, preventing overlapping
  consent-form requests. Failures clear the operation so the next attempt can recover; SDK
  initialization remains once per successful initialization. Later requests still recheck consent.
- Unsettled onboarding/minimum-version startup reads retry when AppState becomes active. An
  attempt counter prevents a delayed earlier read from overwriting the newer result. Completed
  startup does not repeat, and the subscription is removed on unmount. This addresses the documented
  parked-startup follow-up only; it does not claim to repair every possible stalled native/session
  operation or reproduce the separate September 3 empty-list incident.

These changes are local and uncommitted. They are not in the code 23 AAB. No production data,
flags, deployed functions, store release, or frozen design baseline was changed.

## Six-area findings and remaining work

| Area | Evidence / result | Next required work |
|---|---|---|
| Features and bugs | Existing tests pass; parked-startup follow-up implemented. September 3 Bug 4 remains unconfirmed, per PO's earlier instruction to wait for recurrence. Q-5 is closed: approved single-page onboarding. | Exercise both real OAuth providers after PKCE, evidence upload, cold-start push, two-party approval and FINISH flows. |
| Redesign | Component/token phase P5 is present. Status explicitly says P6 native screen layouts and P7 web markup are incomplete. Current web build still includes both legacy brand-symbol images. DESIGN.md's main palette/layout prose also trails the approved pastel plan. | Compare each actual screen against the frozen 41-screen gallery, finish P6/P7 and brand derivatives, verify 360dp and font scale 1.5 plus web paths, then reconcile DESIGN.md/ADR/status. No visual completeness claimed in this pass. |
| Efficiency | Consent work deduplicated and startup stale results fenced. Web build emits a 612.84 kB JS chunk (179.18 kB gzip). | Evaluate route-level splitting of legal/support screens and measure invite loading/CLS before and after; preserve prerendered public home and OAuth behavior. Avoid unrelated rewrites. |
| Security/privacy | Live RLS/public-storage/approval-hash probes below pass. UMP privacy entry and mounted-ad invalidation are implemented and unit/integration tested. Dependency graph warnings decreased to 21; scoped reachability review is above. | Finish physical layout and EEA/debug consent flow; verify mitigations in the final artifact. Recheck published privacy/Data safety against actual SDK behavior. |
| AdMob/purchases | Live exposure flag false; rewarded flag true. Purchase ledger has 8 slot and 1 permanent-access records. Reward intents have 5 PENDING and 1 REJECTED, no successful grant evidence. | Confirm current AdMob readiness/store linkage and all three SSV URLs in console; verify actual rewarded grants and repeated callback idempotence, both purchase roles, interrupted permanent purchase recovery, refund revocation and retention cases. Ledger existence is not current-release E2E proof. |
| Discovery/featuring | Localized E-1 graphics exist; stored inventory has 10 phone candidates per locale, while Play accepts at most 8 per device type. | Choose an 8-image sequence matching implemented screens, replace store assets, evaluate Android vitals, accessibility and larger-screen layout. Assess in-app review only after core reliability; no incentives or positive-rating screening. Featuring is not guaranteed by an API or a feature. |

## Live read-only verification

Project: `vepnrrmxvsytguocicfe`. Probes used Supabase tools and selected aggregates only; no
user contents, raw tokens, credentials, or full log metadata were retained.

| Check | Result |
|---|---|
| Public ordinary tables without RLS | 0 |
| Public Storage buckets | 0 |
| authenticated SELECT on approvals.ip_hash | false (0 findings) |
| Security Advisor | 18 INFO no-policy server-only tables; 1 WARN leaked-password protection; no ERROR reported. Existing status records email/password disabled; auth-provider configuration was not freshly rechecked in this pass. |
| app_configs | ads_enabled=false; rewarded_ads_enabled=true; min_app_version=0.2.0 |
| Purchase ledger aggregates | promise_slot_plus1=8; promise_permanent_access=1 |
| Reward intent aggregates | PENDING=5; REJECTED=1; no GRANTED row returned |
| Scheduled tasks | All 13 listed jobs active. In previous 48 hours, 11 jobs have only succeeded entries; weekly evidence/integrity jobs have no run in that window. |

Cron success proves scheduler execution, not success of asynchronously enqueued HTTP requests or
the business outcome of the Edge worker. Worker response/error review remains required.

GitHub operational evidence:

- [Latest keep-alive](https://github.com/DeepHighAI/littlefinger/actions/runs/33944331190): success,
  2026-09-05 04:21 UTC.
- [Latest weekly backup](https://github.com/DeepHighAI/littlefinger/actions/runs/33337369998): success,
  2026-08-30 21:47 UTC. No restore drill or fresh backup was run in this review.
- [Latest main CI](https://github.com/DeepHighAI/littlefinger/actions/runs/33942556065): success,
  2026-09-05 03:41 UTC; predates this pass's local edits.

## Dependency audit

`npm audit --omit=dev --json`: **25 findings: 8 high, 17 moderate, 0 critical** (exit 1).
This is an npm dependency graph result, not 25 independent exploitable app vulnerabilities.
Direct advisory roots include xmldom, brace-expansion, decode-uri-component, image-size, js-yaml,
nanoid and uuid. Expo/Metro build dependencies also propagate findings into parent packages.
The previous bounded query-string router replacement remains in place; it does not remove the
vulnerable package from the dependency graph. Further package/version/reachability review is open.
Do not use audit's suggested Expo 46 downgrade or blanket `--force` as a release fix.

## Verification

- Baseline `npm test`: Vitest **113 files / 2163 tests**, Jest **82 suites / 897 tests** passed.
- After fixes: focused Jest **3 suites / 34 tests** passed; full mobile Jest **82 suites / 905 tests**
  passed. First full rerun exposed a test mock returning no AppState subscription; fixed the mock
  instead of weakening production cleanup.
- Typecheck first caught an overly broad test callback type (`string` vs `AppStateStatus`); corrected
  to the native type. Final five-project rerun exited 0.
- `npm run check:agents`: synchronized. `git diff --check`: passed.
- `npm run build:web`: **135 modules**, built successfully; existing >500 kB warning remains.
- `adb devices -l`: **no attached devices**. No current-pass physical-device, emulator, screenshot,
  Play purchase, real-ad, TalkBack, or OAuth E2E evidence exists. No UI/layout edits made here.

## Official sources checked

- [Google UMP privacy options](https://developers.google.com/admob/android/privacy): inspect the
  SDK's requirement status and expose an interactive entry point when REQUIRED. The current app
  gathers consent before ads but offers no `showPrivacyOptionsForm` path.
- [Google Play core value](https://developer.android.com/quality/core-value) and
  [Android vitals](https://developer.android.com/topic/performance/vitals): quality and user metrics
  contribute to discovery; prioritize reliability and completed core flows before optional features.
- [Supabase no-policy advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
  and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Exact continuation

1. Preserve the six existing local code/test modifications and read the newest handoff.
2. Complete physical visual verification of the implemented privacy-options entry point and
   real UMP debug-geography verification. Keep fixture-layout evidence separate from SDK/SSV E2E.
3. Finish the screen-by-screen redesign against the approved plan and frozen gallery; do not
   interpret a component/token pass as completed screen work. Use current PO authorization for
   the implementation; do not ask again whether to perform this requested work.
4. Continue dependency/worker/console review and device QA. Android is connected and its Play
   sheet confirmed a no-charge license test account. Slot purchase/cold-restart passed on code 23;
   permanent access roles, interruption, refunds and SSV remain. Never confirm real-money purchases.
5. Re-run required checks, build a new production artifact after source changes are complete,
   verify the actual artifact and close all launch gates before recommending rollout.
