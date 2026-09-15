# Production build — 0.3.6 / code 33

## Delivery

The PO requested commit, merge, push and a Google Play upload build. The PO owns
upload and publication. This candidate supersedes code 32 for the new mascot/icon
release; earlier code-32 functional acceptance remains recorded separately.

| Field | Verified value |
|---|---|
| AAB | `dist/littlefinger-production-v0.3.6-code33.aab` |
| Package | `com.littlefinger.app` |
| Version / code | **0.3.6 / 33** |
| Bytes | 83,085,922 |
| SHA-256 | `e8e4cc549537cfb8a2ec80e91851d120530ce0a76a62e4316602bad91af5bdc7` |
| Upload certificate SHA-256 | `C1:E0:70:DE:41:70:DE:B9:0A:D4:32:C2:D5:21:99:1F:F7:8B:54:6F:CD:06:BB:90:0F:B8:46:A8:D3:97:37:BB` |
| Shipping source | `8c1b5675266fadc901800cf29d3e21528370dbc5` |
| SDK | min 24 / target 36 |
| ABIs | arm64-v8a, armeabi-v7a, x86, x86_64 |

## Changes and integration

ADR 0028 replaces the full portrait, face, eyes and agreement-hand assets, plus
launcher, adaptive/themed icon, splash and web metadata images. Optional Mobbin
spacing proposals remain unapproved and unapplied. The concurrent search/privacy
work is committed separately as `987873f`; mascot/version sources are `8c1b567`.
Both the remaining branch and origin/main were already ancestors of main; both
fast-forward merge checks returned `Already up to date.` No force push was used.

## Build provenance

EAS remote version 32 was read, code 33 reserved and read back. The recent EAS job
list has no competing code-33 build; code 32 is the last PO-reported uploaded code.
The established Windows local Gradle route used a frozen snapshot at C:/DEV/lf30,
a fresh EAS production environment pull, local dotenv disabled, the existing upload
key, JBR 21, Gradle 9.3.1, AGP 8.12.0 and NDK 27.1.12297006. Prebuild regenerated
native sources; R8/resource shrinking and all four ABIs were retained. No cloud
build or Console upload was submitted. Source map watchFolders includes the
existing dependency junction target; generated version/signing are local overrides.

## Verification

- `BUILD SUCCESSFUL in 13m 49s`.
- `npm test`: `Test Files 124 passed (124)` / `Tests 2231 passed (2231)`;
  `Test Suites: 95 passed, 95 total` / `Tests: 972 passed, 972 total`.
- `npm run typecheck`: all five projects passed; `npm run check:agents` passed.
- Prior changed-screen verification: eight acceptance-web routes, five reference
  screens at 360 dp / text scales 1.0 and 1.5, zero page JavaScript errors.
  Native debug launcher/onboarding/login checked on a read-only API 36.1 emulator.
  This is not Play-delivered or signed-in production-device acceptance.
- `bundletool validate: PASS`; `jarsigner: jar verified.`; trusted upload certificate matched.
- Correct manifest version/package/SDK, non-debuggable and non-test-only release.
  Complete merged permissions equal code 30/32; production backend, App Links,
  native AdMob app ID and five runtime ad units match the established configuration.
- 363 frozen shipping inputs archived;
  204 mapped own sources match committed input;
  2191 bundled sources passed module verification.
  Exact AAB Hermes bytes match Gradle output. Required modules and feature markers
  are present; known fixture entrypoints are absent.
- 38408 Hermes strings scanned: no private key, secret API key or
  service-role JWT. Only the expected public anon JWT role was found.
- 30 native launcher/splash raster resources and
  all four mascot assets match the new artwork inside the final AAB.
- Bundle PAGE_ALIGNMENT_16K and 46 ELF64 LOAD-segment
  alignments pass. All 92 native libraries
  are byte-identical to the earlier verified build. R8 mapping is archived.
  Check follows [Android's alignment guidance](https://developer.android.com/guide/practices/page-sizes).

## Remaining PO step

Upload the AAB above to the intended Google Play release. Update the store listing
icon separately with `docs/디자인/store/app-icon/new-2026-09-15/play-icon-512.png`.
No Play upload/publication, web deployment, backend change, runtime flag or forced
minimum-version update was performed in this release task.

Ignored evidence: `release-archive/2026-09-15-v036-code33/`; adjacent AAB `.sha256`
contains the recomputed final digest. Source/test logs and matching R8 mapping are
preserved there; pulled environment files remain private ignored storage.
