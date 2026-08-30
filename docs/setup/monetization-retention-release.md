# Monetization and retention release setup

Date: 2026-08-29
Scope: ADR 0015 operator tasks

Do not run `supabase config push`; Dashboard auth configuration is the source of truth. Deploy the
migration and functions through the repository's normal `db push` and `functions deploy --use-api`
paths only after the console resources below exist.

## 1. Google Play product

Create an active managed in-app product:

- Product ID: `promise_permanent_access`
- Base price: ₩2,000 (localized store prices remain authoritative)
- Consumable behavior: the app consumes only after server verification succeeds

Keep the existing `promise_slot_plus1` product unchanged. Add license testers before purchase QA.
The existing Play service account must retain product-purchase and voided-purchase API access.

## 2. AdMob units and SSV

Create one Android banner unit and three Android rewarded units (witness, duration, retention).
Configure every rewarded unit's server-side verification callback as:

`https://<project-ref>.supabase.co/functions/v1/reward-callback`

Set the EAS production variables:

- `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID`
- `EXPO_PUBLIC_ADMOB_REWARDED_WITNESS_UNIT_ID`
- `EXPO_PUBLIC_ADMOB_REWARDED_DURATION_UNIT_ID`
- `EXPO_PUBLIC_ADMOB_REWARDED_RETENTION_UNIT_ID`

Set matching Supabase Edge secrets without the `EXPO_PUBLIC_` prefix:

- `ADMOB_REWARDED_WITNESS_UNIT_ID`
- `ADMOB_REWARDED_DURATION_UNIT_ID`
- `ADMOB_REWARDED_RETENTION_UNIT_ID`

The public callback accepts only those three units and verifies Google's live P-256 key set. Never
grant from the mobile `EARNED_REWARD` callback.

## 3. Retention worker secret and Vault

Generate a random `RETENTION_WORKER_SECRET` and set it as a Supabase Edge secret. Put the same value
in Vault as `retention_worker_secret`, and put the deployed function URL in Vault as
`retention_maintenance_url`. The migration schedules the worker hourly at minute 17.

## 4. Deploy order

1. Back up the linked database.
2. Publish the 0.2.0 Android build to the track **before** the migration. The migration sets
   `app_configs.min_app_version = 0.2.0`; the witness-list, home-list and detail response shapes
   changed, and a 0.1.x build cannot parse them — the forced-update gate is what keeps those users
   on a working screen.
3. Apply `20260829103504_rewarded_ads_retention_bm.sql`.
4. Deploy with `npx supabase functions deploy --use-api`.
5. Confirm the new functions are ACTIVE and the retention cron row exists exactly once.
6. Keep `ads_enabled=false` and optionally `rewarded_ads_enabled=false` for the first smoke pass.
7. QA on a **production-profile** build with license testers and AdMob test devices. Preview
   builds are forced to Google test ad units and the SSV callback allowlist rejects them, so a
   rewarded grant can never be observed on preview.
8. Run one purchase, one rewarded grant of each action, and one refund reconciliation with
   license testers.
9. Turn on `rewarded_ads_enabled`; turn on `ads_enabled` only after the existing PO traffic gate.

## 5. Release checks

- SSV success grants once; duplicate transaction IDs grant zero additional benefit.
- Wrong ad unit, signature, opaque user, intent, account, product, or promise binding grants none.
- When a rewarded ad cannot be shown (flag off, no fill, consent declined, timeout) the benefit
  stays locked; no grant exists without a valid SSV callback.
- A partner permanent purchase does not unlock shared no-end duration; a creator purchase does.
- A voided permanent purchase revokes only personal access and never rewrites an approved promise.
- A02 banner appears once after the fifth visual card at six records and reserves no space on no
  fill or when `ads_enabled=false`.
- D-7/D-1 warnings dedupe, expired users lose access immediately, and a purge retry never deletes
  storage or DB data twice.
