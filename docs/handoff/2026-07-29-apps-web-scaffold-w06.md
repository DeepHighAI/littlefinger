# Handoff — apps/web (scaffold · SCR-W01 · SCR-W06) and the invite-preview deploy

Date: 2026-07-29. Follows `2026-07-27-b1-7-t01-t02.md`, whose recommended next step (option 1,
`apps/web`) the PO chose.

Status: **ten commits landed, all verification green, and `invite-preview` is deployed and verified
against the live project. Nothing is blocked.** The two blockers this document opened with — the
missing `VITE_` env lines and the wrong Supabase CLI account — were both cleared by the PO on
2026-07-29 and are recorded below as history, because both cost a session's worth of confusion.

## Goal of the session

Unblock the verification debt named in the previous handoff: `promise-approve`'s happy path has
never run outside PGlite, and only a working acceptance web can drive it.

## What shipped

| Commit | What |
|---|---|
| `8d7cbc9` | `promise-create` · `promise-invite` (was uncommitted from the prior session) |
| `5ca83af` | the B1-7 handoff doc |
| `601f362` | **`invite-preview`** — migration `20260727000010`, Edge Function, `InvitePreviewResponse`, ADR 0004, 55 PGlite tests |
| `984d78e` | **`apps/web` scaffold** — Vite + React + React Router, styles/font copied, `/i/:token` route, `_redirects` |
| `b44ddb5` | **SCR-W06** — the link-unavailable screen, reason-specific copy |
| `12be8ba` | **the icon font** — self-hosted 40 KB subset, `LfIcon`, Google CDN import removed |
| `e720862` | handoff — the icon-font decision |
| `d176fe6` | **SCR-W01** — invite landing, `invite-resolve`, Kakao CTA, failure routing into W06 |
| `cc373bd` | handoff — SCR-W01 and the env blocker |
| `d4f02d2` | fix: the ad-slot assertion matched `lf-headline` by substring |

## Decisions made

**1. GAP-1 → option (A)** (PO, 2026-07-29). `invite-preview` as a fifth Edge Function over a
`stable` `lf_invite_preview`, rather than writing an INVITED participant row at T-02 (B) or widening
`invite-resolve` (C). Full rationale and the rejected alternatives are in **ADR 0004**.

**2. GAP-5 → `https://littlefinger.pages.dev`** (PO, 2026-07-29), closing C-3 at its default. Fixed
now rather than later because the server keeps no record of the URL it sent and tokens live 72 h.
`.env.example:13` already held this value. Memory: `web-domain-fixed-pages-dev`.

**3. G6·G7·G9·G10 run on the recorded defaults** (PO, 2026-07-29) — see "Still open" for what that
turned out to mean in practice.

**4. SCR-W06's copy comes from `02` §10, not the design reference.** §4-3-3 requires 사유별 문구;
the reference merges four causes into one sentence and names the creator, whom this screen cannot
know (`invite-resolve` returns nothing when it raises). CLAUDE.md §4 puts `02` above the reference.

**5. The 1회용 notice renders only for EXPIRED and USED.** Revoked/blocked/not-found are not fixed by
requesting a fresh link.

## Two things worth not rediscovering

**React was loaded twice, and only the browser said so.** `apps/mobile` pins the React version Expo
requires, so npm nested a second copy under `apps/web`; `react-router-dom` bound the hoisted one and
the app bound the nested one → `Invalid hook call`, blank page. **`tsc` and `vite build` both passed
clean.** Fixed by matching the hoisted range, with `resolve.dedupe: ['react','react-dom']` in
`vite.config.ts` so the next Expo bump cannot reintroduce it.

**Testing Library registers its auto-cleanup only when a global `afterEach` exists.** This repo does
not enable vitest `globals`, so renders accumulate and the second test in a file fails with
"found multiple elements". Every web test file calls `afterEach(cleanup)` explicitly.

Also: `get_page_text` on a Material Symbols ligature returns the literal source text (`link_off`).
That is a text-extraction artifact, **not** a missing font — check `document.fonts` before chasing it.

## Verification state

Run in this session, at the final commit:

```
npm test          → Test Files 25 passed (25) / Tests 911 passed (911)
                    + jest-expo: Test Suites 4 passed, Tests 137 passed
npm run typecheck → exit 0 (5 projects — apps/web joined)
npm run build:web → ✓ built, index.js 242.08 kB (gzip 78.16 kB)
npm run check:agents → AGENTS.md 는 CLAUDE.md 와 동기화되어 있다.
```

Also checked by hand, because no test can: **all 19 `lf-*` classes SCR-W01 uses exist** in the copied
stylesheets. A class that does not exist passes every test and silently breaks only the layout.

Browser (dev server, 360×800): `/nope` renders SCR-W06 with the `link_off` glyph; SCR-W01 renders its
RETRY state correctly (`role="alert"`, `refresh` glyph U+E5D5, EC-C02 copy); **console errors 0**;
**zero non-localhost requests**; Pretendard and the Material Symbols subset both `loaded` and
self-hosted; `.lf-screen` fills 360×800 at `rgb(255,248,248)`.

**Verified against the live project**, after the deploy:

| Check | Result |
|---|---|
| Migration recorded remotely | `"local":"20260727000010","remote":"20260727000010"` |
| `invite-preview`, no auth | **401** — the point is that it is not 500; a 500 means the function failed to boot, i.e. a secret did not resolve |
| `invite-preview`, anon JWT | `{"code":"E_AUTH_REQUIRED","message":"다시 로그인해 주세요."}` |
| `lf_invite_preview` called directly with the anon key | `{"code":"42501","message":"permission denied for function lf_invite_preview"}` |

That last row is the one worth keeping. It proves the **three-way revoke works on real Postgres**, not
just in PGlite — with `from public` alone the function would simply have run.

SCR-W01 was also driven end to end against the live server: `/i/<bogus-token>` produced two real
requests (the 5 ms one is StrictMode's first effect being aborted), the server answered **404
`E_NOT_FOUND`**, and the screen routed to SCR-W06. Browser → live Edge Function → error code → screen
had never been exercised before this.

The READY state renders correctly at 360×800 (countdown ticking, headline, preview card, Kakao CTA at
320×52 dp, no disclaimer — §8-2 does not list W01), verified with a stubbed response because a real
READY needs a valid token, which needs a promise, which needs login.

## Two environment traps, both cleared — keep the diagnosis

Neither was a code problem, and both presented as something else entirely.

**1. `VITE_` env lines (cleared 2026-07-29).** The root `.env` held `SUPABASE_URL` and
`SUPABASE_ANON_KEY`, but **Vite only exposes variables with the `VITE_` prefix**, so the web could
not build a function URL and every screen fell to EC-C02 — a symptom indistinguishable from the Edge
Function being down. Worse, `functionUrl()` throws *before* `fetch`, so nothing appeared in the
network panel either; the tell was `fetchCalls: 0`.

The values are the ones already in the file, just prefixed:

```
grep -E '^(SUPABASE_URL|SUPABASE_ANON_KEY)=' .env | sed 's/^/VITE_/' >> .env
```

`vite.config.ts` carries `envDir: '../../'` because the single `.env` lives at the repo root and Vite
otherwise searches only `apps/web` — without it the values stay empty even once they exist.
**Cloudflare Pages needs the same two as build env vars.**

**2. The Supabase CLI was authenticated as the wrong account (cleared 2026-07-29).** Every command
returned `403 "Your account does not have the necessary privileges"`, which reads like a permissions
bug on the project. It was not: `supabase orgs list` returned exactly one org,
`hddilaqjdxaprrcebqet` (DeepHighAI), while littlefinger lives in `aseszttxkxpfzenmbylx`. **`orgs list`
is the fastest way to diagnose this** — `projects list` succeeds and simply omits what you cannot see,
which looks like the project is missing rather than invisible.

Two things made re-login harder than it should have been, both worth knowing:

- **`supabase login` silently reuses whatever account the browser is already signed into.** Running it
  again changes nothing unless you sign out of supabase.com first, or use a private window.
- **`--no-browser` asks for an 8-character hex device code shown on the login page — not a personal
  access token.** A pasted `sbp_…` token fails with
  `device_code: must match pattern /^[0-9A-Fa-f]+$/`. A PAT is used by exporting
  `SUPABASE_ACCESS_TOKEN`, never through the login prompt. (A token was pasted into a terminal during
  this session and has been revoked.)

## PO 확인 필요

Raised and still unanswered. GAP numbering follows the brief presented on 2026-07-29.

| # | Item |
|---|---|
| G2 | SCR-W03's primary CTA vs EC-I03 (iOS install banner suppressed). Copy exists — EC-I03 `02:1182`. Only the CTA slot is open |
| G3 | W03's reminder email has no endpoint; the `users update own` policy exposes every column, incl. `email_verified` and `status` |
| G4 | The 거절 / 수정 제안 terminal screen has no SCR-ID, no reference, no copy. Two strings needed |
| G8 | W03's stamp is missing 확정 라벨 · 증인 서명 현황 · [버전 이력 보기]; version history has no read slug |
| G9 | `02` contradicts itself on EC-B10's copy (§4-3-4 vs §10). The server already picked §4-3-4 |
| G11 | The Play Store link has no URL and §4-4-4 wants UTM/Referrer on it |
| ① | Rate limit on `invite-preview`? One account with a link can re-read the full text unbounded, with no counter and no log |
| ② | EC-B02 — a participant re-opening a used link should land on the promise detail. Needs a routing contract, not a fix to one function |
| ③ | **A SUSPENDED account cannot read a promise but can still approve it.** `lf_invite_preview` calls `lf_assert_actor`; `lf_promise_approve` / `-decline` / `-amend_suggest` only check existence. Pre-existing; needs a new migration |

**New, found while building:**

| # | Item |
|---|---|
| ~~④~~ | ~~G6~~ **Closed 2026-07-29** (PO: `material-symbols` npm package, CDN import removed). See "Icons" below |
| ⑤ | SCR-W06's title (`이 링크는 더 쓸 수 없어요`) and the 1회용 notice come from the design reference, not from `02`. They are not contradicted by the spec, but they are not spec-sourced either. **SCR-W01 has five more of the same kind**: `안에 확인해 주세요` · `약속 미리보기` · `자세한 내용은 로그인 후 볼 수 있어요` · the service one-liner · `앱 설치 없이 3분이면 끝나요`. Only the CTA is in 디자인요청서 §5-2 |

**From SCR-W01 (2026-07-29):**

| # | Item |
|---|---|
| ⑥ | **The RETRY screen says "다시 시도해 주세요" and gives nothing to press.** No button label exists in `02`, `01` or the 디자인요청서, so none was invented. This bites in practice: the KakaoTalk in-app browser often shows no reload control. Give a label and it drops straight into an existing `lf-btn` |
| ⑦ | **The loading state has no text for a screen reader.** `role="status"` wraps zero characters. `.lf-sr-only` already exists (`base.css:66`) — only the wording is missing |
| ⑧ | **Offline has no copy of its own**, so a dropped connection is reported with EC-C02, which says the server had a problem. It did not |
| ⑨ | **LOADING and RETRY have no `<h1>`.** Both fill the screen; promoting RETRY's body to a heading is a design call (`lf-title--web` vs `lf-body--secondary`), not a mechanical one |
| ⑩ | **A witness reaching SCR-W01 has no copy.** `invite-resolve` returns `target_role`, and §4-5-2 sends witnesses down the same link, but no witness headline exists (EC-D05 fixes only the exposure limit). The field is read and deliberately unused |

## Icons — settled, and why the obvious way fails

`commit 12be8ba`. **Do not try to subset Material Symbols by ligature name.** Every icon name is
spelled from `a-z` and `_`, so retaining those letters makes harfbuzz close over `liga` and keep
every ligature they can form — the whole ~3,000-icon set. Measured: 5220 KB → 4655 KB, 11%.

Resolving the names to their PUA codepoints first removes the problem, because a codepoint is not
the input to any ligature and the closure has nowhere to spread: **5220 KB → 39.9 KB for 34 icons.**
`tools/subset-icon-font.js` resolves names through the font's own GSUB (fontkit `layout()`), writes
the subset and a generated `apps/web/src/components/icon-codepoints.ts`, and **throws** rather than
skipping a name it cannot resolve. Re-run it only when the icon list changes.

Consequence for every screen: **icons go through `LfIcon`, never a raw span** — the markup carries a
codepoint, not a readable name. `<LfIcon name="link_off" />`. This matches what CLAUDE.md §5-4
already requires of the app side.

`apps/web/src/styles/tokens.css` now differs from `design-reference` in **exactly one place** — the
Google Fonts `@import` at the original line 9 is gone, replaced by a comment saying where its two
passengers went (`styles/icons.css`, `@fontsource/roboto-mono`). Every other line is identical, so
the diff-against-original check still works.

Verified in the browser: `performance.getEntriesByType('resource')` shows **zero** non-localhost
requests, and `link_off` (U+E16F) renders at 42 px.

## SCR-W01 — what it does, and the one thing it cannot do yet

`commit d176fe6`. `/i/:token` → `invite-resolve` on mount → creator nickname, promise title, expiry
countdown, Kakao CTA. All five link-failure codes hand straight to `<ScrW06LinkExpired reason=… />`.

Three decisions inside it that a reader will otherwise re-open:

- **The headline could not follow the reference.** `scr-w01-invite-landing.html` greets the
  *recipient* by name ("민준님, 지우님이 새끼손가락을 내밀었어요!"), and before login there is no
  identity and the server sends none. 디자인요청서 §5-2's "○○님이 약속을 보냈어요" is used instead.
  Reviving the reference line means moving it to a post-login screen.
- **`E_RATE_LIMIT` renders its §2-3 sentence, not SCR-W06.** Sending it to W06 would tell the user
  the link is dead when it will work in a few minutes. Same root as item ①.
- **The countdown hides at zero but the CTA stays.** Expiry is the server's decision (EC-F09); closing
  the screen on device time would lock out a valid invite on a fast clock. The cost is that such a
  user logs in and is refused at SCR-W02 instead.

**After login the user comes back to SCR-W01, not forward.** `redirectTo` is the same invite URL and
there is nothing to branch to yet. When SCR-W02 exists, the mount effect should check
`getSupabase().auth.getSession()` and, when a session is present, go to W02 —
or SCR-W05 when `target_role === 'WITNESS'`. **Until that lands the flow is an infinite landing**,
and it is the first thing to fix.

## The exact next step

**SCR-W02 (약속 검토), against `invite-preview`.** The server side is built and committed
(`601f362`, ADR 0004) and needs only the deploy above. The screen is the conversion screen the whole
milestone exists for.

**`invite-preview` is deployed and verified live** (see the table above), so nothing blocks this.

Order of work:

1. Branch SCR-W01 on session presence so login lands on W02 (see above). Until this exists the flow
   is an infinite landing.
2. Build SCR-W02 from `design-reference/screens/web/scr-w02-promise-review.html` against
   `InvitePreviewResponse`. `LEGAL_DISCLAIMER` belongs on this screen (CLAUDE.md §8-2) — render the
   constant through `LfDisclaimer`, which does **not** take text as a prop.
3. Its 거절 / 수정 제안 actions land on a screen that does not exist and has no copy — **item G4**.
   Get those two strings before wiring the actions, or the buttons have nowhere to go.

Then the real prize, and the one piece of verification debt still outstanding: **`promise-approve`'s
happy path has still only ever run in PGlite.** Closing it needs a real Kakao login, which needs the
Dashboard side configured — provider keys, the two separate redirect allowlists (`§6-1`), and a 비즈 앱
with `account_email` registered as [선택 동의]. Without that last one Kakao rejects the authorize
request with **KOE205** before the consent screen renders, regardless of the fact that this product
does not collect email.
