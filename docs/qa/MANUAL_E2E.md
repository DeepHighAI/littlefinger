# Manual end-to-end runbook

Snapshot: 2026-08-18 KST. Current status: **READY — INTERACTIVE RUN NOT STARTED**.

The Supabase project, Edge Functions, cron jobs, RLS/RPC checks, and public acceptance web are
ready. The scenarios below still require two interactive Kakao sessions and an authorized Android
development device; they must not be inferred from automated tests.

## Prerequisites

1. **PASS** — migrations are applied through
   `20260818000004_counterpart_push_availability.sql`.
2. **PASS** — all 45 Edge Functions are deployed with `--use-api` and report `ACTIVE`.
3. **PASS** — `ACCOUNT_ID_PEPPER` is configured separately.
4. **PASS** — `ads_enabled=false` remains the default and Google test identifiers are configured.
5. **PASS (host)** — `https://littlefinger-app-philwoo.web.app` serves `/i/*` and the matching
   Digital Asset Links JSON; Google recognizes the association statement.
6. **PENDING (operator)** — confirm the Firebase origin in the Dashboard-owned Supabase Auth
   redirect allowlist.
7. **PARTIAL (device/accounts)** — the Firebase-host debug APK builds locally and its manifest is
   correct, but its local debug signature intentionally differs from the EAS certificate published
   in Digital Asset Links. Authorize the Android device, install a fresh EAS-signed development
   build for the App Links pass, and prepare two interactive Kakao test accounts.

## Scenario matrix

| # | Account path | Scenario | Expected result | Status | Capture |
|---:|---|---|---|---|---|
| 1 | A | First launch onboarding, Kakao login, temporary nickname update | Onboarding appears once; later launch goes directly to login/home | NOT_RUN | Pending |
| 2 | A | Create, autosave, reopen, send partner invite | One DRAFT/PENDING record and one usable invite | NOT_RUN | Pending |
| 3 | B | Open invite, approve; repeat with decline and amend suggestion | Each response follows its single T transition and returns to the correct screen | NOT_RUN | Pending |
| 4 | A/B | Invite witness, join, sign, leave | Signature remains append-only and later access is revoked | NOT_RUN | Pending |
| 5 | A/B | Request amend/cancel, approve/decline/withdraw, allow J-05 expiry | Symmetric actions converge without duplicate requests | NOT_RUN | Pending |
| 6 | A/B | Submit all four fulfillment verdict combinations and reopen DISPUTED | COMPLETED/BROKEN/DISPUTED/UNRESOLVED facts remain neutral and round-safe | NOT_RUN | Pending |
| 7 | A/B | Upload evidence, open signed URL, report evidence | Ten-minute URL works; report atomically blinds the image | NOT_RUN | Pending |
| 8 | A/B | Inbox, push and deep-link navigation | One logical event, allowed route only, Kakao fallback when no device token | NOT_RUN | Pending |
| 9 | A/B | Hide terminal promise, block and report counterpart | Only the caller's list changes; historical record remains unchanged | NOT_RUN | Pending |
| 10 | A | Withdraw, retry withdrawal, sign up again with the same Kakao account | Old record is anonymized; new user ID and trust profile do not inherit | NOT_RUN | Pending |
| 11 | A/B | Trigger one COMPLETED celebration per participant | Each participant sees it at most once | NOT_RUN | Pending |
| 12 | A | Toggle `ads_enabled` false/true with test IDs | No reserved space when false; SCR-A02 only when true | NOT_RUN | Pending |

## Non-functional passes

Recorded before the interactive run:

- **PASS** — Firebase root and direct `/i/e2e-invalid-token` return HTTP 200; the Digital Asset
  Links file returns JSON and is recognized by Google's statement API.
- **PASS (public first view)** — three Lighthouse 13 runs at 360×800 simulated slow 4G produced a
  median LCP of 1.431 seconds against the 3-second first-load target. Performance scores were
  92/93/93 and median transfer was 2.20 MB. No chunk split or font subset was applied.
- **FINDING** — CLS was 0.1666, above the 0.1 quality target; SEO was 82.
- **NOT_RUN** — authenticated transition timing, approval API p95, pixel comparison, `adb` handoff,
  and push delivery require the interactive session/device.

- Capture every app and web screen at a logical 360×800 viewport and compare it with the frozen
  `design-reference/` screen. Never edit the reference to make a diff pass.
- Under 4G throttling, record first load (target 3 seconds), major screen transition (target 2
  seconds), and remote approval API p95 (target 1 second). Apply chunk splitting or font subsetting
  only after a measured failure.
- Verify Android App Links with `adb shell am start` against the deployed HTTPS domain.
- Record foreground, background and terminated push delivery separately.

## Result recording

After execution, replace each `NOT_RUN` status with PASS or FAIL, add absolute screenshot
paths, record the two anonymous test-account labels, and copy the results into
`docs/DEVELOPMENT_STATUS.md`. Do not record Kakao IDs, invite tokens, raw IP addresses, or device
tokens.
