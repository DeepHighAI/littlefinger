# Internal-test candidate AAB — 0.3.4 / code 31

**Superseded by 0.3.5 / code 32.** The same-day migration and four Edge Functions
described as pending below were deployed after PO approval on 2026-09-14. See the
[replacement record](INTERNAL_TEST_BUILD_V035_CODE32_2026-09-14.md) for the calendar
fix, production smoke result and next upload artifact. The remainder is the original
code-31 handoff record.

Upload `dist/littlefinger-production-v0.3.4-code31.aab` to Google Play **Internal testing**.
The PO owns tester registration, upload, track rollout, device acceptance and promotion.
This candidate contains the production-code-30 feedback changes and supersedes code 30
as the next upload candidate. Code 30 remains the PO-reported existing production release.

| Field | Verified value |
|---|---|
| Package | `com.littlefinger.app` |
| Version name / code | **0.3.4 / 31** |
| Bytes | **82,586,997** |
| AAB SHA-256 | `fd008f6b9ecd43959830415333075586c2aee81ac15968c7b18b152b713ec034` |
| Upload certificate SHA-256 | `C1:E0:70:DE:41:70:DE:B9:0A:D4:32:C2:D5:21:99:1F:F7:8B:54:6F:CD:06:BB:90:0F:B8:46:A8:D3:97:37:BB` |
| Source | `3ac0b46037062b2fc461654284e9a4c4413b9e79` plus the intentional, uncommitted ADR 0026 feedback patch and 0.3.4 version metadata |
| SDK / ABIs | min 24, target 36; arm64-v8a, armeabi-v7a, x86, x86_64 |
| Delivery state | Built and locally verified; **not uploaded** |

## Scope and provenance

Includes receiving-language reward presets, direct-input hints, the profile `못 지킴`
label, installation-scoped first-promise guidance, the styled reminder-time sheet with
close control, and the KST today-capable native calendar/shared client validation.
The tutorial completion flag uses SecureStore, excluded from Android cloud backup and
device transfer. It is not stored in an account or server row.

EAS CLI 24.3.0 reported remote Android versionCode 30. The recent build list contained no
active job, and the PO identified production as code 30. `build:version:set` reserved 31;
a subsequent `build:version:get` returned `Android versionCode - 31`. No Play API upload
or live track edit was performed, and no cloud build was requested.

The existing isolated native build at `C:/DEV/lf30` was refreshed with all
359 current shipping inputs, including new untracked files.
Hashes, a complete shipping-source ZIP and the tracked diff preserve the exact inputs.
The dependency lock changed only mobile version metadata. Existing installed dependencies,
patches, the trusted upload credential and production environment were reused; the
production environment was freshly pulled from EAS and checked against the established
backend, web origin and real AdMob configuration. Expo local dotenv loading was disabled.
The sole Metro override permits the original dependency-junction target; QA entrypoints
are absent. Generated native signing/version/memory overrides remain isolated.

Toolchain: JBR 21.0.8, Gradle 9.3.1, AGP 8.12.0, NDK 27.1.12297006. R8 and resource
shrinking remain enabled; all four approved ABIs were built.

## Verification output

- `npm test`: `Test Files 122 passed (122)` / `Tests 2222 passed (2222)`;
  `Test Suites: 94 passed, 94 total` / `Tests: 967 passed, 967 total`.
- `npm run typecheck`: all five projects passed; no diagnostics.
- `npm run check:agents`: `AGENTS.md 는 CLAUDE.md 와 동기화되어 있다.`
- Native build: `BUILD SUCCESSFUL in 17m 51s`; `994 actionable tasks: 962 executed, 32 up-to-date`.
- `bundletool validate: PASS`; `jarsigner: jar verified.`; certificate matches the
  trusted upload identity. The normal self-signed certificate warnings do not indicate
  a signature mismatch. ZIP integrity passed; release is neither debuggable nor test-only.
- Manifest and packaged Expo config contain 0.3.4; manifest code is 31. Production
  backend, App Links and native/runtime ad configuration match the expected values.
- Complete merged permission list is unchanged from code 30; CAMERA, RECORD_AUDIO and
  SYSTEM_ALERT_WINDOW remain absent. The exact list is preserved in `provenance.json`.
- All 92 native libraries match code 30 byte-for-byte;
  46 ELF64 libraries pass 16 KB alignment checks, and bundle
  configuration is `PAGE_ALIGNMENT_16K`.
- `Android 번들 모듈 검증 통과: 2204개 소스`.
  All 201 mapped application/shared sources match the
  frozen current code. The AAB Hermes bundle matches the verified Gradle bundle and
  differs from code 30. Its SHA-256 is `233f647a371d720553d3b8f6ad8a73e1747dce42c1f440d41612ae8a67680495`.
- Hermes string-table scan checked 38468 strings: only the expected
  anonymous client JWT role; no private keys, secret API keys, service-role tokens or
  known QA entry markers. R8 mapping is archived with this candidate.
- Existing [native feedback visual/touch QA](PRODUCTION_30_FEEDBACK_2026-09-14.md)
  at 360 dp and font scales 1.0/1.5 applies to these unchanged UI inputs. This packaging
  pass does not claim physical-device or Play-installed acceptance.

Private build/verification evidence is archived under
`release-archive/2026-09-14-v034-code31/` (ignored). The handoff AAB and neighboring
`.sha256` are in `dist/`; the final AAB digest was recomputed at handoff.

## Remaining server and PO steps

**The AAB alone does not enable same-day promise persistence on the current server.**
Before end-to-end same-day creation/edit/invite testing, deploy migration
`20260914000001_allow_same_day_promises.sql` and redeploy `promise-create`,
`promise-draft-update`, `promise-amend-request`, and `promise-invite`.
No backend/web deployment, auth change, runtime flag change, or minimum-version change
was performed in this build-only request. Internal testing uses the configured production
backend; it does not isolate server data.

Next: PO uploads **this 0.3.4 / code 31 AAB** to Internal testing, enables the release for
the designated Google accounts and installs through the opt-in link. Test updating the
existing app first, then tutorial completion/restart and uninstall/reinstall. Track and
license testers are separate if Billing is tested. Promote the verified candidate only
after device acceptance and any necessary server rollout.
