# Email test login — production removal runbook

The dev-only email/password login exists for E2E testing on emulators and local web, where two
interactive Kakao sessions are impractical. **Production login is Kakao + Google SSO only**
(PO, 2026-08-20; Google provider setup is separate, not-yet-implemented work). When the PO asks
to exclude email login for the real-service release, follow this document — it is designed so
that step 1 is already true and only the server-side steps need hands.

## 1. Client — nothing to remove, verify the gates

Both surfaces exclude the test login **at build time**, so no code change or flag is needed for
a production build:

| Surface | Gate | Where |
|---|---|---|
| App (SCR-A01) | `__DEV__` — false in every release bundle | `apps/mobile/src/app/index.tsx` |
| Acceptance web | `import.meta.env.DEV` — false in `vite build` | `apps/web/src/components/test-login-form.tsx` |

Both gates are locked by tests. Verify:

```bash
cd apps/mobile && npx jest src/screens/scr-a01-login.test.tsx -t "카카오와 Google 뿐"
```

That test renders SCR-A01 with `__DEV__` forced off (release-bundle conditions) and asserts the
only login affordances are Kakao and Google. `apps/web/src/components/test-login-form.test.tsx`
covers the web gate the same way.

Optional belt-and-braces check on the web artifact — the label string must not survive the build:

```bash
npm run build:web && grep -r "테스트 로그인" apps/web/dist && echo LEAKED || echo CLEAN
```

## 2. Server — the part that does NOT disappear by itself

Client gates hide the UI, but GoTrue still answers `grant_type=password` for existing accounts
as long as the Email provider is on. At release time:

1. **Supabase Dashboard → Authentication → Sign In / Providers → Email → disable.**
   Dashboard only — **never `supabase config push`** (it PATCHes the entire auth config from an
   incomplete local file; see CLAUDE.md §3).
2. **Delete the test accounts** (`test@test.com` … `test10@test.com`) in Dashboard →
   Authentication → Users. Their E2E promises stay readable to counterparts per the S-14
   anonymization design; if a clean slate is wanted instead, this is a test project decision,
   not a data-retention question.
3. Keep "Allow users without an email" **ON** — that setting belongs to the Kakao no-email
   decision (CLAUDE.md §6-1), not to the email provider.

## 3. Post-check

With the provider off, a password grant must fail:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "https://<project-ref>.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: <anon-key>" -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test@test.com"}'
# expect 4xx (e.g. 400 email_provider_disabled), not 200
```

Then run the §1 checks once more against the release artifacts.
