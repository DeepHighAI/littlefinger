# Development Status

Snapshot date: **2026-08-27 KST**.

## Visual-system baseline: 잉크 & 스티커 (2026-08-27, ADR 0012)

The PO confirmed the **잉크 & 스티커** (Ink & Sticker, Setlog 시안 1a) restyle — full token value
swap (115 names/count frozen, 72 values moved: ink `#221C13` on cream `#F3ECDC`, butter/lavender/
apricot stickers, black filled CTA, Gaegu 400/700, offset sticker shadows) plus the six confirmed
screens A00·A01·A02·A03·A05(ACTIVE)·A08. Applied across all three targets (design-reference in-place
merge — no override layer shipped; RN tokens/components/screens; web tokens + lockstep
components.css per PO confirmation) with the value-pinning tests moved deliberately. This
supersedes the 2026-08-23 palette-A baseline below; `DESIGN.md` was rewritten and ADR 0012 records
the decisions and deviations.

- Gates (2026-08-27): typecheck 5 projects · Vitest **105 files / 2,020** · Jest **72 suites /
  738** — PASS. Six merged reference screens compared side-by-side in Chrome against the bundle's
  own preview; the acceptance-web production build transformed **134 modules** successfully.
- **Type A Pinky Loop brand mark (PO-confirmed 2026-08-27, ADR 0013):** one approved silhouette
  now drives the launcher, adaptive icon, splash, notification icon, RN, acceptance web, and
  frozen reference. Launcher = ink/paper-white; in-product = ink/butter or butter/ink inverse.
  Hash-pinning tests lock every native derivative and byte equality across the three UI targets.
  Clean Browser-plugin passes on reference SCR-A02 and the Vite SCR-W01 route found no console
  warning, overlay, or horizontal overflow; computed colours were exact ink/butter tokens.
- **Play internal-test package (2026-08-27)**: EAS production build
  `7bb7d3cd-1c16-4e79-8fbf-0fcb5609e065` finished from commit `ec62dbd` as
  `com.littlefinger.app` `0.1.0` (`versionCode 9`). The downloaded 81,440,969-byte
  `dist/littlefinger-internal-v0.1.0-code9.aab` passed bundletool 1.18.1 validation and JAR
  signature verification; min/target SDK are 24/36 and arm64-v8a, armeabi-v7a, x86, and x86_64
  are present. Extracted xxxhdpi launcher/splash/notification resources were visually checked
  against Type A. The upload-certificate SHA-256 still matches the versionCode 6/8 AABs already
  used for the Play internal track, and the artifact SHA-256 is
  `3FD91C6E482296897257FB6726670DABF5584E05689C5D13436D00D08E46AC4D`.
- PO legibility correction (2026-08-27): shared disclaimer/supporting copy moved from micro
  11.5/16 + regular + `text-faint` to caption 12.5/18 + bold + `text-secondary` across the
  reference, acceptance web, and RN. SCR-W04 browser verification measured 4.88:1 contrast on
  cream (previous muted candidate: 2.74:1). Follow-up review promoted the whole small-copy tier:
  captions, card metadata, secondary body copy, field labels, and list supporting copy are
  14/22 + bold + `text-secondary`; field hints and attachment labels are 12.5/18 + bold. Proof
  text uses full ink on `surface-muted` (12.97:1 instead of the secondary pair's 4.41:1), and the
  butter trust-card note keeps its existing full ink (13.57:1). RN now uses the same hierarchy and
  restores the A06 upload filename and A08 slot-release explanation. Browser screenshots on
  A05·A06·A08·W04 found no console warning, and the full changed-class audit covered **25 reference
  pages / 77 text elements** with no text or viewport horizontal overflow;
  gates: typecheck 5 projects · Vitest **104 files / 2,017** · Jest **72 suites / 737 tests** · Web
  build **133 modules** — PASS.
- Still pending (device QA): font-scale **1.5 reflow with Gaegu** (wide tracking — D-Day
  badge/chip clipping first), Android dashed-border rendering, elevation approximation of the
  offset sticker shadow, and a real-device pass of the six restyled screens.
- PO-확인: the English twins added for the A03 typewriter line ("→ Shall we write a new
  promise?") and the A00 mascot label ("Littlefinger mascot").

## Device-QA UX batch (2026-08-26, ADR 0011)

Four PO decisions from internal-test device QA, all shipped and gated:

- **Form guidance (SCR-A03)**: CTAs never disable into dead buttons — an invalid press wakes the
  inline §5 messages, jumps to the first invalid step, and shows a red one-line summary
  (`invalidFields` added to draft validation for message-less rules).
- **Category optional**: unselected saves as `ETC` client-side (spec §5-1 amended); zero
  server/hash change; the review step shows 기타.
- **Home 진행·대기 tabs + SCR-A09 history**: `/promises` removed; new history screen splits
  terminal statuses P1-safely (완료/불이행/협의 중단/거절·파기). `lf_promise_home_list` extended
  (migration `20260826000001`, deployed + `promise-home-list` redeployed twice — the shell's own
  tab-vocabulary copy first rejected history tabs, now sourced from shared). Legacy tab
  responses stay byte-compatible for installed builds; live smoke verified both families.
- **Red error copy**: new `LfText` `error` variant; ~25 inline failure lines across 13
  screens/sheets moved off gray. Also from the same QA session: a slot purchase now closes the
  paywall and immediately resumes the blocked send (SCR-A03/A04).
- Gates: typecheck 5 projects · Vitest **104 files / 2,017** · Jest **72 suites / 725** — PASS.
- Purchase E2E completed on device (2026-08-26): paywall on 6th send → test-card payment →
  server verify → slot granted. The whole monetization chain is live.
- **Device verification (2026-08-26)**: versionCode 6 uploaded to the internal track; the PO
  confirmed all five checklist items on device — form guidance, ETC default, home tabs +
  history, red error copy, and purchase auto-resume. The batch is closed.

## Domain re-cut: littlefinger-app.web.app (2026-08-25, ADR 0010)

The PO flagged the personal name in `littlefinger-app-philwoo.web.app` before the Play listing
existed — the last changeable moment. New origin **`https://littlefinger-app.web.app`** (new
Hosting site on the same Firebase project; `littlefinger.web.app` was taken). Old site serves
path-preserving 301s (`hosting:legacy` target). Moved with it: web SEO/OG, 47 origin references
across code/tests/docs (historical records kept), local + example env, EAS
`EXPO_PUBLIC_WEB_BASE_URL` (production/development — App Links intent filters derive from it),
Supabase auth `site_url` + allowlist (legacy origin retained during transition), `app-ads.txt`.
Privacy policy §8 carried the URL → re-versioned **PRIVACY `2026-08-25.1`** (migration
`20260825000001`, pushed). Verified live: new-origin root/assetlinks/app-ads.txt/invite/legal/
account-deletion all 200; legacy `/` and `/i/*` 301 to the new origin. The in-flight production
AAB was cancelled (old origin baked in) and rebuilt after the env change. Gates re-run: typecheck
5 projects, Vitest 104/2,015, Jest 72/718, `check:agents` — all PASS.

## Paid promise slots + expanded ads pass (2026-08-24/25)

Executed against the approved plan (ADR 0009); the Codex red-team pass on the backend surfaced 4
findings, all fixed before deployment (deadlock lock-ordering, error priority — PO decided
validation-first, secret baselines, PUBLIC table revoke + privilege-baseline tests).

- **Server (deployed 2026-08-25)**: migration `20260824000001_paid_promise_slots.sql` applied to
  the linked project; Edge Functions `slot-status` + `purchase-verify` deployed with `--use-api`
  (49/49 ACTIVE). Live smoke: `slot-status` returned `{"used":0,"capacity":5}` for a test account.
  `purchase-verify` stays boot-gated until the `GOOGLE_PLAY_SERVICE_ACCOUNT` secret exists.
- **Slot contract**: 5 free slots counting creator-side in-progress promises (§4-1-4 states);
  DRAFT excluded; resend free; terminal states return the slot; purchases permanent (+1 per
  `promise_slot_plus1`, ₩1,000). Enforced only in `lf_invite_issue_row` (all three send entry
  points), raising the new 15th error code `E_SLOT_LIMIT` (HTTP 402) after content validation.
- **Mobile**: `expo-iap` 5.3.2 added (dev-client rebuild required before device QA);
  `slot-paywall-sheet` (verify-then-consume, unconsumed-purchase reconciliation, store-localized
  price with `SLOT_PRICE_KRW_DEFAULT` fallback) opens on `E_SLOT_LIMIT` from SCR-A03/SCR-A04 and
  from the new profile slot row; ko/en `SLOT_LABEL` catalog registered.
- **Ads (F-12 expanded, PO 2026-08-24)**: SCR-A07 알림함 + SCR-A08 프로필 gained the bottom
  native-ad slot behind the same `ads_enabled` flag (off = not rendered); spec §3 table + F-12
  amended; design-reference A07/A08 carry the disabled marker; P4 zones unchanged. `app-ads.txt`
  waits on the PO's AdMob publisher id.
- **Language setting**: confirmed already implemented (SCR-A08 toggle + web LocaleSwitch);
  PO decision — keep as is.
- **Design review (batch 1, PO-confirmed via previews 2026-08-25)**: reference `scr-a08` was
  stale against the shipped product (email-reminder row violating §6-1; missing language/slots/
  reminder detail/block/logout/withdraw) — now current; new `mod-04-slot-paywall.html` is the
  approved baseline for the purchase sheet. The A07/A08 full-bleed row conversion stays gated on
  the PO's device check of the Karrot home.
- Gates: `npm run typecheck` (5 projects) PASS · Vitest **104 files / 2,015 tests** PASS ·
  mobile Jest **72 suites / 718 tests** PASS · `npm run check:agents` PASS.
- Operator items (blocking purchase/ads E2E): Play Console merchant account + in-app product
  `promise_slot_plus1` + license testers; GCP service account linked in Play Console API access →
  Supabase secret; AdMob account/app/native unit + EAS production IDs + `app-ads.txt` pub id;
  `ads_enabled` flip timing.

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
  palette-A Pine `#0B6B4B` colour (was: default grey square, then Fresh Green).
- **Test-login hygiene**: the mobile test-auth module is now attached via a `__DEV__`-guarded
  `require`, so Metro DCE drops it from production bundles (the static import survived before).
- **SCR-A00 single-page onboarding confirmed** (Q-5 option (b), PO-approved plan): page dots and
  the "1/3 단계" indicator removed; labels and tests updated.
- **`docs/setup/play-data-safety.md`**: prefilled Data safety form answers with code citations
  (declare ads + advertising ID even while `ads_enabled=false`; account-deletion and privacy
  URLs).
- **Google SSO server side verified + auth URLs fixed (2026-08-23)**: the Supabase Google
  provider turned out to be already configured (authorize 302s to accounts.google.com with the
  real client id) and the GCP client has the Supabase callback registered (no
  redirect_uri_mismatch) — the "operator runs google-oauth-setup" note was stale. What WAS broken
  is fixed above (redirect allowlist / site_url). Remaining Google item: consent screen
  publishing status (PO console check), then a real-device sign-in.
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
| `npm test` | PASS — Vitest **101 files / 1,976 tests**, mobile Jest **69 suites / 692 tests** |
| `npm run typecheck` | PASS — shared, mobile, web, Edge Functions, Supabase tests |
| `npm run build:web` | PASS — 130 modules; JS 585.87KB / gzip 170.82KB; 500KB chunk warning |
| `npx expo install --check` | PASS — `Dependencies are up to date` |
| `npm run check:agents` | PASS — CLAUDE.md and AGENTS.md synchronized |
| Android export | PASS — 1,776 modules; 4.4MB Hermes bundle |
| ARM64 device APK | PASS — 54,434,918 bytes; package, SDK, ABI, bundled JS, and signature verified |
| `git diff --check` | PASS |

The Palette A ARM64 release-mode APK was built locally with JDK 21 (`946 actionable tasks`) at
`dist/littlefinger-palette-a-arm64-v0.1.0.apk`. Its compiled manifest reports package
`com.littlefinger.app`, version `0.1.0` (code 1), minSdk 24, targetSdk 36, native code
`arm64-v8a`, and the Google Android test ad application ID. The APK contains the production JS
bundle, verifies with APK Signature Scheme v2, and has SHA-256
`4FB325EE4BC0FCE3DF9F25BA1E69620446F3CD436120DED654F7784A889DE38F`. It uses the local debug
certificate (`FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`), not the EAS/Play certificate, so it is suitable for direct feature testing but not final
App Links auto-verification or store upload. `npm run verify:android-apk -- <apk>` rejects
x86_64-only artifacts before distribution.

The production web bundle has one 585.87KB JavaScript chunk and the full Pretendard variable font
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
`https://littlefinger-app.web.app`.

- `/` and direct `/i/e2e-invalid-token` requests return HTTP 200 HTML.
- `/.well-known/assetlinks.json` returns HTTP 200, `application/json; charset=utf-8`, and the
  development APK SHA-256 signing fingerprint for `com.littlefinger.app`.
- Google Digital Asset Links API returns the expected `handle_all_urls` statement.
- Expo config resolves one `autoVerify` intent filter for HTTPS host
  `littlefinger-app.web.app` and path prefix `/i/`.
- EAS development and production `EXPO_PUBLIC_WEB_BASE_URL` values are updated to the new origin.

The Supabase Auth redirect allowlist was confirmed **stale and fixed on 2026-08-23** via a
field-scoped Management API PATCH (`site_url` was `localhost:3000`; the allowlist carried retired
`littlefinger.pages.dev` and lacked the Firebase origin — the deployed web's OAuth return was
broken until then). Now: `site_url = https://littlefinger-app.web.app`, allowlist =
Firebase origin `/**` + localhost dev entries + `littlefinger://auth-callback`. **App Links final auto-verification passed
on 2026-08-20**: EAS development build `e31110b0` (PO-approved source upload) installed on the
emulator reports `littlefinger-app.web.app: verified` in `pm get-app-links`, and an
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

## Visual-system baseline (2026-08-23) — superseded by 잉크 & 스티커 (2026-08-27, ADR 0012)

The PO approved A — **Pine Anchor · Warm Promise · Blue Record** — for the full mobile app,
acceptance web, and design reference. It superseded the single-green Fresh Green palette while
preserving Soft Promise → Quiet Record layouts and all domain behaviour. ADR 0008 records the
amendment; the 2026-08-27 section above is now the live baseline.

Still pending:

- final physical-device 360×800 comparison against the frozen reference (now the ink-and-sticker
  baseline);
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
