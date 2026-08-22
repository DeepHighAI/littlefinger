# Play Console Data Safety form — prefilled answers

Operator runbook for Play Console → App content → Data safety. Every answer below is grounded
in code on `main`; citations point at the wiring. Fill the form with these values verbatim
unless the code has changed since 2026-08-23.

## URLs the form (and store listing) asks for

| Field | Value |
|---|---|
| Privacy policy URL | `https://littlefinger-app-philwoo.web.app/legal/privacy` |
| Account deletion URL | `https://littlefinger-app-philwoo.web.app/account-deletion` |

## Top-level questions

| Question | Answer | Why |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | account identity, promise content, photos, push tokens go to the backend |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | HTTPS everywhere (Supabase/Firebase/Expo endpoints) |
| Do you provide a way for users to request that their data is deleted? | **Yes** | in-app withdrawal (SCR-A08 → 탈퇴, `account-withdraw` Edge Function) + the web page above |

## Data types to declare

| Play category → type | Collected? | Shared? | Optional? | Purpose | Grounding |
|---|---|---|---|---|---|
| Personal info → User IDs | Yes | No | Required | Account management, app functionality | Kakao member number / Google `sub` → `users.provider_user_id` (`supabase/migrations/20260820000003_provider_identity.sql`) |
| Personal info → Name | Yes | No | **Optional** | App functionality (닉네임 표시) | nickname optional, server assigns a temporary name on refusal (`packages/shared/src/api.ts` `UserProvisionRequest`) |
| Personal info → Email address | Yes | No | **Optional** | Account management only | stored only in Supabase Auth when the user opts in at Kakao consent; the app never reads it (CLAUDE.md §6-1) |
| Photos and videos → Photos | Yes | No | Optional | App functionality (이행 증빙) | EXIF-stripped, private bucket, 10-min signed URLs (`evidence-*` functions) |
| App activity → Other user-generated content | Yes | No | Required for the feature | App functionality (약속 기록) | promises/approvals/fulfillments tables |
| Device or other IDs → Device or other IDs | Yes | No | Required for push | App functionality (푸시) | Expo push token → `device-token-register`, relayed via exp.host/FCM |
| Device or other IDs → Advertising ID | Yes (when ads shown) | **Yes → Google (AdMob)** | Optional | Advertising | `react-native-google-mobile-ads` 16.3.3 ships in the build; UMP consent gate before load (`apps/mobile/src/lib/admob-loader.ts`); slot dark while `ads_enabled=false` |

Declare **nothing** for: location (EXIF stripped by design), contacts, messages, financial info,
health, calendar, files, browsing history, installed apps, crash logs / diagnostics (no
analytics or crash SDK in `apps/mobile/package.json`).

## Notes that keep the form honest

- **Ads must be declared even though `ads_enabled` defaults to false** — the SDK is compiled in
  and the store listing must also mark "Contains ads".
- IP address and User-Agent are stored **only as salted one-way hashes** server-side; Play does
  not require declaring server log hashes, but keep this fact for review responses.
- Data is **not sold**; the only "sharing" is the Advertising ID flowing to Google when ads
  render.
- Target audience: 만 14세 이상 (약관 제4조) — do not enroll in any families/kids program.
