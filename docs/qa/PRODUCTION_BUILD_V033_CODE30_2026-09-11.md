# Final production AAB — 0.3.3 / code 30

**Upload this file:** `dist/littlefinger-production-v0.3.3-code30.aab`.
It is the only entry in `dist/`. The PO owns Play upload and publication.

| Field | Verified value |
|---|---|
| Package | `com.littlefinger.app` |
| Version name / code | **0.3.3 / 30** |
| Bytes | **82,581,163** |
| AAB SHA-256 | `7f171a2cc357c32bd965f3a190348a85fc9df5b626896e20d8487227869068c6` |
| Source commit | `80d0786350a7abeb83df508b0565bb95c0c320a5` on `main`, pushed |
| Upload certificate SHA-256 | `C1:E0:70:DE:41:70:DE:B9:0A:D4:32:C2:D5:21:99:1F:F7:8B:54:6F:CD:06:BB:90:0F:B8:46:A8:D3:97:37:BB` |
| SDK / ABIs | min 24, target 36; arm64-v8a, armeabi-v7a, x86, x86_64 |

## Why this replaces the earlier candidate

The PO confirmed Play currently serves **0.3.2 / code 29**. Existing clients only
compare the public version name, so a minimum of 0.3.2 cannot distinguish codes 29
and 30. This build changes the version name to 0.3.3 while retaining the unused,
EAS-reserved code 30. It includes the same verified Android safe-area fix.

The earlier **0.3.2 / code 30 AAB is superseded and must not be uploaded**.
No new native dependencies, UI changes, or optimization settings were introduced.

## Build and verification

- EAS `build:version:get -p android -e production` returned
  `Android versionCode - 30`. No additional cloud build was requested.
- Source checks passed: `Tests 2220 passed (2220)` in Vitest,
  `Tests: 960 passed, 960 total` in Jest, and all five typechecks (`exit=0`).
  Agent-instruction synchronization and whitespace checks passed.
- [Source CI](https://github.com/DeepHighAI/littlefinger/actions/runs/34497917288)
  completed successfully.
- The isolated `C:/DEV/lf30` native build was reused. 353 tracked shipping-input
  files matched the committed checkout; 26 differed only in LF/CRLF. The sole
  Metro override permits the original workspace's dependency junction target.
  The three version metadata files were refreshed from the committed source and
  generated Gradle versionName was changed to 0.3.3. Signing/R8 overrides remain
  isolated and use the existing upload credential.
- Production environment selection and JBR 21/Gradle 9.3.1/AGP 8.12.0/NDK
  27.1.12297006 inputs match the previous verified build. No dependencies changed.
- Actual output: `BUILD SUCCESSFUL in 4m 34s`;
  `994 actionable tasks: 78 executed, 916 up-to-date`.
- `bundletool validate: PASS`; `jarsigner: jar verified.`; upload certificate
  matches the trusted identity. ZIP integrity passed. Manifest and packaged
  Expo config both contain 0.3.3; the manifest contains versionCode 30 and is
  neither debuggable nor test-only.
- Production backend, native/runtime AdMob configuration and App Links match.
  The full permission list is unchanged from code 29; CAMERA, RECORD_AUDIO and
  SYSTEM_ALERT_WINDOW remain absent.
- All 92 native libraries are byte-identical to the verified predecessor.
  The 46 ELF64 libraries pass 16 KB alignment checks; bundle configuration is
  `PAGE_ALIGNMENT_16K`.
- The actual AAB Hermes bundle exactly matches the Gradle output and verified
  predecessor: 5,072,104 bytes, SHA-256
  `0e07bd50cf95b51f619aa79de17122fb1af56a7f42342a6207894126a3521de6`.
  Its existing secret scan therefore remains applicable. The 2,201-source map
  passes the required consent/ads/Billing module checks and QA-entry exclusions.
  Safe-area and update-gate sources match the committed implementation.
- Compared with the earlier code 30 candidate, packaged Expo configuration
  differs only in `version`. R8 mapping is captured with this artifact.
- The packaged 0.3.3 version passes the existing comparator with minimum 0.3.3;
  existing 0.3.2 requires updating. The live anonymous configuration read returned
  HTTP 200 and minimum 0.2.0. No server setting was changed.

The prior [system-bar visual/touch evidence](ANDROID_SYSTEM_BAR_INSETS_2026-09-10.md)
still applies to the unchanged UI and JS bundle. This packaging pass does not
establish installation from Play or a physical Samsung-device check.

## Archive and delivery

At the PO's request, all other `dist/` contents were moved, without deletion, to:

`release-archive/2026-09-11-v033-code30/`

The archive contains 664 former top-level entries, plus the archive inventory and
handoff summary. It includes superseded AABs, temporary projects, build helpers,
credentials, logs, R8 mapping, the final AAB checksum and localized release notes.
The entire archive is ignored by Git. Historical `dist/` paths now resolve under
this archive; disposable helpers may need their old absolute paths adjusted before
reuse. Keep credential-bearing archive contents private.

The final AAB SHA-256 was checked again after the move. A final directory listing
confirmed exactly one file in `dist/`. The checksum and release notes were also
archived to honor the PO's request to leave only the uploadable file there.

Next: PO uploads/publishes **0.3.3 / code 30**. After confirming availability to
affected users, apply the already requested minimum of 0.3.3 using the
[minimum-version runbook](../setup/minimum-app-version.md). Do not enable the gate
while users can still install only 0.3.2 / code 29.
