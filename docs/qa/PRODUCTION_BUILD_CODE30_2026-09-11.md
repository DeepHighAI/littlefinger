# Production AAB — 0.3.2 / code 30

**Superseded — do not upload.** Use the final **0.3.3 / code 30** candidate in
[the replacement report](PRODUCTION_BUILD_V033_CODE30_2026-09-11.md). The historical
0.3.2 artifact and its inspection files were moved from `dist/` to
`release-archive/2026-09-11-v033-code30/`. The record below describes the earlier build.

File: `dist/littlefinger-production-v0.3.2-code30.aab`, **82,581,158 bytes**.
SHA-256: `87b542b34410b73087458b3def758f9e0ae491479bf96d3518147d3b6c625e85`.
The adjacent `.sha256` file and localized `-release-notes.txt` are in `dist/`.

## Scope and source

The PO requested commit/merge/push followed by a production AAB, with Play Console
registration reserved for the PO. The Android navigation-bar fix is committed and
pushed as `1454e73d1143d1d5fc9619519934be99d786eca1` on `main`.
The existing `codex/supabase-e2e` branch is already an ancestor of `main`, so no
additional branch merge was needed.

[CI for the source commit](https://github.com/DeepHighAI/littlefinger/actions/runs/34491676797)
passed. Local verification passed 2,220 Vitest and 960 Jest tests, all five project
typechecks, instruction synchronization and whitespace checks. The native
three-button/gesture and font-scale 1.0/1.5 visual/touch evidence is in the
[system-bar report](ANDROID_SYSTEM_BAR_INSETS_2026-09-10.md).

## Build provenance

EAS remote Android version was 29; `build:version:set` reserved 30 and a subsequent
`build:version:get` returned `Android versionCode - 30`. The public app version
remains 0.3.2. No cloud job was requested because the same day's code 29 attempt had
already established that the free Android build allowance was exhausted.

The source was exported with `git archive` into `C:/DEV/lf30`. Installed dependency
directories were shared through junctions; 328 tracked mobile/shared/config/patch
and package files were compared with the committed checkout. The lockfile and
dependency versions were unchanged. The existing public Firebase client config was
copied into the isolated app workspace.

EAS production environment variables were pulled into ignored storage and loaded
as data. `EAS_BUILD_PROFILE=production`, `NODE_ENV=production` and
`EXPO_NO_DOTENV=1` apply to both prebuild and Gradle. The resolved backend, canonical
App Links origin and real native/runtime AdMob IDs match code 29's verified inputs.
Signing uses the existing upload credential; no replacement key was generated.

Toolchain: Node 22.18.0, EAS CLI 24.0.0, Android Studio JBR 21, Gradle wrapper 9.3.1,
AGP 8.12.0, Android build tools/compile/target SDK 36, min SDK 24,
NDK 27.1.12297006. All four ABIs and the existing R8/resource-shrinking plugin remain.
The wrapper is invoked through its Java JAR to avoid Windows batch quoting issues.
This is the project's native Gradle fallback, consistent with
[Expo's local native compilation guidance](https://docs.expo.dev/build-reference/local-builds/).

Build-only changes in the disposable copy: generated versionCode 30, upload signing
from process environment, Gradle JVM memory limits, and a Metro watch-folder entry
for the real dependency-junction target. The initial Metro attempt could not resolve
the junction's Expo Router entry; adding that watch folder corrected the resolver.
No QA entrypoint or resolver was used. Prebuild's script-only package.json edit was
restored before compilation. The original checkout's build configuration stayed intact.

The generated release source map contains 2,201 sources and passes
`verify:android-bundle`. Its home, common sheet and entitlement source contents
match the committed fix. The generated Hermes string-table scan finds only an
`anon` JWT role, with no private-key material, secret API key, service-role token
or QA marker. Final inspection confirms the AAB contains those exact runtime bytes.

## Artifact verification

Final Gradle output:

```text
BUILD SUCCESSFUL in 14m
994 actionable tasks: 856 executed, 138 up-to-date
```

Detailed logs and inspection outputs use `dist/code30-*`.

- `bundletool validate`: PASS; ZIP integrity passed.
- `jarsigner`: `jar verified.`. Upload-certificate SHA-256 matches the established
  release identity: `C1:E0:70:DE:41:70:DE:B9:0A:D4:32:C2:D5:21:99:1F:F7:8B:54:6F:CD:06:BB:90:0F:B8:46:A8:D3:97:37:BB`.
- Manifest: `com.littlefinger.app`, versionName `0.3.2`, versionCode `30`,
  min SDK 24 / target SDK 36, neither debuggable nor testOnly.
- Real AdMob native ID and all five runtime ad units, production backend, canonical
  App Links and required UI/runtime modules passed their checks. CAMERA,
  RECORD_AUDIO and SYSTEM_ALERT_WINDOW remain absent. The complete permission list,
  including max SDK qualifications, is unchanged from code 29.
- The AAB's 5,072,104-byte Hermes bundle is byte-identical to Gradle's generated
  release bundle, whose 2,201-source map contains the exact committed fix. It differs
  from code 29. Bundle SHA-256:
  `0e07bd50cf95b51f619aa79de17122fb1af56a7f42342a6207894126a3521de6`.
- The actual runtime's 38,413-string Hermes table has no private-key material,
  secret API key, service-role JWT or QA markers; the only embedded JWT role is
  `anon`. Credential files and QA entrypoints are absent from the AAB.
- All four ABIs are present, with 92 native libraries. All 46 64-bit ELF libraries
  pass 16 KB LOAD-segment alignment; bundle configuration is `PAGE_ALIGNMENT_16K`.
  Four derived inspection APKs pass `zipalign -c -P 16 -v 4`, following
  [Android's page-size guidance](https://developer.android.com/guide/practices/page-sizes).
  Those debug-signed inspection APKs are not the upload artifact or a Play test.
- R8 mapping is included in bundle metadata and extracted to ignored
  `dist/code30-inspection/proguard.map` (136,761,337 uncompressed bytes).
- The handoff AAB's recomputed hash matches the source build output and the
  neighboring `.sha256` receipt.

The signing tool reports the expected self-signed certificate/trust-chain, missing
timestamp and ZIP-attribute warnings. The trusted upload fingerprint matches; the
certificate expires in 2053.

## Merged permissions

```text
android.permission.ACCESS_ADSERVICES_AD_ID
android.permission.ACCESS_ADSERVICES_ATTRIBUTION
android.permission.ACCESS_ADSERVICES_TOPICS
android.permission.ACCESS_NETWORK_STATE
android.permission.FOREGROUND_SERVICE
android.permission.INTERNET
android.permission.POST_NOTIFICATIONS
android.permission.READ_APP_BADGE
android.permission.READ_EXTERNAL_STORAGE (maxSdkVersion 32)
android.permission.RECEIVE_BOOT_COMPLETED
android.permission.USE_BIOMETRIC
android.permission.USE_FINGERPRINT
android.permission.VIBRATE
android.permission.WAKE_LOCK
android.permission.WRITE_EXTERNAL_STORAGE (maxSdkVersion 32)
com.anddoes.launcher.permission.UPDATE_COUNT
com.android.vending.BILLING
com.google.android.c2dm.permission.RECEIVE
com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE
com.google.android.gms.permission.AD_ID
com.htc.launcher.permission.READ_SETTINGS
com.htc.launcher.permission.UPDATE_SHORTCUT
com.huawei.android.launcher.permission.CHANGE_BADGE
com.huawei.android.launcher.permission.READ_SETTINGS
com.huawei.android.launcher.permission.WRITE_SETTINGS
com.littlefinger.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
com.majeur.launcher.permission.UPDATE_BADGE
com.oppo.launcher.permission.READ_SETTINGS
com.oppo.launcher.permission.WRITE_SETTINGS
com.sec.android.provider.badge.permission.READ
com.sec.android.provider.badge.permission.WRITE
com.sonyericsson.home.permission.BROADCAST_BADGE
com.sonymobile.home.permission.PROVIDER_INSERT_BADGE
me.everything.badger.permission.BADGE_COUNT_READ
me.everything.badger.permission.BADGE_COUNT_WRITE
```

## Delivery boundary

The PO will upload the verified AAB through Play Console. No Play upload,
submission, publication, server/web deployment, runtime feature-flag or minimum
version change is part of this packaging task. The reported Samsung device is not
connected, so this work cannot establish a Play-installed physical-device check.
