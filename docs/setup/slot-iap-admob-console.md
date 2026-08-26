# Operator console runbook — slot IAP + AdMob go-live

Companion to ADR 0009. Everything here is console work only the PO can do; the code side is
complete and deployed. Ordered by dependency — later steps assume the earlier ones.

The two hard dependencies to keep in mind:

- The **production AAB build fails by design** until the two real AdMob IDs exist in the EAS
  production environment (the deliberate gate in `config/admob-config.js`).
- The Play Console **in-app product menu only appears after an AAB is uploaded** to some track,
  and purchases are only testable by **license testers on a Play-signed build**.

So the order is: AdMob IDs → production AAB → Play Console app + product → service account →
secret → purchase E2E.

## Step 1 — AdMob account, app, ad unit

1. Create an AdMob account at admob.google.com (existing Google account is fine).
2. Register the app: Android, package `com.littlefinger.app`. If the Play listing does not exist
   yet, register it as an unpublished app and link the store listing later.
3. Create **one Native Advanced ad unit** (the three placements — home, notifications, profile —
   share it for now; per-placement units can be split later without code changes).
4. Note three values: the **app ID** (`ca-app-pub-…~…`), the **ad unit ID** (`ca-app-pub-…/…`),
   and the **publisher ID** (`pub-…`, shown in AdMob settings).

## Step 2 — EAS production environment variables

At expo.dev → project `littlefinger` → Environment variables → environment **production**, set:

| name | value |
|---|---|
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | the app ID from step 1 (`ca-app-pub-…~…`) |
| `EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID` | the ad unit ID from step 1 (`ca-app-pub-…/…`) |

This unblocks `eas build --platform android --profile production` (the AAB that previously
errored in "Read app config" was this gate working as designed).

## Step 3 — Play Console app + AAB

Per the existing launch sequence (README gate list): create the app under the org account, upload
the production AAB to the **closed testing** track, then append the Play App Signing certificate
fingerprint to `assetlinks.json` (`docs/setup/assetlinks-play-signing.md`). The Data safety form
answers are prefilled in `docs/setup/play-data-safety.md` — ads and advertising ID stay declared.

Set the store listing's developer website to `https://littlefinger-app.web.app` — that is
the domain AdMob crawls for `app-ads.txt` (step 7).

## Step 4 — Merchant account + in-app product

1. Play Console → 설정 → Payments profile: activate the merchant account (required before any
   paid product can be created).
2. Play Console → 수익 창출 → 인앱 상품 → Create product:
   - Product ID: **`promise_slot_plus1`** — must match `SLOT_PRODUCT_ID` character for character;
     the server rejects every other product ID.
   - Type: in-app product (managed). Consumption is handled by the app after server verification.
   - Price: ₩1,000. Activate the product.
3. Play Console → 설정 → License testing: add the tester Google accounts. License testers are not
   charged and get fast test-card flows.

## Step 5 — Google Play Developer API service account

1. In GCP (the existing `littlefinger` project is fine), IAM → Service accounts → create one
   (e.g. `play-purchase-verify`), create a **JSON key**, download it.
2. Play Console → 설정 → API access: link that GCP project, then grant the service account
   access with at least **"View financial data, orders"** (구매 조회에 필요한 권한).
3. Hand the JSON key to the dev side (or run yourself):

   ```bash
   npx supabase secrets set GOOGLE_PLAY_SERVICE_ACCOUNT="$(cat service-account.json)"
   ```

   Then **delete the JSON file**. It must never enter the repo (`.gitignore` blocks
   `*service-account*.json`, but the baseline is deleting it once the secret is set).
   Setting the secret restarts `purchase-verify`, which until then fails at boot by design.

## Step 6 — Purchase E2E (first real verification)

On a device with a license-tester account and the closed-track build: send promises until the 6th
send opens the paywall sheet → buy the slot (test card) → the send succeeds after purchase. This
exercises the whole chain: Play Billing → `purchase-verify` → Google API → `lf_slot_grant` →
`lf_promise_invite`. Also verify the profile row shows 6 slots afterwards.

## Step 7 — app-ads.txt + turning ads on (after store publication)

1. Send the publisher ID (`pub-…`) to the dev side → `apps/web/public/app-ads.txt` is created as
   `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0` and the web is redeployed.
   AdMob verifies it against the store listing's developer website within a few days.
2. `ads_enabled` stays `false` until the F-12 threshold call (100 daily confirmations) — flipping
   it is one Dashboard SQL (`update app_configs …`), done on PO instruction; no app update needed.
   Debug/dev builds always use Google test ads regardless.
