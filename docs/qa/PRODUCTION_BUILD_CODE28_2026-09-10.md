# Production AAB — 0.3.2 / code 28

## Artifact

Production build and artifact inspection completed September 10, 2026.

- Source: `70e47af8b3c8f3c7a87e9f1173220fe875e6c8af` on clean `main`, including
  UI fixes `c288c7c` and dependency security fixes `8a017cd`.
- EAS build: [`2b788a13-38cf-48c5-a89f-9bd9afdba0df`](https://expo.dev/accounts/philwoo/projects/littlefinger/builds/2b788a13-38cf-48c5-a89f-9bd9afdba0df).
- Profile/environment: `production`; status FINISHED at **2026-09-10 04:43:22 UTC**.
- Gradle: `BUILD SUCCESSFUL in 14m 14s`.
- Local file: `dist/littlefinger-production-v0.3.2-code28.aab`.
- [Download the AAB](https://expo.dev/artifacts/eas/CGslS6yAIXgWDs6yoNq-jxacAdOB0donA-ZliT1eU8o.aab).
- Size: **85,602,977 bytes**.
- SHA-256: `53aab607ace1071c310eb1cfc7fb64fd5328399cdf6a13d1ef96238264f99f2a`.
- Package: `com.littlefinger.app`; versionName **0.3.2**, versionCode **28**.
  EAS incremented its remote counter from 27 to 28.

The PO already accepted advertising, Play-installed flows and console review in the
[release checklist](PRODUCTION_RELEASE_REVIEW_2026-09-10.md). This task completes the
remaining AAB generation and technical artifact inspection. It does not upload or
publish a Play release, or claim a new Play-delivered installation of code 28.

## Artifact checks

| Check | Result |
|---|---|
| Bundle structure | Bundletool 1.18.1 validation and ZIP CRC/integrity passed. |
| Upload signature | `jarsigner -verify -verbose -certs`: `jar verified.`; SHA256withRSA, 2048-bit key. Certificate SHA-256 matches the previous production AAB: `c1e070de4170deb90ad432c2d521991ff78b546fcd06bb900fb846a8d39737bb`. |
| Manifest | minSdk 24 / targetSdk 36; neither debuggable nor testOnly; expected package/version. Camera, microphone and overlay permissions absent. |
| Production configuration | Native AdMob app ID and all five packaged ad-unit IDs exactly match values read from the EAS production environment; no configured Google test-publisher ID. Packaged backend host matches the production environment. App Links match the production web host and `/i/` route with autoVerify. |
| Dependency patches | Cloud installation logs confirm `patch-package --error-on-fail` applied `image-size@1.2.1` and `query-string@7.1.3`. |
| Normal entry and UI fixes | Cloud Metro log bundles `apps/mobile/node_modules/expo-router/entry.js`. Actual Hermes bundle contains all four new detail/invitation body/action markers and none of the checked QA-entry markers. |
| Native architectures | arm64-v8a, armeabi-v7a, x86 and x86_64 present. |
| 16 KB native compatibility | All **46** ARM64/x86_64 ELF libraries have PT_LOAD alignment at least 16,384 bytes with matching file/virtual-address alignment. BundleConfig requests `PAGE_ALIGNMENT_16K`. |
| APK ZIP alignment | A universal APK generated from this exact AAB passed `zipalign -c -P 16 -v 4`: `Verification successful`. This local inspection APK uses a debug certificate; it is not the production delivery artifact. |
| Credential/fixture scan | No packaged keystore/private-key files; actual Hermes string table contains no private-key blocks, complete `sb_secret_` key or service-role JWT. Detected JWT role is `anon`. Checked QA markers absent. The SDK's bare `sb_secret_` detection string is not a secret. |

Jarsigner reports the expected self-signed certificate/trust-chain and missing timestamp
warnings. Signature integrity passed and the certificate matches the established upload
key; its expiry is December 15, 2053. These warnings are not a signing failure.

## Actual bundle correspondence

The AAB contains a **5,072,032-byte** Hermes v98 bundle with **38,413** strings.
It was compared with the production-environment Android export previously verified
against its source map:

- Same length; exactly **40** differing bytes, confined to the 20-byte source hash
  and 20-byte footer checksum. Both footer checksums were independently verified.
- The runtime payload is byte-identical. Its SHA-256 is
  `30cdafce7ca53b3fb1d054dc846362297c72fe0dfa80094b3981e1e357e20fed`.
- Full Hermes disassembly is identical except for the source-hash metadata line.
- `verify:android-bundle` passed against the corresponding export's source map:
  **2,201 sources**. The existing safe query parser and ads/IAP modules are present;
  legacy query parsers, image-size, uuid and QA substitutions are absent.

This ties the module verification to the actual delivered runtime code; the raw AAB
bundle is not claimed to be byte-identical including its hash metadata.

Source verification: [CI for `70e47af`](https://github.com/DeepHighAI/littlefinger/actions/runs/34436804806)
passed installation, five-project typecheck, 2,220 Vitest tests, 956 mobile tests and
instruction synchronization. No application source changed while this build ran.

## Evidence and follow-up

Ignored local evidence is in `dist/code28-inspection/` and
`dist/production-code28-*`. The artifact has an adjacent `.sha256` file.
The AAB replaces the older production code 27 artifact for this release.

The existing SDK-update recommendations, development-only Vitest advisory and broader
QA evidence gaps remain maintenance items in the release checklist. The patched
image-size release still produces npm audit findings because npm does not recognize
local patches; this build's patch application was independently confirmed.
PO retains Play upload/publication ownership. The existing EAS submit profile targets
internal/draft; no submission command was executed here.
