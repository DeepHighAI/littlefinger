# Play Console Data Safety form — prefilled answers

Operator runbook for Play Console → App content → Data safety. Every answer below is grounded
in code on `main`; citations point at the wiring. Fill the form with these values verbatim
unless the code has changed since 2026-08-30 (ADR 0015: rewarded ads, in-feed banner, the
`promise_permanent_access` product, per-participant retention with purge). Re-submit the form
together with the 0.2.0 build — the previous submission (2026-08-23) predates all of these.

## URLs the form (and store listing) asks for

| Field | Value |
|---|---|
| Privacy policy URL | `https://littlefinger-app.web.app/legal/privacy` (v `2026-08-30.1`) |
| Account deletion URL | `https://littlefinger-app.web.app/account-deletion` |

## Top-level questions

| Question | Answer | Why |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | account identity, promise content, photos, push tokens, purchase records go to the backend; a pseudonymous id goes to Google for rewarded-ad verification |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | HTTPS everywhere (Supabase/Firebase/Expo/Google endpoints) |
| Do you provide a way for users to request that their data is deleted? | **Yes** | in-app withdrawal (SCR-A08 → 탈퇴, `account-withdraw` Edge Function) + the web page above; in addition, promise records are deleted automatically when every participant's access right has ended (privacy policy §3–§4) |

## Data types to declare

| Play category → type | Collected? | Shared? | Optional? | Purpose | Grounding |
|---|---|---|---|---|---|
| Personal info → User IDs | Yes | **Yes → Google (AdMob), pseudonymous** | Required | Account management, app functionality; the shared value is used only to verify a rewarded-ad view | Kakao member number / Google `sub` → `users.provider_user_id` (`supabase/migrations/20260820000003_provider_identity.sql`). Rewarded ads: `reward_intents.opaque_user_id` = SHA-256 of `user_id:intent_id`, valid 15 min, sent as the AdMob SSV `user_id` and received back by `reward-callback` (`supabase/migrations/20260829103504_rewarded_ads_retention_bm.sql`, `supabase/functions/reward-callback/ssv.ts`). It is not the raw account id and not the Advertising ID |
| Personal info → Name | Yes | No | **Optional** | App functionality (닉네임 표시) | nickname optional, server assigns a temporary name on refusal (`packages/shared/src/api.ts` `UserProvisionRequest`) |
| Personal info → Email address | Yes | No | **Optional** | Account management only | stored only in Supabase Auth when the user opts in at Kakao consent; the app never reads it (CLAUDE.md §6-1) |
| Financial info → Purchase history | Yes | No | Optional | App functionality (유료 상품 권한 부여·환불 반영) | Google Play order id, purchase token, product id, purchase time and voided status in `slot_purchases` / `slot_purchase_revocations` (`20260824000001_paid_promise_slots.sql`, `20260827000001_reconciliation_workers.sql`, `20260829103504…`); the app never sees payment instruments — Google Play Billing handles them. Kept 5 years per 전자상거래법 (privacy policy §3) |
| Photos and videos → Photos | Yes | No | Optional | App functionality (이행 증빙) | EXIF-stripped, private bucket, 10-min signed URLs (`evidence-*` functions); deleted with the promise record when the last access right ends, or when the uploader removes the photo (365-day auto-deletion retired 2026-08-29) |
| App activity → Other user-generated content | Yes | No | Required for the feature | App functionality (약속 기록) | promises/approvals/fulfillments tables; purged after the last participant's access right ends, keep-rate aggregates retained de-identified |
| Device or other IDs → Device or other IDs | Yes | No | **Optional** | App functionality (푸시) | notification permission can be denied without blocking app use; only an opted-in device registers an Expo push token via `device-token-register`, relayed through Expo/FCM |
| Device or other IDs → Advertising ID | Yes (when ads shown) | **Yes → Google (AdMob)** | Optional | Advertising | `react-native-google-mobile-ads` 16.3.3 ships in the build; native units at the bottom of A02/A07/A08, one adaptive banner after the 5th A02 card, and three user-initiated rewarded units; UMP consent gate before any load (`apps/mobile/src/lib/admob-loader.ts` `createAdsGate`); exposure slots dark while `ads_enabled=false`, rewarded units gated by `rewarded_ads_enabled` |

Declare **nothing** for: location (EXIF stripped by design), contacts, messages, health,
calendar, files, browsing history, installed apps, crash logs / diagnostics (no analytics or
crash SDK in `apps/mobile/package.json`). Financial info → **Payment info** stays undeclared:
card or account details never reach the app or the backend.

## Notes that keep the form honest

- **Ads must be declared even though `ads_enabled` defaults to false** — the SDK is compiled in
  and the store listing must also mark "Contains ads". Mark "In-app purchases" as well.
- **Rewarded ads are opt-in.** They play only when the user taps a benefit CTA; the app never
  grants on the client `EARNED_REWARD` event, only on Google's signed server callback. If the ad
  cannot be shown the benefit stays locked — there is no free fallback.
- The pseudonymous id shared with Google for SSV is a per-request hash, not a stable user
  identifier; it expires 15 minutes after the request. Say so in review responses if asked why
  "User IDs" is marked shared.
- IP address and User-Agent are stored **only as salted one-way hashes** server-side; Play does
  not require declaring server log hashes, but keep this fact for review responses.
- Data is **not sold**; the only "sharing" is the Advertising ID and the SSV pseudonymous id
  flowing to Google.
- Deletion: besides account withdrawal, confirmed promise records (and their evidence) are
  deleted automatically after the last participant's access right expires (30 days after the
  end date / finish agreement, extendable by rewarded ads, permanent with purchase). Drafts go
  after 90 days, unapproved invitations 30 days after the last link expired.
- Target audience: 만 14세 이상 (약관 제4조) — do not enroll in any families/kids program. Paid
  products additionally require guardian consent under 19 (약관 제13조 ⑦).
