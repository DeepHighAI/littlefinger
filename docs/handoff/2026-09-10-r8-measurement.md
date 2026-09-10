# Android R8 measurement continuation

## Goal of the session and current status

The PO requested research into Play Console code 28 optimization advice, then actual
optimization and a new AAB with measured size/performance changes. Research and builds
are complete, including repeated emulator startup measurement and the final report.
The receiving session verified all raw evidence, completed the QA/status documents,
and stopped the owned emulator without rebuilding or repeating measurements.
The PO explicitly requested a fresh session at the 70% context threshold. Continue in
the SAME checkout, `C:\DEV\littlefinger`, preserving uncommitted files and ignored
`dist/` artifacts. Base HEAD: `36c60b6947a4d8620e249a78281457cb2ee11387`.
Mobile/shared/lockfile/patch source matches code 28's `70e47af` except this optimization.

Ready upload-signed candidate: `dist/littlefinger-production-v0.3.2-code29.aab`,
82,578,757 bytes, SHA256 `79ac0d8644ce0c45bb208c432583c2c33464869eed965bddf9f3b007088ea34a`.
Package com.littlefinger.app, versionName 0.3.2, versionCode 29. NOT uploaded/published.
Code 28 is 85,602,977 bytes. The local unoptimized control is 85,600,014 bytes
(`dist/r8-local-unoptimized-control.aab`, measurement only; do not upload).

## Files created/modified (paths)

- `apps/mobile/app.json`: register the optimization plugin.
- `apps/mobile/config/with-android-optimization.js`: new persistent Expo plugin.
- `apps/mobile/config/with-android-optimization.test.js`: four new tests.
- `docs/qa/ANDROID_R8_COMPARISON_2026-09-10.md`: complete methods, artifact and
  runtime results, raw-evidence audit, checks and limitations.
- `docs/DEVELOPMENT_STATUS.md`: candidate and completed measurement results.
- `docs/notes/environment-gotchas.md`: local build and stale UI XML findings.
- This handoff replaces `2026-09-07-ink-block-s11.md`; its durable decisions,
  verification, cosmetic follow-ups and environment notes already live in ADR 0020,
  DESIGN.md, DEVELOPMENT_STATUS and environment-gotchas. Preserve the July 26 Kakao
  reference exception in handoff/. No commit was made.
- Ignored helpers: `dist/build-r8-local.cjs`, `process-r8-artifacts.py`,
  `compare-r8-bundles.py`, `verify-production-code29.py`, `measure-r8-startup.py`.

## Decisions made + why

Keep AGP 8.12.0 / R8 8.12.14 and all four ABIs. Enable
android.enableMinifyInReleaseBuilds, android.enableShrinkResourcesInReleaseBuilds,
android.r8.optimizedResourceShrinking; use proguard-android-optimize.txt. An immediate
AGP 9 migration adds compatibility work without being necessary for this optimization.
Plugin transforms are pure/idempotent; Expo API is lazy-required inside plugin to avoid
Jest transitive uuid browser/ESM resolution. No dependency upgrade.

EAS assigned code 29 then rejected for free monthly quota (reset October 1). Local
build used EAS production env, JBR 21, Gradle 9.3.1, SDK under the user profile and
the established upload key via process env. Do not print credentials. Generated
signing/version/JVM overrides were cleaned after capture; normal generated output
AAB was restored to the optimized file. Do not blindly use helper --resume now;
the signing overrides it expected are gone. No rebuild is needed to finish this task.

Control and optimized Hermes bytecode and all 92 native libraries are byte-identical;
optimized Hermes also matches original 28. Isolate build-environment differences
using the unoptimized control. Benchmark is emulator process-cold initial display
with fixed ART speed compilation and warm OS caches, NOT real-device startup,
interactive readiness, FPS/ANR or authenticated workflows. PSS is sampled four seconds
after start completion, not peak memory. Prior PO acceptance must not be reopened.

## Verification state (what passed, what did not)

- npm run typecheck: exit 0, all five projects; dist/r8-typecheck.log.
- npm test: 2,220 Vitest tests and 92 mobile suites / 960 tests passed;
  dist/r8-tests.log. npm run check:agents synchronized; git diff --check clean.
- Optimized resumed build: BUILD SUCCESSFUL in 6m 29s; control in 2m 51s.
  These are incremental times, not clean-build performance comparisons.
- jarsigner: jar verified. Actual upload cert matches code 28. Bundletool/ZIP,
  manifest/production config/QA-marker checks pass; 46 64-bit libraries pass 16 KB
  ELF alignment, bundle requests PAGE_ALIGNMENT_16K, four split APKs pass zipalign.
- AAB -3.53%; DEX 55,150,868 -> 15,078,104 bytes (-72.66%, six -> two files);
  ARM64 ko-KR API36 density420 estimated download 37,342,607 -> 24,132,051 bytes
  (-35.38%). R8 mapping compressed 10,261,307 bytes explains smaller AAB savings.
  Local control ARM64 estimate 37,343,767 bytes. See report for x86_64 figures.
- R8 metadata enables obfuscation/optimization/shrinking/full mode/optimized
  resource shrinking. noObfuscationPercentage 16.42; complement 83.58% is allowed
  configuration coverage, NOT a measured new Play Console score.
- Artifact evidence: dist/r8-bundle-comparison.json, r8-code29-inspection/inspection.json,
  r8-code29-mapping/, r8-code29-{signature,certificate}.log, r8-artifact-processing.log.

Benchmark finished while preparing transfer: dist/r8-startup-summary.json reports
16 measured samples each. Median startup code28/control/code29: 4421/4265/3797 ms;
median PSS: 263857.5/261968/224863 KiB. The receiving session matched all 60 rows
to raw logs, recomputed the summary, verified all three artifact hashes, and reviewed
the final block4/block5 and optimized block3 screenshots. Six AndroidRuntime logs
are empty. `dist/r8-final-evidence-audit.json` records PASS. Do not rerun the benchmark.

Completed process reference: unified exec session 91969,
`python dist/measure-r8-startup.py 1`, log dist/r8-startup-resume.log.
Order [code28, control, code29, code29, control, code28], blocks indexed 0..5.
Two warmups + eight measured launches/block: final target 16 measured/variant,
60 rows including warmups. All six blocks completed; no benchmark process remains.
Raw JSON is written after every launch: dist/r8-startup-samples.json. Final summary
dist/r8-startup-summary.json appears only when complete. Do NOT start a second
benchmark while the existing process is running.

Stopped read-only disposable AVD Littlefinger_E2E_API_36_1; serial emulator-5580; API36.1,
x86_64, en-US, 2 cores, 2048 MB, SwiftShader; 720x1600/density320=360x800dp.
SDK: C:\Users\batis\AppData\Local\Android\Sdk. Emulator args:
`-avd Littlefinger_E2E_API_36_1 -read-only -no-snapshot -no-window -no-audio -port 5580 -memory 2048 -cores 2 -gpu swiftshader`.
If restart needed use Start-Process -WindowStyle Hidden, restore wm size/density
and screen timeout; overlay discards changes. Never touch other devices/processes.

Each run requires am start -W Status ok and LaunchState COLD after force-stop,
then captures PSS. per-run r8-{variant}-block{N}-run{I}.txt; end-block PNG,
crashes.txt and uiautomator log share that prefix. Screenshots code28 block0,
control block1, code29 blocks2/3 were visually verified normal, crashes empty.
Final control block4, code28 block5 and optimized block3 screenshots also passed
visual inspection. Code29's 16 measured launches have median 3797 ms: 14.11% lower
than code28 and 10.97% lower than control. Median PSS is 14.78% / 14.16% lower.

Initial harness aborted after block0 due stale boot ANR XML following a failed
uiautomator dump, NOT app failure. Kept eight valid samples; screenshot normal.
Updated harness uses unique XML paths and independently captures PNG. The file
r8-code28-block0-window.xml is stale: DO NOT use. Initial SystemUI boot ANR and
first uncompiled smoke timeout are excluded from declared benchmark protocol.

## Blocked / PO-confirmation items

No blocked items remain for this measurement/report task. No physical phone connected;
real-device performance and new optimized auth/ads/IAP flows were not exercised.
No Play upload or publication requested in this measurement task. Free EAS quota
blocks cloud builds but local signed candidate is complete. Do not buy an upgrade.

## The exact next step

No implementation or measurement step remains. The PO subsequently requested
commit/merge/push preparation for their manual Play Console upload. Follow the
code29 upload handoff in DEVELOPMENT_STATUS and the repository/remote CI state;
preserve the signed code29 AAB and raw evidence. Play upload/publication remains
PO-owned, and additional device testing is outside this preparation task.
