# AGENTS.md

This file provides guidance to coding agents (Codex CLI, Claude Code) when working with code in
this repository. It is generated from CLAUDE.md — do not edit it by hand.
<!-- SYNC-START — everything below this marker is mirrored verbatim into AGENTS.md.
     Edit CLAUDE.md only, then run `npm run sync:agents`. Never hand-edit AGENTS.md. -->

Inherits the global rules in `C:\DEV\CLAUDE.md`. Project rules below win on conflict.

---

## 1. Working agreement (read every session, before touching anything)

### 1-1. Context budget — hard rule at 70%

Keep context usage optimal at all times. Do not run a session until it auto-compacts mid-task.

When context usage crosses **70%**:

1. **Stop taking on new work.** Finish only the atomic step in flight.
2. **Persist durable facts to memory** — decisions, constraints discovered, PO answers. Not code
   structure or git history (the repo already records those).
3. **Write a handoff file** to `docs/handoff/YYYY-MM-DD-<topic>.md` containing exactly:
   - Goal of the session and current status
   - Files created/modified (paths)
   - Decisions made + why
   - Verification state (what passed, what did not)
   - Blocked / PO-confirmation items
   - **The exact next step**, written so a cold session can start from it
4. **Hand off and continue in a new session**, seeded from that handoff file.

Below 70%, still prefer targeted reads: read the doc *section* you need, not the whole file.
`02_세부기능명세서.md` is ~97 KB — always locate the section with grep first (its headers are indexed
in §4-1 of this file), then read that range only.

### 1-2. Language split

| Surface | Language |
|---|---|
| Code, identifiers, file names, types | English |
| Code comments | **Korean (한글)** |
| Guidelines, docs, ADRs, plans, commit messages, PR text | English |
| **Every report, status update, question, and summary to the PO** | **Korean (한글)** |
| User-facing strings in the product | Korean, always via label constants — never hardcoded |

### 1-3. Code style

Write the shortest code that is still explicit. No speculative abstraction, no cleverness, no
defensive layers nobody asked for. Comments are Korean and explain **why**, never **what** — if a
comment restates the code, delete the comment or rename the thing.

### 1-4. Iterate: implement → verify → report

**Never report work as done without verification output.** Every change closes this loop:

1. Implement the smallest complete unit.
2. Verify (see §3). Type check is mandatory; visual diff is mandatory for any screen work.
3. If verification fails → fix → re-verify. Repeat until clean.
4. Report in Korean, quoting the actual command output. If something was skipped or left broken,
   say so explicitly.

Claiming success without running the check is the one failure mode this project does not tolerate.

### 1-5. When stuck

Policy judgements not covered by the specs — state transitions, keepRate math, legal wording —
are **not yours to invent**. Stop, and report the item as `PO 확인 필요` in Korean.

---

## 2. What this is

두 사람이 합의한 약속을 기록하고, 잊지 않게 하고, 지켜지도록 돕는 **상호 약속 관리 서비스**.
Not a scheduling app — it records **the content of the agreement itself**. Brand motif: 새끼손가락
걸기 (pinky promise).

Two surfaces, one domain:

- **App (SCR-A\*, MOD-\*)** — Android, React Native + Expo. The creator's surface.
- **Acceptance web (SCR-W\*)** — opened from a KakaoTalk link by the partner/witness. No login wall
  friction, no ads anywhere, 3-second load target, 3-minute completion target.

---

## 3. Commands

```bash
npm test                  # vitest run — must pass before every commit
```

```bash
npm run typecheck         # tsc --noEmit — must pass before every commit
```

```bash
npm run preview           # node design-reference/serve.js → http://localhost:4173
```

| URL | Contents |
|---|---|
| `http://localhost:4173/` | Full screen gallery, 27 screens |
| `http://localhost:4173/docs/flows.html` | Screen-to-screen flow map |

```bash
npm run check:agents      # fail if AGENTS.md is out of sync (run before commit)
```

Edit `CLAUDE.md` only, then `npm run sync:agents` regenerates `AGENTS.md`. Never hand-edit
`AGENTS.md`.

**Test runners** (`04` §4 omits these — decided by PO 2026-07-26): **Vitest** for
`packages/shared` and `apps/web`; **jest-expo** for `apps/mobile` once it exists. `02` §13 requires
tests (every EC-\* case, concurrency cases in parallel, every batch job idempotent across two runs),
so a runner is not optional.

`typecheck` covers four projects: `packages/shared`, `apps/mobile`, `supabase/functions`,
`supabase/tests`. `apps/web` joins when it exists. Nothing that ships is outside it —
`supabase/functions` has no Deno available locally, so `tsc` plus `functions/deno.d.ts` is the only
check those files get before deploy.

The strict compiler flags (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`verbatimModuleSyntax`, `isolatedModules`) are **never disabled** to make something compile.

**Relative imports carry the `.ts` extension**, not `.js` (PO, 2026-07-26; needs
`allowImportingTsExtensions`, legal because `noEmit` is on). Deno resolves specifiers literally and
the Supabase CLI bundler skips files it cannot find — with `.js` the Edge Functions fail at deploy
with Module not found, and nothing before deploy says so.

Deploying an Edge Function:

```bash
npx supabase functions deploy --use-api
```

`--use-api` is not optional. Without it the CLI bundles with Docker when Docker is running and
silently falls back to server-side bundling when it is not, so the same source produces two
different builds depending on the machine. Docker is not installed here, which also means
`supabase functions serve` — and therefore any local run of the four functions — is unavailable.

**`supabase config push` is never run on this project.** The Dashboard is the source of truth for
auth. `link`, `db push` and `functions deploy` cannot touch config — verified against the CLI source
— so only this one command is dangerous, and it is dangerous in a way nothing catches: it PATCHes
the *entire* auth body from an incomplete local file, and an unresolved `env()` in a provider's
`client_id` is sent as the **literal string** rather than being skipped (`secret` has an env()-aware
guard; `client_id`, a plain string, does not). The failure is silent — the provider looks configured
and every login fails. `supabase/config.toml` therefore keeps only `[db]`, `[api]` and
`[functions]`; auth lives there as comments, which cannot be pushed.

---

## 4. Document hierarchy — the specs outrank the code

On conflict, the higher row wins. The code is an implementation of these documents, not a source of
truth over them.

| # | Path | Ver | Role |
|---|---|---|---|
| 1 | `docs/기획/01_상위기획서.md` | v1.2 | Product definition · state machine · policy — final authority |
| 2 | `docs/기획/02_세부기능명세서.md` | v1.1 | Per-feature screens · fields · data model · transitions · edge cases |
| 3 | `docs/기획/04_AI-Agent_코딩가이드.md` | v1.0 | Confirmed stack · repo layout · **port rules** · Supabase schema · security |
| 4 | `docs/디자인/01_와이어프레임_디자인요청서.md` | v1.1 | Screen inventory (SCR-ID) · glossary · design constraints |
| 5 | `design/concept-4.html` | — | Original approved UI canvas (핑키 / 1d) |
| 6 | `docs/adr/` | — | Implementation decision records |

`docs/기획/03_기술스택_비교분석.md` is the **rationale** behind the N-3 decision; implementation
guidance lives in `04`. **`docs/_archive/` is stale — never read it.**

### 4-1. Section index for `02_세부기능명세서.md` (grep target, do not read whole)

`§2-3` input/validation/error codes · `§2-4` status values (frozen) · `§4` F-01…F-12 feature specs ·
`§5` field specs · `§6-2` table definitions · `§6-3` enums · `§6-4` derived-value math ·
`§7-1` transition table (**anything not in this table is not implemented**) · `§7-2` batch jobs ·
`§8` notification matrix · `§9` permission matrix (basis for RLS) · `§10` full edge-case list ·
`§11-3` config values → `packages/shared/src/config.ts` · `§13` QA acceptance checklist.

---

## 5. Architecture

### 5-1. Repo state: monorepo skeleton, port not started

The app framework (open point N-3) is **decided: React Native + Expo** (PO, 2026-07-25; ADR 0002).

`design-reference/` holds the approved UI as a **framework-free HTML/CSS screen library** — 27
screens, 90 design tokens, 110 `lf-*` component classes. It is **read-only, permanently.** The point
is to diff the port against the original and catch visual regressions, which fails the moment the
original moves. Preview it with `npm run preview`.

- App screens (SCR-A\*, MOD-\*) → **ported** to React Native against this reference.
- Acceptance web (SCR-W\*) → moved to Vite **reusing the CSS verbatim**.

`packages/shared/` exists and is under test. `apps/mobile` and `apps/web` do **not exist yet** —
that is the next milestone (M0-B: `tokens.ts`, the 6 base components, SCR-A01).

Port rules are fully specified in `04` §3–§5. **Follow them; do not improvise.** Two known gaps in
`04`: it counts 111 `lf-*` classes (actually 110), and its §4-6 dependency list omits
`react-native-svg`, which SCR-A01's 핑키 logo needs.

### 5-2. The domain contract lives in `packages/shared`

| File | Holds | Spec |
|---|---|---|
| `promise.ts` | 11 `PromiseStatus` values, label maps, entity shapes, `LEGAL_DISCLAIMER` | `02` §2-4·§6-3 |
| `config.ts` | **every policy number** | `02` §11-3 |
| `errors.ts` | 14 error codes + HTTP status + user-facing copy | `02` §2-3 |
| `text.ts` | input normalization (**NFC**), code-point length | `02` §2-3 |
| `validation.ts` | the `02` §5 field rules, as pure functions | `02` §5 |
| `datetime.ts` | KST D-Day, imminence, CHECKING window, quiet hours | `02` §2-2·§6-4 |
| `keep-rate.ts` | keepRate — `null` below `TRUST_MIN_SAMPLE` means "집계 중" | `02` §4-9-1 |
| `transitions.ts` | the T-01…T-18 table + `canTransition` | `02` §7-1 |
| `api.ts` | the Edge Function HTTP contract — error body, request shapes, endpoint slugs | `02` §2-3·§7-3.6 |
| `notification.ts` | NT event codes, titles, deeplinks, `dedupe_key` builders | `02` §8-1·§6-2 |

Naming follows **`02`, not `04`** where they conflict (PO, 2026-07-26): `keeper` not `obligor`,
`INVITE_TTL_HOURS` not `INVITE_EXPIRY_HOURS`, `CHECK_DEADLINE_DAYS`, `WITNESS_MAX`,
`REMINDER_OFFSETS_DAYS`. `04` §3's "move `promise.ts` unchanged" is superseded — `02` outranks `04`.

Everything downstream derives from these: DB enum strings are the *same* strings, screen labels come
from the label maps, keepRate math comes from the status sets, and no transition exists outside
`TRANSITIONS`. **Contracts-first**: read the types before implementing; if a type is missing, write
the type first, implement against it, then `npm test && npm run typecheck`.

Still to build here: the Supabase client wrappers the app and web call (`api.ts` currently holds the
HTTP contract only — types and constants, no calls).

**Normalize before you measure.** `02` §2-3 mandates code-point length counting but never named a
normalization form; the PO chose **NFC** (2026-07-26). Korean typed as conjoining jamo counts far
longer than the same text precomposed — 가속 is 5 code points raw and 2 after NFC — so every length
check runs `normalizeInput` first. Control characters are stripped *before* NFC, because one sitting
between jamo blocks composition. `content_hash` keeps its own NFC step inside the Edge Function,
since it cannot assume its input came through the client path.

**Validators never read the clock.** `validateEndDate(value, now)` takes the instant as an argument
so the Edge Function can re-run the identical rule at approval time (T-03·T-08) instead of trusting
a client-computed date.

Lifecycle:

```
DRAFT → PENDING → ACTIVE → CHECKING → COMPLETED | BROKEN | DISPUTED | UNRESOLVED
                     ↕                      ↑
              AMEND_PENDING → CANCELED      └── DISPUTED (재협의로 CHECKING 재진입)
        PENDING → DECLINED
```

keepRate denominator counts **only promises where I am the obligor**, and shows "집계 중" below a
3-promise minimum sample.

### 5-3. The design system is a one-source, three-target pipeline

`src/styles/tokens.css` is the single definition of every colour, type scale, radius, spacing,
elevation, easing and duration. It was authored at a **360×800 dp** viewport, which is why the port
is mechanical:

| Target | Transform |
|---|---|
| `design-reference/styles/tokens.css` | copy, frozen |
| `apps/mobile/src/theme/tokens.ts` | **px number = RN dp, 1:1**. Only shadows (→ objects), easing (→ `Easing.bezier`), weights (→ strings) change shape |
| `apps/web/src/styles/tokens.css` | copy, used as-is |

`src/styles/components.css` holds 110 `lf-*` classes. Modifier classes collapse into **props**, not
separate components — `lf-btn--filled` → `<LfButton variant="filled">`. The full 110→~33 mapping
table is `04` §5-2. Screen-specific styles live in `src/styles/screens/`.

**Never write a design literal.** No hex, no font size, no spacing number, no radius in screen or
component code — always through the token layer. If a value is missing, add the token first (and
mirror it into `design-reference/styles/tokens.css`).

Likewise **never hardcode a policy number** — read it from `packages/shared/src/config.ts` or the
Supabase `app_configs` table (`02` §11-3).

### 5-4. Screen files map 1:1 to SCR-IDs

Filenames are the SCR-ID. One screen = one file. `SCR-A05` alone has **9 status variants** (pending,
active, checking, completed, broken, disputed, unresolved, declined, amend-pending) — these are the
main consumer of the status → label → colour contract.

Preview-only scaffolding that **must be stripped during the port**: the `lf-device` /
`lf-device__viewport` wrapper, `src/screens/frame.js` (status bar + gesture bar injection —
`SafeAreaView` replaces it in RN), `screen-page.css`, and the `lf-browserbar` block (the real
KakaoTalk in-app browser plays that role). Keep the `lf-screen` structure and every `lf-*` class.

Two port gotchas already discovered, do not rediscover them:
- `assets/fonts/PretendardVariable.woff2` is **web-only** — RN needs 4 static `.ttf` weights
  (400/600/700/800), because RN Android's variable-font weight axis is unreliable.
- Material Symbols Rounded is not bundled with Expo — use `@expo/vector-icons` MaterialIcons behind
  an `LfIcon` wrapper so the swap point stays in one file. Screens never import icons directly.

### 5-5. Target layout after the port (npm workspaces)

```
packages/shared/   # the only shared code — MUST NOT import react-native, window, or document
apps/mobile/       # Expo — SCR-A*, MOD-*
apps/web/          # Vite — SCR-W01..W06, existing CSS reused as-is
supabase/          # migrations + Edge Functions
design-reference/  # today's HTML/CSS — read-only
```

`packages/shared` holds domain types, label/policy constants, error codes, validation rules and the
Supabase call wrappers. It holds **no** screens, styles, or platform APIs.

### 5-6. Backend: what the server must own

Client code is not trusted with anything that affects the record's integrity. These live in Edge
Functions only (`04` §7-3): `invite-resolve`, `promise-approve` (state transition **and**
`content_hash` generation), `promise-decline` / `promise-amend` / `promise-cancel`,
`fulfillment-submit` (the COMPLETED/BROKEN/DISPUTED verdict), `evidence-sign-url`, `push-send`
(quiet hours 21:00–08:00 KST).

**`promise-create` and `promise-invite` joined that list** (2026-07-27), which `04` §7-3 did not
anticipate — it left T-01 to the client over RLS. Two things forced the move: EC-H05's "DRAFT 20건 ·
일 30건" can only be counted where creation happens, and `content_hash` is server-generated (§9). The
client-side INSERT/UPDATE policies on `promises` and `promise_versions` were therefore **dropped**;
`promises delete own draft` stays (§4-2-2.5). DRAFT editing waits on its own RPC. **Neither function
emits a notification** — §8-1: "초대 발송 자체는 시스템 알림이 아니다".

**`invite-preview` joined it too** (2026-07-27, ADR 0004) — SCR-W02 had no server read path at all.
`invite-resolve` could not grow one: it is the pre-login endpoint and what it *refuses* to return is
its design. RLS could not supply one either — at PENDING the partner has no `promise_participants`
row yet (T-01 writes CREATOR only; PARTNER appears inside `lf_promise_approve`), so
`can_read_promise()` is false and the select returns empty. `lf_invite_preview` is therefore the
**read twin of approve**: the same guards in the same order, and the `02` §4-3-4 content only for a
caller who would be allowed to approve. It is `stable`, which is enforcement rather than
optimization — Postgres rejects INSERT/UPDATE/DELETE and `select … for update` inside it, so a
review screen reopened by refresh or back-button (EC-A01) cannot consume the invite it is about to
approve.

But the transition itself is **not** in the Edge Function — it is a Postgres `lf_*` function, one
per transition, and the function boundary is the transaction boundary (ADR 0003). The Edge Function
is a shell: JWT → user id, request shape, call the RPC, map the raised message to the `02` §2-3 code
and HTTP status, and write the notification **after** the commit.

Every shell splits in two, and this is load-bearing rather than stylistic: `handler.ts` is pure and
takes a `Deps` object, `index.ts` is `Deno.serve(create…(createDeps()))` and nothing else. Touching a
Deno global at module top level makes the whole file unimportable by Vitest, so logic in `index.ts`
is logic no test can reach.

Three things the shells own that nothing below them can:
- **`surface`** comes from the presence of the `Origin` header (browsers always send it cross-origin,
  RN's fetch never does). Not from the request body — `approvals` is append-only and cannot be
  corrected, so a client-declared value there is permanent. Not from `users.primary_surface`, which
  is the **signup** surface (`02` §6-2), a KPI field.
- **Unknown failures are flattened to a 500** with EC-C02's copy. A raised message that is not one of
  the 14 codes carries Postgres's table and column names, and letting it through breaks `02` §9 on
  the failure path only.
- **Notification failure never fails the response.** The transition is already committed; throwing
  there shows the user an error for a promise that is confirmed.

RLS on every table, derived from the `02` §9 permission matrix, with three principles:
1. Non-participants are not told a promise **exists** — unauthorized reads return empty, and the app
   layer answers `E_NOT_FOUND`.
2. After ACTIVE, content fields are `UPDATE`-rejected by policy. Change = new `promise_versions` row.
3. Append-only tables (`approvals`, `promise_versions`, `fulfillment_checks`, `notifications`) get no
   UPDATE/DELETE policy at all.

Batch jobs run on `pg_cron` and **must be idempotent** — running twice in a day must not double-send.

Time: store UTC (`timestamptz`), compute and display in **Asia/Seoul**. Never trust the device time
zone. Date-boundary decisions (D-Day, deadline expiry) are the server's call; client math is display
only.

Supabase Free pauses a project after 1 week of inactivity — the daily GitHub Actions keep-alive ping
and the weekly `supabase db dump` backup are load-bearing, not optional.

---

## 6. Confirmed stack (all free-tier)

| Area | Confirmed |
|---|---|
| App (SCR-A\*, MOD-\*) | React Native + **Expo SDK 57** (RN 0.86) · TypeScript · Expo Router |
| Acceptance web (SCR-W\*) | **Vite + React + React Router**, existing CSS reused |
| DB · auth · storage · server logic · batch | **Supabase Free** (Postgres · Auth · Storage · Edge Functions · pg_cron) |
| Web hosting | **Firebase Hosting Spark** on the existing `littlefinger-app-philwoo` project |
| Push | expo-notifications + Expo Push Service |
| Ads | `react-native-google-mobile-ads` (AdMob) — SCR-A02 bottom slot only |

**Do not use**: Vercel (Hobby plan forbids ad-monetized services) · Firebase Blaze · Next.js ·
react-native-web / Expo Web for the acceptance web · `@react-native-kakao/*` (unofficial) ·
Render / Railway / Fly.io. Rationale: `04` §2.

**Kakao and Google login go through Supabase Auth's official OAuth providers.** No unofficial
SDK. **Production login is Kakao + Google SSO only** (PO, 2026-08-20). The Google client path
(app + web) and the DB identity generalization (`users.provider_user_id` + `provider`, formerly
`kakao_id` — 02 §6-2 amended) shipped 2026-08-20; the Google Cloud OAuth client and Dashboard
provider setup are operator steps in
[`docs/setup/google-oauth-setup.md`](docs/setup/google-oauth-setup.md) — one **Web application**
client serves both surfaces, since the code flow terminates at Supabase's server.
The dev-only email test login is excluded from every production build by build-time gates
(`__DEV__` / `import.meta.env.DEV`), both locked by tests; the release-time server-side removal
(Dashboard Email provider off, test accounts deleted) is scripted in
[`docs/setup/email-test-login-removal.md`](docs/setup/email-test-login-removal.md) — execute it
only when the PO asks.

### 6-1. Kakao setup — three things that are not what they look like

Verified 2026-07-26 against current docs and adversarially reviewed. Full detail:
[`docs/handoff/2026-07-26-kakao-supabase-oauth-findings.md`](docs/handoff/2026-07-26-kakao-supabase-oauth-findings.md).

1. **비즈 앱 is mandatory for login itself, not for email.** gotrue hardcodes the scope list
   `account_email profile_image profile_nickname` and the dashboard can only *append* to it. If that
   consent item is not registered in the Kakao console, Kakao rejects the authorize request with
   **KOE205** before the consent screen renders. `04` §13's framing — "Biz App only matters if you
   want email" — is wrong.
2. **The PO chose not to collect email (2026-07-26).** Register `account_email` as **[선택 동의]**
   and turn Supabase's **"Allow users without an email" ON**; the app then never stores or reads it.
   `User.email` keeps its `string | null` type. **Registering the consent item is not the same as
   collecting the data** — gotrue always requests the scope, so an unregistered item is KOE205, not
   privacy; [선택 동의] is what lets the user refuse while login still works.
   **The separately typed reminder email on SCR-W03 (`02` §5-3) is out of MVP too** (PO,
   2026-07-29): this product reaches people through KakaoTalk links and the Play Store link, never
   through email, so `02` §5-3's field, EC-G01 and EC-G03 are not implemented. That also removes any
   need to write to `users` from the client, which the `users update own` policy would have made
   dangerous — it permits updating every column, including `email_verified` and `status`.
3. **`expo-secure-store` cannot hold a Supabase session directly** — it caps values at 2048 bytes
   and a session exceeds that. Use the `LargeSecureStore` pattern: AES-256 key in SecureStore,
   ciphertext in AsyncStorage. Also required: `autoRefreshToken`, `persistSession`, and an
   `AppState` listener driving `startAutoRefresh` / `stopAutoRefresh`.

Redirect URIs live in **two different allowlists**. Kakao accepts only HTTP/HTTPS, so it gets just
`https://<ref>.supabase.co/auth/v1/callback`; the app deep link and web origins go in Supabase's
own list. `04` §8's "3종 등록" conflates them.

`openAuthSessionAsync` alone never stores a session — the returned URL must be parsed and passed to
`setSession()`, or login silently succeeds with `getSession()` forever null.

---

## 7. Terminology — one word per concept

Do not coin terms outside this table. Status names use the `PromiseStatus` English constants
verbatim in code, DB, and design; screen labels **always** go through `PROMISE_STATUS_LABEL`.

| Concept | Code | Screen label | Never use |
|---|---|---|---|
| 약속 | `promise` | 약속 | contract, agreement, 계약 |
| Promise entity type | `PromiseRecord` | — | `Promise` (collides with the JS global) |
| 작성자 / 상대방 / 증인 | `creator` / `partner` / `witness` | 작성자 / 상대방 / 증인 | owner, invitee, guest |
| 지킬 사람 (obligated party) | `keeper` | 지킬 사람 | obligor, assignee, target |
| 보상 / 벌칙 | `reward` / `penalty` | 보상 / **벌칙** | 패널티 |
| 약속 지킴율 | `keepRate` | 약속 지킴율 | 이행률, 성공률 (O-D3) |
| 확정 기록 지문 | `fingerprint` | 기록 지문 | hash, 해시, 서명 |
| 초대 링크 | `inviteLink` | 초대 링크 | 공유 링크, url |

---

## 8. Hard constraints — no document below §4 can override these

1. **No ads at moments of trust.** Creation, review, approval, confirmation and fulfillment screens,
   plus **the entire acceptance web**, carry no ads. The only slot is the SCR-A02 bottom. When
   `ads_enabled=false`, the component is **not rendered at all** — no reserved empty space.
2. **`LEGAL_DISCLAIMER` is verbatim and immutable.** `LfDisclaimer` renders the constant and does not
   accept text as a prop. It appears in **4 places**: SCR-W02 · SCR-A05/ACTIVE confirmation area ·
   SCR-W03 · SCR-A08 terms area.
3. **It must not look like a legal contract.** No stamp/document/courtroom metaphors — but the
   confirmation stamp area must still feel like "this was properly recorded".
4. **DISPUTED never indicates who is right** (principle P1 — recorder, not judge). Not through
   wording, colour, ordering, or icons. Both claims sit side by side.
5. **Immutable after confirmation** (P3) — post-ACTIVE content fields are UPDATE-rejected at the DB
   layer; change is expressed only as a new version.
6. **Money escrow and automatic penalty settlement are permanently out of scope.** A 벌칙 is a text
   record and nothing more.
7. **Accessibility**: minimum 48 dp touch targets; never encode state in colour alone — always pair
   it with a text label.
8. **Privacy**: invite tokens, IPs and User-Agents are stored **hashed only** (originals never kept);
   evidence photos have **EXIF location stripped**, live in a private bucket, and are exposed only
   via 10-minute signed URLs.

## 9. Security

The Supabase project exists (created by the PO, 2026-07-26). The URL and `anon` key live in the
gitignored root `.env`; `.env.example` documents the shape. **Free-plan trap**: the project is paused
after 7 days of inactivity and deleted after 90 days paused, so the daily GitHub Actions keep-alive
ping is load-bearing — switch it on before development goes quiet.

- The Supabase `service_role` key exists **only inside Edge Functions**. App and web ship the `anon`
  key only. The `anon` key is designed to be public — **RLS is what protects the data**, which is
  why every table gets RLS.
- `KAKAO_REST_API_KEY` and `KAKAO_CLIENT_SECRET` never enter the repo in any form. They go only
  into Supabase Dashboard → Authentication → Providers → Kakao. The Google OAuth client ID and
  secret follow the same rule (Dashboard → Providers → Google).
- `content_hash` is generated **only on the server**, so a client cannot forge it. SHA-256, fixed key
  order, NFC-normalized strings (`02` §6). It lives in Postgres (`lf_content_hash`), one layer deeper
  than `04` §7-3 put it — see ADR 0003.
- **Invite tokens hash as `SHA-256(token + INVITE_TOKEN_PEPPER)`** (PO, 2026-07-26; `02` §6-2 was
  corrected to match `04` §9). The issuing path (T-02, not built) and the resolving path must use
  the same rule — if they diverge every valid link fails as `E_NOT_FOUND` and there is no other
  symptom to trace.
- **IP and User-Agent hash with `PII_HASH_SALT`, a different secret.** Sharing the invite pepper
  would mean one leaked secret hands over both link authentication and an oracle for stored IPs.
  Both columns are nullable and stay NULL when the header is absent — hashing a placeholder makes
  different people share a hash, which makes the audit log lie.
- `.env*` is gitignored; only `.env.example` is committed. **If a key was ever committed, rotate it
  immediately.**

---

## 10. Build order

M0 repo restructure + tokens + fonts, then **build 6 components (LfText, LfStack, LfRow, LfButton,
LfCard, LfIcon) and finish SCR-A01 alone, then eyeball it against the gallery** — that single screen
is what validates the whole port ruleset. Then the rest of the components, then Supabase schema +
RLS + keep-alive.
M1 login → promise creation → invite → acceptance web → confirmation (`promise-approve` +
`content_hash` + fingerprint + disclaimer) → fulfillment check.
M2 reminders, push, quiet hours, notification inbox, home list, the 9 SCR-A05 variants.
M3 witnesses, keepRate profile, amend/cancel, MOD-03.
M4 ad slot, accessibility pass, `02` §13 acceptance checklist, Google Play closed testing
(12 testers × 14 consecutive days — start recruiting alongside development, not after).

Full detail: `04` §10.

---

## 11. Still open

| # | Issue | State |
|---|---|---|
| ~~N-3~~ | ~~App framework~~ | **Decided: React Native + Expo** (2026-07-25). Rationale `03`, port rules `04` |
| ~~C-1~~ | ~~Business registration → email collection~~ | **Closed 2026-07-26. The PO has a business registration, and chose not to collect email anyway.** See §6-1 below — Biz App is still mandatory, for a different reason than `04` §13 assumed |
| ~~Emoji~~ | ~~`02` §2-3 wants both "count code points" and "emoji counts as 1"~~ | **Decided 2026-07-26: code points.** A family emoji counts 5, 🇰🇷 counts 2. Grapheme counting needs `Intl.Segmenter`, an ECMA-402 surface where Hermes has gaps. Revisit at M4 if device testing allows |
| C-2 | Match icons to the original 100%? | Default: no — Expo MaterialIcons, slight corner-curvature difference |
| ~~C-3~~ | ~~Buy a domain for the acceptance web?~~ | **Closed 2026-08-18: use `https://littlefinger-app-philwoo.web.app` (ADR 0005).** |
| C-4 | Pretty KakaoTalk share card for invites? | Default: out of MVP scope — OS share sheet, link only |
| N-1 | '리틀핑거' trademark / store name | Confirm before launch |
| ~~N-4~~ | ~~Google SSO for production login~~ | **Implemented 2026-08-20** (client both surfaces + identity rename). Remaining: operator runs `docs/setup/google-oauth-setup.md` (GCP client + Dashboard provider); until then the Google button fails into EC-A02 copy |
| N-2 | iOS launch timing | Decided in v2 |
| Q-5 | Onboarding pages 2 and 3 | Only page 1 is implemented |
| Q-6 | COMPLETED share card design | Out of scope |
| Q-7 | Max evidence photo count | **3** (`EVIDENCE_MAX_COUNT`, `02` §5-2·§11-3). S-10 is about amend rounds, not photos |
