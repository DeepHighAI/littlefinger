# Manual end-to-end runbook

Snapshot: 2026-08-18 KST. Current status: **BLOCKED_REMOTE**.

The local implementation and automated gates are ready, but the linked Supabase project currently
returns HTTP 403 for `supabase link` and `supabase db push --dry-run`. The following run must not be
marked complete until the account running the CLI has project deployment privileges.

## Prerequisites

1. Deploy all pending migrations through `20260818000004_counterpart_push_availability.sql`.
2. Deploy the local-only F-11, witness self-leave, account/safety and related Edge Functions with
   `npx supabase functions deploy --use-api`.
3. Configure `ACCOUNT_ID_PEPPER` as a new Edge Secret, separate from `INVITE_TOKEN_PEPPER` and
   `PII_HASH_SALT`.
4. Keep `ads_enabled=false` by default and use Google test identifiers for the enabled pass.
5. Prepare two Kakao test accounts, an Android development build, and the local Vite web at
   `http://127.0.0.1:4174`.
6. Configure the deployed HTTPS origin for Android App Links and publish matching
   `/.well-known/assetlinks.json` before the real-link pass.

## Scenario matrix

| # | Account path | Scenario | Expected result | Status | Capture |
|---:|---|---|---|---|---|
| 1 | A | First launch onboarding, Kakao login, temporary nickname update | Onboarding appears once; later launch goes directly to login/home | BLOCKED_REMOTE | Pending |
| 2 | A | Create, autosave, reopen, send partner invite | One DRAFT/PENDING record and one usable invite | BLOCKED_REMOTE | Pending |
| 3 | B | Open invite, approve; repeat with decline and amend suggestion | Each response follows its single T transition and returns to the correct screen | BLOCKED_REMOTE | Pending |
| 4 | A/B | Invite witness, join, sign, leave | Signature remains append-only and later access is revoked | BLOCKED_REMOTE | Pending |
| 5 | A/B | Request amend/cancel, approve/decline/withdraw, allow J-05 expiry | Symmetric actions converge without duplicate requests | BLOCKED_REMOTE | Pending |
| 6 | A/B | Submit all four fulfillment verdict combinations and reopen DISPUTED | COMPLETED/BROKEN/DISPUTED/UNRESOLVED facts remain neutral and round-safe | BLOCKED_REMOTE | Pending |
| 7 | A/B | Upload evidence, open signed URL, report evidence | Ten-minute URL works; report atomically blinds the image | BLOCKED_REMOTE | Pending |
| 8 | A/B | Inbox, push and deep-link navigation | One logical event, allowed route only, Kakao fallback when no device token | BLOCKED_REMOTE | Pending |
| 9 | A/B | Hide terminal promise, block and report counterpart | Only the caller's list changes; historical record remains unchanged | BLOCKED_REMOTE | Pending |
| 10 | A | Withdraw, retry withdrawal, sign up again with the same Kakao account | Old record is anonymized; new user ID and trust profile do not inherit | BLOCKED_REMOTE | Pending |
| 11 | A/B | Trigger one COMPLETED celebration per participant | Each participant sees it at most once | BLOCKED_REMOTE | Pending |
| 12 | A | Toggle `ads_enabled` false/true with test IDs | No reserved space when false; SCR-A02 only when true | BLOCKED_REMOTE | Pending |

## Non-functional passes

- Capture every app and web screen at a logical 360×800 viewport and compare it with the frozen
  `design-reference/` screen. Never edit the reference to make a diff pass.
- Under 4G throttling, record first load (target 3 seconds), major screen transition (target 2
  seconds), and remote approval API p95 (target 1 second). Apply chunk splitting or font subsetting
  only after a measured failure.
- Verify Android App Links with `adb shell am start` against the deployed HTTPS domain.
- Record foreground, background and terminated push delivery separately.

## Result recording

After execution, replace each `BLOCKED_REMOTE` status with PASS or FAIL, add absolute screenshot
paths, record the two anonymous test-account labels, and copy the results into
`docs/DEVELOPMENT_STATUS.md`. Do not record Kakao IDs, invite tokens, raw IP addresses, or device
tokens.

