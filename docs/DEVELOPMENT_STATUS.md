# Development Status

Snapshot date: **2026-09-03 KST**.

## Open testing release (2026-09-03)

The Play Console was read end to end on 2026-09-03 before the submission (developer account
주식회사딥하이 — an **organization** account, so the personal-account rule "closed testing, 12
testers, 14 consecutive days" does not apply). Findings that shaped the release:

- App state `앱 초안 · unreviewed` — this submission is the first Google review. Internal testing
  serves `20 (0.2.0)` (published 2026-09-02 20:09 KST). **Code 20 was built from `fdc2b8b`** (EAS
  `ee80e524-c82a-49f7-9632-90a39c7729a1`); the three commits after it are docs-only.
- Open testing track: 177 countries, testers and a draft release exist, **no bundle attached**.
- 게시 개요's "검토를 위해 앱 전송" is locked because the **광고 ID declaration** is the one app-content
  item not yet submitted; the other nine (data safety, content rating, target audience 13+, ads,
  app access, privacy policy, health, financial, government) were completed on 2026-09-03 and sit
  as unsent changes.
- Listing: icon, feature graphic, **8/8 phone screenshots** (gallery renders with the storyboard
  overlay band), ko-KR + en-US. The app name was ko `리틀핑거` / en `Liitlefinger-promise` (typo);
  category 커뮤니케이션 with tags 데이트·소셜·엔터테인먼트·장난·커뮤니케이션; app access was
  declared as "no special access needed" although login is mandatory.
- The code 19 AAB manifest (bundletool dump) carried `CAMERA`, `RECORD_AUDIO` and
  `SYSTEM_ALERT_WINDOW`; host, AdMob application id, SDK range and ABIs were correct.

PO decisions (2026-09-03): rebuild as **code 21** with the permission cleanup; keep the console
category and tags and update the docs; change the listing names to the documented values; execute
the email-test-login server removal **before** open testing (public track).

Code 21 source is `711e181`: `android.blockedPermissions` removes the three permissions (locked by
`apps/mobile/config/android-permissions.test.js`; a local prebuild shows `tools:node="remove"`
for all three), and the root layout's startup `Promise.all` falls open on rejection instead of
leaving the splash screen (`root-layout.test.tsx`). Gates at `711e181`: Vitest **110 files /
2,142 tests**, jest-expo **80 suites / 824 tests**, five-project `typecheck`, `git diff --check` —
PASS. Runbooks: `docs/setup/open-testing-release.md` (engineer) and
`docs/setup/open-testing-po-guide.md` (PO console steps with a hand-back block). Build record:
see "Build 0.2.0 / versionCode 21" under Remote deployment state.

**Google OAuth consent screen (2026-09-03, GCP project `littlefinger-506104`).** The PO's
"앱 게시" took effect: publishing status is **프로덕션 단계**, and with only the three non-sensitive
scopes the Verification Center's data-access card says no verification is needed — any Google
account can sign in. What the console still flags is **brand verification** (app name + logo on the
consent screen; until it passes the screen shows the Supabase domain). Its automated check listed
four issues: homepage domain not verified in Search Console, a login page shown before a homepage,
no app-purpose description on the homepage, and the branding app name `Liitlefinger` not matching
the site. The web root `/` used to fall through to SCR-W06 (E_NOT_FOUND), so a public **home page**
now lives at `/` (`apps/web/src/screens/home.tsx`, copy from the approved listing §1-3/§1-4,
ko/en catalog registered, no login control) and is deployed to Firebase Hosting (root 200,
`assetlinks.json`, `app-ads.txt`, legal and account-deletion routes unchanged). The first
re-verification after that deploy still reported "no purpose description" and "login page first":
Google's automated check reads the HTML without executing JavaScript, and the SPA shell's body was
empty. The home is therefore **prerendered at build time** — `apps/web/src/screens/home-static.ts`
renders the same ko labels to static HTML, a Vite plugin injects it into `index.html` only, and
deep routes are served by a byte-identical `app.html` shell (`firebase.json` rewrite `**` →
`/app.html`), so invite screens never flash the home copy. Verified live: `/` returns
`<h1>리틀핑거</h1>` and the purpose text in the raw HTML, `/i/*` returns the empty shell. Search
Console ownership of `littlefinger-app.web.app` is **verified** (HTML file
`googleb324b92c6f5d9c19.html`, served from `apps/web/public/`, pinned by `seo.test.ts`), and the
branding app name was corrected to `리틀핑거` by the PO. The third attempt still listed "homepage
not registered to you" and "login page before homepage" although IAM shows task@deephigh.ai as
project **Owner** and Search Console's live URL test renders the home correctly (all resources
loaded, no console errors, no login screen) — consistent with the Search Console → brand-check
sync lag reported on Google's developer forums. The Play CTA was moved below the description
sections to leave nothing that reads as a gate, and Firebase Hosting's default
`Cache-Control: max-age=3600` on HTML (which let a CDN edge serve the previous home for up to an
hour after a deploy — observed with `X-Cache: MISS` vs. stale content) was replaced by
`max-age=0, must-revalidate` for the shells, one-year immutable caching for hashed `/assets/**`,
and one day for `/fonts/**` (`firebase.json`, pinned by `seo.test.ts`). Remaining: re-run branding
verification after a few hours, or request manual review with the justification in
`open-testing-po-guide.md` §4.

### After open testing — verification and development backlog

Priority order; each item names what it needs.

1. Two real Kakao accounts through approval, witness, amend, fulfillment, safety and withdrawal on
   the store build (spec §13 item 1 has no device evidence; the email test login is gone).
2. Release-build retests of F7 (evidence upload) and F4 (cold-start push deep link); real push
   delivery and quiet hours on a physical device.
3. Once the AdMob account is approved and fills: rewarded rows 2, 6, 7 (SSV grant) and banner row
   13 (`ads_enabled` on for the row only), plus the unfinished halves of rows 3–5.
4. Second-account rows: creator-side permanent access UI (rows 9–10), FINISH flow (rows 14–15).
5. AppState-active retry for startup gates parked while the screen was off (follow-up to the
   code 21 `.catch`).
6. Before production: refund → reconcile revocation (row 12), retention expiry/purge/NT-22·23
   (rows 16–18, staging SQL + worker secrets), ADR 0015 non-functional passes, remote concurrency
   EC rows (5), J-10/J-11 double-run idempotence, TalkBack speech, font scale 1.5, dashed border and
   sticker shadow on device, Security Advisor WARN backlog (55), web CLS 0.1666,
   `deeplink-dev-qa.md` A–D, legal `2026-08-30.2` re-versioning, Q-5 onboarding pages 2–3.
7. Operations: close the survey two weeks after go-live, `ads_enabled` traffic gate (100 daily
   confirmations), AdMob app ↔ listing link after approval.

## Open-testing final QA candidate (2026-09-02)

Play internal testing installed `0.2.0 (18)` from EAS build
`5e543b9d-0680-4617-ba6e-abddbd0c0368` (Git `ab84bda`, AAB SHA-256
`FF25362322E032F17C326C1EB02A8228C195050069350BFE999ABC3E2A8F9B7D`) through
`com.android.vending` on the connected Samsung Android 13 device. Home loading, cold start,
notification navigation, legal links, the hidden no-end CTA, and reward/penalty keyboard avoidance
pass; the cold-start log contains no fatal or React error. A Play license-test purchase of
`promise_slot_plus1` completed without a charge and increased server capacity from 5 to 6.

The run found and fixed two release defects in `c0a17fb`:

- The store-installed APK uses signing certificate `B3:BD:C8:EB:67:FF:B7:25:43:04:3B:E6:AB:4E:48:A9:E1:69:42:65:F0:BB:A4:98:9E:35:CB:1C:AA:D0:A7:14`, which was absent from
  `assetlinks.json`. The statement and pinning test now retain all three known certificates;
  Firebase Hosting is deployed, Google DAL and Android report `verified`, and Samsung Internet's
  app-open action launches the invalid-invite screen in the app.
- Play returned an empty permanent-access price because `promise_permanent_access` does not exist.
  The native price loaders now trim blank values and use the approved fallback instead of rendering
  `에 영구 보관`. Full tests, the five-project typecheck, `check:agents`, and `git diff --check`
  passed before the commit was pushed. Production code 19 build
  `afa4ebab-a08a-4528-98ba-3ca73a30af25` finished from that exact SHA. The validated AAB is
  `83,253,612` bytes with SHA-256
  `548BC45448FC185D8B3C8EBF8BC5119C8F223B4B84A676FAC97B813981D60FCD`; bundletool confirms
  versionCode 19, targetSdk 36, minSdk 24, four ABIs, and no debug manifest flag, while JAR
  signature verification exits 0. Play internal release 13 (`19 (0.2.0)`) is published, and the
  Play Store updated the connected device to code 19 through `com.android.vending`. Cold start,
  retained-session home loading, and the permanent-access sheet's `₩2,000에 영구 보관` fallback
  pass on that store-installed build; Android App Links remain `verified` after the update.

Two external release blockers remained at this point — both were closed later the same day (the
UMP form in the second pass, the permanent product in the code 20 follow-up below). As written
then: AdMob UMP has no applicable message/form and returns a
publisher-misconfiguration error before SDK initialization, blocking every exposure and rewarded
ad row; `ads_enabled=false` was restored and `rewarded_ads_enabled=true` remains. Play Console's
one-time-product catalog contains only the slot product. Creating the required consumable
`promise_permanent_access` at ₩2,000 passes field/price validation, but its product detail/save APIs
remain loading and the item is not created; the signed-in account is confirmed as the developer
account owner, not a restricted user. Permanent-purchase rows therefore remain blocked. The PO
confirmed all 31 users and 29 promises are disposable test data, but destructive retention rows
still require their dedicated setup and worker secrets. Detailed evidence and row status:
[`docs/qa/ADR0015_DEVICE_QA.md`](qa/ADR0015_DEVICE_QA.md).

## Second device-QA pass on code 19 (2026-09-02)

A second pass ran against the store-installed `0.2.0 (19)` on the same SM-N981N, signed in as
the partner test account (B) — the **partner** on the promise under test, which is what makes the partner-side rows
reachable at all. The matrix moved from 1 PASS · 2 FAIL · 17 NOT_RUN to
**3 PASS · 6 PARTIAL · 1 FAIL · 10 NOT_RUN** after the code 20 follow-up. The overall result stays
**FAIL** because ad-backed rows cannot finish while AdMob remains unavailable and ten destructive
or multi-account rows have not yet run.

What newly passes. Row 8: the partner's duration sheet shows `종료일 범위는 작성자만 늘릴 수
있어요.` and renders **no rewarded-ad button** — only the scrim, close, and purchase CTA. Row 19:
every clickable on A05 detail, the retention sheet, the witness sheet and the amend editor carries
a Korean accessibility label, all targets are ≥48 dp, and locked state is text plus a disabled
button rather than colour. Rows 3, 4, 5 and 7 pass their reachable halves: the locked witness copy
with a disabled invite button, the end-date refusal with the ceiling `2026-10-02 (금)` (= today +
`END_DATE_FREE_DAYS` 30), the retention expiry display, and — most usefully — the
**no-free-fallback rule under a genuine ad outage**: both rewarded actions answer `지금은 광고를
볼 수 없어 잠겨 있어요.` and grant nothing. Row 11's product is still unavailable to code 19,
but the same
recovery machinery was exercised with the slot product: a license-test purchase, `force-stop`
while Play was still on its post-purchase screen, then reopening the sheet recovered it — 6 → 7,
**+1 exactly, no second payment**.

The PO then completed the two console settings. A cold-start retest confirms that the former UMP
publisher-misconfiguration error is gone: UMP writes `IABTCF_gdprApplies=0`, Mobile Ads initializes,
and an ad request is made. The request still ends with `Ad failed to load : 3` (no fill), so no
reward is granted and the locked copy remains.

The Play-installed `0.2.0 (20)` follow-up closes the permanent-product blocker. Play Billing shows
`약속 영구 보관`, the localized ₩2,000 price, `테스트 카드, 항상 승인`, and the explicit
no-charge test-order notice. Completing the order changes the partner's sheet to `영구 보관 중`;
it survives a force-stop and cold start. The server ledger contains exactly one
`promise_permanent_access` row, the order and token each occur once, the buyer's effective access
is true, and the creator's remains false. Live flags after every test are `ads_enabled=false` and
`rewarded_ads_enabled=true`.

Two new defects, both outside the ADR 0015 surface but present on the release build.
`ADR15-QA-F07`: MOD-02 still says `카카오톡으로 증인 초대하기` while its handler is the OS share
sheet — the exact label lie C-4 retired for SCR-A04 on 2026-08-23, and now the only 카카오톡 string
left in the app. `ADR15-QA-F08`: with English selected the home hero and list rows print a Korean
weekday (`End date 2026-09-22 (화)`), because two of `formatKstDate`'s eleven call sites
(`apps/mobile/src/app/home.tsx:304`, `apps/mobile/src/components/PromiseListRow.tsx:88`) omit the
`locale` argument that the other nine pass. Both are fixed in `fdc2b8b`: MOD-02 now says
`초대 링크 공유하기` / `Share invite link`, and both home call sites pass the current locale.
The code 20 development build was exercised end to end with a newly created and mutually approved
promise; screenshots confirm `(Thu)` on the hero and list and the corrected witness-sheet CTA with
no clipping or layout regression. The Play-installed code 20 repeats both checks: `(Thu)`/`(Tue)`
render in English, and MOD-02 renders `초대 링크 공유하기` / `Share invite link` without clipping.

Post-fix repo gates: `vitest run` 110 files / 2142 tests passed, `jest-expo` 79 suites / 821
tests passed, the five-project `typecheck` and `check:agents` both exited 0. Rows 14–18 remain
unrun — they need purpose-built retention fixtures and the worker secrets, and were not improvised
against unrelated rows. Detail and evidence paths:
[`docs/qa/ADR0015_DEVICE_QA.md`](qa/ADR0015_DEVICE_QA.md).

## Open-testing feedback survey drafted (2026-08-31)

`docs/setup/open-testing-survey.md` is the paste-ready Google Forms body for Play **open testing**
feedback: the form settings to toggle by hand, the title / intro / confirmation blocks, and 16
questions covering the five PO-named improvement areas — UI/UX design, the send → approve system,
wanted features, real-world usefulness, and bug reports. PO decisions on the day: Korean only (no
en-US twin), fully anonymous (email collection off, no file-upload question — it would force a
Google sign-in), 16 questions / ~2 minutes, and **one optional free-text box** (Q15, bug repro)
because testers will not write. Verified by grep: 16 questions = 4 linear scales + 6 radios + 5
checkboxes + 1 short answer, two optional (Q6, Q15), 7 sections, and **zero** §8-3 wording-guard
words or banned terms inside the paste-ready blocks. Creating the form, wiring its link into the
Play open-testing feedback URL, and distributing it are PO console work.

## Pending promise deletion deployed (2026-08-31)

Creators can now delete both DRAFT and PENDING promises from the waiting list. PENDING deletion is
a server-owned, idempotent operation with a two-step confirmation in Korean and English: it locks
the invitation before the promise, verifies creator ownership and PENDING status, then deletes the
promise transactionally. Cascades remove the invitation and every participant-facing waiting-list
row, so the send is canceled for both people; reports are retained with their promise/evidence
links cleared. `CANCELED` remains reserved for the post-ACTIVE mutual-cancel transition.

Migration `20260831052923_pending_promise_delete.sql` and the `promise-pending-delete` Edge
Function are deployed to the linked Supabase project. The function is ACTIVE with JWT verification;
the RPC is security-invoker, has an empty `search_path`, and is executable only by `service_role`.
A live authenticated QA deletion returned HTTP 200. The deleted promise and all checked dependent
rows (`invitations`, participants, versions, reminders, approvals, notifications, linked reports)
were 0 afterward while the account's other four PENDING promises remained. A request without a JWT
returned HTTP 401. The one expired QA PENDING record used for this destructive smoke test is not
restored.

Verification: Vitest **110 files / 2,136 tests PASS**; jest-expo **79 suites / 811 tests PASS**;
five-project `npm run typecheck`, `npm run check:agents`, and `git diff --check` PASS. Android
emulator visual QA passed for the Korean and English waiting-row delete action and confirmation
dialog; the destructive action was canceled during visual QA and exercised only once afterward
through the live authenticated endpoint.

## Play store listing drafted (2026-08-31)

`docs/setup/play-store-listing.md` grew from a flags-and-permissions checklist into the full
store-presence document, written against the new `docs/google_play_store_listing_guide.md`:
app name, short description, full description (all four in ko-KR **and** en-US), keyword plan,
graphic-asset specs, an eight-shot screenshot storyboard, category and tags, and the developer
contact block. PO decisions on the day: primary category **라이프스타일**, listing localized in
**ko-KR + en-US**. App name ships as `리틀핑거 - 둘이 지키는 약속 기록` / `Littlefinger: Promises
Kept`, with two A/B alternates recorded — the brand name is never used alone because of open issue
N-1 (a same-name company and a similar Play app already exist).

Two store graphics were produced into `docs/디자인/store/`: `store-icon-512.png` (512×512, alpha
flattened to butter, every alpha pixel 255, 253 KB) from the ADR 0016 launcher artwork, and
`feature-graphic-1024x500{,-en}.png` drafts in the 잉크 & 스티커 system (cream canvas, butter
sticker card with an ink border and hard offset shadow, Pretendard). The feature graphics are
**drafts awaiting PO approval**; screenshots are storyboard-only and get captured on a real device
during ADR 0015 device QA.

Verified: all eight paste-ready blocks are inside their Play limits by NFC code-point count
(name 19/27, short 55/72, full 1,493/2,562, release notes 281/476) and contain **zero** §8-3
wording-guard words and zero banned promo words. Store publication is still blocked by the external
법무 review (`2026-08-30.2`), the screenshots, feature-graphic approval, the N-1 trademark check,
and AdMob account approval.

## Promise send production hotfix (2026-08-31)

SCR-A03 [상대에게 보내기] returned the generic error on four consecutive `promise-create`
requests at 13:44–13:45 KST. Edge invocation logs showed HTTP 500 and the matching Postgres log
identified `permission denied for table slot_purchase_revocations`. Migration `20260827000001`
had revoked direct access to the server-only revocation ledger but left `lf_slot_capacity` as a
security-invoker function; both `slot-status` and every DRAFT → PENDING path therefore failed when
the new capacity query reached that table.

Migration `20260831051301_fix_slot_capacity_revocation_access.sql` is deployed to the linked
Supabase project. It makes only `lf_slot_capacity(uuid)` a `SECURITY DEFINER` function with an empty
`search_path`; `service_role` and `authenticated` still have no direct ledger SELECT privilege and
the function remains executable only by `service_role`. Remote checks returned slot status
`{capacity: 5, used: 0}` and a rollback-wrapped `lf_promise_create` send returned `PENDING`.
Supabase Security Advisor reported no ERROR.

Regression and full verification: targeted paid-slot suite **26/26 PASS**; Vitest **109 files /
2,127 tests PASS**; jest-expo **78 suites / 806 tests PASS**; five-project `npm run typecheck`,
`npm run check:agents`, and `git diff --check` PASS.

## Rewarded benefits + personal retention (2026-08-29, ADR 0015)

Implemented locally from the PO-confirmed monetization cross-check:

- Creator free witness 1 + creator rewarded 1 + partner rewarded 1 (promise max 3), with inviter
  provenance and reusable capacity after leave; existing witness counts are grandfathered.
- KST creation +30-day duration ceiling, repeatable creator +30-day rewarded grants, nullable
  no-end proposals only after an effective creator permanent purchase, and mutual approval for all
  ACTIVE duration changes.
- Per-participant retention from finite end-date or no-end finish approval, 30 free days,
  repeatable +30-day rewards, ₩2,000 personal permanent access, irreversible individual expiry,
  deployment grace, unformed-record TTLs, D-7/D-1 warnings, and storage-first final purge that
  preserves de-identified keepRate aggregates.
- AdMob SSV intent/status/callback flow (Google P-256 verification; client earned events do not
  grant), no free fallback when an ad cannot be shown (locked — PO 2026-08-29), separate
  `rewarded_ads_enabled`, and Android-only payment/ad code.
- SCR-A02 ACTIVE/WAITING in-feed adaptive banner after the fifth visual card for tab counts >=6;
  the existing A02/A07/A08 bottom native ads remain. All exposure placements still disappear with
  `ads_enabled=false`; permanent purchasers remain eligible for ads.
- `promise_permanent_access` purchase verification binds both Google account and promise profile,
  recovers unconsumed purchases, and uses the existing voided-purchase ledger for refunds without
  undoing counterpart-approved no-end or finish agreements.

### Review and fix batch (2026-08-29, same day)

A three-lane review (DB / Edge / client+docs) of the local implementation found that it differed
from the PO's two-round Q&A in six places (witness 3 vs 2, no-end promises + FINISH, per-participant
retention anchored at the end date, hard purge with aggregates, no-fill fallback). **The PO accepted
the implemented design as the baseline and asked for defects only** — except the no-fill fallback,
which is removed (the server cannot verify no-fill; "locked when the ad cannot be shown" stands).

Fixed in the same batch (all in the unapplied migration + local code; nothing deployed):
- P0: fallback endpoint/RPC/UI/spec removed; `slot_purchases` scope check no longer contradicts the
  `on delete set null` FK (promise deletes with a permanent purchase row succeed); purge finalize
  nulls `reports.evidence_id` before the cascade; no-end ACTIVE promises no longer listed twice on
  the home tab; `min_app_version` → 0.2.0 inside the migration (`app.json` 0.2.0) with the deploy
  order (build first, then migration) in the release doc; `E_END_DATE_RANGE` copy is neutral so
  the acceptance web never shows ad/purchase guidance; the in-feed banner runs through the UMP
  consent gate.
- Server: reward grant takes the advisory lock before the intent row (no ABBA with intent-create);
  the intent TTL is judged against the signed SSV timestamp and a miss never rejects the intent;
  grace + reward stacking formula; FINISH request/approve/decline now notify (NT-15/NT-16 with
  `amendType: 'FINISH'`) and schedule the 3-day reminder; D-7/D-1 warning windows are a full day;
  privilege baseline covers every new signature and the trigger functions; one witness "used"
  predicate; deploy-time grace for every activated record; purge finalize re-checks access; an
  amend that keeps `end_date` skips the duration ceiling.
- Edge: verify_jwt lock covers the five new functions; verifier-key refetch only on an unknown
  `key_id` and throttled; `promise_id` UUID-validated; SSV tampered-query and DER→P1363 fixed
  vectors; `retention-maintenance` composes from `createDeps()` + a separate storage runtime.
- Client: partner sees no DURATION button; rewarded show timeout; policy numbers from config;
  spec↔code copy aligned (E_WITNESS_LIMIT, NT-22/23, "마무리 요청", "영구 보관"); W05 null end date;
  unconsumed permanent purchases reconcile only against their own promise; ads gate retries a
  failed SDK init.

Verification after the batch: `npm run typecheck` 5/5; Vitest **109 files / 2,102 tests**;
jest-expo **75 suites / 778 tests**; `check:agents` and `git diff --check` clean.

### Leftover closure (2026-08-30)

PO decisions on the audit: dead codes `E_REWARD_PENDING` / `E_PURGING` **deleted** (17 codes);
**J-08's 365-day evidence deletion retired** — evidence dies with the record (retention purge) or on
user removal only, `EVIDENCE_RETENTION_DAYS` removed, `purge_after` left as a nulled legacy column,
the weekly `lf-evidence-purge` job now handles `removed_at` objects only; the `benefit` module
renamed to `entitlement` (CLAUDE.md §7); expired access disappears silently as designed. Spec `02`
v1.3 and `04` v1.2 caught up with the implementation (error table, screen table incl. MOD-04/05,
ADR 0015 tables and enums, §6-5, J-08/J-11, NT-15/16 FINISH, quiet hours for NT-22/23, §9 rows,
EC-J01…EC-L03, §11-3, §13). Tests added: no-end lifecycle (approve creates no D-n reminders, J-02
never moves it), nine EC-tagged cases (traceability 57 → 66), config twins (`RETENTION_WARNING_DAYS`,
`REWARD_INTENT_TTL_MIN`), evidence tests rewritten for the retired rule, mobile FINISH flow,
`monetization-native`/`monetization-api` units, banner consent gate + SDK-init retry.
Still open (not code): legal documents (privacy v6, paid-service terms, Data Safety),
design-reference baselines for the seven new UI surfaces, operator release, device QA — see
`docs/handoff/2026-08-30-monetization-retention-fix-batch.md`.

(Superseded on 2026-08-30 by "ADR 0015 deployed to the linked project" under Remote deployment
state — kept as the record of the pre-deploy boundary.) Not deployed at the time: the migration, five new Edge Functions (`promise-entitlements`, `reward-intent-create`, `reward-status`, `reward-callback`, `retention-maintenance`) plus seven changed ones (`fulfillment-submit`, `promise-amend-request`, `promise-amend-respond`, `promise-create`, `promise-draft-update`, `promise-invite`, `purchase-verify`), Supabase/Vault secrets, AdMob units + SSV
callback, Play product, and a new native build all remain operator release work. Local verification
results (2026-08-30, after the fix batch and the leftover closure): `npm run typecheck` **5 projects PASS**; Vitest **109 files / 2,124 tests PASS**;
jest-expo **78 suites / 807 tests PASS**; web production build **131 modules PASS**;
`npm run check:agents` and `git diff --check` PASS. Google AdMob's current SSV specification was
cross-checked: the signed query boundary is preserved, P-256 keys refresh within 24 hours, and only
configured rewarded units can grant. Android real-device visual and native rewarded/IAP QA is still
pending because this session has no connected `adb` device; execute the checklist in
`docs/setup/monetization-retention-release.md` with a Play-signed build.

## Visual-system baseline: 잉크 & 스티커 (2026-08-27, ADR 0012)

The PO confirmed the **잉크 & 스티커** (Ink & Sticker, Setlog 시안 1a) restyle — full token value
swap (115 names/count frozen, 72 values moved: ink `#221C13` on cream `#F3ECDC`, butter/lavender/
apricot stickers, black filled CTA, Pretendard 400/600/700/800 (ADR 0014), offset sticker shadows)
plus the six confirmed
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
- **Unified Pretendard typography (PO-confirmed 2026-08-27, ADR 0014):** Korean and English now
  use Pretendard for every display, body, metadata, fingerprint, timer, and decorative text role.
  RN loads local static 400/600/700/800 files; reference/web self-host Pretendard Variable. Gaegu
  and Roboto Mono packages/imports were removed, while Material Symbols remains icon-only. Gates:
  typecheck 5 projects · Vitest **106 files / 2,023 tests** · Jest **72 suites / 743 tests** · web
  production build **130 modules** — PASS. Browser visual verification is still pending because
  the Browser tool blocked reloading the existing localhost tab under its URL policy.
- **Play internal-test package (2026-08-27)**: EAS production build
  `7bb7d3cd-1c16-4e79-8fbf-0fcb5609e065` finished from commit `ec62dbd` as
  `com.littlefinger.app` `0.1.0` (`versionCode 9`). The downloaded 81,440,969-byte
  `dist/littlefinger-internal-v0.1.0-code9.aab` passed bundletool 1.18.1 validation and JAR
  signature verification; min/target SDK are 24/36 and arm64-v8a, armeabi-v7a, x86, and x86_64
  are present. Extracted xxxhdpi launcher/splash/notification resources were visually checked
  against Type A. The upload-certificate SHA-256 still matches the versionCode 6/8 AABs already
  used for the Play internal track, and the artifact SHA-256 is
  `3FD91C6E482296897257FB6726670DABF5584E05689C5D13436D00D08E46AC4D`.
- **Review corrections deployed (2026-08-28):** refunded/charged-back Play purchases now lose their
  slot through the daily Voided Purchases reconciliation ledger; account withdrawal creates an
  Auth-deletion outbox in the same transaction and retries leased work every 15 minutes until
  deletion succeeds. Play Data Safety now marks the opt-in push token correctly as optional, and
  the Setlog reference bundle moved from the transient `docs/handoff/` directory to `docs/디자인/`.
  Gates: typecheck 5 projects · Vitest **107 files / 2,038 tests** · Jest **72 suites / 752 tests**
  · `check:agents` · `git diff --check` — PASS.
  - `PURCHASE_RECONCILE_SECRET` and `ACCOUNT_DELETE_RETRY_SECRET` set as Edge secrets, with the
    matching `purchase_reconcile_url/secret` and `account_delete_retry_url/secret` in Vault.
  - `20260827000001_reconciliation_workers.sql` applied. The WITHDRAWN backfill matched **0 rows**,
    so no existing identity was touched. `slot_purchase_revocations` and `auth_deletion_outbox`
    carry RLS, the `users_enqueue_auth_deletion` trigger is active, and `lf_slot_capacity(uuid)` was
    replaced in place — every existing caller now excludes revoked purchases.
  - Deployed with `--use-api`: `purchase-reconcile` v1, `account-delete-retry` v1,
    `account-withdraw` v7. `purchase-verify` stays at v4 — its refactor is behaviour-identical, so
    the deployed bundle predates it.
  - Verified live: both workers answer a wrong shared secret with 401 `E_AUTH_REQUIRED`;
    `account-delete-retry` returns 200 `{"claimed_count":0,...}`, and the `*/15` cron job fired at
    22:15 KST with `net._http_response.status_code = 200`, proving the Vault → pg_net → worker
    chain end to end.
  - `purchase-reconcile` first answered a correct-secret invocation with 500 `E_INTERNAL`. The
    cause was our own reconciliation window: a `startTime` of exactly `now - 30 days` is already
    outside the range Google accepts by the time the request is evaluated. Narrowing it to **29
    days** returned 200 `{"checked_count":0,"revoked_count":0}` on the same deployment, which also
    proves the Play Console financial-data permission is granted. The window is pinned by a test
    and recorded in ADR 0009; the diagnosis path is in `docs/notes/environment-gotchas.md`.
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
- Still pending (device QA): font-scale **1.5 reflow with Pretendard** (D-Day badge/chip clipping
  first), Android dashed-border rendering, elevation approximation of the
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
  personal data, and fences all later Edge RPC calls. Auth deletion failure cannot restore access;
  the transactionally-created deletion outbox retries until the Auth identity is actually gone.
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

### ADR 0015 deployed to the linked project (2026-08-30)

Order followed: build 0.2.0 / versionCode 10 uploaded to the Play **internal testing** track by the
PO → Edge secrets `RETENTION_WORKER_SECRET` + `ADMOB_REWARDED_{WITNESS,DURATION,RETENTION}_UNIT_ID`
(Google test unit ids for now) → Vault `retention_maintenance_url` / `retention_worker_secret` →
`npx supabase db push` applied **`20260829103504_rewarded_ads_retention_bm`** and
**`20260830000001_legal_v6_paid_products_retention`** → `npx supabase functions deploy --use-api`
redeployed all **56** functions (5 new: `promise-entitlements`, `reward-intent-create`,
`reward-status`, `reward-callback`, `retention-maintenance`), all ACTIVE.

Verified live: cron `lf-retention-maintenance` (`17 * * * *`) exists once and is active;
`app_configs` = `ads_enabled=false`, `rewarded_ads_enabled=true`, `min_app_version="0.2.0"`;
`lf_current_terms_version() = lf_current_privacy_version() = 2026-08-30.1`; no live `purge_after`,
retention trigger and function gone; RLS on the 7 new tables; 16 `promise_access_graces` rows
backfilled; `supabase/tests/remote/adr0015-smoke.sql` passed via the Management API SQL endpoint;
`reward-callback` answers 401 without / with a bogus signature (`{"granted":false}`);
`retention-maintenance` answers 401 to a wrong secret and 200
`{"maintenance":{"queued":0,"warned":0},"claimed_count":0,"purged_count":0,"failed_count":0}` to the
real one (first worker run); `promise-entitlements` answers 401 without a JWT.

Not done from this machine: a fresh DB backup (no `pg_dump`/Docker here; the weekly
`supabase-backup.yml` artifact is the fallback) — recorded as a known gap. The real AdMob units,
SSV setup and code 11 rebuild are now complete below; rewarded device QA still waits on registering
the QA phone as an AdMob test device.

### Build 0.2.0 / versionCode 21 (2026-09-03, open testing candidate)

EAS production build `4ab9e13d-7c8e-48ab-9b67-c7d2f2ae4889` from `main` commit
`711e181f01212fb74697a54d7deff5d7039b634e` (pushed before the build; remote versionCode 20 → 21;
all nine `EXPO_PUBLIC_*` production variables loaded). Downloaded to
`dist/littlefinger-open-v0.2.0-code21.aab` — **83,253,576** bytes, SHA-256
`60ACD27C53FE8528A372AFC379A72CAC220C477E556E3AC6F66987D90EEFE38D`.

Validation (`docs/setup/open-testing-release.md` §3): `bundletool 1.18.1 validate` exit 0;
manifest `com.littlefinger.app`, versionCode 21, versionName 0.2.0, minSdk 24, targetSdk 36;
arm64-v8a, armeabi-v7a, x86, x86_64; App Links host `littlefinger-app.web.app`; AdMob
`APPLICATION_ID = ca-app-pub-9625042173735017~2273644771`; `jarsigner` → `jar verified.`; upload
certificate SHA-256 `C1:E0:70:DE:41:70:DE:B9:0A:D4:32:C2:D5:21:99:1F:F7:8B:54:6F:CD:06:BB:90:0F:B8:46:A8:D3:97:37:BB`,
identical to code 19 (and the first `assetlinks.json` fingerprint).

Permission set (listing §7 record). **Absent, as intended:** `CAMERA`, `RECORD_AUDIO`,
`SYSTEM_ALERT_WINDOW`, and every §7 "must be absent" entry. **Present:** `INTERNET`,
`ACCESS_NETWORK_STATE`, `POST_NOTIFICATIONS`, `VIBRATE`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`,
`FOREGROUND_SERVICE`, `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` (maxSdk 32),
`USE_BIOMETRIC` / `USE_FINGERPRINT` (expo-secure-store), `READ_APP_BADGE` plus the launcher badge
vendor permissions (expo-notifications), `ACCESS_ADSERVICES_{AD_ID,ATTRIBUTION,TOPICS}` and
`com.google.android.gms.permission.AD_ID` (Mobile Ads), `com.android.vending.BILLING` (expo-iap),
`com.google.android.c2dm.permission.RECEIVE` (FCM), `BIND_GET_INSTALL_REFERRER_SERVICE`, and the
app's own `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. Not yet uploaded to Play — the PO attaches
it to the open-testing draft per `open-testing-po-guide.md` §9.

### Butter/ink icon replacement (2026-08-31, local code 15 AAB verified)

ADR 0018 replaces the white outlined launcher and in-product artwork with the PO-selected solid
Type A mark: butter/ink launcher, ink on light in-product surfaces, and butter on ink Create
actions. Launcher, adaptive foreground/background/monochrome, splash, native brand derivative,
and the 512px Play listing icon were regenerated. The corrected shared silhouette is unchanged.

Verification: `npm test` reports **110 Vitest files / 2,136 tests passed** and **79 Jest suites /
814 tests passed**. `npm run typecheck` and `git diff --check` exit 0; `npm run check:agents`
confirms synchronization. The exporter validates both adaptive alpha layers against the 66dp
safe circle. Exported launcher/default/inverse images were inspected locally. Browser screen QA
was not completed (preview server offline; local-file browser navigation blocked), and no new
physical-device install has been tested.

The PO explicitly approved uploading the current source/assets to Expo EAS
`philwoo/littlefinger` and building the AAB on 2026-08-31. The `production` invocation used frozen
remote credentials, incremented the remote version counter from 14 to 15, uploaded the 54.7 MB
source archive, and completed fingerprinting. EAS then rejected it because the account had used
its monthly Free-plan Android builds; the CLI reported a reset in 11 hours on 2026-09-01.
No cloud build job or AAB was created. A read-only EAS build list confirms code 13 is still the
latest completed cloud package, and it does **not** contain ADR 0018. No paid plan or Play
submission was made.

The PO subsequently approved downloading the existing EAS upload key for a local release. The
key and its credential JSON are now stored only in the gitignored `dist/local15` snapshot; its
SHA-256 certificate matches code 13. The original ignored native project (old code 1 / debug
signing) is untouched. A fresh 251-file mobile source/asset snapshot was prebuilt with the pulled
EAS production environment, `EAS_BUILD_PROFILE=production`, and versionCode 15, then configured
to sign with that existing upload key. Gradle `app:bundleRelease` completed with JBR 21 and all
four ABIs: **`BUILD SUCCESSFUL in 21m 56s`** (1,021 actionable tasks). No replacement key was
generated and the remote version counter was not reset.
The typecheck, agent-document synchronization, and diff-whitespace checks were rerun successfully
after approval.

The new internal-test artifact is `dist/littlefinger-internal-v0.2.0-code15.aab`
(83,247,950 B; SHA-256
`26E44C98B7793140C0DC8F4EDBD14C9AA0B1CF0D809454CDFA864E0B22AD59F3`).
`bundletool 1.18.1 validate` passes; the manifest confirms `com.littlefinger.app`, versionName
0.2.0, versionCode 15, minSdk 24, targetSdk 36, and a non-debuggable release. `jarsigner -verify`
reports **`jar verified.`**; the upload-certificate SHA-256 matches code 13. Native libraries
cover arm64-v8a, armeabi-v7a, x86, and x86_64. The real AdMob app ID and native/banner/rewarded
units are present, and the Hermes bundle contains the latest `promise-pending-delete` endpoint.
The packaged in-app mark is pixel-identical to the approved export; the extracted launcher,
adaptive foreground, and in-app mark were visually inspected. Validation evidence is in
gitignored `dist/code15-inspection/`. This AAB has not been submitted to Play or installed on a
physical device. The Play listing icon remains a separate upload at
`docs/디자인/store/store-icon-512.png`.

### Build 0.2.0 / versionCode 13 (2026-08-31, pushed-source candidate)

EAS production build `46c3b4ed-9191-4d2e-beca-7eaa41b1090d` was created from clean `main` commit
`75c2277bac98cc45320ca428c1f3d4f5068ab2ea` after that exact SHA was pushed to `origin/main`.
It supersedes code 12 and is downloaded to `dist/littlefinger-internal-v0.2.0-code13.aab`
(83,496,540 B; SHA-256
`A8CCA668CC7BC6B248E7569E553FD01789CFE2EFCCE486E5A5DF7832C63EC76A`).

`bundletool 1.18.1 validate` exited 0; manifest: package `com.littlefinger.app`, versionCode 13,
versionName 0.2.0, minSdk 24, targetSdk 36, with arm64-v8a, armeabi-v7a, x86 and x86_64. `jarsigner
-verify` reports `jar verified.` and the upload-certificate SHA-256 matches code 11/12. Direct
inspection of the 4,694,748-byte Hermes bundle found the `promise-pending-delete` endpoint. This
AAB has not been submitted to Play.

### Build 0.2.0 / versionCode 12 (2026-08-31, pending-delete candidate)

EAS production build `3f1730fd-960a-4c03-853e-14713dba13d5` completed successfully and was
downloaded to `dist/littlefinger-internal-v0.2.0-code12.aab` (83,496,558 B; SHA-256
`3D412914C4C6937832804771095A12A24163D443DE8330DEFD2502D8A54CD5E9`). It contains the promise-send
hotfix client state and the DRAFT/PENDING waiting-row deletion flow. Direct inspection of the
4,694,748-byte Hermes bundle found the `promise-pending-delete` endpoint.

`bundletool 1.18.1 validate` exited 0; manifest: package `com.littlefinger.app`, versionCode 12,
versionName 0.2.0, minSdk 24, targetSdk 36, with arm64-v8a, armeabi-v7a, x86 and x86_64. `jarsigner
-verify` reports `jar verified.`; its upload-certificate SHA-256
`C1:E0:70:DE:41:70:DE:B9:0A:D4:32:C2:D5:21:99:1F:F7:8B:54:6F:CD:06:BB:90:0F:B8:46:A8:D3:97:37:BB`
matches code 11. The AAB is downloaded and validated but has not been submitted to Play.

### Build 0.2.0 / versionCode 11 (2026-08-30, real-AdMob candidate)

EAS production build `a4cb96ce-6c70-4943-8b5c-1b059325c297` completed successfully and was
downloaded to `dist/littlefinger-internal-v0.2.0-code11.aab` (83,261,325 B; SHA-256
`D0A596305A5AC7279ECF0B60ECAD0B1BE4ED1444820AC61BB21C746EC74A6895`). `bundletool 1.18.1
validate` exited 0; manifest: package `com.littlefinger.app`, versionCode 11, versionName 0.2.0,
minSdk 24, targetSdk 36, four ABIs, production AdMob application id, Play Billing and AD_ID
permission present. Extracted `assets/app.config` contains the production native, banner and three
rewarded unit ids; `jarsigner -verify` reports `jar verified.`

All three rewarded units have the verified SSV callback saved in AdMob, and the production EAS
variables and Supabase Edge secrets use the matching real ids. The AdMob account is still awaiting
approval, the app is not linked to its Play listing, and the connected SM-N981N is not yet a test
device. This AAB has not been uploaded to Play; those are the remaining operator/device-QA steps.

### Build 0.2.0 / versionCode 10 (2026-08-30, internal-test candidate)

EAS production build `8f83b014-79b9-4357-bb33-413737f65206` from commit `9816a6f` → downloaded to
`dist/littlefinger-internal-v0.2.0-code10.aab` (83,261,324 B). `bundletool 1.18.1 validate` OK;
manifest: versionCode 10, versionName 0.2.0, minSdk 24, targetSdk 36, four ABIs, AdMob
`APPLICATION_ID = ca-app-pub-9625042173735017~2273644771`, `com.android.vending.BILLING` and
`com.google.android.gms.permission.AD_ID` present; `jarsigner -verify` → "jar verified." (Play App
Signing upload key, expires 2053-12-15). **The four new EAS production variables
(`EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID`, `…_REWARDED_{WITNESS,DURATION,RETENTION}_UNIT_ID`) hold Google
test unit ids** (PO decision 2026-08-30: build now, real units later) — banner/native render test
ads, purchases and every screen are testable, but **rewarded grants cannot be verified with this
build** (test units send no SSV callback). A rebuild (versionCode 11) follows once the real unit
ids replace them. Not yet uploaded to the internal track; migration and functions not deployed.


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

## Legal documents v6 — paid products, rewarded ads, record retention (2026-08-30)

Terms **`2026-08-30.1`** and Privacy **`2026-08-30.1`** (migration `20260830000001`, shared
`LEGAL_DOCUMENTS`, `apps/web/src/legal/legal-content.ts`). Terms: 제13조 유료 상품과 결제 (two
products, Google Play pricing/receipts, entitlement on server verification, 청약철회 restriction for
digital content with the 7-day unused exception, refund via Play or task@deephigh.ai within 3
business days, revocation semantics, minors, dispute mediation), 제14조 기록의 열람 기간과 삭제
(30-day access right per participant, +30 d per rewarded ad, permanent purchase, non-restorable
expiry, purge after the last participant, unformed-record TTLs), 제12조 rewarded-ad clauses (③–⑤:
opt-in only, server-confirmed, locked when unavailable, purchases do not remove ads), 제9조 ④⑤
(duration ceiling, no-end promises), 제7조/제20조 free-of-charge wording narrowed to free features,
company block + 통신판매업 신고번호 **2026-대구북구-0751** and email. Old 제13조–제20조 renumbered to
제15조–제22조. Privacy: purchase and rewarded-ad data in §1, purposes in §2, retention by access
right + 5-year purchase records + 15-minute intent TTL in §3 (365-day evidence line removed),
two-phase purge in §4, Google Play / AdMob SSV delegation and transfer in §6, display vs rewarded
ads and the pseudonymous SSV id in §7, server verification in §9. English twins are paragraph-
for-paragraph parallel (`legal-document.test.tsx` parity guard; drift guard now pins
`RETENTION_*`, `END_DATE_*`, `REWARD_INTENT_TTL_MIN`, the 신고번호). Effective immediately (no real
users pre-launch; the 30-day unfavourable-change notice has no addressee yet). **External 법무
review is running in parallel and is required before store publication** — feedback lands as
`2026-08-30.2`. `docs/setup/play-data-safety.md` re-grounded the same day (User IDs shared
pseudonymously with Google for SSV, Purchase history collected, deletion by access expiry).

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

### ADR 0015 device QA partial run (2026-08-30)

Superseded by the 2026-09-02 passes at the top of this file (3 PASS · 6 PARTIAL · 1 FAIL ·
10 NOT_RUN on codes 18–20). As recorded then —
Status: **FAIL** (0 PASS · 1 FAIL · 19 NOT_RUN). The Play Console showed internal track version
`10 (0.2.0)` ACTIVE and offered to testers; a read-only CLI recheck returned 56/56 Edge Functions
ACTIVE. Row 20's public web half failed: `/legal/terms` still serves `2026-08-22.3` and
`/legal/privacy` still serves `2026-08-25.1` in both locales instead of `2026-08-30.1`
(`ADR15-QA-F01`). The privacy version line also clips on the left at 360×800 in both locales
(`ADR15-QA-F02`). Evidence is under
`C:\Users\batis\AppData\Local\Temp\littlefinger-qa\adr0015-20260830\`.

The remaining rows were not run: ADB had zero connected devices, and versionCode 10 embeds Google
test rewarded unit ids that cannot complete the backend SSV grant. Continue with the planned
real-unit versionCode 11 production build, attach the required test phones, deploy the current web
bundle, retest row 20, then execute rows 1–19. Detailed matrix:
[`docs/qa/ADR0015_DEVICE_QA.md`](qa/ADR0015_DEVICE_QA.md).

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
