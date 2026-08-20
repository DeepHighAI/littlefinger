# Development Status

Snapshot date: **2026-08-19 KST**.

## Overall result

The local MVP implementation is feature-complete for the scope approved in the 2026-08-18 plan.
The Supabase test project is caught up, all 45 Edge Functions are active, and the acceptance web is
live on the existing Firebase project. Remaining work is interactive account/device verification,
not an unimplemented local product flow.

J-07 automatic metrics review/operator alerting remains explicitly out of scope. Real legal copy,
real AdMob release configuration, Play closed testing, trademark/store-name confirmation, and full
physical-device accessibility/push verification remain release gates.

## Implemented in this completion pass

- Specification alignment: email collection/sending is removed from the MVP contract and shared
  validator; J-07 is marked deferred; NT-20 and NT-21 plus draft reminder kinds are documented and
  implemented.
- SCR-A00 onboarding: the approved first page is shown once and completion is stored locally.
- Startup version gate: `app_configs.min_app_version` is strictly parsed and compared; outdated
  builds are blocked, while configuration failure is fail-open.
- Android App Links: HTTPS `/i/*` intent filters, route parsing, app handoff copy, and web fallback
  contracts are present. Domain association remains a hosting/device gate.
- Authentication boundaries: Kakao cancel, provider failure, required nickname refusal, expired
  session, and KakaoTalk in-app browser fallback copy match the EC-A/I contract.
- Account lifecycle: withdrawal removes DRAFTs, declines PENDING records and revokes invites,
  withdraws AMEND_PENDING requests, preserves confirmed records, removes device tokens, anonymizes
  personal data, and fences all later Edge RPC calls. Auth deletion failure cannot restore access.
- Re-registration: the same Kakao account receives a new user ID after completed withdrawal and
  does not inherit promises or trust history.
- Account/safety surfaces: temporary nickname update, terminal promise hide/unhide, shared-record
  user block/report, and evidence report with atomic `blinded_at` update.
- EC-G01: promise detail exposes only a counterpart push-availability boolean; a creator sees the
  manual Kakao share action when the partner has no registered device token.
- Batches: J-04 expires invitations while keeping the promise PENDING; J-06 schedules NT-20/NT-21
  and deletes only eligible warned 90-day drafts. Both schedulers replace duplicate cron rows and
  are idempotent across same-time reruns.
- Public API additions: `account-withdraw`, `profile-nickname-update`, `promise-hide`, `user-block`,
  and `safety-report`, all with strict shared response parsers.
- Edge-case traceability: all 57 EC-A01--EC-I04 IDs map to named behavior tests. The executable map
  is [`supabase/tests/ec-traceability.test.ts`](../supabase/tests/ec-traceability.test.ts); the
  summary is [`docs/qa/EC_TRACEABILITY.md`](qa/EC_TRACEABILITY.md).

## Local verification

| Gate | Result |
|---|---|
| `npm test` | PASS — Vitest **88 files / 1,887 tests**, mobile Jest **61 suites / 595 tests** |
| `npm run typecheck` | PASS — shared, mobile, web, Edge Functions, Supabase tests |
| `npm run build:web` | PASS — 115 modules; JS 535.90KB / gzip 154.02KB; 500KB chunk warning |
| `npx expo install --check` | PASS — `Dependencies are up to date` |
| `npm run check:agents` | PASS — CLAUDE.md and AGENTS.md synchronized |
| Android export | PASS — 1,776 modules; 4.4MB Hermes bundle |
| ARM64 device APK | PASS — 99,186,411 bytes; package, SDK, ABI, and signature verified |
| `git diff --check` | PASS |

The new Android export is at `apps/mobile/.expo/firebase-export`. The earlier
`littlefinger-firebase-debug-x86_64.apk` contains only x86_64 native libraries and is emulator-only;
Galaxy devices correctly reject it as incompatible. A replacement ARM64 debug APK built with JDK
21 (`558 actionable tasks`, 99,186,411 bytes) is at
`C:\Users\batis\AppData\Local\Temp\littlefinger-firebase-debug-arm64-v8a.apk`. Its compiled manifest
reports package `com.littlefinger.app`, minSdk 24, targetSdk 36, and native code `arm64-v8a`; the
APK signature verifies. It uses the local
debug certificate (`FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`), not the EAS development certificate in the public
Digital Asset Links file, so it is suitable for local feature testing but not final App Links
auto-verification. `npm run verify:android-apk -- <apk>` now rejects x86_64-only artifacts before
distribution. Google test ad identifiers remain configured.

The production web bundle has one 535.90KB JavaScript chunk and the full Pretendard variable font
remains 2.06MB. The measured public-route LCP passes the approved 3-second target, so the plan does
not authorize font subsetting or chunk splitting in this pass; the build warning remains recorded.

## Remote deployment state

The test project `vepnrrmxvsytguocicfe` is linked under `batisututu@gmail.com`. All migrations
through `20260818000004_counterpart_push_availability.sql` are applied, `ACCOUNT_ID_PEPPER` is set
independently, and all **45/45** local Edge Functions are deployed with `--use-api` and report
`ACTIVE`. `supabase config push` was not run.

Read-only metadata and rollback-safe remote tests produced these results:

- J-04 `lf-invitation-expiry`: exactly one active `*/30 * * * *` cron row; two fixed-time runs
  produced one expiry effect and no duplicate work.
- J-06 `lf-draft-cleanup`: exactly one active `0 19 * * *` cron row; two fixed-time runs produced
  one NT-20/NT-21 scheduling/deletion effect and no duplicate work.
- RLS is enabled on every public table; 15 tables have the restrictive active-account boundary.
- The batch functions deny `anon`, `authenticated`, and `public`, allow `service_role`, use
  `security definer`, and have an empty search path.
- ACTIVE access, WITHDRAWN denial, active nickname RPC idempotency, and withdrawn RPC rejection all
  passed; fixtures were rolled back.

Supabase Security Advisor returned no ERROR and 55 WARN findings: 30 mutable function search paths,
4 anonymous and 4 authenticated security-definer grants, 1 leaked-password-protection setting, and
16 RLS init-plan findings. They are a hardening backlog, not a failed result of the scoped checks.

Reusable verification SQL is committed under `supabase/tests/remote/`.

## Web hosting and App Links

Cloudflare Pages is retired. ADR 0005 selects the existing Firebase Spark project
`littlefinger-app-philwoo`, and the acceptance web was deployed as 31 static files to
`https://littlefinger-app-philwoo.web.app`.

- `/` and direct `/i/e2e-invalid-token` requests return HTTP 200 HTML.
- `/.well-known/assetlinks.json` returns HTTP 200, `application/json; charset=utf-8`, and the
  development APK SHA-256 signing fingerprint for `com.littlefinger.app`.
- Google Digital Asset Links API returns the expected `handle_all_urls` statement.
- Expo config resolves one `autoVerify` intent filter for HTTPS host
  `littlefinger-app-philwoo.web.app` and path prefix `/i/`.
- EAS development and production `EXPO_PUBLIC_WEB_BASE_URL` values are updated to the new origin.

The Supabase Auth redirect allowlist is Dashboard-owned and still needs an interactive confirmation
that the Firebase origin and callback path are present. **App Links final auto-verification passed
on 2026-08-20**: EAS development build `e31110b0` (PO-approved source upload) installed on the
emulator reports `littlefinger-app-philwoo.web.app: verified` in `pm get-app-links`, and an
`am start` HTTPS `/i/*` intent resolves into `com.littlefinger.app` instead of the browser.

## Manual and visual verification

**Run 1 (2026-08-19) + Day 2 (2026-08-20) of the 12-scenario manual E2E executed** (emulator +
local web, dev email test login): scenarios 1–6, 9, 11, 12 PASS; 7, 8, 10 PARTIAL; none NOT_RUN.
Seven findings: F1/F2 fixed by migration `20260819100000` (deployed, live-verified); F5 fixed and
verified on device; F6 (`20260820000001`) and F3 (`20260820000002` + `user-unblock`/
`user-block-list` + the blocked-users screen) fixed and PGlite-tested but **deploy-blocked on the
recurring Supabase CLI wrong-account 403**; F7 (evidence picker upload fails on the dev client;
server path healthy) is new and needs a release-build retest. Matrix:
[`docs/qa/MANUAL_E2E.md`](qa/MANUAL_E2E.md), full record:
[`docs/qa/E2E_RUN_2026-08-19.md`](qa/E2E_RUN_2026-08-19.md). Kakao OAuth and real-device push
remain untested (release checklist); App Links is verified.

Lighthouse 13 measured the deployed invalid-invite route three times at 360×800 with simulated
slow 4G (150 ms RTT, 1,638.4 Kbps, 4× CPU). Results were Performance **92/93/93**,
Accessibility **100/100/100**, Best Practices **100/100/100**, median FCP **1.281 s**, median LCP
**1.431 s**, median Speed Index **1.281 s**, median TBT **14 ms**, and median transfer **2.20 MB**.
The measured first-view LCP passes the 3-second target, so the plan does not authorize chunk or font
changes. CLS is **0.1666** and remains a visual-quality finding; SEO is **82**. Authenticated major
screen transitions and approval API p95 were not measurable without the two-account session.

Still pending:

- full app/web 360×800 comparison after the Fresh Green and brand-symbol changes;
- authenticated major screen transition ≤2 seconds and approval API p95 ≤1 second;
- two Kakao accounts completing approval, witness, amend, fulfillment, safety and withdrawal flows;
- real Expo push delivery on a physical device (emulator delivery verified foreground/background/
  terminated; F4 cold-start deep link needs a release-build retest).

## Exact next step

1. Operator: fix the Supabase CLI account again (private window → `npx supabase login` as
   batisututu, or export a `SUPABASE_ACCESS_TOKEN` PAT). Then deploy migrations
   `20260820000001`+`20260820000002` and Edge Functions `user-unblock`/`user-block-list`
   (`--use-api`), and live-verify F6 and F3 (unblocking A→test1 restores that account pair).
2. Codex verification pass over the new backend surface (PO-driven).
3. Release pass: two interactive Kakao accounts for the flows the email login cannot represent
   (#10 re-signup, real-device push incl. F4, quiet hours), #7 evidence upload retest on a
   release build (F7), TalkBack, and the 360×800 frozen-reference comparison.
