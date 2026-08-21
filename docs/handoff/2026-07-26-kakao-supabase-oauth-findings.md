# Handoff — Kakao × Supabase Auth setup, verified

> **정정 (2026-08-22).** 이 문서는 `CLAUDE.md` §6-1 과 `supabase/config.toml` 이 Dashboard auth
> 설정의 근거로 가리키기 때문에 보존한다. 2026-07-26 이후 바뀐 네 가지는 아래가 이깁니다:
>
> 1. **호스팅은 Firebase Hosting** — `https://littlefinger-app-philwoo.web.app` (ADR 0005).
>    본문의 Cloudflare Pages·`*.pages.dev` 서술은 폐기됐다. 리다이렉트 허용목록에도 이 오리진을
>    넣는다.
> 2. **C-3(도메인)은 종결** — 커스텀 도메인을 사지 않고 위 무료 오리진을 쓴다.
> 3. **SCR-W03 리마인드 이메일 필드도 MVP 제외** (PO 2026-07-29). 본문 "still specced. Do not
>    delete it" 는 그 결정 이전 서술이다.
> 4. **프로덕션 로그인은 카카오 + Google SSO** (PO 2026-08-20). Google 쪽 설정은
>    [`docs/setup/google-oauth-setup.md`](../setup/google-oauth-setup.md).

Date: 2026-07-26. Researched with official docs, then **adversarially verified by three
independent reviewers (Kakao console / Supabase Auth / Expo deep-linking lenses). All three
refuted the first draft.** What follows is the post-correction answer; every claim below survived
at least two reviewers.

## The one thing that will bite first

**비즈 앱 (Biz App) 전환은 선택이 아니라 필수다.** Not "if you want email" — *at all*.

Supabase's gotrue hardcodes the Kakao scope list in `internal/api/provider/kakao.go`:

```go
oauthScopes := []string{"account_email", "profile_image", "profile_nickname"}
```

Dashboard scope settings only **append**; `account_email` cannot be removed. If that consent item
is not configured, Kakao rejects the authorize request with **KOE205** — before the consent screen
even renders. The login never reaches Supabase, so the "Allow users without an email" toggle cannot
save you. (Refs: supabase/supabase #36878, #29917 — still open.)

`account_email` requires Biz App. Therefore: **no Biz App → no Kakao login at all.**

The PO has a business registration number, so use `[앱] > [일반] > [비즈니스 정보] > [사업자 정보 등록]`.
(Two reviewers noted a **개인 개발자 비즈 앱** path exists without a registration number — irrelevant
here, but it means the `04` §13 C-1 framing was wrong on the merits too.)

## Redirect URIs — where each one goes

Kakao only accepts HTTP/HTTPS, so the app deep link and web origins go in **Supabase's** allowlist,
not Kakao's. These are two different lists. `04` §8's "3종 등록" wording conflates them.

### Register in Kakao — `[앱] > [플랫폼 키] > [REST API 키] > [리다이렉트 URI]`

```
https://vepnrrmxvsytguocicfe.supabase.co/auth/v1/callback
```

That is the **only** required entry. Path is exactly `/auth/v1/callback` (verified by all three
reviewers). Byte-for-byte match or Kakao returns **KOE006**.

If you use the Supabase CLI locally, add **both** of these — `supabase start` prints `127.0.0.1`
while the docs say `localhost`, and Kakao matches literally:

```
http://localhost:54321/auth/v1/callback
http://127.0.0.1:54321/auth/v1/callback
```

Max 10 URIs per key. HTTP and HTTPS are separate entries. No arbitrary path parameters.

### Register in Supabase — `Authentication > URL Configuration > Redirect URLs`

```
littlefinger://auth-callback
littlefinger://**
https://littlefinger-app-philwoo.web.app/**
https://littlefinger-app-philwoo.web.app
```

Two corrections the reviewers insisted on:

- **Wildcard rule**: Supabase treats `.` and `/` as separators. `*` cannot cross them, only `**`
  can. So `https://host/**` matches `https://host/` but **not** `https://host` (no trailing
  slash). Register the bare origin separately.
- **Drop `exp://127.0.0.1:8081/--/**`.** Expo's own docs say Expo Go cannot be used for OAuth
  because the scheme is not customizable, and on a physical device `makeRedirectUri()` returns the
  Metro LAN IP anyway, which that pattern cannot match. Use a development build
  (`npx expo run:android` or an EAS dev client).

### Site URL

Set it to the **app** deep link, not the web origin: `littlefinger://login-callback/`.

Site URL is the fallback when `redirectTo` is missing or unmatched. The acceptance web is a
**no-login surface** by design (§2), so a mobile callback falling back to a web origin drops the
session silently — the user lands on a Cloudflare page instead of returning to the app. That
failure mode has no error message, which is what makes it expensive to debug.

## Consent items — `[카카오 로그인] > [동의항목] > [개인정보]`

| 항목 | scope | 필요 권한 |
|---|---|---|
| 닉네임 | `profile_nickname` | 기본 제공 |
| 프로필 사진 | `profile_image` | 기본 제공 |
| 카카오계정(이메일) | `account_email` | **비즈 앱** |

**Set `account_email` to [선택 동의] AND turn Supabase's "Allow users without an email" ON.**

The reviewers split on 필수 vs 선택, but converged on the toggle: even with 필수 동의, a Kakao
account registered by phone number may carry no email, and then gotrue's
`external.go` returns `Error getting user email from external provider` (HTTP 500). The toggle is
the only thing that prevents that. 선택 동의 also matches `User.email: string | null` and avoids
signup drop-off — the project sends nothing by email today (push is Expo, invites are KakaoTalk links).

## Client Secret

`[앱] > [플랫폼 키] > [REST API 키] > [클라이언트 시크릿]`. Per Kakao's own docs, newly created keys
**ship with it already enabled** — just copy the existing 코드. The older "코드 생성 → 활성화 ON"
sequence no longer applies to new apps.

- Supabase `Kakao Client ID` ← the REST API 키
- Supabase `Kakao Client Secret` ← that 클라이언트 시크릿 코드

OpenID Connect stays **OFF** — it is only needed for `signInWithIdToken`, and this project uses
`signInWithOAuth`.

## Two implementation landmines for M1 (all three reviewers flagged these)

### 1. `openAuthSessionAsync` alone never stores a session

With `detectSessionInUrl: false`, nothing parses the returned URL. Login appears to succeed and
`getSession()` stays `null` forever, with no error. Required, per Supabase's native-mobile-deep-linking doc:

```ts
WebBrowser.maybeCompleteAuthSession();               // module scope

const createSessionFromUrl = async (url: string) => {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);
  const { access_token, refresh_token } = params;
  if (!access_token) return;
  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return data.session;
};

const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
if (res.type === 'success') await createSessionFromUrl(res.url);

const url = Linking.useLinkingURL();                 // cold start
if (url) createSessionFromUrl(url);
```

Import: `import * as QueryParams from 'expo-auth-session/build/QueryParams'`.

### 2. `expo-secure-store` cannot hold a Supabase session directly

SecureStore caps values at **2048 bytes**; a Supabase session (JWT + refresh token) exceeds it.
Supabase's official Expo tutorial uses a `LargeSecureStore` adapter: an AES-256 key lives in
SecureStore, the ciphertext lives in AsyncStorage.

**This qualifies `CLAUDE.md` §6's flat "sessions are stored in `expo-secure-store`."** The intent
holds (the key never sits in plaintext AsyncStorage) but the mechanism is a hybrid, and writing it
the naive way fails at runtime. Also required: `autoRefreshToken: true`, `persistSession: true`,
and an `AppState` listener calling `supabase.auth.startAutoRefresh()` / `stopAutoRefresh()`.

Also: `app.json` needs `{"expo": {"scheme": "littlefinger"}}` **plus a native rebuild**
(`npx expo prebuild`). It will not take effect over OTA.

## One more thing to check before M1

A reviewer noted Supabase's current docs show clients created with an `sb_publishable_...` key
rather than the legacy `anon` JWT. `CLAUDE.md` §9 and `.env.example` both say `anon`. **Verify
which key type project `vepnrrmxvsytguocicfe` issues** before hardcoding either.

## PO 확인 필요

1. **`account_email` 동의 단계** — 선택 동의 recommended above. Confirm.
2. **C-3 도메인** — the Cloudflare Pages subdomain is needed to finish the Supabase allowlist.
3. `02` §2-3 says both "count by code point" and "emoji counts as 1". Those are **mutually
   exclusive** — a family emoji is 5 code points but 1 grapheme. Current code counts code points.
   Resolving toward "emoji = 1" needs `Intl.Segmenter`, which is exactly the ECMA-402 surface where
   Hermes has gaps, so it needs device verification before adoption. Not changed as a side effect.

---

## PO decisions, 2026-07-26 (these close the questions above)

**`account_email`: do not collect.** Register it in the Kakao console as **[선택 동의]** — that
registration is not optional, since without it Kakao returns KOE205 and login fails outright — and
turn Supabase's **"Allow users without an email" ON**. The app never stores or reads the value.
`User.email` keeps `string | null`. Email reminders (F-05, EC-G03) are **out of scope**.

Scope note: this covers the Kakao-provided email only. The reminder email a web participant types
themselves on SCR-W03 (`02` §5-3) is a different field and is still specced. Do not delete it.

**Character counting: code points.** `02` §2-3 demands both "count by code point" and "emoji counts
as 1", which cannot both hold — measured, 👍 is 1 code point but ❤️/🇰🇷/👍🏽 are 2 and 👨‍👩‍👧 is 5.
Code points win; grapheme counting needs `Intl.Segmenter`, an ECMA-402 surface where Hermes has
gaps, and would have to be mirrored server-side. Revisit at M4. `codepointLength` is unchanged.

**Hosting stays Cloudflare Pages.** Raised again this session: Vercel is excluded because its free
Hobby plan forbids ad-monetized commercial services, not because of anything to do with domains —
both platforms hand out a free subdomain. Settled in `03` §6, `04` §2, ADR 0002. Open issue C-3 is
only about whether to *buy* a custom domain; the default remains the free `*.pages.dev` address.

## Still blocking

- **C-3** — the Cloudflare Pages subdomain is needed to finish the Supabase redirect allowlist.
- Verify whether project `vepnrrmxvsytguocicfe` issues a legacy `anon` JWT or an
  `sb_publishable_...` key; `CLAUDE.md` §9 and `.env.example` currently assume `anon`.
