# Internal-test replacement — 0.3.5 / code 32

## Acceptance update — 2026-09-14

The PO reports all requested corrections passed Internal testing and authorized source
integration and push. **Use the same 0.3.5 / code 32 bundle for Production.** Its SHA-256
and all 363 archived shipping-input hashes were rechecked and still match. No source
rebuild or version increment is needed. The source integration contains the approved
ADR 0026/0027 patch; separate concurrent web/privacy work is excluded. Internal-test
acceptance is PO-reported. No production rollout was performed by the agent.

In Play Console, create the Production release and select the already uploaded code 32
using **Add from library**, or promote the internal release. Re-uploading the same version
code is unnecessary. [Google Play release instructions](https://support.google.com/googleplay/android-developer/answer/9859348?hl=en).

The following sections preserve the original build-time evidence and delivery status.

Pre-commit verification on the matching isolated snapshot completed with
`npm test`: `Test Files 122 passed (122)` / `Tests 2222 passed (2222)` and
`Test Suites: 95 passed, 95 total` / `Tests: 972 passed, 972 total`.
`npm run typecheck` passed all five projects without diagnostics; root
`npm run check:agents` passed. All 37 staged code/config/test changes matched that
snapshot after Git line-ending normalization. Logs are preserved under
`.expo/release-code32/commit-*.log` and the ignored code-32 release archive.

Upload `dist/littlefinger-production-v0.3.5-code32.aab` to Google Play Internal testing.
This replaces the code-31 candidate. The PO owns Play upload, tester setup, rollout,
physical-device acceptance and promotion. No Play upload was performed.

| Field | Verified value |
|---|---|
| Package | `com.littlefinger.app` |
| Version / code | **0.3.5 / 32** |
| Bytes | 82,585,845 |
| SHA-256 | `8e99143ad27d10a805901df7df192f6e5c9d895f56157c91f158ce2ebcd6cd99` |
| Upload certificate SHA-256 | `C1:E0:70:DE:41:70:DE:B9:0A:D4:32:C2:D5:21:99:1F:F7:8B:54:6F:CD:06:BB:90:0F:B8:46:A8:D3:97:37:BB` |
| Source commit | `3ac0b46037062b2fc461654284e9a4c4413b9e79` plus intentional uncommitted ADR 0026/0027 mobile/shared changes and version metadata |
| SDK / ABIs | min 24, target 36; arm64-v8a, armeabi-v7a, x86, x86_64 |

## Cause and completed correction

The code-31 client accepted today, but deployed Edge validation and database guards
still required tomorrow. Sending a same-day promise produced `E_VALIDATION` on the
end-date field, which intentionally returned the editor to Terms. This was not a
tutorial-only navigation defect. The PO approved deployment after reviewing this cause.

Production `vepnrrmxvsytguocicfe` now has migration
`20260914000001_allow_same_day_promises.sql` and redeployed `promise-create` (v16),
`promise-draft-update` (v13), `promise-amend-request` (v8), and `promise-invite` (v16).
Migration dry-run showed only this migration; `db push --linked --skip-vault --yes`
and `functions deploy ... --use-api` completed. Deployed guards were read back.
A transactional production smoke check returned:

> PASS: today creates PENDING and invite; yesterday rejected; all fixtures rolled back

Temporary auth/user/promise/invitation rows were rolled back. No invite message was
sent. This server fix also applies to code 31. Auth settings, runtime flags, minimum
version and acceptance-web deployment were not changed.

The mobile date picker now uses the approved paper/ink/yellow calendar with close,
cancel, Today and confirm controls. Creation and amendment share it. Calendar math
uses UTC calendar fields with KST today as its lower bound, preserving upper limits.
Confirm revalidates across midnight; cancel preserves the original form. Server field
errors now also explain the return to a previous editor step in the persistent footer.
All earlier installation-scoped tutorial and feedback fixes remain included.

## Source verification

- Root mobile suite: `Test Suites: 95 passed, 95 total`; `Tests: 972 passed, 972 total`.
- After the final calendar column-width adjustment, the isolated candidate run passed
  `Test Files 122 passed (122)` / `Tests 2222 passed (2222)` for shared/server/baseline web,
  and 971/972 mobile tests. Its single mobile failure was `git check-ignore` exit 128
  because the source copy lacked Git metadata. After initializing metadata and copying
  ignore rules, the affected suite passed `6 passed, 6 total`; no test assertion changed.
- Root and final isolated `npm run typecheck`: all five projects passed, no diagnostics.
  The first isolated attempt lacked the nested web dependency junction; it was restored.
- `npm run check:agents`: `AGENTS.md 는 CLAUDE.md 와 동기화되어 있다.`
- A separate concurrent web change failed root web catalog parity. Those files were
  left untouched and excluded from the Android snapshot; the baseline web passed above.
- Regression coverage includes tutorial-active today creation reaching `/invite`, field
  error explanation, today/yesterday, maximum date, cancellation, KST midnight,
  leap years, year boundaries and six-week months.

## Native visual and interaction evidence

Actual RN components ran in a fixture-only APK on a read-only API 36.1 emulator,
360x800 dp, font scales 1.0/1.5. Backend/router/ads were mocked only in this fixture;
the production bundle was separately checked for their absence. The emulator was stopped.

| Before / after | Evidence |
|---|---|
| PO-reported native teal dialog | [Before](assets/calendar-fix-2026-09-14/calendar-before.png) |
| Ink & Block calendar, font 1.0 | [After](assets/calendar-fix-2026-09-14/calendar-final-1.png) |
| Calendar, font 1.5 | [Large text](assets/calendar-fix-2026-09-14/calendar-final-15.png) |
| Six-week January, font 1.5 | [Six rows](assets/calendar-fix-2026-09-14/calendar-15-month-3.png) |
| Review Send reaches Invite | [Invite](assets/calendar-fix-2026-09-14/invite-final.png) |
| Selecting January 31 then cancel preserves September 14 | [Cancel](assets/calendar-fix-2026-09-14/terms-after-cancel-15.png) |

Visual comparison confirms paper surface, ink borders, yellow selection, aligned
seven-column cells and visible close/confirm/cancel controls. Large six-week layouts
scroll the body while retaining footer controls. This is not Play-installed device QA.

## Exact AAB verification

EAS remote version was explicitly reserved and read back as `Android versionCode - 32`.
The established Windows local Gradle fallback reused the isolated `C:/DEV/lf30` native
project, existing dependencies and production upload credential. No clean/prebuild,
dependency upgrade or cloud build was needed. EAS production environment was freshly
pulled and compared to the established backend/App Links/real AdMob values, with local
dotenv loading disabled. JBR 21, Gradle 9.3.1, AGP 8.12.0 and NDK 27.1.12297006;
R8/resource shrinking and all ABIs retained.

- `BUILD SUCCESSFUL in 6m 57s`.
- `bundletool validate: PASS`; `jarsigner: jar verified.`; trusted upload certificate matches.
- Package, version/code, SDK, release flags, ZIP integrity and production config pass.
- 363 hashed shipping inputs are archived in `shipping-source.zip`.
  All 204 mapped own sources match current frozen inputs;
  `2191` bundled sources passed module verification. Only the
  documented Metro dependency-junction watch path differs in the isolated build config.
- Exact AAB Hermes bytes match Gradle output, contain the new calendar/tutorial markers
  and exclude known fixture entrypoints. String-table scan checked 38414
  strings; no private key, service-role JWT or secret API key was found.
- 92 native libraries remain byte-identical to code 30;
  46 ELF64 libraries and the bundle pass 16 KB alignment checks.
  Complete merged permissions are unchanged from code 30. R8 mapping is archived.

Ignored evidence: `release-archive/2026-09-14-v035-code32/`; final AAB and neighboring
SHA-256 file: `dist/`. No fixture APK should be uploaded or distributed.

## PO next step

Upload this **0.3.5 / code 32** AAB to Internal testing and install the update through
Google Play. Verify today's date -> Review -> Send -> Invite, date selection/cancel at
normal and enlarged text, and reinstall -> first-use tutorial. Account completion is
not stored; reinstall must repeat the tutorial. Physical-device and Play-delivery QA
remain PO-owned before promotion.
