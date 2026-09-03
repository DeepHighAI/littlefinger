# ADR 0015 device QA — internal testing 0.2.0

Snapshot: 2026-09-02 KST. Status: **FAIL** (3 PASS · 6 PARTIAL · 1 FAIL · 10 NOT_RUN).

Companion to `docs/setup/monetization-retention-release.md` §4. Same format as
`docs/qa/MANUAL_E2E.md`: fill the Status and Capture columns in place, then copy the result block
into `docs/DEVELOPMENT_STATUS.md`. Every row runs on the **production-profile** build installed
from the internal testing track — preview builds use Google test ad units, which the SSV callback
rejects, so rows 2–8 cannot pass on them.

### Code 18 physical-device run — 2026-09-02

- Candidate: `0.2.0 (18)`, EAS build `5e543b9d-0680-4617-ba6e-abddbd0c0368`, Git
  `ab84bda`, AAB SHA-256
  `FF25362322E032F17C326C1EB02A8228C195050069350BFE999ABC3E2A8F9B7D`.
- The Play internal track installed code 18 through `com.android.vending` on a Samsung SM-N981N
  (Android 13). The delivered Play signature is
  `B3:BD:C8:EB:67:FF:B7:25:43:04:3B:E6:AB:4E:48:A9:E1:69:42:65:F0:BB:A4:98:9E:35:CB:1C:AA:D0:A7:14`.
- Home loading, cold start, notification list/detail navigation, legal links, hidden no-end CTA,
  and reward/penalty keyboard avoidance passed. `logcat` contained no fatal or React error after
  the cold start.
- A license-test purchase of `promise_slot_plus1` completed without a charge and increased the
  server-backed capacity from 5 to 6. The device-wide Play purchase-authentication preference was
  left at the safer `항상 요구` setting.
- Store-installed App Links initially failed because the deployed statement omitted the delivered
  Play signature. The statement was fixed and deployed; Google DAL and `pm get-app-links` now say
  `verified`, and Samsung Internet's app-open action launched the app into the invalid-invite
  screen. Fix: `c0a17fb`.
- `promise_permanent_access` was absent from the Play product catalog. The sheet rendered an empty
  price and purchase failed before showing Play Billing. Empty/whitespace store prices now fall
  back safely (`c0a17fb`); the product itself remains a release blocker because Play Console's
  product detail/save calls do not complete even for the confirmed account owner.
- Exposure/rewarded-ad execution is blocked before SDK initialization: UMP reports publisher
  misconfiguration because the AdMob app has no applicable message/form. `ads_enabled` was restored
  to `false`; `rewarded_ads_enabled` remains `true`.
- Code 19 was built from fix commit `c0a17fb`: EAS build
  `afa4ebab-a08a-4528-98ba-3ca73a30af25`, AAB SHA-256
  `548BC45448FC185D8B3C8EBF8BC5119C8F223B4B84A676FAC97B813981D60FCD`, size `83,253,612` bytes.
  Bundletool and JAR-signature checks pass. Play internal release 13 (`19 (0.2.0)`) is published,
  and the Play Store updated the connected device through `com.android.vending`. Cold start and
  retained-session home loading pass; the permanent-access sheet now renders the complete
  `₩2,000에 영구 보관` fallback, and App Links remain `verified` after the update.
- Capture root:
  `C:\Users\batis\AppData\Local\Temp\littlefinger-qa\open-testing-final-20260902\`
  (`s49`–`s77`). The PO confirmed all 31 users and 29 promises are disposable test data; rows
  16–18 still need their dedicated setup and worker secrets and were not improvised.

### Code 19 second pass — 2026-09-02, store-installed build

- Same connected SM-N981N (Android 13), `0.2.0 (19)` installed through `com.android.vending`,
  `installerPackageName=com.android.vending`, `lastUpdateTime=2026-09-02 15:52:55`. Signed-in
  account is the **partner test account (B)** on the ACTIVE promise used for rows 3–8 — the app
  reports `witness.partner_capacity = 0`, which is what renders the locked copy.
- Flags read live before the pass: `ads_enabled=false`, `rewarded_ads_enabled=true` — the values
  the first pass said it restored.
- At the start of the second pass, the two external blockers were re-confirmed rather than assumed.
  Logcat during a real rewarded
  attempt: `Publisher misconfiguration: Failed to read publisher's account configuration; no
  form(s) configured for the input app ID. Received app ID: ca-app-pub-9625042173735017~2273644771.`
  The same log line yields the **AdMob test-device hashed id `278D76522FF9E640A4DB636E0016313E`**,
  which closes prerequisite 7 as soon as a UMP message/form exists.
- After the PO completed both console settings, the UMP publisher-misconfiguration error stopped.
  A cold start now writes `IABTCF_gdprApplies=0`, initializes Mobile Ads, and makes an ad request.
  The request still ends with `Ad failed to load : 3` (no fill), so the rewarded rows remain
  incomplete. The permanent-access CTA still does not open Play Billing and the ledger still has
  zero `promise_permanent_access` purchases. Final live flags: `ads_enabled=false`,
  `rewarded_ads_enabled=true`.
- Repo gates at `80d067a`: `vitest run` 110 files / 2142 tests passed; `jest-expo` 79 suites /
  820 tests passed; the five-project `typecheck` and `check:agents` both exited 0.
- Two new defects found, both outside the ADR 0015 surface but on the release build:
  `ADR15-QA-F07` (MOD-02 KakaoTalk label) and `ADR15-QA-F08` (Korean weekday in English locale).
  Both are fixed in `fdc2b8b` and visually verified in the code 20 development build after creating
  a new promise and approving it from the second account: the hero and row render `(Thu)`, and
  MOD-02 renders `Share invite link` without clipping.
- Incidental checks that passed on the way through: `LEGAL_DISCLAIMER` renders verbatim in Korean
  on A05/ACTIVE and A08, and the English pair renders verbatim on A08 after the locale switch
  (typographic apostrophe included) — §8-2 holds in both locales on device. keepRate shows
  `집계 중` / `약속 3개부터 지킴율을 알려드려요` below the 3-promise sample. D-Day math is right:
  end date 2026-09-22 renders `D-20` on 2026-09-02 KST, and an overdue PENDING row renders `D+4`.
  With `ads_enabled=false` the home hierarchy contains **zero** ad view classes — no placeholder,
  no reserved gap. The locale switch and switch-back both took effect without a restart.

### Code 20 Play follow-up — 2026-09-02, store-installed build

- `0.2.0 (20)` is installed from Play (`installerPackageName=com.android.vending`,
  `lastUpdateTime=2026-09-02 20:14:06`) on the same SM-N981N. Code 20 was built from Git
  `fdc2b8b` (EAS build `ee80e524-c82a-49f7-9632-90a39c7729a1`); the commits after it are docs-only,
  so code 20 is the last build of the pre-open-testing source. Its manifest carries the same
  `CAMERA` / `RECORD_AUDIO` / `SYSTEM_ALERT_WINDOW` permissions found in the code 19 dump — removed
  in code 21 (`docs/setup/open-testing-release.md` §1).
- The two code fixes are confirmed in the release artifact, not only the development build. English
  home dates render `(Thu)` and `(Tue)` in the hero and list; MOD-02 renders
  `초대 링크 공유하기` / `Share invite link` with no clipping.
- The permanent product is now available. Play Billing shows `약속 영구 보관`, ₩2,000,
  `테스트 카드, 항상 승인`, and `테스트 주문이므로 청구되지 않습니다.` Completing the order
  changes the sheet to `영구 보관 중`, which survives force-stop and cold start.
- Server verification: exactly one `promise_permanent_access` ledger row; `granted_slots=0`; the
  same order and purchase token each occur once; no revocation; the partner buyer's effective
  access is true and the creator's is false. This closes the catalog/product blocker while leaving
  the creator-side UI half of row 10 to a second signed-in app account.
- UMP still completes and reaches Mobile Ads, but the rewarded request remains unavailable and the
  app shows the locked copy. No reward was granted. Final flags are `ads_enabled=false` and
  `rewarded_ads_enabled=true`.

**Measurement note — uiautomator under-reports the bottom of the screen.** The app window is
`[0,0][1080,2266]` while the display is 1080×2400, so `uiautomator dump` clips the bounds of
anything near the bottom and a 48 dp control reads as 39 dp. Three separate controls looked like
48 dp violations and were none. Measure with the raw framebuffer instead — `adb exec-out screencap`
returns a 16-byte header followed by RGBA8888 — and confirm with a hit test. The 상대방 차단 pill
measures y=2155…2290 = 135 px = **48 dp exactly**, and a tap at y=2280 (below the reported clip
line) opened its confirm dialog.

## Prerequisites

| # | Item | Value |
|---:|---|---|
| 1 | Build | `0.2.0 (20)`, build `ee80e524-c82a-49f7-9632-90a39c7729a1`, installed through Play |
| 2 | Backend | Migrations `20260829103504` + `20260830000001` applied; all 57 functions `ACTIVE`; `adr0015-smoke.sql` passed |
| 3 | Account A — creator | license tester `____________` (Google sign-in in app; the same Google account is signed into Play Store on the phone) |
| 4 | Account B — partner | license tester `____________` (second phone, or the acceptance web `https://littlefinger-app.web.app` on desktop) |
| 5 | Account C — witness | `____________` (any account; web) |
| 6 | 0.1.x device | one phone still on `0.1.0 (9)` for row 1 — do **not** update it until row 1 is captured |
| 7 | AdMob test devices | **DONE (PO confirmed)** — `278D76522FF9E640A4DB636E0016313E` registered; immediate device retest reached the SDK and returned no fill |
| 8 | `rewarded_ads_enabled` | `true` (migration default) — rows 7a and 13 change it and restore it |
| 9 | `ads_enabled` | `false` — row 13 sets `true` for that row only and restores `false` |
| 10 | Worker secrets in hand | `PURCHASE_RECONCILE_SECRET` (row 12) and `RETENTION_WORKER_SECRET` (row 18), read from `npx supabase secrets` owner's notes — never from the repo |
| 11 | Capture root | `C:\Users\batis\AppData\Local\Temp\littlefinger-qa\open-testing-final-20260902\` |
| 12 | Staging promises | Every promise created during this run is test data. Rows 16–18 use the fast-forward SQL below and are **never** run against a database with real users |

### Run record — 2026-08-30

- Play Console showed internal track `ACTIVE`, version `10 (0.2.0)`, offered to internal testers.
  Build id: `8f83b014-79b9-4357-bb33-413737f65206`.
- Read-only backend recheck: `npx supabase functions list` returned 56/56 functions `ACTIVE`.
- Capture root: `C:\Users\batis\AppData\Local\Temp\littlefinger-qa\adr0015-20260830\`.
- Device blocker `ADR15-QA-B01`: ADB reported zero connected devices, so app, Play Billing,
  TalkBack, network-condition, and push scenarios were not run.
- Rewarded blocker `ADR15-QA-B02`: internal build code 10 embeds Google test rewarded unit ids.
  They do not send the SSV callback accepted by this backend, so rows 2–8 cannot pass until the
  real units are configured and the planned versionCode 11 production build is installed.
- Only the independently reachable web half of row 20 was executed. No account identifiers,
  purchase tokens, callback URLs, or worker secrets were recorded.

Reading server state: Dashboard → SQL editor as `postgres` (bypasses RLS). Handy queries:

```sql
-- reward ledger for one user
select id, action, status, transaction_id is not null as has_txn, rewarded_at, granted_at
  from public.reward_intents where user_id = '<A>' order by created_at desc limit 10;
select action, source, intent_id, created_at
  from public.promise_reward_grants where promise_id = '<P>' order by created_at;
-- per-participant access
select public.lf_access_expires_at('<P>', '<A>'), public.lf_permanent_access_effective('<P>', '<A>');
-- notifications for one user
select event_code, dedupe_key, created_at from public.notifications
 where user_id = '<A>' and event_code in ('NT-15', 'NT-22', 'NT-23') order by created_at;
```

## Scenario matrix

| # | Account | Scenario | Expected | Status | Capture |
|---:|---|---|---|---|---|
| 1 | A (0.1.x phone) | Open `0.1.0 (9)` after the migration | Home is replaced by the forced-update screen (`업데이트 후 이용해 주세요.`) with a Play Store link; nothing else is reachable. Then update to 0.2.0 → home loads normally | NOT_RUN | `s01-*.png` |
| 2 | A | Rewarded **WITNESS_CREATOR** once: A creates a finite promise, sends, B approves (ACTIVE). MOD-02 → invite C into the free spot → the second spot shows the ad button → watch the test rewarded ad to the end | Sheet shows `광고 확인 결과를 반영하고 있어요…`, then the spot opens (polling, no restart needed). SQL: one `reward_intents` row `WITNESS_CREATOR` / `GRANTED` with `transaction_id`, one `promise_reward_grants` row `source = ADMOB_SSV`. No further ad button for this action on this promise (creator max = 1 free + 1 reward) | NOT_RUN | `s02-*.png`, `s02-ledger.txt` |
| 3 | B | Rewarded **WITNESS_PARTNER** once on the same promise | B's MOD-02 first shows `내 증인 자리는 아직 잠겨 있어요. 광고를 보면 한 자리가 열려요.`; after the ad one spot opens; a second ad is not offered. Ledger: one `WITNESS_PARTNER` GRANTED row for B | **PARTIAL** — locked half PASS: MOD-02 shows `증인 0 / 1`, `내 증인 자리는 아직 잠겨 있어요. 광고를 보면 한 자리가 열려요.`, and the invite button stays `enabled=false`. Grant half blocked by `ADR15-QA-F03` | `s81-qa2-witness-sheet.png`<br>`window-qa2-witness-sheet.xml` |
| 4 | A | Rewarded **DURATION_30D** (repeatable): new DRAFT, pick an end date past the shown ceiling (`현재 설정 가능한 마지막 날 · …`) → send | Send is refused with the sheet's range copy (`광고 1편 = 30일 연장 · 영구 보관 구매 = 종료일 무제한`); `광고 보고 30일 늘리기` → ceiling moves +30 days → send succeeds. A second ad moves it another +30. Ledger: one GRANTED row per ad | **PARTIAL** — refusal half PASS: the picker allows a date past the ceiling, send is refused with `고른 종료일이 지금 설정할 수 있는 범위를 넘었어요. 광고 1편 = 30일 연장 · 영구 보관 구매 = 종료일 무제한`, and the sheet shows `현재 설정 가능한 마지막 날 · 2026-10-02 (금)` = today + `END_DATE_FREE_DAYS` 30. Extension half blocked by `ADR15-QA-F03` | `s84-qa2-datepicker.png`<br>`s85-qa2-enddate-range-refusal.png` |
| 5 | A | Rewarded **RETENTION_30D** once: on a promise in CHECKING/COMPLETED, SCR-A05 `내 기록 보관` → `광고 보고 내 보관 30일 늘리기` | `현재 내 보관 만료` moves exactly +30 days; `lf_access_expires_at(P, A)` agrees; one GRANTED row. B's expiry on the same promise is unchanged (personal) | **PARTIAL** — sheet half PASS: A05 `내 기록 보관` shows `보관 만료 · 2026-10-23 00:00 (KST)` and the sheet repeats `현재 내 보관 만료 · 2026-10-23 00:00` with the `광고 보고 내 보관 30일 늘리기` CTA. Extension half blocked by `ADR15-QA-F03`; the expiry did not move | `s78-qa2-start.png`<br>`s79-qa2-retention-sheet.png` |
| 6 | — | Duplicate `transaction_id`: Dashboard → Edge Functions → `reward-callback` → Logs → copy the full callback URL (Google's query string incl. `signature`) of row 2's grant → `curl -i "<url>"` twice | Neither replay inserts a second `promise_reward_grants` row for that intent; the intent stays `GRANTED` once; no 5xx in logs | NOT_RUN | `s06-replay.txt` |
| 7 | A | Ad unavailable → benefit stays locked, no free path. (a) `update public.app_configs set value='false'::jsonb where key='rewarded_ads_enabled';` then reopen the entitlement sheet; (b) airplane mode before tapping the ad button (no fill); (c) on a test device with UMP debug geography = EEA, decline consent; (d) throttle to ~50 kbps so the load times out | Each case shows `지금은 광고를 볼 수 없어 잠겨 있어요.` and no benefit changes; SQL shows no new GRANTED row (a PENDING row may exist and expires after 15 min). Restore the flag to `true` after (a) | **PARTIAL** — the rule itself PASSES under real no fill on **both** rewarded actions: tapping the button shows exactly `지금은 광고를 볼 수 없어 잠겨 있어요.`, the benefit does not change (retention stays 2026-10-23, witness stays 0/1 with the invite button disabled), and no free path appears. Forced sub-cases (a) flag off, (b) airplane, (c) EEA decline, (d) throttle were not run individually; the natural no-fill path covered the principal lock invariant, while the four forced variants still need their own captures | `s80-qa2-reward-ad-unavailable.png`<br>`s82-qa2-witness-ad-unavailable.png` |
| 8 | B | Partner cannot use DURATION: B opens the entitlement sheet on A's promise | Sheet shows `종료일 범위는 작성자만 늘릴 수 있어요.` and no ad button. Optional API check: `reward-intent-create` with `action: DURATION_30D` as B → `422 E_REWARD_NOT_ELIGIBLE` | **PASS** — the partner's DURATION sheet shows `종료일 범위는 작성자만 늘릴 수 있어요.` and holds exactly three controls: the scrim, `닫기`, and the purchase CTA. **No rewarded-ad button is rendered.** The optional API check was not run | `s85-qa2-enddate-range-refusal.png`<br>`window-qa2-duration-sheet-partner.xml` |
| 9 | A | Creator permanent purchase (₩2,000, test card) on promise P1 | Sheet shows `영구 보관이 적용됐어요.`, then `이 기록은 내 계정에 영구 보관돼요` **and** `종료일 없이 제안할 수 있어요`; the editor offers `종료일 없음`; an AMEND request with no end date is accepted and B sees `종료일 없음` on the web. SQL: one `slot_purchases` row `product_id = promise_permanent_access` for (P1, A) | NOT_RUN | `s09-*.png` |
| 10 | B | Partner permanent purchase on a different promise P2 (A has not bought) | B sees `영구 보관 중` on P2; A's sheet on P2 still shows the ceiling and no `종료일 없음`; A's editor still refuses a no-end proposal (`E_END_DATE_RANGE`) | **PARTIAL** — partner half PASS on Play-installed code 20: the no-charge license-test purchase sheet opens at ₩2,000, the app changes to `영구 보관 중`, and the state survives force-stop/cold start. SQL: one ledger row, one order, one token, no revocation, buyer effective=true, creator effective=false. Creator-side sheet/editor UI still needs the second signed-in app account | `s114-code20-play-permanent-attempt.png`<br>`s115-code20-play-permanent-complete.png`<br>`window-code20-play-reopen-detail-ko.xml` |
| 11 | A | Restore on reopen: start a purchase on P3, kill the app right after Play's payment sheet reports success and before `영구 보관이 적용됐어요.` | Reopen the sheet → the unconsumed purchase is recovered and applied without paying again; exactly one `slot_purchases` row for (P3, A); Play shows one order | **PARTIAL** — the permanent product is now available, but its exact kill-between-Play-and-server scenario was not run. The same recovery machinery passed with `promise_slot_plus1`: a license-test purchase was completed, the app was `force-stop`ped while Play was still showing its post-purchase screen, and on relaunch the profile still read `사용 중 2 / 6`. Opening the slot sheet recovered the unconsumed purchase and it read `사용 중 2 / 7` — **+1 exactly, no second payment, no error in logcat**. The normally completed permanent purchase also survives force-stop/cold start with one ledger row | `s93-qa2-play-billing.png`<br>`s94-qa2-killed-mid-purchase.png`<br>`s96-qa2-slot-after-recovery.png`<br>`s97-qa2-slot-sheet-recovery.png`<br>`s115-code20-play-permanent-complete.png` |
| 12 | A | Refund → reconcile revokes: Play Console → 주문 관리 → refund row 9's order **with 권한 취소** → wait for `lf-purchase-reconcile` (03:17 UTC = 12:17 KST) or trigger it: `curl -X POST https://vepnrrmxvsytguocicfe.supabase.co/functions/v1/purchase-reconcile -H "x-purchase-reconcile-secret: $PURCHASE_RECONCILE_SECRET" -H 'Content-Type: application/json' -d '{}'` (Google's voided-purchases feed can lag; retry the next day if empty) | A loses `영구 보관 중` on P1 and the finite expiry is recalculated; the already-approved no-end amendment on P1 is **not** rewritten (`종료일 없음` stays); B's access unchanged | NOT_RUN | `s12-*.png` |
| 13 | A | A02 banner: `update public.app_configs set value='true'::jsonb where key='ads_enabled';` with ≥6 rows in the ACTIVE tab; then with exactly 5; then `false`; then `true` in airplane mode | ≥6: one banner after the 5th visual card (hero counts), none elsewhere; 5: none; `false`: none and no gap; airplane (no fill): no reserved space. Restore `false` | **FAIL** — the former UMP publisher-misconfiguration is resolved, but the live request returns `Ad failed to load : 3` (no fill), so the required rendered-ad placement cannot be verified. `ads_enabled=false` restored | logcat; flag restored to `false` |
| 14 | A/B | FINISH request → approve: on a no-end ACTIVE promise (row 9) A taps `이 약속 마무리 요청` → confirm | B receives one push (NT-15 copy `…님이 약속 변경을 요청했어요`) and one inbox row; B opens the web `/promises` → approves → status CHECKING on both surfaces; SQL: `retention_anchor_at` set, actions `FINISH_REQUEST` + `FINISH_APPROVE` in the audit list | NOT_RUN | `s14-*.png` |
| 15 | A/B | FINISH decline and withdraw: request → B declines; request again → A withdraws | Each returns the promise to ACTIVE with `FINISH_DECLINE` / `FINISH_WITHDRAW` recorded; a second open request is impossible while one is pending; no duplicate pushes | NOT_RUN | `s15-*.png` |
| 16 | A/B | NT-22 / NT-23 arrive once — fast-forward (see below) at D-7 twice, then D-1 twice | Exactly one NT-22 and one NT-23 per JOINED participant (dedupe_key `<expiry>:RETENTION_D7` / `_D1`); the second identical run inserts nothing; inbox shows each once; push arrives once (quiet hours 21:00–08:00 KST delay it, they do not duplicate) | NOT_RUN | `s16-*.png`, `s16-notif.txt` |
| 17 | A | Expired access disappears: shift the anchor of staging promise S1 so A's expiry is in the past (see below) while B holds permanent access | A: S1 absent from every home tab, from history, and the deep link answers `약속을 찾을 수 없어요` (E_NOT_FOUND); no ad or purchase path offers to restore it. B still sees S1 | NOT_RUN | `s17-*.png` |
| 18 | — | Purge idempotent: staging promise S2 where every participant's access has ended → `select public.lf_retention_maintenance(now());` queues the job → call the worker twice: `curl -X POST https://vepnrrmxvsytguocicfe.supabase.co/functions/v1/retention-maintenance -H "x-retention-worker-secret: $RETENTION_WORKER_SECRET" -H 'Content-Type: application/json' -d '{}'` | First call: `purged_count 1`, evidence objects gone from the private bucket, the `promises` row and children gone, one `purged_promise_receipts` row, `user_keep_rate_aggregates` updated and A07 keepRate **unchanged**. Second call: `purged_count 0`, HTTP 200, no error log | NOT_RUN | `s18-*.txt` |
| 19 | A | TalkBack + 48 dp on the entitlement sheet, the locked witness row (row 3 state), and the A05 retention card | TalkBack reads each control's label and its locked/disabled state; every tappable target is ≥48 dp (Developer options → Show layout bounds); locked state is conveyed by text, never by colour alone | **PASS** (measured, TalkBack speech itself not run) — every clickable node on A05 detail, the retention sheet, the witness sheet and the amend editor carries a Korean `content-desc`; no control is label-less. All targets are ≥48 dp once the window-clip artifact above is accounted for (`상대방 차단` 135 px = 48 dp, purchase CTA 152 px = 54 dp). Locked state is text plus `enabled=false` on the invite button, never colour alone | `window-qa2-a05.xml`<br>`window-qa2-retention-sheet.xml`<br>`window-qa2-witness-sheet.xml`<br>`window-qa2-amend-editor.xml` |
| 20 | A/B | Legal pages show the new version: app → 프로필 → 이용약관 / 개인정보 처리방침; web `/legal/terms`, `/legal/privacy` | Version line reads `버전 2026-08-30.1 · 시행일 2026-08-30` (en: `Version 2026-08-30.1 · Effective 2026-08-30`); if the app prompts for re-consent it does so once | **PASS** — current web pages and both app links show the complete current version | `s54-play-code18-terms-current.png`<br>`s55-play-code18-privacy-current.png` plus prior four 360×800 web captures |

## Findings

### ADR15-QA-F01 — deployed web legal bundle is stale — RESOLVED

- Expected: both legal pages show version `2026-08-30.1`, effective `2026-08-30`, in Korean and
  English.
- Actual: `/legal/terms` shows `2026-08-22.3` / `2026-08-22`; `/legal/privacy` shows
  `2026-08-25.1` / `2026-08-25` in both locales.
- Scope: release blocker for row 20. Local `apps/web` source and the deployed database functions
  already declare `2026-08-30.1`, so the public Firebase Hosting bundle does not match the current
  release source.
- Resolution: the current Firebase bundle is deployed. Code 18 opened the current terms and privacy
  pages from the app; both show version `2026-08-30.1` without an error.

### ADR15-QA-F02 — privacy version line clips at 360×800 — RESOLVED

- Expected: the full version and effective-date line is visible without horizontal clipping.
- Actual: the left side of the privacy version line is outside the viewport in both Korean and
  English 360×800 captures. The terms page does not show the same clipping.
- Resolution: the four Korean/English 360×800 captures have no horizontal overflow, and the code 18
  device link renders the same current page.

### ADR15-QA-F03 — AdMob request still has no fill after UMP resolution

- Expected: UMP resolves consent, the Mobile Ads SDK initializes, and the configured test device
  can request exposure and rewarded ads.
- Actual: `AdsConsent.gatherConsent()` reports `Publisher misconfiguration: Failed to read
  publisher's account configuration; no form(s) configured for the input app ID.` The shared
  consent gate correctly prevents SDK initialization, so no banner or rewarded request is made.
- Scope: release blocker for rewarded rows 2–7 and exposure row 13. This is not safely bypassed in
  code; configure and publish the applicable AdMob privacy message/form, link/approve the app, then
  register the test device and repeat the rows. `ads_enabled=false` was restored.
- 2026-09-02 second pass: reproduced verbatim on the store-installed code 19, with the failing app
  id named in the log — `ca-app-pub-9625042173735017~2273644771`. The same log line supplies the
  **test-device hashed id `278D76522FF9E640A4DB636E0016313E`**, so prerequisite 7 needs no further
  device work once the message/form is published. The consent gate behaved correctly throughout:
  the SDK never initialized, no ad request was made, and both rewarded actions fell to the locked
  copy rather than granting anything (row 7).
- **Console issue resolved, 2026-09-02:** after the PO published the UMP setup and registered the
  test device, the publisher-misconfiguration message disappeared. UMP now completes and the SDK
  issues a request, which currently returns code 3 (no fill). Keep this finding open only as a
  device-QA blocker until a test ad fills and the rewarded/exposure rows can be completed; it is no
  longer evidence of a UMP configuration defect.

### ADR15-QA-F04 — permanent-access Play product is unavailable — RESOLVED IN CODE 20

- Expected: `promise_permanent_access` is Active at ₩2,000; the sheet shows its localized price and
  opens the license-test purchase sheet.
- Original result: the catalog contained only `promise_slot_plus1`. The app received an empty
  price, rendered `에 영구 보관`, and failed before Play Billing appeared.
- After console configuration: the PO confirms `promise_permanent_access` is configured at ₩2,000,
  but the immediate code 19 retest still rendered the approved fallback price and did not open the
  purchase sheet. This was console propagation, not a second client defect.
- Code resolution: `c0a17fb` trims store prices and treats empty/whitespace as unavailable, restoring
  the approved ₩2,000 fallback instead of an empty label.
- Play resolution: the code 20 installed build receives the product, opens the ₩2,000 no-charge
  license-test purchase sheet, verifies the purchase server-side, consumes it, and restores
  `영구 보관 중` after a cold start. The ledger and participant-isolation checks above pass.

### ADR15-QA-F05 — store signing certificate missing from App Links — RESOLVED

- The Play-installed APK was signed with a certificate absent from the deployed Digital Asset
  Links statement. `c0a17fb` appended it without removing the existing EAS/Play certificates and
  added a pinning test; Firebase Hosting was redeployed.
- Google DAL returns the delivered signature, Android reports the domain `verified`, and the
  browser's app-open action launches `com.littlefinger.app` into the invalid-invite screen.

### ADR15-QA-F06 — empty Play price produced a malformed CTA — RESOLVED IN CODE 19

- `displayPrice = ''` bypassed the nullish fallback because an empty string is not `null` or
  `undefined`. Both slot and permanent-access price loaders now trim and return `null` for blank
  values, with regression tests. Code 18 demonstrates the original defect; the Play-installed code
  19 sheet renders `₩2,000에 영구 보관`. Evidence:
  `s77-play-code19-permanent-price-fallback.png`.

### ADR15-QA-F07 — MOD-02 said KakaoTalk while the handler is the OS share sheet — RESOLVED IN CODE 20

- Expected: the witness invite button describes what it does. C-4 was closed on 2026-08-23 by
  retiring exactly this label on SCR-A04 — the handler there was already the OS share sheet and
  "only the label lied".
- Actual: MOD-02 renders `카카오톡으로 증인 초대하기` (en: `Invite witnesses via KakaoTalk`) at
  `apps/mobile/src/screens/mod-02-labels.ts:40` and `:79`, while
  `shareWitnessInvite` in `apps/mobile/src/lib/witness-native.ts:127` calls `Share.share` — the OS
  sheet, offering 카톡·SMS·SNS alike. Grep confirms this is the **only** remaining 카카오톡 label in
  the app, so MOD-02 was simply missed by the C-4 sweep.
- Scope: not a release blocker; a copy correction of the same kind already approved for SCR-A04.
  Fixed in `fdc2b8b` with the already-approved SCR-A04 wording `초대 링크 공유하기` /
  `Share invite link`. Unit coverage passes, and both the development build and Play-installed code
  20 render the new label without clipping. Evidence: `s81-qa2-witness-sheet.png` (before),
  `s110-code20-dev-witness-share-label.png`, `s113-code20-play-witness-share-en.png`, and
  `s116-code20-play-witness-share-ko.png` (after).

### ADR15-QA-F08 — English locale printed a Korean weekday on the home list — RESOLVED IN CODE 20

- Expected: with English selected, `종료일`/`End date` renders an English weekday —
  `WEEKDAY_LABEL.en` already exists in `packages/shared/src/datetime.ts:96`.
- Actual: the home hero shows `End date 2026-09-22 (화)` and the list rows show
  `End date 2026-08-29 (토)`. `formatKstDate(date, locale = 'ko')` defaults to Korean, and exactly
  two of its eleven call sites omit the argument: `apps/mobile/src/app/home.tsx:304` and
  `apps/mobile/src/components/PromiseListRow.tsx:88`. The other nine (fulfillment, editor,
  entitlement sheet, A05 detail state, and all four web screens) pass `locale` correctly.
- Scope: SCR-A02 only, both hero and rows; ADR 0006 requires user-facing strings in both locales.
  Fixed in `fdc2b8b` by passing the current locale at both call sites, with a regression test for
  the hero and list. The Play-installed code 20 renders `End date 2026-09-03 (Thu)` on the hero and
  `End date 2026-09-22 (Tue)` in the row. Evidence:
  `s90-qa2-home-en-weekday-defect.png`, `s91-qa2-list-en-weekday-defect.png` (before),
  `s108-code20-dev-home-en-weekday.png`, `s109-code20-dev-home-en-hero-weekday.png`, and
  `s112-code20-play-home-en.png` (after).

## Staging fast-forward SQL (rows 16–18)

Retention math cannot be shortened without a migration (`lf_retention_free_days()` is a constant
30). The hourly job takes its clock as an argument, so warnings are produced by calling it with a
future instant; expiry itself is moved by shifting the anchor of a **dedicated staging promise**.
Run as `postgres` in the SQL editor. The staging promise's fingerprint will no longer match its
content afterwards — that is expected and is why it must be a throwaway.

```sql
-- current per-participant expiry
select pp.user_id, public.lf_access_expires_at(p.id, pp.user_id) as expires_at
  from public.promises p join public.promise_participants pp on pp.promise_id = p.id
 where p.id = '<S>' and pp.status = 'JOINED';

-- row 16: D-7 window, run twice; then D-1, run twice (replace <expiry> with the value above)
select public.lf_retention_maintenance('<expiry>'::timestamptz - interval '7 days' + interval '1 hour');
select public.lf_retention_maintenance('<expiry>'::timestamptz - interval '7 days' + interval '1 hour');
select public.lf_retention_maintenance('<expiry>'::timestamptz - interval '1 day' + interval '1 hour');
select public.lf_retention_maintenance('<expiry>'::timestamptz - interval '1 day' + interval '1 hour');

-- row 17/18: move the anchor into the past (finite promise: end_date; no-end promise: retention_anchor_at)
update public.promises set end_date = current_date - 40 where id = '<S>';                  -- finite
update public.promises set retention_anchor_at = now() - interval '40 days' where id = '<S>'; -- no-end, finished
-- then queue purge work for whatever has fully expired at "now"
select public.lf_retention_maintenance(now());
select * from public.promise_purge_jobs;
```

A future `p_now` also queues purge jobs for **any** promise whose last access ends before that
instant, which is why this is staging-only. If an `update` above is rejected by a trigger, stop and
record it as a finding rather than disabling the trigger.

## Non-functional passes

- **Rewarded ad latency** — from tapping the ad button to the rewarded ad rendering: record three
  samples on Wi-Fi and three on LTE; target < 10 s. From closing the ad to the sheet unlocking
  (SSV round trip + polling): target < 60 s; record the worst sample.
- **Edge logs** — zero 5xx across `reward-intent-create`, `reward-status`, `reward-callback`,
  `promise-entitlements`, `purchase-verify`, `retention-maintenance` for the run window.
- **Cron** — `cron.job_run_details` for `lf-retention-maintenance` shows only `succeeded` during
  the run; the function log shows one 200 per hour.
- **Ad-free surfaces** — creation, review, approval, confirmation, fulfillment screens, every
  modal, and the whole acceptance web show no ad component with `ads_enabled=true` (row 13 window).
  Capture one screen of each.
- **Performance** — entitlement sheet open (`promise-entitlements`) p95 < 1 s over ten opens on
  LTE; home list with 6+ rows and the banner has no visible layout shift when the banner fills.
- **Visual** — 360×800 captures of the entitlement sheet (unlocked / locked), MOD-02 with a locked
  spot, A05 retention card, A05 no-end + finish-pending, compared with the `design-reference/`
  screens of the same names. Never edit the reference to make a diff pass.
- **Not covered here** — Kakao OAuth, App Links, quiet-hours delivery: `docs/qa/MANUAL_E2E.md`.

## Result recording

After execution replace each `NOT_RUN` with **PASS** / **FAIL** (with a one-line reason and a
finding id), add absolute capture paths, record the build code `N`, and copy the header line and
any findings into `docs/DEVELOPMENT_STATUS.md`. Restore `ads_enabled=false` and
`rewarded_ads_enabled=true` before closing the run and state both values in the record. Do not
record Google account ids, purchase tokens, SSV callback URLs, worker secrets, raw IPs, or device
tokens.
