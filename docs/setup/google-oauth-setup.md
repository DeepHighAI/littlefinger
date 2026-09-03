# Google OAuth — setup (operator runbook)

Production login is Kakao + Google SSO (PO, 2026-08-20; CLAUDE.md N-4). The client code and DB
identity generalization ship with the repo; **nothing works until this runbook is executed**,
because the provider credentials live only in Google Cloud and the Supabase Dashboard. Until
then, tapping the Google button fails into the standard EC-A02 retry copy — acceptable while
developing.

## 1. Google Cloud project

console.cloud.google.com → create (or reuse) a project, suggested name `littlefinger-auth`.
No billing account is needed for OAuth.

## 2. OAuth consent screen (APIs & Services → OAuth consent screen)

- User type: **External**.
- App name `리틀핑거`, support email + developer contact `batisututu@gmail.com`.
- Scopes: only the three non-sensitive ones — `openid`,
  `.../auth/userinfo.email`, `.../auth/userinfo.profile`. **Do not add sensitive scopes**;
  these three require no Google verification review.
- Publishing status: keep **Testing** during development (only listed test users can sign in,
  100-user cap, and refresh tokens expire after 7 days — add the Google test accounts under
  "Test users"). Switch to **In production** before release; with non-sensitive scopes the
  switch itself is self-serve (done 2026-09-03, project `littlefinger-506104`), but the console
  then asks for **brand verification** so the consent screen shows the app name and logo instead
  of the Supabase domain. Its automated check requires: the homepage domain verified in Search
  Console by the project owner, a public homepage that explains the app without a login screen,
  and the branding app name equal to the homepage's name (`리틀핑거`). Steps and hand-back items:
  `open-testing-po-guide.md` §4.

## 3. OAuth client (APIs & Services → Credentials → Create credentials → OAuth client ID)

Create **one Web application client**. The mobile app uses this same client — the OAuth code
flow terminates at Supabase's server (Custom Tabs → Supabase callback), not inside the app, so
no Android client ID is needed.

| Field | Value |
|---|---|
| Authorized redirect URI | `https://vepnrrmxvsytguocicfe.supabase.co/auth/v1/callback` |
| Authorized JavaScript origins | `https://littlefinger-app.web.app`, `http://localhost:5173` |

Copy the **Client ID** and **Client secret**.

## 4. Supabase Dashboard (Authentication → Sign In / Providers → Google)

- Enable the provider; paste Client ID and Client secret.
- **Dashboard only — never `supabase config push`** (CLAUDE.md §3: it PATCHes the whole auth
  config from an incomplete local file and can write a literal `env()` string as a client_id).
- Leave **"Skip nonce checks" OFF** — it exists for native iOS ID-token flows; ours is the
  server-side code flow.
- The client secret never enters the repo in any form (same rule as the Kakao keys,
  CLAUDE.md §9).

## 5. Redirect allowlist — verify, don't add

The existing entries already cover both surfaces: `littlefinger://auth-callback` (app) and the
`https://littlefinger-app.web.app/**` wildcard (web). Google needs nothing new.

## 6. Email nuance

Google always returns a verified email and gotrue stores it in `auth.users.email`. This does
not conflict with the Kakao no-email decision: keep **"Allow users without an email" ON** (it
belongs to Kakao login, `docs/setup/email-test-login-removal.md` §2-3), and the product still
never reads the email — `public.users.email` stays NULL and the privacy draft words it as
"인증 제공자가 전달한 이메일은 인증 시스템 외부에 저장하지 않습니다".

## 7. Post-check

1. Dev build (app): tap `Google로 시작하기` → Custom Tabs consent → back in the app signed in.
2. Web: open an invite link → `Google 로그인하고 내용 보기` → lands back on the same invite.
3. Data: `select provider, provider_user_id from public.users` for the new account —
   expect `provider = 'google'` and the Google `sub` value; a Kakao account row is untouched.
4. Withdrawal path unchanged: the anonymized value must match `^withdrawn:[0-9a-f]{64}$`.
