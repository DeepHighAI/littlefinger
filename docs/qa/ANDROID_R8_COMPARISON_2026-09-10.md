# Android R8 comparison — September 10, 2026

## Scope and build configuration

Requested: apply Android release optimization and measure the resulting AAB size
and runtime performance against production 0.3.2 / code 28.

Source base: `36c60b6947a4d8620e249a78281457cb2ee11387`. Mobile/shared code,
lockfile and dependency patches are unchanged from code 28's `70e47af` source.
The only product build changes are the config plugin registration in
`apps/mobile/app.json` and `apps/mobile/config/with-android-optimization.js`:

- Enable R8 release minification and resource shrinking.
- Enable `android.r8.optimizedResourceShrinking` on the existing AGP 8.12.0.
- Replace the default `proguard-android.txt` (which disables optimization) with
  `proguard-android-optimize.txt`, preserving application/library keep rules.
- Keep all four existing ABIs and the current Expo/React Native/dependency versions.

The plugin uses Expo's existing config-plugin API; no new dependency is required.
It reapplies settings during prebuild and fails if the expected default rules are
missing from a future template.

EAS assigned versionCode 29, but refused the cloud build because the account's
monthly free Android build allowance is exhausted. The fallback uses Windows,
Android Studio JBR 21, the existing Gradle 9.3.1 wrapper and AGP 8.12.0, EAS
production environment variables, and the established upload keystore. Its
certificate fingerprint was verified against code 28 without printing credentials.
Local dotenv loading is disabled during the build.

Temporary generated signing, version and JVM-memory overrides were restored after
artifact capture. The generated release-output AAB was restored to the optimized
candidate and its SHA-256 matches the preserved `dist/` candidate. The generated
Gradle project is back to its ordinary debug signing/versionCode 1 defaults; use
the verified `dist/` AAB for this result, not a new build from those defaults.

An additional unoptimized local control uses the same source, versionCode 29,
environment, signing key and compiler outputs, with only the three optimization
properties disabled. It is a measurement artifact, not a release candidate.
This controls for differences between the original Linux EAS build and Windows.

## Measurement method

- AAB: ZIP file bytes; total uncompressed and compressed DEX/resource/native sections.
- Download estimate: bundletool 1.18.1 `get-size total` for Android API 36,
  ARM64, density 420, locale ko-KR. This is an estimated device-specific download,
  not a measured Play download or the sum of all ABIs in the AAB.
- Runtime: read-only overlay of `Littlefinger_E2E_API_36_1`, Android API 36.1,
  x86_64, 2 virtual CPU cores, 2 GiB configured RAM, SwiftShader rendering,
  720x1600 pixels / density 320 (360x800 dp), en-US, logged-out onboarding.
- Both releases and the local control are converted from their AABs to matching
  split APKs, using the same inspection/debug certificate for local installation.
  The AAB upload signature is checked independently.
- Run only after host compilation finishes. Install each variant into the disposable
  emulator, use `cmd package compile -m speed -f`, then two warmups and eight
  measured process-cold launches per block. Order: code28, control, code29,
  code29, control, code28. Report 16 measured launches per variant.
- Start with `am force-stop`, wait one second, then `am start -W`. Record Android's
  `TotalTime` (time to initial display), requiring `Status: ok` and `LaunchState: COLD`.
  This does not measure interactive readiness, authenticated home data, or a
  disk-cache-cold launch. AOT `speed` deliberately fixes compilation state and
  does not reproduce Play's device-specific profile-guided compilation.
- Sample total PSS four seconds after the launch command completes. This is a
  fixed-delay onboarding memory sample, not peak memory or a long-running leak test.
- Retain raw samples, per-run command/memory output, end-of-block screenshots,
  UI hierarchy and crash logs under ignored `dist/r8-*` paths.

The emulator showed a System UI ANR dialog during initial boot/host compilation;
it was dismissed before measurement, and subsequent screenshots show the app.
Onboarding's continuous animation makes `uiautomator dump` sometimes return
`ERROR: could not get idle state` with a zero exit code. The first harness version
then read a stale boot-time XML file and stopped after code 28's first eight valid
samples. The actual screenshot showed normal onboarding and AndroidRuntime had
no fatal exception. Those samples were retained, and the harness resumed at the
next block using unique XML paths and independent screenshots; failed hierarchy
extraction is recorded rather than reading an older file.

No physical device was connected. Emulator results cannot establish physical-device
startup gains, frame-rate/ANR improvements, or Play Console's optimization rating.
No Play upload or publication is part of this task.

## Source verification

- `npm run typecheck`: exit 0, all five projects.
- `npm test`: 2,220 Vitest tests; 92 mobile suites / 960 tests passed.
- `npm run check:agents`: synchronized.
- `git diff --check`: passed.
- Prebuild: all three properties enabled and optimized default rules present.

The initial plugin test exposed Jest's browser resolution of a transitive `uuid`
dependency when loading the native config API. Loading that API when the plugin
runs keeps pure configuration transforms testable; the full suite then passed.
An initial local Gradle invocation also failed on Windows command-line quoting;
moving the JVM memory options into the generated Gradle properties fixed invocation.

## References

- [Android: enable app optimization](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization)
- [Expo: config plugin mods](https://docs.expo.dev/config-plugins/mods/)
- [Android: app startup time](https://developer.android.com/topic/performance/vitals/launch-time)
- [Android: measuring app performance](https://developer.android.com/topic/performance/measuring-performance)

## Results

### Artifact size

All values below are bytes. MB in the PO report uses 1 MB = 1,000,000 bytes.

| Metric | Production code 28 | Local unoptimized control | Optimized code 29 |
|---|---:|---:|---:|
| AAB file | 85,602,977 | 85,600,014 | 82,578,757 |
| DEX, uncompressed | 55,150,868 | 55,152,688 | 15,078,104 |
| DEX files | 6 | 6 | 2 |
| ARM64 / ko-KR download estimate | 37,342,607 | 37,343,767 | 24,132,051 |
| x86_64 / en-US download estimate | 37,586,474 | 37,584,750 | 24,373,859 |

Against code 28: AAB **3.53% smaller**, uncompressed DEX **72.66% smaller**,
ARM64 download estimate **35.38% smaller** (13,210,556 bytes saved).
The AAB now includes a 10,261,307-byte compressed R8 mapping file; its metadata
overhead explains why the AAB reduction is smaller than the download reduction.

The local unoptimized control's ARM64 estimate differs from code 28 by only 1,160
bytes. Control and optimized builds contain byte-identical Hermes bytecode and all
92 native libraries. The optimized Hermes bytecode is also byte-identical to code
28 (5,072,032 bytes), so no JavaScript payload change accounts for these results.

Artifact: `dist/littlefinger-production-v0.3.2-code29.aab`, versionName `0.3.2`,
versionCode `29`, SHA-256:
`79ac0d8644ce0c45bb208c432583c2c33464869eed965bddf9f3b007088ea34a`.

### Artifact verification

- Resumed optimized Gradle build: `BUILD SUCCESSFUL in 6m 29s`. This reuses
  compilation completed before a session interruption; it is not a clean-build
  timing measurement. Unoptimized control: `BUILD SUCCESSFUL in 2m 51s`.
- Bundletool validation and ZIP integrity: passed.
- Signature: `jar verified.`; actual AAB certificate matches the established code
  28 upload certificate. Expected self-signed/trust-chain and timestamp warnings
  remain; jarsigner also notes ZIP permission attributes are not signature-covered.
- Version, package, non-debuggable/non-testOnly flags, SDK levels, blocked
  permissions, production AdMob/backend configuration, App Links and expected UI
  markers: passed. No checked QA markers or private credential files in the AAB.
- All four ABIs retained. All 46 ARM64/x86_64 ELF libraries pass 16 KB segment
  alignment checks; BundleConfig requests `PAGE_ALIGNMENT_16K`. All four matching
  x86_64 split APKs pass `zipalign -c -P 16 -v 4`.
- R8 mapping and `BUNDLE-METADATA/com.android.tools/r8.json` included. R8 8.12.14
  reports obfuscation, optimization, shrinking and optimized resource shrinking
  enabled, with ProGuard compatibility mode disabled (full mode).
- R8 metadata's `noObfuscationPercentage`, `noOptimizationPercentage`, and
  `noShrinkingPercentage` are 16.42, 16.95, and 16.38 respectively. Their complements
  are 83.58%, 83.05%, and 83.62%; these describe the local configuration's allowed
  optimization coverage, not a freshly observed Play Console score or size saving.
- Optimized split-APK smoke launch reaches the expected onboarding screen without
  an AndroidRuntime fatal exception. The first uncompiled smoke launch timed out
  in `am start -W` while the screen subsequently rendered; this is not included
  in the predeclared AOT-compiled repeated-launch benchmark.

Evidence: `dist/r8-bundle-comparison.json`, `dist/r8-*-size-*.csv`,
`dist/r8-code29-inspection/inspection.json`, `dist/r8-code29-mapping/`,
`dist/r8-code29-{signature,certificate}.log`, `dist/r8-artifact-processing.log`,
`dist/r8-local-build{,-resume}.log` and the inspection split APK sets.

### Runtime

Completed six blocks: 60 launches total, including 12 excluded warmups and
**16 measured process-cold launches per variant**. Independent final verification
matched every JSON row to its raw launch and memory output, checked unique
block/run indexes, and recomputed the saved summary. All 60 launches report
`Status: ok` and `LaunchState: COLD`; all six captured AndroidRuntime logs are empty.

| Metric | Production code 28 | Local unoptimized control | Optimized code 29 |
|---|---:|---:|---:|
| Measured launches | 16 | 16 | 16 |
| Initial-display median, ms | 4,421 | 4,265 | 3,797 |
| Initial-display p90, ms | 4,773 | 4,422 | 4,001 |
| Initial-display min–max, ms | 3,959–4,930 | 3,700–4,738 | 3,342–4,137 |
| Fixed-delay total PSS median, KiB | 263,857.5 | 261,968 | 224,863 |
| Fixed-delay total PSS median, MiB | 257.67 | 255.83 | 219.59 |

p90 uses nearest rank (`ceil(0.9 × 16)`, the 15th sorted sample); MiB = KiB / 1024.

Against code 28, code 29's median initial-display time decreased **624 ms (14.11%)**,
p90 decreased **772 ms (16.17%)**, and median PSS decreased **38,994.5 KiB
(38.08 MiB, 14.78%)**. Against the same-environment unoptimized control, the respective
reductions are **468 ms (10.97%)**, **421 ms (9.52%)**, and **37,105 KiB
(36.24 MiB, 14.16%)**. The control comparison better isolates the optimization
from the original EAS build environment.

Block medians, in execution order, make run-to-run drift visible:

| Block (zero-based) | Variant | Initial-display median, ms | PSS median, KiB |
|---|---|---:|---:|
| 0 | code28 | 4,383 | 258,850.5 |
| 1 | control | 4,209.5 | 259,512 |
| 2 | code29 | 3,701 | 224,863 |
| 3 | code29 | 3,857.5 | 222,771.5 |
| 4 | control | 4,284 | 262,469.5 |
| 5 | code28 | 4,511.5 | 265,348.5 |

Both optimized blocks have lower medians than either control or code 28 block.
These are descriptive observations from one emulator session, without a
statistical significance claim. They do not establish real-phone startup,
interactive readiness, FPS, ANR rate, peak memory, or authenticated auth/ads/IAP
behavior under R8; those flows were not exercised on the new candidate.

Visual inspection of the final control block 4, code 28 block 5 and optimized
block 3 screenshots confirms the same onboarding layout, readable copy and
`Get started` button, with no visible crash/ANR dialog. Mascot pose differences
are expected animation frames. Earlier block screenshots were checked in the
build session. Failed UI hierarchy extraction remains an explicit evidence
limitation; `r8-code28-block0-window.xml` is stale and excluded.

Final evidence: `dist/r8-startup-samples.json`, `dist/r8-startup-summary.json`,
`dist/r8-final-evidence-audit.json`, `dist/r8-startup{,-resume}.log`, and
`dist/r8-{code28,control,code29}-block*-{run*,crashes}.txt` / `block*.png`.
The final audit reports `PASS`, 60 matched raw logs, six empty AndroidRuntime
logs and three matching artifact hashes. Existing full test/typecheck logs were
reviewed; no product source changed and no rebuild or repeated measurement was
performed during finalization.

The owned read-only emulator `emulator-5580` was stopped after final verification;
all source changes and ignored `dist/` evidence remain preserved. The measurement
phase performed no commit, Play upload or publication. The PO subsequently requested
repository commit/merge/push preparation for a manual Play Console upload, recorded
in `docs/DEVELOPMENT_STATUS.md`; this does not change the measured artifact.
