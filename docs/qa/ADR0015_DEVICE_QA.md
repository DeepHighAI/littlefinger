# ADR 0015 device QA — internal testing 0.2.0

Snapshot: 2026-08-30 KST. Status: **NOT_RUN** (0 PASS · 0 FAIL · 20 NOT_RUN).

Companion to `docs/setup/monetization-retention-release.md` §4. Same format as
`docs/qa/MANUAL_E2E.md`: fill the Status and Capture columns in place, then copy the result block
into `docs/DEVELOPMENT_STATUS.md`. Every row runs on the **production-profile** build installed
from the internal testing track — preview builds use Google test ad units, which the SSV callback
rejects, so rows 2–8 cannot pass on them.

## Prerequisites

| # | Item | Value |
|---:|---|---|
| 1 | Build | `0.2.0` versionCode `N = ____` (build id `________`), installed from the internal-track opt-in URL, not sideloaded |
| 2 | Backend | Migrations `20260829103504` + `20260830000001` applied; all 56 functions `ACTIVE`; `adr0015-smoke.sql` passed |
| 3 | Account A — creator | license tester `____________` (Google sign-in in app; the same Google account is signed into Play Store on the phone) |
| 4 | Account B — partner | license tester `____________` (second phone, or the acceptance web `https://littlefinger-app.web.app` on desktop) |
| 5 | Account C — witness | `____________` (any account; web) |
| 6 | 0.1.x device | one phone still on `0.1.0 (9)` for row 1 — do **not** update it until row 1 is captured |
| 7 | AdMob test devices | ids `____________`, `____________` registered (runbook §1 row 6); rewarded ads render the "Test Ad" label |
| 8 | `rewarded_ads_enabled` | `true` (migration default) — rows 7a and 13 change it and restore it |
| 9 | `ads_enabled` | `false` — row 13 sets `true` for that row only and restores `false` |
| 10 | Worker secrets in hand | `PURCHASE_RECONCILE_SECRET` (row 12) and `RETENTION_WORKER_SECRET` (row 18), read from `npx supabase secrets` owner's notes — never from the repo |
| 11 | Capture root | `%TEMP%\littlefinger-qa\adr0015-<yyyymmdd>\`, files `s<nn>-<step>.png` at 360×800 logical; SQL evidence as `s<nn>-<step>.txt` |
| 12 | Staging promises | Every promise created during this run is test data. Rows 16–18 use the fast-forward SQL below and are **never** run against a database with real users |

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
| 3 | B | Rewarded **WITNESS_PARTNER** once on the same promise | B's MOD-02 first shows `내 증인 자리는 아직 잠겨 있어요. 광고를 보면 한 자리가 열려요.`; after the ad one spot opens; a second ad is not offered. Ledger: one `WITNESS_PARTNER` GRANTED row for B | NOT_RUN | `s03-*.png` |
| 4 | A | Rewarded **DURATION_30D** (repeatable): new DRAFT, pick an end date past the shown ceiling (`현재 설정 가능한 마지막 날 · …`) → send | Send is refused with the sheet's range copy (`광고 1편 = 30일 연장 · 영구 보관 구매 = 종료일 무제한`); `광고 보고 30일 늘리기` → ceiling moves +30 days → send succeeds. A second ad moves it another +30. Ledger: one GRANTED row per ad | NOT_RUN | `s04-*.png` |
| 5 | A | Rewarded **RETENTION_30D** once: on a promise in CHECKING/COMPLETED, SCR-A05 `내 기록 보관` → `광고 보고 내 보관 30일 늘리기` | `현재 내 보관 만료` moves exactly +30 days; `lf_access_expires_at(P, A)` agrees; one GRANTED row. B's expiry on the same promise is unchanged (personal) | NOT_RUN | `s05-*.png` |
| 6 | — | Duplicate `transaction_id`: Dashboard → Edge Functions → `reward-callback` → Logs → copy the full callback URL (Google's query string incl. `signature`) of row 2's grant → `curl -i "<url>"` twice | Neither replay inserts a second `promise_reward_grants` row for that intent; the intent stays `GRANTED` once; no 5xx in logs | NOT_RUN | `s06-replay.txt` |
| 7 | A | Ad unavailable → benefit stays locked, no free path. (a) `update public.app_configs set value='false'::jsonb where key='rewarded_ads_enabled';` then reopen the entitlement sheet; (b) airplane mode before tapping the ad button (no fill); (c) on a test device with UMP debug geography = EEA, decline consent; (d) throttle to ~50 kbps so the load times out | Each case shows `지금은 광고를 볼 수 없어 잠겨 있어요.` and no benefit changes; SQL shows no new GRANTED row (a PENDING row may exist and expires after 15 min). Restore the flag to `true` after (a) | NOT_RUN | `s07a-*.png` … `s07d-*.png` |
| 8 | B | Partner cannot use DURATION: B opens the entitlement sheet on A's promise | Sheet shows `종료일 범위는 작성자만 늘릴 수 있어요.` and no ad button. Optional API check: `reward-intent-create` with `action: DURATION_30D` as B → `422 E_REWARD_NOT_ELIGIBLE` | NOT_RUN | `s08-*.png` |
| 9 | A | Creator permanent purchase (₩2,000, test card) on promise P1 | Sheet shows `영구 보관이 적용됐어요.`, then `이 기록은 내 계정에 영구 보관돼요` **and** `종료일 없이 제안할 수 있어요`; the editor offers `종료일 없음`; an AMEND request with no end date is accepted and B sees `종료일 없음` on the web. SQL: one `slot_purchases` row `product_id = promise_permanent_access` for (P1, A) | NOT_RUN | `s09-*.png` |
| 10 | B | Partner permanent purchase on a different promise P2 (A has not bought) | B sees `영구 보관 중` on P2; A's sheet on P2 still shows the ceiling and no `종료일 없음`; A's editor still refuses a no-end proposal (`E_END_DATE_RANGE`) | NOT_RUN | `s10-*.png` |
| 11 | A | Restore on reopen: start a purchase on P3, kill the app right after Play's payment sheet reports success and before `영구 보관이 적용됐어요.` | Reopen the sheet → the unconsumed purchase is recovered and applied without paying again; exactly one `slot_purchases` row for (P3, A); Play shows one order | NOT_RUN | `s11-*.png` |
| 12 | A | Refund → reconcile revokes: Play Console → 주문 관리 → refund row 9's order **with 권한 취소** → wait for `lf-purchase-reconcile` (03:17 UTC = 12:17 KST) or trigger it: `curl -X POST https://vepnrrmxvsytguocicfe.supabase.co/functions/v1/purchase-reconcile -H "x-purchase-reconcile-secret: $PURCHASE_RECONCILE_SECRET" -H 'Content-Type: application/json' -d '{}'` (Google's voided-purchases feed can lag; retry the next day if empty) | A loses `영구 보관 중` on P1 and the finite expiry is recalculated; the already-approved no-end amendment on P1 is **not** rewritten (`종료일 없음` stays); B's access unchanged | NOT_RUN | `s12-*.png` |
| 13 | A | A02 banner: `update public.app_configs set value='true'::jsonb where key='ads_enabled';` with ≥6 rows in the ACTIVE tab; then with exactly 5; then `false`; then `true` in airplane mode | ≥6: one banner after the 5th visual card (hero counts), none elsewhere; 5: none; `false`: none and no gap; airplane (no fill): no reserved space. Restore `false` | NOT_RUN | `s13-*.png` |
| 14 | A/B | FINISH request → approve: on a no-end ACTIVE promise (row 9) A taps `이 약속 마무리 요청` → confirm | B receives one push (NT-15 copy `…님이 약속 변경을 요청했어요`) and one inbox row; B opens the web `/promises` → approves → status CHECKING on both surfaces; SQL: `retention_anchor_at` set, actions `FINISH_REQUEST` + `FINISH_APPROVE` in the audit list | NOT_RUN | `s14-*.png` |
| 15 | A/B | FINISH decline and withdraw: request → B declines; request again → A withdraws | Each returns the promise to ACTIVE with `FINISH_DECLINE` / `FINISH_WITHDRAW` recorded; a second open request is impossible while one is pending; no duplicate pushes | NOT_RUN | `s15-*.png` |
| 16 | A/B | NT-22 / NT-23 arrive once — fast-forward (see below) at D-7 twice, then D-1 twice | Exactly one NT-22 and one NT-23 per JOINED participant (dedupe_key `<expiry>:RETENTION_D7` / `_D1`); the second identical run inserts nothing; inbox shows each once; push arrives once (quiet hours 21:00–08:00 KST delay it, they do not duplicate) | NOT_RUN | `s16-*.png`, `s16-notif.txt` |
| 17 | A | Expired access disappears: shift the anchor of staging promise S1 so A's expiry is in the past (see below) while B holds permanent access | A: S1 absent from every home tab, from history, and the deep link answers `약속을 찾을 수 없어요` (E_NOT_FOUND); no ad or purchase path offers to restore it. B still sees S1 | NOT_RUN | `s17-*.png` |
| 18 | — | Purge idempotent: staging promise S2 where every participant's access has ended → `select public.lf_retention_maintenance(now());` queues the job → call the worker twice: `curl -X POST https://vepnrrmxvsytguocicfe.supabase.co/functions/v1/retention-maintenance -H "x-retention-worker-secret: $RETENTION_WORKER_SECRET" -H 'Content-Type: application/json' -d '{}'` | First call: `purged_count 1`, evidence objects gone from the private bucket, the `promises` row and children gone, one `purged_promise_receipts` row, `user_keep_rate_aggregates` updated and A07 keepRate **unchanged**. Second call: `purged_count 0`, HTTP 200, no error log | NOT_RUN | `s18-*.txt` |
| 19 | A | TalkBack + 48 dp on the entitlement sheet, the locked witness row (row 3 state), and the A05 retention card | TalkBack reads each control's label and its locked/disabled state; every tappable target is ≥48 dp (Developer options → Show layout bounds); locked state is conveyed by text, never by colour alone | NOT_RUN | `s19-*.png` |
| 20 | A/B | Legal pages show the new version: app → 프로필 → 이용약관 / 개인정보 처리방침; web `/legal/terms`, `/legal/privacy` | Version line reads `버전 2026-08-30.1 · 시행일 2026-08-30` (en: `Version 2026-08-30.1 · Effective 2026-08-30`); if the app prompts for re-consent it does so once | NOT_RUN | `s20-*.png` |

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
