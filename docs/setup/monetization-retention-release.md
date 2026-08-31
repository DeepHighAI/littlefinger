# ADR 0015 internal-test release runbook

Date: 2026-08-30 (supersedes the 2026-08-29 draft)
Scope: Google Play **internal testing** release of `0.2.0` — rewarded benefits, permanent access,
personal retention purge (ADR 0015, commit `28f6e0d`), plus the legal 2026-08-30.1 bump.

Two repository rules apply throughout and are not repeated per step:

- `npx supabase functions deploy --use-api` — `--use-api` is mandatory (CLAUDE.md §3).
- **`supabase config push` is never run.** The Dashboard owns auth configuration.

Why the order below is fixed:

1. `reward-callback` and `retention-maintenance` call `requireEnv` at boot, so the Edge secrets
   (§2-1) must exist before the functions are deployed (§2-9), or they fail on first request.
2. The migration sets `app_configs.min_app_version = "0.2.0"` and changes the witness-list,
   home-list and detail response shapes. A 0.1.x build cannot parse them; the forced-update gate
   is what keeps those users on a working screen. So the 0.2.0 AAB must be **installable from the
   internal track (§2-7) before** `db push` (§2-8).
3. Triggers in the migration raise new error codes, so every Edge shell's error map changed —
   **all 56 functions** redeploy, not only the five new ones.

---

## §0 Preconditions

Run from the repository root unless a step says otherwise. Every check must pass before §1.

1. Git: on `main`, clean, and containing the ADR 0015 commit.

   ```bash
   git rev-parse --abbrev-ref HEAD        # main
   git status --porcelain                 # empty
   git log --oneline -1                   # 28f6e0d or later
   ```

2. Local gates:

   ```bash
   npm test && npm run typecheck && npm run check:agents
   ```

3. Supabase CLI is signed into the **right account** (`docs/notes/environment-gotchas.md` §4).
   The PAT lives in the gitignored root `.env`; export it **in every shell** — it does not persist
   between Bash tool calls.

   ```bash
   export SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env | cut -d= -f2- | tr -d '\r')
   npx supabase orgs list                 # must list aseszttxkxpfzenmbylx
   npx supabase projects list             # must list vepnrrmxvsytguocicfe
   ```

   If `aseszttxkxpfzenmbylx` is missing, the CLI is on the wrong account; a `403 "Your account does
   not have the necessary privileges"` later is the same problem, not a permissions bug.
   If `supabase/.temp/` is missing on this machine, re-link:
   `npx supabase link --project-ref vepnrrmxvsytguocicfe`.

4. The two migrations of this batch are local-only:

   ```bash
   npx supabase migration list
   # 20260829103504 | (remote blank)   rewarded_ads_retention_bm
   # 20260830000001 | (remote blank)   legal_v6_paid_products_retention
   ```

5. **Backup.** GitHub → `DeepHighAI/littlefinger` → Actions → `supabase weekly backup` → Run
   workflow (`main`). Wait for green and confirm the run has an artifact `supabase-backup-<run_id>`
   containing non-empty `schema.sql` and `data.sql`. Download it and keep it until §2-12 passes;
   the migration is forward-only (§5).

6. EAS CLI. `eas-cli` is not a repository dependency (`npx eas` fails with "could not determine
   executable"); use `npx eas-cli@latest …` from `apps/mobile`, or a global install.

   ```bash
   cd apps/mobile
   npx eas-cli@latest whoami              # an account with access to owner philwoo / project littlefinger
   npx eas-cli@latest env:list --environment production
   ```

   The production environment must already carry `EXPO_PUBLIC_SUPABASE_URL`,
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_WEB_BASE_URL`, `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` and
   `EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID` from the 2026-08-23/24 setup. The four new variables are
   added in §2-3.

7. Tools for §2-6: JDK (`jarsigner`), `bundletool-all-1.18.1.jar` (the version that validated the
   code9 AAB), `psql` on PATH for §6.

---

## §1 PO console checklist

Console work only the PO can do. Hand the filled-in block back to the engineer; §2 cannot start
without rows 1–6.

| # | Console | Do | Hand back |
|---:|---|---|---|
| 1 | Play Console → 수익 창출 → 인앱 상품 | Create **managed product** `promise_permanent_access` (exact id — the server rejects any other), consumable (the app consumes after server verification), base price **₩2,000**, **Active**. Keep `promise_slot_plus1` unchanged. | Product status = 활성 |
| 2 | Play Console → 설정 → 라이선스 테스트 | Add every QA Google account (the account signed into Play Store on each QA phone). Response: `RESPOND_NORMALLY`. | Tester emails |
| 3 | Play Console → 테스트 → 내부 테스트 | Track exists; a tester email list containing the row-2 accounts is attached; copy the **opt-in URL** (참여 링크). | Opt-in URL |
| 4 | AdMob → 앱 → `com.littlefinger.app` → 광고 단위 | Create **1 Banner** (anchored adaptive; suggested name `lf-a02-banner`) and **3 Rewarded** units (`lf-rewarded-witness`, `lf-rewarded-duration`, `lf-rewarded-retention`). | 4 unit ids, each `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX` |
| 5 | Each rewarded unit → 고급 설정 → 서버 측 인증(SSV) | Turn **on** and set the callback URL on **all three**: `https://vepnrrmxvsytguocicfe.supabase.co/functions/v1/reward-callback` | "SSV set ×3" |
| 6 | AdMob → 설정 → 테스트 기기 | Register every QA phone (AdMob shows the device id in logcat on first ad request; or Settings → Google → Ads shows the advertising id). | Test device ids |
| 7 | Only if uploading with `eas submit` (§2-7 B) | Play Console → 설정 → API 액세스: a service account with **"테스트 트랙에 출시"** permission; JSON key. The existing `purchase-verify` account has only order-read rights — grant it or create a second one. | JSON key handed over out-of-band, never in chat or repo |

Fill-in block (copy into the handoff message; unit ids are not secrets, the row-7 key is):

```
PLAY_PRODUCT promise_permanent_access   active: [ ]   price: ₩2,000
LICENSE_TESTERS:                        ______________ , ______________
INTERNAL_TRACK_OPT_IN_URL:              https://play.google.com/apps/internaltest/________
ADMOB_BANNER_UNIT_ID:                   ca-app-pub-________________/__________
ADMOB_REWARDED_WITNESS_UNIT_ID:         ca-app-pub-________________/__________
ADMOB_REWARDED_DURATION_UNIT_ID:        ca-app-pub-________________/__________
ADMOB_REWARDED_RETENTION_UNIT_ID:       ca-app-pub-________________/__________
SSV_CALLBACK_SET_ON_ALL_THREE:          [ ]
ADMOB_TEST_DEVICE_IDS:                  ______________ , ______________
PLAY_SUBMIT_SERVICE_ACCOUNT (row 7):    [ ] not needed / [ ] key handed over
```

Current AdMob execution record (2026-08-30):

```text
ADMOB_ANDROID_APP_ID:                   ca-app-pub-9625042173735017~2273644771
ADMOB_NATIVE_UNIT_ID:                   ca-app-pub-9625042173735017/1468714041
ADMOB_BANNER_UNIT_ID:                   ca-app-pub-9625042173735017/1537920242
ADMOB_REWARDED_WITNESS_UNIT_ID:         ca-app-pub-9625042173735017/8166907779
ADMOB_REWARDED_DURATION_UNIT_ID:        ca-app-pub-9625042173735017/3843580039
ADMOB_REWARDED_RETENTION_UNIT_ID:       ca-app-pub-9625042173735017/9969627380
SSV_CALLBACK_SET_ON_ALL_THREE:          [x] URL verified and saved
ADMOB_TEST_DEVICE_IDS:                  pending — register before the first ad request
```

The three rewarded ids are set in both Supabase Edge secrets and the EAS `production`
environment. The AdMob URL verifier signs a fixed probe with ad unit `1234567890`, not the edited
unit's real id. `reward-callback` accepts only that exact signed probe tuple and returns 200 without
calling the grant RPC; real grants still require one of the three configured rewarded ids. This is
locked by `supabase/tests/edge-monetization.test.ts`.

The AdMob account still shows **account approval pending** and the app is not linked to its Play
store listing. Those states can prevent live serving, but they do not replace row 6: every QA phone
must be registered as a test device before it makes any request with these production ids.

Unit ids must match `^ca-app-pub-\d{16}/\d{10}$` — `config/admob-config.js` refuses the
production build otherwise, and `reward-callback` only accepts callbacks for the three rewarded
ids it was given.

---

## §2 Operator commands

Run by the engineer once the §1 block is filled. Every shell starts with the §0-3 export.

### 2-1 Edge secrets

```bash
export SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env | cut -d= -f2- | tr -d '\r')
RETENTION_WORKER_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

npx supabase secrets set \
  ADMOB_REWARDED_WITNESS_UNIT_ID='ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX' \
  ADMOB_REWARDED_DURATION_UNIT_ID='ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX' \
  ADMOB_REWARDED_RETENTION_UNIT_ID='ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX' \
  RETENTION_WORKER_SECRET="$RETENTION_WORKER_SECRET"

npx supabase secrets list   # the four names appear (values are shown as digests)
```

Keep `$RETENTION_WORKER_SECRET` in this shell for 2-2. It is never written to a file. Setting
secrets restarts already-deployed functions; the two new ones do not exist yet, which is fine.

### 2-2 Vault rows (Dashboard → SQL editor)

The cron command reads both rows from `vault.decrypted_secrets` by name. Same pattern as the
`purchase_reconcile_*` / `account_delete_retry_*` rows in `slot-iap-admob-console.md` step 5.

```sql
select vault.create_secret(
  'https://vepnrrmxvsytguocicfe.supabase.co/functions/v1/retention-maintenance',
  'retention_maintenance_url'
);
select vault.create_secret('<paste $RETENTION_WORKER_SECRET>', 'retention_worker_secret');
```

Verify without echoing the value (64 = the hex length of a 32-byte secret):

```sql
select name, length(decrypted_secret) as len
  from vault.decrypted_secrets
 where name in ('retention_maintenance_url', 'retention_worker_secret')
 order by name;
-- retention_maintenance_url | 76
-- retention_worker_secret   | 64
```

Clear the SQL editor afterwards. If a row already exists (re-run), update instead of creating a
duplicate: `select vault.update_secret((select id from vault.secrets where name =
'retention_worker_secret'), '<new value>');` — the cron command uses `limit 1`, so a duplicate name
would silently pick one of the two.

### 2-3 EAS production environment variables

Run in `apps/mobile`. Current EAS docs name the command `eas env:set` (create-or-update). Older
CLIs shipped the same flags under `eas env:create`; if `env:set` is reported as unknown, substitute
`env:create` with identical flags.

```bash
cd apps/mobile
for pair in \
  "EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX" \
  "EXPO_PUBLIC_ADMOB_REWARDED_WITNESS_UNIT_ID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX" \
  "EXPO_PUBLIC_ADMOB_REWARDED_DURATION_UNIT_ID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX" \
  "EXPO_PUBLIC_ADMOB_REWARDED_RETENTION_UNIT_ID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"; do
  npx eas-cli@latest env:set --environment production --visibility plaintext \
    --name "${pair%%=*}" --value "${pair#*=}" --non-interactive
done
npx eas-cli@latest env:list --environment production
```

Dashboard alternative: expo.dev → `philwoo` → `littlefinger` → Environment variables →
**production** → Create variable → Plain text, one per name. The values are public ad unit ids;
plaintext visibility is correct. `env:list` must show all **six** `EXPO_PUBLIC_ADMOB_*` names.

### 2-4 Production build

```bash
cd apps/mobile
npx eas-cli@latest build -p android --profile production --non-interactive --wait
```

`appVersionSource: remote` + `autoIncrement` mean EAS assigns `versionCode`; the last completed
store build was 10, so the 2026-08-30 real-unit rebuild is assigned **11** — always read the actual
`N` from the build output (`Android version code`) and use it in every file name below.
`versionName` is `0.2.0` from `app.json`. A failure in the
"Read app config" phase is `config/admob-config.js` rejecting a missing or malformed unit id — fix
§2-3, do not touch the resolver.

### 2-5 Download the AAB

```bash
cd apps/mobile
npx eas-cli@latest build:list -p android --profile production --limit 1 --json --non-interactive
# read: id, appBuildVersion (= N), artifacts.applicationArchiveUrl
mkdir -p ../../dist
curl -L -o ../../dist/littlefinger-internal-v0.2.0-code<N>.aab "<applicationArchiveUrl>"
```

(Or copy the download link from the build page.) `dist/` is gitignored; the AAB never enters git.

### 2-6 Validate the artefact

Same three checks that validated the code9 AAB on 2026-08-27 (`docs/DEVELOPMENT_STATUS.md`).

```bash
java -jar bundletool-all-1.18.1.jar validate --bundle dist/littlefinger-internal-v0.2.0-code<N>.aab
java -jar bundletool-all-1.18.1.jar dump manifest --bundle dist/littlefinger-internal-v0.2.0-code<N>.aab \
  > dist/manifest-code<N>.xml
jarsigner -verify -verbose -certs dist/littlefinger-internal-v0.2.0-code<N>.aab | tail -n 6
sha256sum dist/littlefinger-internal-v0.2.0-code<N>.aab      # Windows: certutil -hashfile <file> SHA256
```

Expected: `validate` exits 0 with `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` listed; the manifest
has `package="com.littlefinger.app"`, `versionCode="<N>"`, `versionName="0.2.0"`, minSdk 24 /
targetSdk 36, and the permission set in `docs/setup/play-store-listing.md` §3; `jarsigner` prints
`jar verified.` with the **same upload-certificate SHA-256** as the code 6/8/9 AABs. Record `N`,
the artefact SHA-256 and the build id in `docs/DEVELOPMENT_STATUS.md`.

### 2-7 Upload to the internal testing track

**A — Play Console (manual).** 테스트 → 내부 테스트 → 새 버전 만들기 → upload the AAB → 출시명
`0.2.0 (<N>)` → release notes: paste ko + en from `docs/setup/play-store-listing.md` §1 → 다음 →
저장 → 출시 검토 → 내부 테스트 트랙으로 출시 시작. Wait until the release shows **테스터에게
제공 중**.

**B — `eas submit` (uses the new `submit.production` profile in `apps/mobile/eas.json`).** Put the
§1 row-7 key at `apps/mobile/.secrets/play-service-account.json` (gitignored directory), then:

```bash
cd apps/mobile
npx eas-cli@latest submit -p android --profile production \
  --path ../../dist/littlefinger-internal-v0.2.0-code<N>.aab --non-interactive
```

The profile is `track: internal`, `releaseStatus: draft`: the build lands as a **draft** release on
the internal track and is rolled out from the console (same 출시 검토 → 출시 시작 as A). Delete the
key file when done.

**Gate before 2-8:** on a license-tester phone, open the opt-in URL, accept, and confirm Play Store
offers **0.2.0 (<N>)**. Until it does, the migration would strand every 0.1.x tester on the
forced-update screen with nothing to update to.

### 2-8 Migrations

```bash
npx supabase db push --dry-run     # lists exactly 20260829103504 and 20260830000001
npx supabase db push
```

`db push` cannot touch auth configuration (verified against the CLI source — only `config push`
can). If the dry run lists anything else, stop.

### 2-9 Edge Functions — all of them

```bash
npx supabase functions deploy --use-api
```

Deploys all 56 function directories. Let it finish; a partial deploy leaves old shells that map the
new trigger-raised codes to a 500.

### 2-10 Verify (Dashboard → SQL editor, then CLI)

```sql
select jobname, schedule, active
  from cron.job
 where jobname = 'lf-retention-maintenance';
-- exactly one row: 17 * * * * | true

select key, value
  from public.app_configs
 where key in ('rewarded_ads_enabled', 'ads_enabled', 'min_app_version')
 order by key;
-- ads_enabled          | false
-- min_app_version      | "0.2.0"
-- rewarded_ads_enabled | true

select public.lf_current_terms_version(), public.lf_current_privacy_version();
-- 2026-08-30.1 | 2026-08-30.1
```

```bash
npx supabase functions list
```

All rows `ACTIVE`, including the five new ones: `promise-entitlements`, `reward-intent-create`,
`reward-status`, `reward-callback`, `retention-maintenance`.

### 2-11 First worker run

After the next `hh:17` (KST or UTC — the schedule is server-local, minute 17 of every hour):

```sql
select status, return_message, start_time
  from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'lf-retention-maintenance')
 order by start_time desc
 limit 3;
```

`succeeded` only means `net.http_post` was queued. Then Dashboard → Edge Functions →
`retention-maintenance` → Logs: the request must be a **200** with `purged_count`/`warned` in the
body. A **401** means the Vault `retention_worker_secret` and the Edge `RETENTION_WORKER_SECRET`
differ — redo 2-1/2-2 with the same value.

### 2-12 Smoke SQL

Run `supabase/tests/remote/adr0015-smoke.sql` as described in §6. It must end with
`NOTICE:  ADR 0015 smoke: all assertions passed` and exit 0. Paste the JSON report it prints into
`docs/DEVELOPMENT_STATUS.md`.

---

## §3 Flags

- **`rewarded_ads_enabled` is seeded `true` by the migration.** The moment 2-8 completes,
  `reward-intent-create` issues intents and rewarded rows on 0.2.0 devices are live. There is no
  "keep it off for the first pass" default — the earlier draft of this document said otherwise and
  was wrong. If a smoke pass with rewarded benefits **off** is wanted, flip it explicitly and flip
  it back:

  ```sql
  update public.app_configs set value = 'false'::jsonb where key = 'rewarded_ads_enabled';
  -- … every rewarded row shows the locked copy, reward-intent-create answers E_REWARD_NOT_ELIGIBLE …
  update public.app_configs set value = 'true'::jsonb where key = 'rewarded_ads_enabled';
  ```

  Existing grants are append-only and unaffected by the flag.
- **`ads_enabled` stays `false`** until the PO's F-12 traffic gate (100 daily confirmations;
  `slot-iap-admob-console.md` step 7). The QA row that exercises the A02 banner turns it on for the
  duration of that row and restores `false`. It also gates the three native bottom slots.
- **`min_app_version` is `"0.2.0"`** and is not lowered: a 0.1.x build cannot parse the post-batch
  responses regardless of the flag.

---

## §4 Device QA

The scenario matrix, prerequisites, capture root and staging fast-forward SQL are in
[`docs/qa/ADR0015_DEVICE_QA.md`](../qa/ADR0015_DEVICE_QA.md). It needs a **production-profile**
build with license testers and AdMob test devices: preview builds are forced to Google test ad
units, which the SSV callback allowlist rejects, so a rewarded grant can never be observed on a
preview build.

### §4-1 Register an Android QA phone as an AdMob test device

Do this before exercising any ad row with the production unit ids. Test-device registration is an
AdMob account setting; it does not require another app build.

1. Open AdMob → **Settings → Test devices → Add test device**, select Android, give the phone a
   recognizable name, and save its advertising/test-device id.
2. If the id is not already known, install the internal-track build, connect ADB, clear logcat, and
   open one ad-bearing screen **once without tapping the ad**:

   ```powershell
   adb logcat -c
   adb logcat | Select-String 'setTestDeviceIds|RequestConfiguration|test device'
   ```

   Copy the hexadecimal id from Mobile Ads SDK's `setTestDeviceIds(...)` instruction into the
   AdMob test-device form. This discovery request can look live, so do not click it.
3. Force-stop and reopen the app after saving. AdMob says propagation can take up to 15 minutes.
   Do not continue QA until the creative carries the **Test Ad** label.
4. Keep Google Play license testing separate: add the tester account in Play Console before the
   purchase rows. AdMob test-device status does not make Play Billing a test purchase.
5. For each rewarded row, confirm all three layers: the app reports completion, `reward-status`
   changes only after SSV, and the server grant row exists. A client `EARNED_REWARD` event by itself
   is never a pass.

The currently connected SM-N981N is not registered yet. Record its id in the execution block in
§2-2 after registration; do not commit the id anywhere else.

---

## §5 Rollback

There is no OTA channel (`expo-updates` is not installed), and the migration has no down
migration; `supabase db reset` is local-only. Rollback is therefore **roll forward + flags**:

| Layer | What can be undone | How |
|---|---|---|
| App | A broken 0.2.0 needs a **new store build**: fix → bump `version` to `0.2.1` in `apps/mobile/app.json` **and** `apps/mobile/package.json` → §2-4…2-7 again (versionCode `N+1`). Play never accepts a lower versionCode, and a testing track has no halt button — if testers must stop, remove them from the tester list. | — |
| Rewarded benefits | Stop issuing intents; existing grants stay. | `update public.app_configs set value = 'false'::jsonb where key = 'rewarded_ads_enabled';` |
| Exposure ads | Remove the A02 banner and the three native slots. | `update public.app_configs set value = 'false'::jsonb where key = 'ads_enabled';` |
| Retention worker | Pause D-7/D-1 warnings and purge claims. Re-arm with `select public.lf_schedule_retention_worker();` (re-creates the single row). | `select cron.unschedule(jobid) from cron.job where jobname = 'lf-retention-maintenance';` |
| Worker access | Lock the worker out without unscheduling: rotate `RETENTION_WORKER_SECRET` (2-1) **without** updating Vault → every cron call is a 401. | — |
| Permanent purchases | Refund in Play Console (Order management → 환불 + 권한 취소); the daily `lf-purchase-reconcile` (03:17 UTC) revokes personal access. | — |
| Purged records | **Not recoverable.** Storage objects and rows are gone; only the de-identified `user_keep_rate_aggregates` and the `purged_promise_receipts` digest remain. The §0-5 backup is the only source, and restoring it is a manual `data.sql` replay, not a button. | — |
| `min_app_version` | Do not lower it. | — |
| Edge Functions | Redeploying a pre-batch commit is not a rollback: the DB already raises the new codes. Fix forward. | — |

---

## §6 Running the remote SQL

`supabase/tests/remote/*.sql` run against the linked project with `psql`; nothing in CI touches
the remote database.

```bash
export SUPABASE_DB_URL='postgresql://postgres.vepnrrmxvsytguocicfe:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/remote/adr0015-smoke.sql
```

- **Where `SUPABASE_DB_URL` comes from:** Dashboard → Project Settings → Database → Connection
  string → **Session pooler** — host `*.pooler.supabase.com`, port **5432**. It is the same value
  as the GitHub Actions secret `SUPABASE_DB_URL` (`docs/setup/github-actions-secrets.md`). The
  direct host `db.vepnrrmxvsytguocicfe.supabase.co` is IPv6-only and may not resolve here; the
  transaction pooler (6543) is not used for consistency with the backup workflow.
- The URL embeds the database password: keep it in the shell or the gitignored `.env` only; never
  in a file under the repo, a commit, or a chat message. Percent-encode special characters.
- Any `psql` 15+ works for these queries (the server is PG 17; only `pg_dump` cares about the
  major version).
- Pass = exit code 0 and the final `NOTICE:  ADR 0015 smoke: all assertions passed`; the JSON
  `verification` row printed before it is the record for `docs/DEVELOPMENT_STATUS.md`. The script
  is read-only and can be re-run at any time, including after the first cron run.
- `metadata.sql` and `rls-rpc.sql` in the same directory run the same way.
