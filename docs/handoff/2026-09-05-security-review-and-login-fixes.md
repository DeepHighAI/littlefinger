# Handoff — security review, login-screen fixes, QA APK (2026-09-05)

> **Read `AGENTS.md` (or `CLAUDE.md`, same content) first.** It carries the working agreement, the
> document hierarchy, the domain contract, and the hard constraints. This file only covers what
> happened in this session and what to do next; it does not restate the project rules.

## Goal and current status

The session started as a `/security-review` of the whole codebase (there was no pending diff — the
tree was clean at `5d53ee0`), then continued into the PO's device-QA bug reports and a sideload QA
APK build.

Everything below is **committed and pushed to `origin/main`**; the working tree is clean and
`main...origin/main` is `0 0`. Seven commits, `5d53ee0..9fddd48`:

```
9fddd48 docs: record the generated-native-project env drift
0367d72 feat: gate sign-in on explicit legal consent
66792ea fix: stop button labels clipping at large font scale
7515e49 docs: record the 2026-09-05 security review outcome
2bfa7fc fix: harden mobile OAuth against callback interception
0955412 fix: hide approvals IP and User-Agent hashes from participants
1c38cff fix: gate evidence signing on the retention access boundary
```

Four security findings were confirmed and fixed. Three of the PO's four device-QA bugs are fixed
pending device confirmation. **The fourth (bug 4) is unresolved and is the main open engineering
item** — see *Blocked* below; do not re-investigate from scratch, the negative results are recorded
here.

## Where to work

Two checkouts of this repo exist on the machine and both sit on `c224334`, clean:

```
C:/DEV/littlefinger                         [main]
C:/DEV/littlefinger/.worktrees/supabase-e2e [codex/supabase-e2e]
```

The worktree was 163 commits behind and was fast-forwarded on 2026-09-05; its stale
`apps/mobile/android/app/build` and `.expo` caches (1.2 GB, built from August sources) were deleted,
and its `.env` is a **symlink** to the root `.env`, so the values live in one place. It has its own
`node_modules`. It does **not** have `apps/mobile/.env`, so mobile builds will not work there until
that is linked too — backend and Supabase work is what it is set up for.

Prefer `main` in the primary checkout for ordinary work. Use the worktree when something must run in
isolation from an in-progress edit.

## Files created / modified

**Security — database** (both migrations are **already applied to production**):
`supabase/migrations/20260905000001_gate_evidence_sign_target_record_access.sql`,
`supabase/migrations/20260905000002_restrict_approvals_pii_columns.sql`,
`supabase/tests/evidence-lifecycle.test.ts`, `supabase/tests/promise-detail.test.ts`.

**Security — mobile auth:** `apps/mobile/src/lib/supabase.ts`, `kakao-auth.ts`,
`kakao-auth-native.ts`, `session-gate.ts`, plus `supabase.test.ts`, `kakao-auth.test.ts`,
`session-gate.test.ts`.

**Login screen (SCR-A01):** `apps/mobile/src/app/index.tsx`,
`apps/mobile/src/screens/login-labels.ts`, `apps/mobile/src/screens/scr-a01-login.test.tsx`,
`apps/mobile/src/components/LfButton.tsx`, `apps/mobile/src/components/components.test.tsx`.

**Docs:** `docs/DEVELOPMENT_STATUS.md`, `docs/notes/environment-gotchas.md` (two new sections), and
this handoff (replacing `2026-09-04-pastel-restyle-s7.md`, whose durable facts are all already in
`DEVELOPMENT_STATUS.md`).

**Not tracked by git, changed on this machine only** — important, because git shows nothing:
`apps/mobile/.env` gained `EXPO_PUBLIC_WEB_BASE_URL=https://littlefinger-app.web.app`, and
`apps/mobile/.env.local` (which held a stale override of it) was **deleted**.
`apps/mobile/android/` is gitignored prebuild output; its `versionName` and App Link host were
regenerated. A fresh clone needs its own `.env` files.

## Decisions made and why

- **PKCE, not implicit, on mobile.** `auth-js` 2.110.8 defaults `flowType` to `implicit`
  (`GoTrueClient.js:21`), so the OAuth callback carried a long-lived `refresh_token` into
  `littlefinger://auth-callback` — an exported, unverifiable custom scheme any app can also register.
  The web client already set `pkce`; only mobile was on the default.
- **The EC-A02 retry (1/2/4s) is gone, deliberately.** `auth-js` deletes the `code_verifier` on a
  failed exchange, so a second attempt can only fail with a different, misleading error.
  `AUTH_SESSION_RETRY_DELAYS_MS` is now unused but was **left in `config.ts`** because it is a
  spec-derived constant — removing it is the PO's call, not ours.
- **The session gate refuses a callback when a session already exists**, rather than requiring an
  in-flight flag. An in-flight-only guard would break the legitimate cold-start callback (the app
  process is created by the browser redirect), which existing tests cover. PKCE already makes an
  injected `code` unexchangeable; the session check stops a crafted link from *replacing* a live
  session.
- **`lf_evidence_sign_target` answers the same `E_NOT_FOUND`** for a missing evidence id and for an
  expired-access one, per `02` §9 principle 1. It stays `security invoker`: its caller is the
  service_role client, which already holds execute on `lf_has_record_access`.
- **`approvals` keeps a column grant, not a table grant.** RLS is row-level and cannot hide
  `ip_hash`/`user_agent_hash`; `anon` never passed the policy anyway, so its revoke is a no-op.
- **The consent checkbox is drawn, not iconised.** The Material Symbols subset carries `check` but
  no `check_box` (see `environment-gotchas.md` §1 — subsetting by a missing ligature fails silently).
- **`flexShrink` moved off the button label onto a wrapping `View`,** and `fontWeight` was removed
  from it. Both were added by the pastel redesign (`0860177`). Android answers `flexShrink` on a
  `Text` by cutting the line instead of wrapping it, and `fontWeight` fights the per-weight static
  Pretendard files that `04` §5-4 exists to use.
- **The retired domain was NOT kept in the App Link filter.** It 301s even
  `/.well-known/assetlinks.json`, and Android's verifier does not follow redirects, so that host
  could never verify and adding it would only risk the new host's verification.
- **Tests that read generated files were reverted.** A guard reading `android/app/build.gradle` or
  the generated manifest fails in a clean checkout. The env drift lives in gitignored files and no
  test can catch it, so it was documented in `environment-gotchas.md` instead.

## Verification state

**Passed.** `npm run typecheck` across all five projects. Vitest **113 files / 2,163 tests**.
jest-expo **82 suites / 896 tests** (up from 894 — three added, one replaced). `npm run check:agents`.

Both migrations were pushed with `npx supabase db push` (`upToDate: true` afterwards) and then
verified **live**, because `migration list` only proves the row was recorded:

```
{"ip_hash_open":false,"ua_hash_open":false,"comment_open":true,
 "acted_at_open":true,"sign_target_gated":true}
```

`supabase db dump` cannot run here (needs Docker). Read real remote state with the Management API
instead — the recipe is in `environment-gotchas.md`.

The sideload QA APK was built and content-verified (see *Artifact* below).

**Not verified — needs a device.** The PKCE switch changes the auth protocol on the wire, and the
SCR-A01 layout fixes were diagnosed from a screenshot rather than reproduced. Neither can be
confirmed on this machine.

## Artifact

```
apps/mobile/android/app/build/outputs/apk/release/littlefinger-qa-20260905-9fddd48.apk
113.7 MB   SHA-256 7e454f316c0821680fe0e47a8ea84f4cdd3e7d5ca1942a84eae3b8dc174225b6
```

`apksigner`: `Verifies`, v2 scheme, signer `CN=Android Debug` — **sideload QA only, never a Play
upload build** (`release` uses `signingConfigs.debug`). The Play path is EAS AAB, unchanged.

Verified inside the APK, not in the source: manifest `versionName 0.3.0`, App Link host
`littlefinger-app.web.app` with `autoVerify` and `/i/`; bundle contains the new origin (1) and not
the retired one (0), contains the new consent labels and `OAuth callback code is missing.`, and does
**not** contain the old implicit-flow string `Kakao OAuth callback tokens are missing.`

Build recipe (PATH JDK 25 breaks it — see `environment-gotchas.md`):

```bash
cd apps/mobile/android
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" \
ANDROID_HOME='C:\Users\batis\AppData\Local\Android\Sdk' ./gradlew assembleRelease
```

**On this QA build invite links open the browser, not the app** — the debug certificate
(`FA:C6:17:45…`) is not among the three fingerprints in
`apps/web/public/.well-known/assetlinks.json`. Expected for a sideload build, not a bug.

## Blocked / PO-confirmation items

1. **Device QA (PO).** Kakao and Google sign-in, session survives an app restart, sign-in cancel,
   and the SCR-A01 layout at the device's font/display scale. If text still clips, get the device's
   **설정 → 디스플레이 → 글꼴 크기 / 화면 크기** values — the fix was made scale-tolerant blind, and
   those two numbers are what pin the real dp width.
2. **EC-A02 retry removal (PO).** See the decision above; `AUTH_SESSION_RETRY_DELAYS_MS` is now
   unused.
3. **Bug 4 — unresolved, needs one fact from the PO.** Reported as "after a Kakao user invites and a
   Google user approves, the promise list is empty; probably provider-segregated". **That hypothesis
   is disproved** — participants and access are keyed on UUID and reference no provider, and
   production has a working cross-provider promise (`3efb18e4`: google CREATOR + kakao PARTNER,
   ACTIVE, both `JOINED`, both `lf_has_record_access = true`, `purge_state AVAILABLE`). The home list
   refetches on focus, so it is not a stale-list bug either. **The decisive finding: the last
   `approvals` row is 09-03 17:36 — there are no approvals on 09-04 or 09-05, and no promise or user
   was created on 09-05 at all.** An approval that reached the server always writes a row, so the
   current reading is that the approval never reached the server and the empty list is downstream of
   that. Ask the PO for the approximate time of that test and whether the approval screen showed an
   error, then trace that request.
4. Play Console items from the previous session (screenshot selection and upload, leaked-password
   protection needing Supabase Pro, P6/P7) are unchanged and live in `docs/DEVELOPMENT_STATUS.md`.

## Exact next step

Hand the APK above to the PO for the device pass in item 1, and ask for the bug-4 timestamp in
item 3 at the same time — both are PO-blocking and can run in parallel.

While waiting, the highest-value engineering work is **bug 4**: reproduce the invite → approve flow
against production with two accounts of different providers and watch whether an `approvals` row
appears. If it does, the defect is in the client's post-approval navigation or list query; if it does
not, the defect is in the approval request path (`invite-preview` → `promise-approve`), and the Edge
Function logs for that window are the next place to look. Do **not** start by re-checking RLS,
`lf_has_record_access`, or provider handling — all three were checked against live production data
this session and are correct.

Do not build a Play upload artifact from this branch; the mobile fixes reach users only in a new EAS
build, and that is a separate authorized step.
