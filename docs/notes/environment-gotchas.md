# Environment gotchas — things that cost hours, kept so nobody pays twice

Consolidated 2026-08-22 from the session handoffs before they were deleted. Everything here was
**measured on this project**, not reasoned from documentation, and every item is one where the
obvious approach fails in a way that does not look like the real cause.

This file is permanent. Session handoffs are not — `CLAUDE.md` §1-1 keeps only the newest one, so
anything discovered in a session that outlives the session belongs here instead.

---

## 1. Icons — subsetting by ligature name silently fails

**Never subset Material Symbols by icon name.** Every name is spelled from `a-z` and `_`, so keeping
those letters makes harfbuzz close over the `liga` table and retain every ligature they can form —
the whole ~3,000-icon set. Measured: **5,220 KB → 4,655 KB (11% saved)**, which looks like the font
is simply large rather than like the subset failing.

Resolving the names to their **PUA codepoints first** removes the problem, because a codepoint is not
an input to any ligature and the closure has nowhere to spread: **5,220 KB → 39.9 KB for 34 icons**.

`tools/subset-icon-font.js` does that: it resolves names through the font's own GSUB (fontkit
`layout()`), writes the subset plus a generated `apps/web/src/components/icon-codepoints.ts`, and
**throws** rather than skipping a name it cannot resolve. It has no npm script on purpose — both
outputs are committed; re-run `node tools/subset-icon-font.js` only when the icon list changes.

Consequence for screens: **icons always go through `LfIcon`, never a raw span**, because the markup
now carries a codepoint instead of a readable name.

---

## 2. Postgres tests — PGlite, and the RLS bug only it could find

Docker is not installed on this machine, so `supabase start` (and `supabase functions serve`) was
never available. `supabase/tests/harness.ts` boots **PGlite** (Postgres compiled to WASM, in-process
under Node), applies the migrations, and recreates the two things a real Supabase project provides
that migrations do not: the `auth` schema with `auth.uid()`, and the `anon` / `authenticated` /
`service_role` roles with their default `public` grants. RLS is genuinely enforced — a superuser and
a role-switched user see different row counts.

Pin the harness to **UTC**. It inherits KST from this machine otherwise, which hides every timezone
bug the KST-boundary logic exists to prevent.

**The bug structural tests could not find:** creating a promise failed at `insert … returning`.
RETURNING re-reads the new row; the SELECT policy resolved participation through
`promise_participants`, and that row does not exist yet at that instant. Worse, `can_read_promise` is
`stable`, so it reads the statement-start snapshot and cannot see the row being inserted at all. In
production this would have broken Supabase's ordinary `.insert().select()` on the very first screen
that creates a promise. The policy now compares `creator_id` on the row directly.

**The two denial paths do not look alike:** a `using` violation filters silently to **zero rows**; a
`with check` violation **raises**. Read any future RLS failure with that in mind.

---

## 3. Edge Functions — client IP and the rate limiter

**The client IP is `cf-connecting-ip`, not any position in `x-forwarded-for`.** Cloudflare fronts
Supabase Edge Functions. Measured against the deployed platform:

| header | observed |
|---|---|
| `cf-connecting-ip` | the real client address, **constant** across requests |
| `x-forwarded-for` | `[client, client, internal hop]` — the **last entry rotates every request** |
| a client-supplied `X-Forwarded-For` | **dropped entirely** — the forged value never arrives |

The first implementation read the *last* entry on the general principle that a proxy appends what it
observed. The principle is right and the conclusion was wrong: the last slot is an internal hop, so
every request minted a fresh rate-limit bucket and **210 live requests never once returned 429**.
What settled it was deploying a throwaway function that echoed hashed hops and seeing which position
stayed constant — one deploy, two minutes. Do that again rather than reasoning about XFF semantics.

**A fixed 10-minute window makes a naive burst test lie.** After the fix was correct, a 70-request
loop still produced no 429 because it straddled a window boundary and neither window reached 61.
`rate_limit_counters` showed `hits = 60` sitting exactly at the cap — the 61st raises and rolls its
own increment back, so **60 is the ceiling a stored row can ever show**. Check the counter table
before concluding the limiter is broken; only a service-role client can read it.

---

## 4. Supabase CLI — a 403 that is not a permissions bug

Every command returning `403 "Your account does not have the necessary privileges"` reads like a
project permission problem. It is usually the **wrong account**: this repo's project lives in org
`aseszttxkxpfzenmbylx`, while the CLI was signed into `hddilaqjdxaprrcebqet` (DeepHighAI).

- **`supabase orgs list` is the fastest diagnosis.** `projects list` succeeds and simply omits what
  you cannot see, which looks like the project is missing rather than invisible.
- **`supabase login` silently reuses the browser's existing session.** Re-running it changes nothing
  unless you sign out of supabase.com first or use a private window.
- **`--no-browser` wants the 8-character hex device code from the login page, not a PAT.** A pasted
  `sbp_…` token fails with `device_code: must match pattern /^[0-9A-Fa-f]+$/`. A PAT is used by
  exporting `SUPABASE_ACCESS_TOKEN`, never through the login prompt:

  ```bash
  export SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env | cut -d= -f2- | tr -d '\r')
  ```

  (Per shell — it does not persist between Bash tool calls.)

---

## 5. Vite — the `VITE_` prefix trap

Vite only exposes variables prefixed `VITE_`. The root `.env` holds `SUPABASE_URL` /
`SUPABASE_ANON_KEY`, so the web surface saw neither until `VITE_`-prefixed copies were added.

The failure is **indistinguishable from a dead Edge Function**: `functionUrl()` throws *before*
`fetch`, so nothing appears in the network panel. The tell is **`fetchCalls: 0`**.

`apps/web/vite.config.ts` carries `envDir: '../../'` because the single `.env` lives at the repo root.

---

## 6. Jest (jest-expo) — lazy loading

- **Use `require`, not dynamic `import()`.** Without `--experimental-vm-modules`, `await import(…)`
  throws `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`. Write
  `require('expo-file-system') as typeof import('expo-file-system')`.
- **`jest.isolateModules` seals the registry against late lazy requires** — a module that requires
  something *after* the isolate block cannot resolve it. Use a plain `require` plus `resetModules`.
- Mock factory variables must be `mock`-prefixed (`mockGetItem`), or the out-of-scope check rejects
  them. React Native Testing Library in this repo is awaited: `await render(…)`, `await fireEvent…`.

---

## 7. Metro on this Windows machine

Two independent failures, both looking like different bugs:

```bash
cd apps/mobile
CI=1 EXPO_NO_TYPESCRIPT_SETUP=1 npx expo start --dev-client --port 8143
adb reverse tcp:8143 tcp:8143
```

- Port **8081 sits inside a WinNAT excluded range** (`netsh interface ipv4 show excludedportrange
  protocol=tcp`; the range moves per reboot), so Expo reports "port in use" with nothing listening.
- **Watch-mode init times out**, leaving the transformer unconstructed: the server still prints
  "Waiting on http://…" while every bundle request returns InternalError. `CI=1` disables watching
  entirely (no hot reload; reload from the dev menu). `EXPO_NO_TYPESCRIPT_SETUP=1` dodges a fatal
  typed-routes crash.
- Verify with `curl http://localhost:8143/status` → `packager-status:running`, then confirm an actual
  `Android Bundled …` line. "Waiting on" alone does not mean bundles work.
- Emulator driving: use `adb shell input swipe x y x y 80` as a tap (plain `input tap` often does not
  register on the Fabric surface). The emulator clipboard syncs to the host, so a share-sheet copy
  plus PowerShell `Get-Clipboard` extracts invite links.

---

## 8. Fonts

- Pretendard's web fallback metrics were measured with fontaine against the real woff2 (ascent 1950 /
  descent −494 / lineGap 0 / upm 2048 / xWidthAvg 921) and are frozen in
  `apps/web/src/styles/font-fallback.css`: `size-adjust: 100.8762%`, `ascent-override: 94.3878%`,
  `descent-override: 23.9116%`, `line-gap-override: 0%`. Re-measure only if the woff2 changes.
- `assets/fonts/PretendardVariable.woff2` is **web-only**. RN needs 4 static `.ttf` weights
  (400/600/700/800) because Android's variable-font weight axis is unreliable.
- OS-owned surfaces (Alert, date picker, share sheet, push banner) render in the system font. That is
  accepted, not a bug — fixing it would mean replacing every OS dialog with a custom one.

---

## 9. Device artifacts

The Galaxy-compatible ARM64 debug APK used for manual QA:
`C:\Users\batis\AppData\Local\Temp\littlefinger-firebase-debug-arm64-v8a.apk`
(package `com.littlefinger.app`, minSdk 24, targetSdk 36, ABI `arm64-v8a`). x86_64 artifacts are
emulator-only.

Its **local debug certificate differs from the EAS development certificate** published in
`assetlinks.json`, so App Links auto-verification fails with this APK by design. Use it for feature
testing; use a fresh EAS-signed development build for App Links verification. Full QA steps:
[`docs/setup/deeplink-dev-qa.md`](../setup/deeplink-dev-qa.md).

---

## 10. Parallel subagents share the account usage limit

A fleet of subagents burns the shared quota together and dies together, usually mid-edit. Prefer 2–3
agents over 7. After a fleet dies, run `git status` first: files the agents wrote **first** (label
catalogs, new modules) are usually complete and worth keeping, while files they edited **second** are
half-converted — `tsc -p <app>` pinpoints exactly what to finish by hand.

## Never start the release app on a locked Samsung via adb (2026-08-23)

`adb shell am start`/`monkey` while the SM-N981N's screen is off creates a **permanently wedged
process**: Samsung defers network and render commits for an activity started invisible, the
startup awaits park (all threads asleep, no request ever reaches Supabase), and unlocking does NOT
revive it — the user sees a frozen splash ("무한로딩") or a screen whose buttons run their JS
(storage writes persist!) but never commit a frame ("시작하기 무반응"). Both 2026-08-23 field
reports were this one artifact. A fresh user-launched process on an unlocked screen is fully
healthy — verified end to end: onboarding → login → real-Kakao OAuth (`/auth/v1/token` 200) →
promise creation.

Debug recipe that worked: `svc power stayon usb` + wake, ask the PO to unlock once, then screencap
(`exec-out screencap -p`) before/after every remote `input tap` — identical PNG sizes = frozen
commit. `dumpsys window | grep mDreamingLockscreen` tells you whether a capture is contaminated by
the lockscreen. Undo the stay-awake with `svc power stayon false`.

Hardening still worth adding (not yet done): the `_layout.tsx` startup `Promise.all` has no
`.catch` (any rejection = infinite splash) and no AppState-active retry for gates that parked
while the screen was off.

## Shared error codes are baked into every deployed Edge Function (2026-08-26)

Each shell bundles `packages/shared/src/errors.ts` at deploy time, and `_shared/errors.ts` builds
its KNOWN_CODES set from that copy. **Adding a code to shared does nothing for already-deployed
functions** — a stale shell treats the new raise as unknown and flattens it to 500 `E_INTERNAL`,
which the app then renders as the generic "문제가 발생했어요" (its own parser also rejects
unknown codes). Measured with `E_SLOT_LIMIT`: the DB raised it correctly, `slot-status` /
`purchase-verify` (freshly deployed) knew it, but `promise-create`/`promise-invite`/
`promise-draft-update` (deployed before the code existed) returned 500 — on device this looked
like a client bug, and the profile purchase path "working" while the send path "failed" was the
tell. Rule: **when the shared error vocabulary changes, redeploy every function whose RPC can
raise the new code** (grep the migrations for the raise site, then its callers).

## An unmapped Edge failure erases its own cause (2026-08-28)

`_shared/http.ts` `failureResponse` logs an unrecognized raise as
`'unmapped RPC failure'` with `{reason: 'UNMAPPED_ERROR'}` — the raised message never reaches the
log. That is deliberate for the *response* (§9 keeps Postgres table and column names out of it),
but it also means a 500 `E_INTERNAL` from a function's own `throw new Error('…')` leaves **no
diagnosable trace anywhere**. `purchase-reconcile`'s first live run threw
`GOOGLE_VOIDED_PURCHASES_<status>` and the status code was unrecoverable from
`function_logs`, `function_edge_logs`, and the Dashboard alike.

The way around it is a **differential probe**: find a deployed function that shares the failing
dependency but maps its failure to a distinguishable code, and call that instead.
`purchase-verify` shares the service-account OAuth provider with `purchase-reconcile` and answers
an invalid purchase token with 422 `E_VALIDATION` — a response only reachable *after* a successful
Google round trip. One call proved OAuth healthy and moved the whole suspect set onto the
`purchases/voidedpurchases` endpoint — which both needs a Play Console permission
(financial data / orders) that `purchases/products` does not, **and** was called with a `startTime`
of exactly `now - 30 days`, the edge of the window Google accepts. The probe cannot separate those
two, so the cheaper candidate was tested by deploying it: **29 days returned 200 where 30 had
failed**, which answered both questions at once — the boundary was the bug, and the Play Console
permission was there all along. When a status code is unreadable, a one-line change that only one
hypothesis predicts is faster than any amount of log archaeology.

## PGlite is single-connection — lock-order deadlocks cannot be reproduced

The harness (`supabase/tests/harness.ts`) runs one PGlite session, so a test can never hold a row
lock in connection A while connection B takes an advisory lock. The ABBA hazard between
`lf_reward_intent_create` (advisory → intent row) and `lf_reward_grant` (must be the same order)
is therefore pinned by a *definition-order* assertion in
`supabase/tests/monetization-retention.test.ts` ("잠금 순서는 두 경로 모두 약속 advisory lock → intent
행이다") that reads both function bodies with `pg_get_functiondef` and checks the advisory lock
call precedes the `for update`. It proves the source, not the runtime; a real two-connection test
needs a linked project (`supabase/tests/remote/`). Do not "fix" the assertion by rewriting it as a
concurrency test on PGlite — it will pass vacuously.
