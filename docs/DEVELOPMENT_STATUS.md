# Development Status

Snapshot date: **2026-08-18 KST**.

## Overall result

The local MVP implementation is feature-complete for the scope approved in the 2026-08-18 plan.
The remaining work is deployment and manual/device verification, not an unimplemented local product
flow. Remote catch-up and two-account E2E are currently blocked because the Supabase CLI account
receives HTTP 403 for the linked project.

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
| `npm test` | PASS — Vitest **87 files / 1,885 tests**, mobile Jest **61 suites / 594 tests** |
| `npm run typecheck` | PASS — shared, mobile, web, Edge Functions, Supabase tests |
| `npm run build:web` | PASS — 115 modules; JS 330.63KB / gzip 100.84KB |
| `npx expo install --check` | PASS — `Dependencies are up to date` |
| `npm run check:agents` | PASS — CLAUDE.md and AGENTS.md synchronized |
| Android export | PASS — 1,775 modules; 4.4MB Hermes bundle |
| `git diff --check` | PASS |

The Android export is at
`C:\Users\batis\AppData\Local\Temp\littlefinger-local-mvp-20260818`. It used the Cloudflare
default URL for the App Link config and Google test ad identifiers. The iOS AdMob warning is not an
Android export failure; iOS is outside the MVP platform scope.

The production web bundle no longer has a JavaScript chunk above 500KB. The full Pretendard
variable font remains 2.06MB. It has not been subset because the required throttled measurement
could not be completed, so there is no measured failure authorizing that optimization.

## Remote deployment state

The existing test project is `vepnrrmxvsytguocicfe`. Earlier deployments cover the previously
recorded F-09/MOD-03 baseline, but the following local changes are not verified remotely:

- F-11 migrations and four amend/cancel Edge Functions
- witness self-leave migration and Edge Function
- account/safety migrations and five Edge Functions
- J-04/J-06 migrations, NT-20/NT-21 enum changes and cron schedules
- counterpart push availability detail wrapper

`npx supabase link --project-ref vepnrrmxvsytguocicfe` and `npx supabase db push --dry-run` both
return HTTP 403 for the available CLI account. No remote mutation was attempted after that denial,
and `supabase config push` was not run.

Before retrying deployment, configure the new `ACCOUNT_ID_PEPPER` Edge Secret independently from
`INVITE_TOKEN_PEPPER` and `PII_HASH_SALT`.

## Manual and visual verification

The two-account development-build E2E has not been executed because the backend cannot be caught up
to the local contract. Account scenarios, expected outcomes, and screenshot slots are recorded in
[`docs/qa/MANUAL_E2E.md`](qa/MANUAL_E2E.md), all currently marked `BLOCKED_REMOTE`.

The in-app browser connection also failed during trusted-path initialization, so this pass does not
claim a new 360×800 pixel comparison or 4G-throttled timing result. Automated screen semantics,
route contracts, no-ad boundaries, and Android export pass, but the following remain pending:

- full app/web 360×800 comparison after the Fresh Green and brand-symbol changes;
- first load ≤3 seconds and major screen ≤2 seconds under 4G throttling;
- approval API p95 ≤1 second against the caught-up remote project;
- actual HTTPS `assetlinks.json` verification and Android intent handoff;
- two Kakao accounts completing approval, witness, amend, fulfillment, safety and withdrawal flows;
- real Expo push delivery in foreground/background/terminated states.

## Exact next step

Grant the Supabase CLI account deployment access to `vepnrrmxvsytguocicfe`. Then run a dry-run
migration review, deploy the pending migrations and Edge Functions with `--use-api`, verify the new
cron jobs and secrets, and execute `docs/qa/MANUAL_E2E.md` with two Kakao test accounts. Record each
PASS/FAIL and screenshot path here without storing raw identifiers or invite/device tokens.
