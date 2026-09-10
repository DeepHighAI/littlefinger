# Public test 27 follow-up

Date: 2026-09-10. Reported release: 27 (0.3.2).
Status: Native corrections, local verification and the standalone preview APK are
complete. On 2026-09-10 the PO confirmed normal behavior when testing that exact APK.
A new Play production build and the remaining release gates are still outstanding.

## Implemented scope

PO-confirmed decisions are recorded in ADR 0025.

1. `backOrHome` preserves existing navigation history and replaces the current route
   with `/home` when no back destination exists. All direct app back calls now use
   this helper, including error states and successful editor/nickname/hide exits.
2. Login gives the notice and its Text the available body width. It preserves the
   approved Korean/English copy and font sizes, and allows wrapping. The old nested
   intrinsic-width layout could still clip after Android display-density changes.
3. Initial invitation acceptance/confirmation and detail AMEND/CANCEL/FINISH acceptance
   stay outside ScrollView. At enlarged system text scales, acceptance and decline
   stack vertically with acceptance first; at default scale they remain side by side.
4. Witness invitation sits below the participant list inside the scrolling detail body.
   Its existing permission checks and sheet-opening behavior are retained.

No production service, migration, frozen reference, app version or build number changed.

## Automated verification

- `npm run test:shared`: **121 passed files, 2,207 passed tests**.
- `npm run test:mobile -- --runInBand`: **91 passed suites, 956 passed tests**.
  The outer workspace script did not forward the extra option; the configured worker
  limit applied. No test failures occurred.
- Final affected-screen runs after the layout refinements:
  **3 passed suites / 75 tests** (detail, finish, invitation) and
  **2 passed suites / 120 tests** (login, components).
- Five-project `npm run typecheck`: exit 0.
- `npm run check:agents`: `AGENTS.md 는 CLAUDE.md 와 동기화되어 있다.`
- `git diff --check`: exit 0.

The regression checks cover missing navigation history, existing back behavior,
acceptance controls outside the body, witness invitation remaining in the body,
acceptance API/idempotency/error handling, and the initial two-step confirmation.
React review found no new effect subscriptions, duplicated response handlers, policy
literals, hardcoded product copy or disabled compiler checks.

## Native visual verification

Actual production screen components were rendered with fixture APIs in an Android
API 36.1 emulator. The fixture selects AMEND/CANCEL/FINISH/ACTIVE and Korean/English
without changing real records or starting OAuth. It is not live backend or device QA.

- Login: 1440 x 3120 and 1080 x 2400, each at 360 dp; font scales 1.0 and 1.5
  covered across the captures. Final Korean and English enlarged notices are complete.
- Changing emulator resolution/density reproduced missing trailing login glyphs in
  an intermediate intrinsic-width implementation. Explicit notice and text width
  fixed that observed case. This does not establish the exact Samsung OEM root cause.
- Default-scale cancellation acceptance fits beside decline. Expanded-text acceptance
  wraps as complete words in a full-width fixed button. Initial acceptance and its
  confirmation retain their original two-step interaction.
- Scrolling the detail body leaves the fixed footer unchanged. Witness invitation
  appears below the participants and above retention information.
- Image comparison: login-notice region **4.922% changed**, detail-footer region
  **11.480% changed**, fixed-footer region before/after scroll **0.000% changed**
  (RGB-channel difference threshold >8). Captures were also inspected visually.

Ignored evidence is in `apps/mobile/dist/test27-qa/`: final login images have the
`-final.png` suffix; `cancel-ko-1440-1.png`, `cancel-scrolled-ko-1440-1.png`,
`cancel-en-1440-1.5.png`, `invite-en-1440-1.5.png`,
`witness-in-body-ko-1080-1.png`, and `visual-diff.json` document the final behavior.
Earlier intermediate captures in that directory are not final approval evidence.
Command logs are `dist/test27-*.log`.

Temporary package-entry and Metro overrides were restored byte-for-byte, and the
emulator display/font settings were restored. No physical Samsung device was connected.
A new Play production AAB has not been built or deployed in this task.

## Standalone APK for device acceptance

PO acceptance (2026-09-10): `littlefinger-v0.3.2-code27-fixes-20260910.apk`
passed the reported physical-device retest. This closes the reported UI corrections;
it does not substitute for production-unit advertising or Play-delivered Billing QA.

At the PO's request, EAS preview build `38f69be8-39eb-4d59-9967-3b1951332e74`
finished on 2026-09-10 from the working tree containing these corrections.
The existing preview profile uses the production environment and Google test ads;
it is a release APK that starts without Metro. Version remains **0.3.2 / code 27**.

- File: `dist/littlefinger-v0.3.2-code27-fixes-20260910.apk`
- Size: **119,216,553 bytes**.
- SHA-256: `9bc2d40be6a09b99a9515df1352de4230373ae148afa7af3f7502d2134e081b5`.
- EAS artifact: https://expo.dev/artifacts/eas/NE9N0LJ3MdF38Slsb54IocaJaUOhsczNW8XlwyD9CJw.apk
- `apksigner verify --verbose --print-certs`: **Verifies**, APK signature scheme v2.
- `npm run verify:android-apk -- <file>`:
  `실기기 APK ABI 검증 통과: arm64-v8a, armeabi-v7a, x86, x86_64`.
- Manifest: `com.littlefinger.app`, minSdk 24 / targetSdk 36, non-debuggable,
  expected App Links host and test AdMob ID; camera, microphone and overlay permissions absent.
- APK ZIP integrity passed; the bundled Hermes bytecode contains all four new detail/
  invitation body/footer markers and none of the checked QA fixture markers.
- Installed on an API 36.1 emulator with `adb install -r`: **Success**. Cold launch:
  **Status: ok**. Onboarding and login were visually inspected without Metro; the
  app remained alive and its crash buffer was empty. This was a `-read-only` emulator
  run, stopped afterward without saving changes to the original AVD.

The emulator initially displayed a System UI ANR; dismissing it allowed the app to
continue. UIAutomator could not reach an idle state on the animated entry screens,
so screenshots and process/crash checks were used. No real OAuth acceptance or
physical Samsung testing was performed by the agent.

APK signing certificate SHA-256 is
`c1e070de4170deb90ad432c2d521991ff78b546fcd06bb900fb846a8d39737bb`.
The inspected Play-installed APK uses
`b3bdc8eb67ffb72543043be6ab4e48a9e1694265f0bba4989e35cb1caad0a714`.
Therefore this preview cannot update that Play installation in place. The PO must
remove the Play installation first or use another test device; local app data is
removed by uninstalling. Existing APK installations with the matching EAS signer
can be updated, as verified on the emulator.

Ignored package evidence: `dist/test27-apk-*.log`, `dist/test27-apk-*.json`,
`dist/test27-apk-{badging,manifest}.txt`, and `dist/test27-apk-login.png`.
