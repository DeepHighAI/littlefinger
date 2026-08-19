# Claude Code Continuation Handoff

## Goal and current status

Continue the Littlefinger MVP from local `main` without repeating completed deployment work. The
approved local feature scope is implemented, the test Supabase backend and Firebase acceptance web
are deployed, and a Galaxy-compatible ARM64 debug APK is available. The remaining work is
interactive verification on physical Android devices with two Kakao test accounts, followed by
recording actual PASS/FAIL evidence.

Repository state when this handoff was written:

- Branch: `main`
- HEAD: `0bb7305 fix: build Galaxy-compatible ARM64 APK`
- Intentional untracked user file: `.claude/settings.local.json` — preserve it and do not commit it
- Secondary worktree: `.worktrees/supabase-e2e` on `codex/supabase-e2e`; `main` already contains the
  relevant work, so do not force-remove the worktree
- No push was requested or performed

Completed product and infrastructure work:

- SCR-A00 first-run onboarding, minimum-version fail-open gate, Android `/i/*` App Links contract,
  Kakao authentication edge-copy, account withdrawal/anonymization, nickname update, promise hide,
  user block/report, evidence report/blinding, and J-04/J-06 jobs are implemented.
- Supabase project `vepnrrmxvsytguocicfe` has all migrations through
  `20260818000004_counterpart_push_availability.sql`; all 45 Edge Functions are `ACTIVE` and were
  deployed with `--use-api`.
- J-04 and J-06 same-time double-run checks, RLS active/withdrawn boundaries, and nickname RPC
  checks passed remotely. Supabase Security Advisor has no ERROR and 55 WARN hardening items.
- The acceptance web is live at `https://littlefinger-app-philwoo.web.app` on the existing Firebase
  Spark project. Root, direct `/i/*`, Digital Asset Links, and the Expo intent-filter contract were
  verified.
- The x86_64 APK is emulator-only. The Galaxy-compatible ARM64 debug APK is:
  `C:\Users\batis\AppData\Local\Temp\littlefinger-firebase-debug-arm64-v8a.apk`.
  It is package `com.littlefinger.app`, minSdk 24, targetSdk 36, ABI `arm64-v8a`, and has a valid
  debug signature. SHA-256:
  `67907FDE59C5E9E95F15AA32F7ACB7DA98C199A71845807EF15895E798F2218E`.

## Files created/modified

The completed work is recorded by these recent commits:

- `0bb7305` — Galaxy-compatible ARM64 APK build and ABI verifier
- `b2ecc05` — stale Cloudflare hosting references removed
- `a4afcbb` — final Firebase deployment verification documented
- `205c4aa` — Expo SDK 57 TypeScript alignment
- `19f42d4` — mobile Jest concurrency stabilization
- `bf27eae` — acceptance web moved to Firebase Hosting
- `42b9aab` — local MVP readiness gaps completed

Primary continuation documents and implementation references:

- `docs/DEVELOPMENT_STATUS.md`
- `docs/qa/MANUAL_E2E.md`
- `docs/qa/EC_TRACEABILITY.md`
- `docs/adr/0005-use-existing-firebase-hosting.md`
- `README.md`
- `tools/verify-android-apk-abi.js`
- `tools/verify-android-apk-abi.test.ts`
- This handoff: `docs/handoff/2026-08-19-claude-code-continuation.md`

## Decisions made and why

- Use the existing Firebase Hosting project instead of Cloudflare. It satisfies the free static
  hosting, HTTPS, SPA rewrite, and Digital Asset Links requirements without adding another account.
- Never run `supabase config push`. Supabase Dashboard remains the source of truth for auth config;
  the local config intentionally does not represent the complete provider configuration.
- Deploy Edge Functions only with `npx supabase functions deploy --use-api`.
- Use Android Studio JBR/JDK 21 for local Android builds. System Zulu JDK 25 caused the React Native
  CMake build to fail on restricted Java methods.
- Build physical-device APKs with `arm64-v8a`; `x86_64` artifacts are emulator-only.
- The local ARM64 debug certificate differs from the EAS development certificate published in
  Digital Asset Links. Use the local APK for feature testing, but use a fresh EAS-signed development
  build for final App Links auto-verification.
- Do not optimize the current 535.90 KB JavaScript chunk or 2.06 MB font solely for size. The
  measured slow-4G median LCP is 1.431 seconds, below the approved 3-second threshold.
- Never store or print Kakao credentials, Supabase keys, peppers, invite tokens, device tokens, raw
  IP addresses, or test-account passwords.

## Verification state

Latest completed gates:

- `npm test`: PASS — Vitest 88 files / 1,887 tests; mobile Jest 61 suites / 595 tests
- `npm run typecheck`: PASS
- `npm run build:web`: PASS — 115 modules; 535.90 KB JS / 154.02 KB gzip; chunk warning remains
- `npx expo install --check`: PASS
- `npm run check:agents`: PASS
- Android export: PASS — 1,776 modules; 4.4 MB Hermes bundle
- ARM64 APK build: PASS — 558 tasks; 99,186,411 bytes
- `npm run verify:android-apk -- <apk>`: PASS for `arm64-v8a`
- Slow-4G Lighthouse at 360x800: performance 92/93/93, accessibility 100/100/100, median LCP
  1.431 seconds; CLS 0.1666 remains a visual-quality finding

Not yet verified:

- The 12 two-account scenarios in `docs/qa/MANUAL_E2E.md` are all `NOT_RUN`.
- Installation and launch on Galaxy Note20 and Galaxy S25 have not been recorded.
- Final Android App Links handoff with an EAS-signed build has not been run.
- Real push delivery in foreground, background, and terminated states has not been run.
- Full app/web frozen-reference comparison at 360x800 has not been run.
- Authenticated major-screen timing and approval API p95 have not been measured.

## Blocked / PO-confirmation items

- Two interactive Kakao test accounts and physical devices are required. The operator must enter
  credentials directly; the agent must not request or store passwords.
- Supabase Dashboard must confirm that the Firebase origin and required callback path are present in
  the Auth redirect allowlist. Do this in the Dashboard; never use `supabase config push`.
- A fresh EAS development build uploads project source to Expo. Obtain explicit PO approval for that
  source egress before running it.
- If a device already has `com.littlefinger.app` signed with a different key, uninstalling it may be
  required, but first warn that uninstalling removes local app data.
- Explicitly excluded: final legal review, real AdMob release IDs/consent, Play closed testing,
  trademark/store-name confirmation, full physical TalkBack/production-push validation, and J-07
  automatic metrics/operator alerts.

## Exact next step

1. Confirm `main` is at `0bb7305` or later and preserve `.claude/settings.local.json`.
2. Start the development server when testing the local debug APK:
   `cd C:\DEV\littlefinger\apps\mobile` then `npx expo start --dev-client`.
3. Install `C:\Users\batis\AppData\Local\Temp\littlefinger-firebase-debug-arm64-v8a.apk` on the
   Galaxy Note20 and Galaxy S25. Record install, launch, and ABI results without fabricating them.
4. Confirm the Firebase Hosting origin and callback entries in the Supabase Auth Dashboard.
5. After explicit approval for source upload, create a fresh EAS-signed development APK and verify
   `/i/*` using `adb shell am start`.
6. Execute all 12 scenarios in `docs/qa/MANUAL_E2E.md` with two Kakao accounts, including push,
   360x800 comparison, and authenticated performance checks.
7. Replace each `NOT_RUN` with actual PASS/FAIL and screenshot paths, and update both
   `docs/qa/MANUAL_E2E.md` and `docs/DEVELOPMENT_STATUS.md`. Run proportionate verification before
   committing; do not claim manual checks passed without direct evidence.

## Claude Code startup prompt

```text
Continue the Littlefinger project in C:\DEV\littlefinger from the existing local main branch.

Before making changes:
1. Read CLAUDE.md completely and follow it as the repository authority.
2. Read docs/handoff/2026-08-19-claude-code-continuation.md completely.
3. Read only the relevant sections of docs/DEVELOPMENT_STATUS.md and docs/qa/MANUAL_E2E.md.
4. Run git branch --show-current, git status --short, and git log -10 --oneline. Confirm main is at
   0bb7305 or later. Preserve the user-owned untracked .claude/settings.local.json and do not commit,
   overwrite, or delete it.

The implementation, Supabase migrations, 45 Edge Function deployments, J-04/J-06 checks, Firebase
Hosting deployment, and ARM64 APK build are already complete. Do not repeat remote deployment unless
read-only evidence shows drift. Never run supabase config push. Edge Functions may only be deployed
with --use-api.

Continue from the handoff's Exact next step. First validate the ARM64 debug APK on Galaxy Note20 and
Galaxy S25 while running `npx expo start --dev-client` from apps/mobile. Then confirm the Supabase
Auth redirect allowlist in the Dashboard. Ask for explicit PO approval before any EAS build that
uploads source. Use a fresh EAS-signed development APK for final Android App Links verification.

After device prerequisites are ready, execute all 12 scenarios in docs/qa/MANUAL_E2E.md with two
interactive Kakao test accounts. Never ask for, store, or print account passwords or any secrets.
Record only observed PASS/FAIL results and absolute screenshot paths in docs/qa/MANUAL_E2E.md and
docs/DEVELOPMENT_STATUS.md. Also verify foreground/background/terminated push delivery, the 360x800
frozen-reference comparison, authenticated screen timing, and approval API p95. Do not fabricate
manual results when a device, account, or approval is unavailable; report the exact blocker in
Korean instead.

For Android local builds, use Android Studio JBR/JDK 21 and arm64-v8a. The system JDK 25 is known to
break the React Native CMake build. Warn before uninstalling an existing differently signed app
because uninstalling removes local app data.

Communicate all status reports and questions to the PO in Korean. Keep docs, plans, commit messages,
and code identifiers in English; code comments are Korean. Verify every change before reporting it
complete, quote actual command results, and preserve unrelated worktree changes.
```
