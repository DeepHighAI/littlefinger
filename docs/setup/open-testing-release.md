# Open testing release runbook — 0.2.0 (code 21)

Date: 2026-09-03. Scope: the first **Google Play open testing** submission of `com.littlefinger.app`.
The PO-facing half (console clicks, values, hand-back block) is
[`open-testing-po-guide.md`](open-testing-po-guide.md); this file is the engineer's half. Shared
commands (secrets, Vault, EAS environment, AAB validation, rollback) are not repeated — they live in
[`monetization-retention-release.md`](monetization-retention-release.md) §0, §2-4…2-6 and §5.

Why open testing and not closed testing: the Play developer account is an **organization** account
(verified in the console 2026-09-03), so the personal-account rule "closed testing, 12 testers, 14
consecutive days" does not apply. Open testing is a public track: the listing is searchable, anyone
can join, and Google reviews the app before it goes live. That is why the email test login is
removed server-side **before** submission (PO decision 2026-09-03), not at production launch.

## §1 What changed for code 21

| Change | Where | Why |
|---|---|---|
| `android.blockedPermissions` = CAMERA · RECORD_AUDIO · SYSTEM_ALERT_WINDOW | `apps/mobile/app.json` | The code 19 AAB manifest carried all three although the app only opens the gallery (`fulfillment-native.ts`). Expo applies `tools:node="remove"`, which also strips the copies merged in by `expo-image-picker` and the template. Locked by `apps/mobile/config/android-permissions.test.js` |
| Startup `Promise.all(...).catch(...)` | `apps/mobile/src/app/_layout.tsx` | A rejected startup read left the splash screen forever; it now fails open to the login screen. Locked by `root-layout.test.tsx` |

`version` stays `0.2.0`; EAS assigns versionCode 21 (`appVersionSource: remote`, `autoIncrement`).
`min_app_version` (`0.2.0`) is unaffected.

## §2 Build

Preconditions are `monetization-retention-release.md` §0 (clean `main`, gates green, EAS account
with the six `EXPO_PUBLIC_ADMOB_*` production variables). One extra check: the EAS Free plan
build quota was exhausted once on 2026-08-31. If `eas build` refuses, use the local Gradle path
that produced code 15 (`dist/prepare-local15.cjs` → `dist/build-local15.cjs` →
`dist/validate-local15.ps1`, upload key already in `dist/local15/`) and bump the version code by
hand to the next free number.

```bash
cd apps/mobile
npx eas-cli@latest build -p android --profile production --non-interactive --wait
npx eas-cli@latest build:list -p android --profile production --limit 1 --json --non-interactive
curl -L -o ../../dist/littlefinger-open-v0.2.0-code21.aab "<applicationArchiveUrl>"
```

## §3 Validate (must all hold before the AAB leaves this machine)

```bash
cd /c/DEV/littlefinger
java -jar dist/bundletool-all-1.18.1.jar validate --bundle dist/littlefinger-open-v0.2.0-code21.aab
java -jar dist/bundletool-all-1.18.1.jar dump manifest --bundle dist/littlefinger-open-v0.2.0-code21.aab > dist/manifest-code21.xml
jarsigner -verify -verbose -certs dist/littlefinger-open-v0.2.0-code21.aab | tail -n 6
certutil -hashfile dist/littlefinger-open-v0.2.0-code21.aab SHA256
```

| Assertion | Expected |
|---|---|
| `versionCode` / `versionName` | `21` / `0.2.0` |
| `minSdkVersion` / `targetSdkVersion` | 24 / 36 |
| ABIs | arm64-v8a, armeabi-v7a, x86, x86_64 |
| `android.permission.CAMERA`, `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW` | **absent** (`grep -c` = 0) |
| `play-store-listing.md` §7 "must be absent" set | absent |
| `com.google.android.gms.permission.AD_ID`, `com.android.vending.BILLING`, `POST_NOTIFICATIONS` | present |
| `android:host` in the App Links intent filter | `littlefinger-app.web.app` |
| `com.google.android.gms.ads.APPLICATION_ID` | `ca-app-pub-9625042173735017~2273644771` (not the Google test id) |
| `jarsigner` | `jar verified.`; upload-certificate SHA-256 identical to codes 13–20 |

Record build id, SHA-256, size and the **full permission list** in `docs/DEVELOPMENT_STATUS.md`
next to the build code (listing §7 rule), then hand the AAB and its SHA-256 to the PO for
`open-testing-po-guide.md` §9.

## §4 Server-side steps the engineer runs

1. After the PO reports guide §5 done (Email provider off, test accounts deleted):

   ```bash
   curl -s -o /dev/null -w "%{http_code}" \
     -X POST "https://vepnrrmxvsytguocicfe.supabase.co/auth/v1/token?grant_type=password" \
     -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","password":"test@test.com"}'
   # expect 4xx (400 email_provider_disabled), never 200
   ```

   Then update the memory/docs that still describe the email accounts as usable
   (`docs/setup/email-test-login-removal.md` gets a "executed 2026-09-xx" line).
2. Flags stay: `ads_enabled=false`, `rewarded_ads_enabled=true`, `min_app_version="0.2.0"` —
   verify with the §2-10 SQL in `monetization-retention-release.md`.
3. Nothing is deployed to Supabase for code 21: no migration, no function change.

## §5 Submission and after

- The PO submits from 게시 개요 (guide §10). Until Google approves, the app stays
  `unreviewed`; the internal track keeps serving code 20 (or 21 if the PO also promotes it).
- Review outcome arrives by mail to `task@deephigh.ai`. A rejection is handled as a normal
  defect: reproduce, fix on `main`, rebuild (code 22), re-submit — the same §2–§3 path.
- After approval: AdMob app ↔ Play listing link (guide §11), then the rewarded-ad QA rows that
  were blocked by no-fill (`docs/qa/ADR0015_DEVICE_QA.md` rows 2, 6, 7, 13) once the AdMob
  account is approved and serving.
- Rollback is `monetization-retention-release.md` §5 — there is no OTA channel; a bad build is
  replaced by a higher versionCode, and a public track cannot be halted, only superseded.

## §6 Evidence trail for this release

| Item | Where recorded |
|---|---|
| Console state before submission (tracks, declarations, listing, category/tags) | `docs/DEVELOPMENT_STATUS.md` "Open testing release (2026-09-03)" |
| Code 20 provenance (`fdc2b8b`) and code 21 build record | same section |
| PO decisions of 2026-09-03 (code 21, keep console category/tags, listing names, email login removal) | same section + `play-store-listing.md` §3 |
| Remaining verification and development backlog after open testing | `docs/DEVELOPMENT_STATUS.md` "After open testing" list |
