# Development Status

Snapshot date: **2026-08-18 KST**.

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
| `npm test` | PASS — Vitest **87 files / 1,885 tests**, mobile Jest **61 suites / 595 tests** |
| `npm run typecheck` | PASS — shared, mobile, web, Edge Functions, Supabase tests |
| `npm run build:web` | PASS — 115 modules; JS 330.63KB / gzip 100.84KB |
| `npx expo install --check` | PASS — `Dependencies are up to date` |
| `npm run check:agents` | PASS — CLAUDE.md and AGENTS.md synchronized |
| Android export | PASS — 1,776 modules; 4.4MB Hermes bundle |
| `git diff --check` | PASS |

The new Android export is at `apps/mobile/.expo/firebase-export`. A local x86_64 debug APK also
built successfully (`558 actionable tasks`, 99,172,731 bytes) and is copied to
`C:\Users\batis\AppData\Local\Temp\littlefinger-firebase-debug-x86_64.apk`. Its compiled manifest
contains `autoVerify=true`, host `littlefinger-app-philwoo.web.app`, and `/i/`. It uses the local
debug certificate (`FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`), not the EAS development certificate in the public
Digital Asset Links file, so it is suitable for local feature testing but not final App Links
auto-verification. Google test ad identifiers remain configured.

The production web bundle no longer has a JavaScript chunk above 500KB. The full Pretendard
variable font remains 2.06MB. The measured public-route LCP passes the approved 3-second target, so
the plan does not authorize font subsetting or further chunk splitting in this pass.

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
that the Firebase origin and callback path are present. A fresh EAS development build is needed for
final auto-verification because App Links hosts and signing identity must both match.

## Manual and visual verification

The backend and public web prerequisites are complete, but the 12 two-account scenarios have not
been executed. The Android emulator remains `unauthorized`, no interactive pair of Kakao test
sessions is available to the agent, and the in-app browser failed trusted-path initialization.
Account scenarios and evidence slots are in [`docs/qa/MANUAL_E2E.md`](qa/MANUAL_E2E.md).

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
- `adb shell am start` handoff with a fresh build containing the Firebase host;
- two Kakao accounts completing approval, witness, amend, fulfillment, safety and withdrawal flows;
- real Expo push delivery in foreground/background/terminated states.

## Exact next step

Authorize the Android emulator's USB-debugging prompt, create/install a freshly EAS-signed
development build, and add the Firebase origin to the Supabase Auth redirect allowlist if it is
absent. Then execute
`docs/qa/MANUAL_E2E.md` interactively with two Kakao test accounts and record each PASS/FAIL and
screenshot path without storing raw identifiers, invite tokens, or device tokens.
