# Handoff — apps/web (scaffold · SCR-W01 · SCR-W06) and the invite-preview deploy

Date: 2026-07-29. Follows `2026-07-27-b1-7-t01-t02.md`, whose recommended next step (option 1,
`apps/web`) the PO chose.

Status: **fourteen commits landed, all verification green, `invite-preview` deployed and verified live,
and the acceptance web now runs SCR-W01 → W02 → W03.** The two environment blockers this document
opened with — the missing `VITE_` env lines and the wrong Supabase CLI account — were cleared by the
PO on 2026-07-29 and are kept below as history, because both cost a session's worth of confusion.

**G4 is closed** (`8d3ea01`): the PO approved both sentences on 2026-07-29, and 거절 · 수정 제안 ·
[종료일 변경 요청하기] are wired to their live endpoints. A partner can decline, and an EC-B10 promise
is no longer trapped in PENDING. **Nothing blocks the flow now except the Kakao Dashboard setup.**

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
| `1271b4d` | handoff — the `invite-preview` deploy |
| `8fe2e29` | handoff — SCR-W02 and SCR-W03 |
| `8d3ea01` | **G4 closed** — 거절 · 수정 제안 wired, `response-complete.tsx`, per-endpoint idempotency keys |
| `3566a47` | **W01 session branch · SCR-W02 · thin SCR-W03** — `LfDisclaimer`, `api-failure.ts`, `PromiseApproveResponse`, `formatKstDateTime`, routes `/i/:token/review` and `/i/:token/done` |

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
npm test          → Test Files 28 passed (28) / Tests 987 passed (987)
                    + jest-expo: Test Suites 4 passed, Tests 137 passed
npm run typecheck → exit 0 (5 projects — apps/web joined)
npm run build:web → ✓ built, index.js 463.66 kB (gzip 135.49 kB) — see the W02/W03 section on this growth
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

## SCR-W02 · SCR-W03 (2026-07-29)

`commit 3566a47`. W01 now resolves the invite and reads the session together; a PARTNER with a
session is handed to `/i/:token/review`. **A witness stays on W01** — SCR-W05 does not exist and no
witness copy exists anywhere, so there is nowhere honest to send them.

W02 renders §4-3-4 from the live `invite-preview`, gates 승인 behind the 오수락 방지 confirmation
sheet (F-03), and applies §4-3-4's EC-B10 wording when the end date has passed. `LfDisclaimer` takes
**no props** and renders the constant — §8-2's four places, of which the web owns two.

W03 is deliberately thin: stamp, KST confirmation time, both approval rows with full dates (§4-3-6 +
EC-F09), fingerprint, disclaimer. **Absent on purpose**, each with a comment naming its blocker: the
reminder-email card (G3), [버전 이력 보기] (G8), the app-install CTA (G2/G11).

### Verified, and not

`npm test` 966 passed (27 files) + jest-expo 137 · `typecheck` exit 0 · `build:web` ok.

**Browser: the session guard is confirmed** — entering `/i/:token/review` without a session bounces
back to W01. **The READY states of W02 and W03 have never been seen in a browser.** Faking a session
in `localStorage` does not survive supabase-js's own client, so it falls to EC-C02. They are covered
by 32 tests and by the implementing agent's own render check, but nobody has verified them by eye at
360×800. That becomes a one-minute check the moment Kakao login works.

**The bundle grew 234 kB → 460 kB (gzip 134 kB)** when W02 started using the session — supabase-js's
auth code entered the graph. Against the 3-second budget this deserves a look before launch.

## PO 확인 필요 — added 2026-07-29 (W02/W03)

| # | Item |
|---|---|
| ~~G4~~ | **Closed 2026-07-29** (`8d3ea01`) — the PO approved both sentences and the three actions are wired. See the G4 section below. |
| ⑪ | **Reloading or directly opening W03 shows a blank screen.** The approve response exists once (the invite becomes USED) and there is no re-read path — that is SCR-W04, which does not exist. No copy describes the situation, so it was left empty |
| ⑫ | §4-3-4's 증인 사용 예정 여부 has no copy of its own. `witness_enabled=true` shows §4-2-1's line; `false` shows nothing. Confirm whether the false case needs wording |
| ⑬ | §4-4-4 item 3's 재접근 안내 is omitted on W03 — the copy exists in `02`, but with no SCR-W04 it would promise a route that does not exist |
| ⑭ | `.lf-avatar` has no `object-fit`, so a non-square profile image stretches. Fixing it means editing the frozen stylesheet. An `onError` initial fallback is in place |
| ⑮ | W02's headline and field labels come from the reference HTML, not `02` — same class as items ⑤ and ⑩ |
| ⑯ | W02's loading state wraps zero characters in `role="status"` — same as W01's item ⑦ |
| ⑰ | **W02's RETRY screen has nothing to press, and `E_AUTH_REQUIRED` lands there.** The user is told to log in again with no way to do it; unlike W01, no CTA slot is specified for this screen |

## G4 — closed, and what it left open

`commit 8d3ea01`. The PO approved both sentences on 2026-07-29; they are rendered **verbatim** and
were diffed codepoint by codepoint by two reviewers. 거절 → `promise-decline`, 수정 제안 →
`promise-amend`, and **[종료일 변경 요청하기] runs the same function under the same conditions as
[수정 제안]** — §4-3-4 makes them one path, and it is the only exit a lapsed promise has.

Two things worth not rediscovering:

- **One `Idempotency-Key` per screen is wrong.** `lf_idempotency_begin` binds a key to
  (user, endpoint) and raises `E_FORBIDDEN` on a mismatch (`20260726000004_idempotency.sql:94`), so
  three actions sharing one key means the **second one is refused**. Keys are per endpoint, minted
  once on screen entry — not per render, which would defeat the mechanism entirely.
- **The outcome rides the URL, not router state.** State dies on reload, and by then the invite is
  consumed, so a refresh would strand the user on a blank screen for a promise they can no longer
  reach. That is exactly W03's item 11; this screen does not repeat it.

A review finding worth the whole pass: deleting the in-flight lock on all three buttons left **48
tests passing**, and double submission reproduced by hand. Covered now, and re-verified by putting
the mutation back.

## PO 확인 필요 — added 2026-07-29 (G4)

| # | Item |
|---|---|
| G4-a | **The decline reason is never sent, so it will be NULL forever.** §4-3-4 specifies 사유 입력 (optional, 0-200자), §5-3 defines `decline_reason`, and `promise-decline/handler.ts` already accepts it — only the screen omits it. Needs a label and a placement decision on a screen whose primary CTA is 승인 |
| G4-b | **Nothing on screen explains why [종료일 변경 요청하기] is greyed out.** It unlocks at 5 characters of 의견, but the textarea sits at the end of the body while the button is pinned to the action bar. The screen says "작성자에게 종료일 변경을 요청해 주세요" and then appears to lock the means without reason. One sentence fixes it |
| G4-c | **Over 300 characters of 의견 has no message.** §5-3 supplies only the lower-bound wording, so a user past the limit sees a disabled button and no reason |
| G4-d | **The terminal screen has no SCR-ID.** Neither `02` nor the 디자인요청서 assigns one, so the file is named for its function (`response-complete.tsx`, `/i/:token/responded/:outcome`). When a number is assigned, file and route move together (CLAUDE.md §5-4) |
| G4-e | **The 의견 label was made visible.** The reference uses an `lf-sr-only` label plus a placeholder ending in "(선택)", but §4-3-4 makes the field **required**, so that placeholder could not be used as written. This is a visible difference from the reference and will surface in any visual diff |

## The exact next step

**Configure Kakao in the Supabase Dashboard.** It is now the only thing standing between this code
and a real end-to-end walk: provider keys, both redirect allowlists (§6-1 — Kakao takes only
`https://<ref>.supabase.co/auth/v1/callback`; the app deep link and web origins go in Supabase's own
list), and a 비즈 앱 with `account_email` registered as [선택 동의]. Without that last one Kakao
answers **KOE205** before the consent screen renders, regardless of this product not collecting email.

Then walk it: `promise-invite` issues a token → open the link → Kakao login → W02 → 승인 → W03.
That closes the **last piece of verification debt — `promise-approve`'s happy path has still only
ever run in PGlite** — and exercises `content_hash`, the NT-01 notification and the reminder schedule
along with it. It also takes 60 seconds to confirm the one thing nobody has seen by eye: **the READY
states of W02 and W03**, which no amount of stubbing has been able to reach.

After that, **SCR-W04 (참여자 열람)** — items 11, 13 and the terminal screen's missing CTA all wait
on it.

Check the bundle before launch: it grew 234 kB → 464 kB (gzip 135 kB) once supabase-js's auth code
entered the graph, against a 3-second budget.
