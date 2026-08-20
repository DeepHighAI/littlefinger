# Handoff — Google SSO shipped; remaining dev items F–K pending

## Goal and current status

PO-approved plan (2026-08-20): Google login + GCP guide + remaining dev items. Parts A–E are
**done, tested, committed** on local `main` (no push). Parts F–K and the deploy step M remain.
The full plan lives at `C:\Users\batis\.claude\plans\witty-fluttering-alpaca.md`; the essentials
are restated below so this file alone suffices.

Session verification state at handoff: `npm run typecheck` PASS; vitest full suite PASS
(89 files); mobile jest PASS (63 suites / 624 tests); working tree clean at `ad0fdad`.

## Done (commits this session)

- `5ade563` **Part A** — `users.kakao_id` → `provider_user_id` + `provider` column
  (migration `20260820000003_provider_identity.sql`, NOT yet deployed), `lf_user_stub` /
  `lf_user_provision` (now reads kakao+google identities) / `lf_account_withdraw` (param renamed,
  drop+create) re-created; `account-withdraw/runtime.ts` reads the new column with a legacy
  kakao_id fallback so the function may deploy before the migration.
- `c9f8fae` **Part B** — mobile Google login: `signInWithGoogle` in kakao-auth(-native).ts,
  google LfButton variant + `leading` prop + GoogleMark, SCR-A01 button; tokens google/onGoogle/
  googleBorder mirrored in all three targets (count test 92→95). Release-bundle guard test now
  "카카오와 Google 뿐" (the email-removal runbook command was updated to match).
- `540fb03` **Part C** — web Google login: `signInWithGoogle` twin, buttons on W01/W04/W05 with
  shared `google-mark.tsx`, `.lf-btn--google` CSS (+design-reference mirror), W03 copy
  provider-neutral, legal drafts name Google + auth-layer email nuance.
- `80f4777` **Part D** — `docs/setup/google-oauth-setup.md` (operator runbook) + spec 02
  amendments (§4-1-1, §4-1-3.1, §6-2, §6-5, EC-A05) + CLAUDE.md N-4 closed + AGENTS.md sync.
- `ad0fdad` **Part E** — F4 fix: root gate defers the `/home` replace until the push-destination
  restore settles; `restore()` now returns whether it navigated. Tests added.

## Exact next steps (in order)

1. **Part M(1/2) — deploy** (needs `export SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env | cut -d= -f2- | tr -d '\r')`
   in every shell; CLI account flips otherwise):
   a. `npx supabase functions deploy account-withdraw --use-api` (tolerant version, deploy FIRST)
   b. `npx supabase db push` (applies `20260820000003`)
   c. Live-verify: withdraw one disposable test account (or skip), Kakao provision intact
      (`select provider, provider_user_id from users` via `db query --linked`).
   d. Later cleanup commit: drop the kakao_id fallback in `account-withdraw/runtime.ts`.
2. **Part F — FAILED evidence tile remove**: `apps/mobile/src/app/fulfillment/[promise_id].tsx`
   `LocalEvidenceTile` (~L362-381) renders retry XOR remove; for `status==='FAILED'` render both
   (remove keeps `styles.evidenceRemove`; add an offset style for retry). Test in
   `scr-a06-fulfillment-check.test.tsx`: both buttons present, remove drops the tile.
3. **Part G — F7 upload hardening**: `npx expo install expo-file-system` (new dep). New pure
   module `fulfillment-evidence-file.ts`: copy picker `content://` URI to cache `file://`
   (new File/Paths API), fall back to the original URI on copy failure; wire into
   `uploadFulfillmentEvidence` (`fulfillment-native.ts` L117-139). 2 tests.
4. **Part H — focus refresh**: `profile.tsx` mount-load → `useFocusEffect`; `home.tsx` refocus
   refreshes the selected tab via the existing `refresh:true` path, first focus skipped via ref.
   Extend the expo-router mocks with `useFocusEffect` + a `triggerFocus()` handle.
5. **Part I — spec §13 guard tests**: new `supabase/tests/spec13-guards.test.ts` — no
   promise-update/delete endpoint; no ad lib in apps/web; no payment/escrow deps in the four
   package.json; no email-sending libs in functions; ENDPOINT ↔ function dirs 1:1.
6. **Part J — Security Advisor hardening**: migration `20260820000004` — `alter function … set
   search_path=''` for the ~37 unpinned functions (ALTER preserves ACLs; only rewrite bodies that
   break); RLS init-plan rewrites (`(select auth.uid())`) generated from live `pg_policies` in
   PGlite (don't trust original SQL files — some policies were dropped later); revoke
   anon/authenticated verbs that no policy grants (KEEP SELECT on `app_configs`, `promises`,
   `approvals` — client PostgREST reads). New `security-hardening.test.ts` (proconfig sweep,
   grants-vs-policies, init-plan shape). Then deploy with db push.
7. **Part K — web CLS/SEO**: move `PretendardVariable.woff2` to `apps/web/public/fonts/`, update
   `@font-face` src; `index.html` font preload + meta description + og tags + theme-color (no
   chunk splitting); `font-fallback.css` with fontaine/capsize-computed metrics +
   `--lf-font-brand` gains 'Pretendard Fallback' IDENTICALLY in design-reference and web
   tokens.css (parity test); `seo.test.ts` guard. Fallback-metrics step is a design-token value
   change — flag it in the report.
8. **Codex gate**: after J deploys, report the backend surface (migrations 20260820000003/4,
   account-withdraw shell) for the PO-driven Codex pass.

## Verification per step

`npm test && npm run typecheck && npm run check:agents`; mobile-only steps also
`cd apps/mobile && npx jest <file>`. One logical commit per part (see the five commits above for
message style).

## Blocked / PO items

- Operator: run `docs/setup/google-oauth-setup.md` (GCP OAuth client + Supabase Dashboard
  provider). Until then the Google buttons fail into EC-A02 copy by design.
- 법무 검토 of the amended legal drafts before launch (existing N-1-style pre-launch item).
