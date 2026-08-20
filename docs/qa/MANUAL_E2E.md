# Manual end-to-end runbook

Snapshot: 2026-08-20 KST. Current status: **RUN 1 + DAY 2 EXECUTED (emulator + local web, dev
email test login)** — 9 PASS · 3 PARTIAL · 0 NOT_RUN, 7 findings (F1·F2 fixed and deployed;
F3·F5·F6 fixed in code, F3·F6 deploy pending; F7 new). App Links verified with an EAS-signed
build. Details below and in `docs/qa/E2E_RUN_2026-08-19.md`.

The Supabase project, Edge Functions, cron jobs, RLS/RPC checks, and public acceptance web are
ready. Run 1 used the dev-only email test login (accounts A=`test@test.com`, B=`test1@test.com`,
witness=`test2@test.com`, withdraw pair=`test10`/`test9`; password = full email) on the
`small_phone` emulator (Android 16, 360×640 dp) plus the local Vite web. A final pass on a
physical device with two interactive Kakao sessions is still required before release; Kakao
OAuth, App Links, and real-device push were not exercised by this run.

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
7. **PARTIAL (device/accounts)** — the ARM64 Firebase-host debug APK is compatible with Galaxy
   physical devices and its package, SDK range, native ABI, and signature verify. Its local debug
   signature intentionally differs from the EAS certificate published in Digital Asset Links.
   Install the ARM64 APK for feature tests; use a fresh EAS-signed development build for the final
   App Links pass, and prepare two interactive Kakao test accounts.

## Scenario matrix

| # | Account path | Scenario | Expected result | Status | Capture |
|---:|---|---|---|---|---|
| 1 | A | First launch onboarding, Kakao login, temporary nickname update | Onboarding appears once; later launch goes directly to login/home | **PASS** (email test login, not Kakao) | `littlefinger-qa\e2e-20260819\s01-*.png` |
| 2 | A | Create, autosave, reopen, send partner invite | One DRAFT/PENDING record and one usable invite | **PASS** | `s02-*.png` |
| 3 | B | Open invite, approve; repeat with decline and amend suggestion | Each response follows its single T transition and returns to the correct screen | **PASS** — T-03/T-04/T-05 each verified on web result route and app status. Findings F1 (fingerprint mismatch) and the amend-comment visibility question logged | `s03-*.png` |
| 4 | A/B | Invite witness, join, sign, leave | Signature remains append-only and later access is revoked | **PASS** — signature stays in 승인 이력 after leave; revisit returns 약속을 찾을 수 없어요; token single-use | `s04-*.png` |
| 5 | A/B | Request amend/cancel, approve/decline/withdraw, allow J-05 expiry | Symmetric actions converge without duplicate requests | **PASS** — T-07/T-08/T-09(decline+withdraw)/T-10 verified with clean audit trail; J-05 force-expired after the CLI fix, NT-17 자동 철회 delivered to both inboxes | `s05-*.png` |
| 6 | A/B | Submit all four fulfillment verdict combinations and reopen DISPUTED | COMPLETED/BROKEN/DISPUTED/UNRESOLVED facts remain neutral and round-safe | **PASS** — both-KEPT→COMPLETED, both-NOT_KEPT→BROKEN, mismatch→DISPUTED→재확인 요청→round 2 CHECKING→합치→COMPLETED (day 2; round-1 history append-only), J-06 expiry→UNRESOLVED | `s06-*.png` |
| 7 | A/B | Upload evidence, open signed URL, report evidence | Ten-minute URL works; report atomically blinds the image | **PARTIAL PASS** — EXIF-stripped upload and signed-URL viewer verified (Run 1); evidence on the COMPLETED promise now `BLINDED` (report → atomic blinding confirmed at data layer). Day 2: picker upload consistently fails on the dev client (F7, server path healthy) — re-test and re-capture on a release build | `s07-*.png` |
| 8 | A/B | Inbox, push and deep-link navigation | One logical event, allowed route only, Kakao fallback when no device token | **PARTIAL PASS** — inbox one-row-per-event; in-app tap routes correctly; FCM delivered foreground/background and after `am kill` (terminated); Kakao fallback UI shown for tokenless partner. Gaps: cold-start push tap lands on home (F4); force-stop delivery impossible (Android policy); quiet-hours window not tested | `s08-*.png` |
| 9 | A/B | Hide terminal promise, block and report counterpart | Only the caller's list changes; historical record remains unchanged | **PASS** — hide removed item from A's list only (B still sees 파기됨); report and block confirmed with record-preservation copy. Findings F2 (DECLINED detail 500) and F3 (no unblock path) logged | `s09-*.png` |
| 10 | A | Withdraw, retry withdrawal, sign up again with the same Kakao account | Old record is anonymized; new user ID and trust profile do not inherit | **PARTIAL PASS** (ran with disposable pair test10/test9) — two-step confirm with anonymization copy; auth user deleted (re-login → invalid_credentials); counterpart record and version history intact. Re-signup/trust-inheritance check impossible with email accounts (signup disabled); needs Kakao or CLI-recreated account. Findings F5, F6 | `s10-*.png` |
| 11 | A/B | Trigger one COMPLETED celebration per participant | Each participant sees it at most once | **PASS** — day 2: rendered exactly once for A and for B on the round-2 COMPLETED promise, with correct 지킴율 집계 시작(67%); reopening the detail shows no repeat for either side | `s11-*.png` |
| 12 | A | Toggle `ads_enabled` false/true with test IDs | No reserved space when false; SCR-A02 only when true | **PASS** — `false`: no ad slot and no reserved space (s01-05/s01-09, s12-02); `true`: SCR-A02 bottom slot rendered (s12-01); remote value restored to `false` after the run | `s12-*.png` |

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

## Run 1 — 2026-08-19 (emulator + local web)

Evidence root: `C:\Users\batis\AppData\Local\Temp\littlefinger-qa\e2e-20260819\`.
Full narrative, findings F1–F6, and blocker list: `docs/qa/E2E_RUN_2026-08-19.md`.

Environment: `small_phone` AVD (Android 16, 720×1280 @320dpi = 360×640 dp), ARM-free x86_64 dev
client + Metro in CI mode on port 8143 (Windows excluded-port range 8035–8134 blocks 8081; watch
mode also fails on this machine — `CI=1 EXPO_NO_TYPESCRIPT_SETUP=1 npx expo start --dev-client
--port 8143` is the working recipe). Web: local Vite dev server (test login form renders only
there). Accounts: dev email test accounts (password = full email), A=`test`, B=`test1`,
witness=`test2`, withdraw pair=`test10`/`test9`, all `@test.com`.

The Supabase CLI wrong-account blocker was resolved mid-run (operator re-login as batisututu),
which unblocked the DB-side levers — then **flipped back to the wrong account on 2026-08-20**,
mid-session, blocking the deploy of the F6/F3 fix migrations and the two new Edge Functions.
See `docs/qa/E2E_RUN_2026-08-19.md` (continuation + day 2) for the full sequence.

Remaining after Day 2 (2026-08-20):

1. Operator: fix the CLI account again (private window → `npx supabase login` as batisututu,
   or export a `SUPABASE_ACCESS_TOKEN` PAT); then deploy migrations `20260820000001`(F6) +
   `20260820000002`(F3) and Edge Functions `user-unblock`/`user-block-list`, and live-verify
   both (unblocking A→test1 also restores the burned account pair).
2. #10 re-signup/trust-inheritance needs a Kakao account or a CLI-recreated email account
   (signup is confirm-gated and SMTP rate-limited; `test3`–`test8` remain unused).
3. Release pass: Kakao OAuth interactive, real-device push (incl. the F4 cold-start retest),
   quiet-hours window, #7 re-test on a release build (F7), TalkBack. App Links is **done**
   (EAS build `e31110b0`, domain verified + intent handoff on the emulator).
