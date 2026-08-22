# Development Status

Snapshot date: **2026-08-23 KST**.

## Play launch readiness pass (2026-08-23)

Executed against the approved launch-review plan (`docs` release gates + Play policy):

- **`/account-deletion` public web page** (Play data-safety requirement): in-app steps, the
  `task@deephigh.ai` off-app channel, and the de-identified-retention facts, ko/en, linked from
  privacy policy §8. Privacy policy re-versioned to **`2026-08-23.1`** (migration
  `20260823000001`, DB applied); TERMS stays `2026-08-22.3` — document versions are independent
  and only a changed text moves.
- **Release build plumbing**: `eas.json` gains `cli.appVersionSource: remote` +
  `production.autoIncrement`; AdMob production env vars documented in `.env.example` (production
  builds deliberately fail without real IDs).
- **Push notification branding**: `expo-notifications` plugin now sets the monochrome icon +
  `#00BF40` color (was: default grey square).
- **Test-login hygiene**: the mobile test-auth module is now attached via a `__DEV__`-guarded
  `require`, so Metro DCE drops it from production bundles (the static import survived before).
- **SCR-A00 single-page onboarding confirmed** (Q-5 option (b), PO-approved plan): page dots and
  the "1/3 단계" indicator removed; labels and tests updated.
- **`docs/setup/play-data-safety.md`**: prefilled Data safety form answers with code citations
  (declare ads + advertising ID even while `ads_enabled=false`; account-deletion and privacy
  URLs).
- **First EAS cloud builds (2026-08-23)**: the EAS `production` environment now carries the three
  `EXPO_PUBLIC_*` vars (Supabase URL/key added; web URL existed). The **preview APK** (release
  mode, production backend, Google test ad IDs, EAS-signed so App Links verify against the
  published fingerprint) **FINISHED** — build `a4e9e7bd`, all four ABIs verified locally. The
  **production AAB** (build `159b1038`) **ERRORED in the "Read app config" phase — the designed
  AdMob env gate**; it unblocks the moment D-4 registers the two real AdMob IDs in the EAS
  production environment, then `eas build --platform android --profile production` is the only
  remaining step.

Remaining launch work is tracked in the README gate list and section below — the big ones are
real-OAuth verification (Kakao console state + Google runbook D-1), the release-build E2E pass
(F4/F7 retest, quiet hours, TalkBack, 360×800), operator console tasks (AdMob IDs, GitHub
Actions secrets, redirect allowlist, email-login removal at the end), and the Play Console
sequence (org account → AAB → Play signing fingerprint append → store listing).

## Overall result

The local MVP implementation is feature-complete for the scope approved in the 2026-08-18 plan.
The Supabase test project is caught up, all 47 Edge Functions are active, and the acceptance web is
live on the existing Firebase project. Remaining work is interactive account/device verification,
not an unimplemented local product flow.

J-07 automatic metrics review/operator alerting remains explicitly out of scope. Real AdMob
release configuration, Play closed testing, trademark/store-name confirmation, and full
physical-device accessibility/push verification remain release gates. The real legal copy gate
closed on 2026-08-22 (see "Legal documents finalized" below); the PO confirmed external 법무
review of the published texts completed the same day.

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
| `npm test` | PASS — Vitest **100 files**, mobile Jest **68 suites / 649 tests** |
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
through `20260820000004_security_hardening.sql` are applied, `ACCOUNT_ID_PEPPER` is set
independently, and all **47/47** local Edge Functions are deployed with `--use-api` and report
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

## Deep-link invites, Korean/English UI, Pretendard (2026-08-20/21)

Approved plan executed in full; every phase committed and pushed (`f1cd06d`…`af6af67`), suite green
(vitest 99 files, jest 69 suites / 658 tests, `typecheck`, `check:agents`).

- **Deep link (ADR 0007)**: SCR-W01 shows an Android-only [앱에서 계속하기] `intent://` CTA
  (opens the app when installed, Play Store when not, and escapes KakaoTalk's in-app browser);
  the app now reviews/approves/declines/amends the invite **in-app** (EC-I01 implemented for real,
  `surface='APP'` recorded), while witness tokens keep the browser hand-off.
- **i18n (ADR 0006)**: no library — `Localized<T>` typed catalogs across app + acceptance web,
  registry-driven parity tests on both surfaces plus a cross-surface copy contract test.
  Device-locale detection is **ON** (`LOCALE_DETECTION_ENABLED`), with a manual toggle in
  SCR-A08 and a fixed web `LocaleSwitch`. Server-rendered copy (notifications, error envelopes)
  stays Korean in phase 1.
- **Pretendard**: verified correct on both surfaces; branded `+not-found` screen added; OS-owned
  surfaces (Alert, share sheet, push banner) stay system-font by design.
- Web redeployed from a fresh build; live bundle carries the intent CTA and the locale switch,
  `/.well-known/assetlinks.json` still 200.
- Open: `docs/setup/deeplink-dev-qa.md` (PO-run manual QA) and
  `docs/setup/assetlinks-play-signing.md` (M4 Play signing cert append) are not yet executed.
  (The English disclaimer's DRAFT flag was lifted 2026-08-22 — the completed 법무 review
  covered that sentence; see "Legal documents finalized" below.)

## Legal documents finalized (2026-08-22)

The placeholder drafts at `/legal/terms` and `/legal/privacy` were replaced with the final Terms
of Service (20 articles + addendum) and the PIPA-compliant Privacy Policy (overview + 12 sections),
both carrying the real operator identity (주식회사 딥하이 / 심충섭 / 798-86-01094 /
02-3443-1028) and full English translations that state the Korean version prevails.

- Version `2026-08-22.3`, status FINAL, effective 2026-08-22 (`packages/shared/src/legal.ts`);
  migrations `20260822000001`–`20260822000003` bump `lf_current_terms_version()` /
  `lf_current_privacy_version()` so new signups agree to this version. Existing agreements are
  not retro-inferred (unchanged `lf_user_provision` rule). `.3` adds the privacy officer
  contact email (task@deephigh.ai, PO 2026-08-22).
- `.2` incorporates the Codex verification pass (2 findings, both fixed): the privacy policy now
  discloses the web's sessionStorage draft holding (SCR-W04 response drafts, SCR-W01 login
  attempt flag) instead of claiming "login + language only", and the nickname is classified as
  optional (server assigns a temporary name on refusal) matching `UserProvisionRequest`.
- Policy numbers inside the documents are deliberate literals (a versioned document must not
  drift with config); `legal-document.test.tsx` compares them against `config.ts` so a config
  change breaks the build until a conscious re-versioning.
- Facts checked against the running system: Supabase data region is `ap-northeast-2` (Seoul) —
  stated as domestic storage with a US operator; push relay (Expo/FCM) is disclosed as the
  overseas transfer; AdMob ad identifiers are disclosed for the app-only ad slot; email/phone
  non-collection wording matches §6-1.
- The draft badge/notice UI and its CSS were removed; the pages now render version + effective
  date chrome. External 법무 review of the final texts is **complete** (PO confirmed
  2026-08-22), including the English `LEGAL_DISCLAIMER` sentence — its DRAFT flag is lifted
  and both locales are now verbatim-immutable.

## Manual and visual verification

**Run 1 (2026-08-19) + Day 2 (2026-08-20) of the 12-scenario manual E2E executed** (emulator +
local web, dev email test login): scenarios 1–6, 9, 11, 12 PASS; 7, 8, 10 PARTIAL; none NOT_RUN.
Seven findings: F1/F2 fixed by migration `20260819100000` (deployed, live-verified); F5 fixed and
verified on device; F6 (`20260820000001`) and F3 (`20260820000002` + `user-unblock`/
`user-block-list` + the blocked-users screen) fixed, PGlite-tested, **deployed and live-verified
on 2026-08-20** (a PAT in the root `.env` as `SUPABASE_ACCESS_TOKEN` neutralizes the recurring
CLI account flips); F7 (evidence picker upload fails on the dev client; server path healthy) is
new and needs a release-build retest. Matrix:
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

1. Codex verification pass over the new backend surface (PO-driven): `lf_my_trust_profile`,
   `lf_recompute_trust_profile`, `lf_user_block_list`, `lf_user_unblock`, and the
   `user-unblock`/`user-block-list` shells.
2. Release pass: two interactive Kakao accounts for the flows the email login cannot represent
   (#10 re-signup, real-device push incl. F4, quiet hours), #7 evidence upload retest on a
   release build (F7), TalkBack, and the 360×800 frozen-reference comparison.
