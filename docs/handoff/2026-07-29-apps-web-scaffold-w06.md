# Handoff — apps/web scaffold + SCR-W06, and the blocked deploy

Date: 2026-07-29. Follows `2026-07-27-b1-7-t01-t02.md`, whose recommended next step (option 1,
`apps/web`) the PO chose.

Status: **four commits landed, all local verification green, deploy blocked on Supabase CLI auth.**

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
npm test          → Test Files 24 passed (24) / Tests 885 passed (885)
                    + jest-expo: Test Suites 4 passed, Tests 137 passed
npm run typecheck → exit 0 (5 projects — apps/web joined)
npm run build:web → ✓ built, index.js 233.91 kB (gzip 75.12 kB), index.css 31.14 kB (gzip 5.69 kB)
npm run check:agents → AGENTS.md 는 CLAUDE.md 와 동기화되어 있다.
```

Browser (dev server, 360×800): `/i/a-b_c-d_e` extracts the token with `-`/`_` intact; `/nope`
renders SCR-W06; **console errors 0**; 4 stylesheets; tokens resolve (`--lf-radius-md: 16px`);
Pretendard `loaded` and self-hosted; Material Symbols `loaded`; `.lf-screen` fills 360×800 at
`rgb(255,248,248)`.

**Never run live**: everything on the Supabase project. See below.

## Blocked

**The deploy could not run — the Supabase CLI is authenticated as the wrong account.**

```
npx supabase migration list → 403 "Your account does not have the necessary privileges"
```

`supabase/.temp/project-ref` is `vepnrrmxvsytguocicfe` (littlefinger, org `aseszttxkxpfzenmbylx`),
but `supabase projects list` succeeds and returns only `muuudarddkvevwdpefvy` and
`jamhkucluhiibqpjsiov`, both in org `hddilaqjdxaprrcebqet`. The account that pushed migrations
0001–0009 is not the account logged in now. `SUPABASE_ACCESS_TOKEN` is unset.

Pending deploy: migration `20260727000010_invite_preview.sql` and the `invite-preview` function.
Once the PO re-authenticates (`npx supabase login`, or an access token in the environment):

```
npx supabase db push && npx supabase functions deploy invite-preview --use-api
```

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
| ④ | **G6 as I specified it is not executable.** Inline SVG needs real Material Symbols path geometry, which is not in the repo and cannot be written from memory. The executable options that satisfy `04` §5-3's self-host requirement are `npm i material-symbols` (full set, several hundred KB) or a subset build. **Today the web still loads Material Symbols and Roboto Mono from the Google Fonts `@import` at `tokens.css:9`** — a CDN dependency against the 3-second budget. Removing that line is the one deliberate deviation from "copy verbatim", and it should be made once, after every screen is ported, not piecemeal |
| ⑤ | SCR-W06's title (`이 링크는 더 쓸 수 없어요`) and the 1회용 notice come from the design reference, not from `02`. They are not contradicted by the spec, but they are not spec-sourced either |

## The exact next step

**SCR-W01 (초대 랜딩).** It is the entry point for `/i/:token`, it is pre-login, and it is the only
remaining piece between a token and a real end-to-end walk. It calls `invite-resolve` (already live)
and routes its four failure codes into SCR-W06, which now exists and takes exactly those codes as
its `reason` prop.

Concretely: call `invite-resolve` with the `:token` param, render the creator nickname and promise
title per `디자인:105` ("○○님이 약속을 보냈어요"), put the Kakao login CTA below it, and hand
`E_INVITE_EXPIRED` / `E_INVITE_USED` / `E_INVITE_REVOKED` / `E_NOT_FOUND` straight to
`<ScrW06LinkExpired reason=… />`. `E_RATE_LIMIT` has no screen yet — that is part of item ①.

After W01, the Kakao login flow (G10: the token rides `redirectTo`, not the OAuth `state`, because
supabase-js owns `state` for PKCE) and then SCR-W02 against `invite-preview`.
