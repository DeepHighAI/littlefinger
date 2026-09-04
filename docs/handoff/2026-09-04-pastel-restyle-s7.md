# Handoff — pastel sticker restyle, session 7 (pre-commit remediation)

## Goal and current status

Apply the PO-approved Claude Design handoff, preserve the supplied Google Play graphics, and close
every finding from the pre-commit code and security review. P0–P5 are implemented in the uncommitted
working tree. The A08 back-navigation defect, E-1 launcher, compact SCR-A03 flow, condition presets,
PENDING card tone, malformed external-link crash surface, exposed `SECURITY DEFINER` helpers, and
150% font-scale layout findings are fixed. The current release APK is installed and verified on the
SM-N981N. The PO has now authorized merging/pushing this scope and creating a Google Play package.
Mobile P8 packaging is in progress as `0.3.0` / remote code 22; P6's full screen-by-screen native
comparison, P7's production web markup port, cross-surface derivatives, and Play Console upload
remain outside this package unit.

## Files created / modified

- Security: `apps/mobile/metro.config.js`, `apps/mobile/metro.safe-query-resolver.js`,
  `apps/mobile/src/lib/query-string-safe.js`, `apps/mobile/src/lib/query-string-safe.test.ts`,
  `supabase/migrations/20260903232317_restrict_security_definer_helpers.sql`,
  `supabase/tests/schema.test.ts`, and `supabase/tests/monetization-retention.test.ts`.
- Accessibility and layout: `apps/mobile/src/components/LfButton.tsx`,
  `apps/mobile/src/app/home.tsx`, their component/home tests, and six screen tests whose touch-target
  assertions now enforce the real minimum instead of an exact height.
- Status treatment: `apps/mobile/src/screens/status-tone.ts` and
  `apps/mobile/src/screens/scr-a05-detail-state.test.ts`.
- Release records: `docs/DEVELOPMENT_STATUS.md` and this handoff.
- Mobile P8: `apps/mobile/app.json`, `apps/mobile/assets/images/splash-icon.png`,
  `apps/mobile/config/firebase-config.test.js`, `tools/export-brand-icons.js`, `DESIGN.md`,
  `docs/adr/0019-e1-face-launcher-icon.md`, and the accepted redesign plan.
- The earlier P5 redesign, E-1 assets, SCR-A03 refinements, ADR/runbook changes, and 23 PO-provided
  Play assets remain in the same working tree. `design-reference/ui-ux/` remains the unmodified,
  untracked user source and must not be staged. The authoritative tracked design request was restored
  exactly from HEAD and has no diff.

## Decisions made and why

- Route every bundled `query-string` import to the local bounded parser. Package overrides could not
  safely replace the vulnerable transitive module without breaking Expo Router's CommonJS/ESM
  contract; the resolver removes that runtime path while preserving the lockfile and router API.
- Cap external query parsing at 8,192 characters and 100 pairs, and treat malformed percent escapes
  as literal input. An external intent must not be able to crash or make parsing unbounded.
- Move the four helper functions from `public` to `private`, deny direct public execution, and grant
  only the RLS/auth runtime roles that call them. Policy and trigger dependencies follow the moved
  function OIDs, preserving behavior while removing Data API exposure.
- Keep the Supabase Auth leaked-password warning documented rather than claiming it can be enabled:
  HaveIBeenPwned protection is unavailable on Free. Production email/password auth is disabled and a
  live password grant returns 422, so Kakao/Google SSO remain the only login paths.
- Use flexible minimum button heights and enough A02 bottom content clearance for dynamic type. The
  design contract is a minimum 48dp target, not an exact fixed height.
- PENDING is neutral paper; yellow remains a positive/attention sticker tone.
- Treat the PO's Google Play packaging request as the accepted P8 build signal. Use version `0.3.0`
  with EAS remote auto-increment code 22, the E-1 splash, and `#FFE59A` notification colour. Build
  with the production profile but do not submit to a Play track without a separate upload action.

## Verification state

- Full `npm test` pass: Vitest 113 files / 2,161 tests and jest-expo 82 suites / 892 tests. The six
  touch-target suites also pass 119/119 in isolation after correcting their minimum-height assertions.
- Five-project `npm run typecheck` passed. The web production build passed with 134 modules; its
  existing 612.77 kB chunk warning remains.
- `npm run check:agents`, `git diff --check`, and the changed-text private-key/API-secret pattern
  scan passed. `package.json`, `package-lock.json`, and the authoritative design request are
  byte-identical to HEAD.
- Release APK built successfully and was installed on physical SM-N981N. At exact 360×800dp and font
  scales 1.0 and 1.5, A02 top/bottom, A08, and A08 → A02 back navigation pass without clipping,
  obstruction, overflow, or fatal Android/React logs. Device font scale and density were restored.
- Malformed-percent and 9,000-character external URL intents did not crash the release app. The
  packaged source map contains `query-string-safe.js`, proving the resolver is in the release graph.
- Migration `20260903232317` is applied to linked project `vepnrrmxvsytguocicfe`. Live metadata and
  local schema tests confirm the four functions are private and privilege-scoped. Security Advisor
  now has 18 intentional server-only INFO findings and one Auth warning; no exposed-definer warning.
- Live auth configuration has email/password disabled and Google/Kakao enabled; a password grant was
  rejected with HTTP 422.
- The current 119,183,345-byte APK passed the four-ABI verifier (`arm64-v8a`, `armeabi-v7a`, `x86`,
  `x86_64`). SHA-256:
  `528F90EBCE819D341CB4C96753A681D48BE3E1128DB5840F342E3E9FF1BD7507`.
- `apksigner` verifies APK Signature Scheme v2 with one signer. The signer is the Android Debug
  certificate, so this APK is valid for sideload QA but must not be treated as a Play upload build.
- `npm audit signatures` verified 1,049 registry signatures and 235 attestations. The cached
  production audit reported zero advisories; the online audit endpoint timed out without a result.
  `npm ls` still confirms the known `decode-uri-component@0.2.2` transitive package, so the runtime
  resolver/source-map/injection evidence—not the audit count—is the basis for this mitigation.

## Blocked / PO-confirmation items

- **PO confirmation required:** choose eight of the ten screenshot numbers for both ko-KR and en-US,
  then upload the E-1 icon, localized feature graphics, and selected screenshots in Play Console.
- Leaked-password protection can only be enabled after a Supabase Pro upgrade. It is not an active
  password-login exposure while the email provider remains disabled.
- P6/P7 and cross-surface derivative work remain open; this does not block packaging the explicitly
  authorized current Android test candidate.

## Exact next step

Run the full gates after the P8 asset/version change, commit everything except
`design-reference/ui-ux/`, push `main`, then launch the EAS production Android build. Download the
code 22 AAB, validate its manifest, permissions, ABIs, signature and SHA-256, record the build in
status/handoff, and push that documentation commit. Do not submit the bundle to a Play track.
