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
node tools/serve.js       # preview server → http://localhost:4173  (also: npm run preview)
```

| URL | Contents |
|---|---|
| `http://localhost:4173/` | Full screen gallery, 27 screens |
| `http://localhost:4173/docs/flows.html` | Screen-to-screen flow map |

```bash
npm run typecheck         # tsc --noEmit — must pass before every commit
```

```bash
npm run sync:agents       # regenerate AGENTS.md from CLAUDE.md
npm run check:agents      # fail if AGENTS.md is out of sync (run before commit)
```

There is **no test runner in this repo yet**. Do not invent one or reference scripts that do not
exist in `package.json`. Verification today = `npm run typecheck` + visual diff against the gallery.
When the monorepo lands (§5), `typecheck` becomes the composite defined in `04` §4:
`tsc --noEmit -p packages/shared && tsc --noEmit -p apps/mobile && tsc --noEmit -p apps/web`.

The strict compiler flags (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`verbatimModuleSyntax`, `isolatedModules`) are **never disabled** to make something compile.

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

### 5-1. Repo state: a screen library awaiting port

The app framework (open point N-3) is **decided: React Native + Expo** (PO, 2026-07-25; ADR 0002).
What exists today is the approved UI built as a **framework-free HTML/CSS screen library** — 27
screens, design tokens, 110 `lf-*` component classes. It is the **visual source of truth for the
port**, not throwaway work.

- App screens (SCR-A\*, MOD-\*) → **ported** to React Native against this reference.
- Acceptance web (SCR-W\*) → moved to Vite **reusing the CSS verbatim**.
- Once ported, this HTML/CSS moves to `design-reference/` and becomes **read-only forever** — the
  point is to be able to diff the port against the original and catch visual regressions.

Port rules are fully specified in `04` §3–§5. **Follow them; do not improvise.**

### 5-2. The domain contract is one file

`src/types/promise.ts` → moves **byte-for-byte unchanged** to `packages/shared/src/promise.ts`.

It defines the 11 `PromiseStatus` values, `PROMISE_STATUS_LABEL`, which statuses count toward
keepRate (`RATE_COUNTED_STATUSES` = COMPLETED, BROKEN) versus which are excluded but shown as
separate counts (`RATE_EXCLUDED_STATUSES` = DISPUTED, UNRESOLVED, DECLINED, CANCELED), the entity
shapes, the policy constants, and `LEGAL_DISCLAIMER`.

Everything downstream derives from it: DB enum strings are the *same* strings, screen labels come
from the label maps, keepRate math comes from the status sets. **Contracts-first**: read the types
before implementing; if a type is missing, write the type first, implement against it, then
`npm run typecheck`.

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
| Web hosting | **Cloudflare Pages** |
| Push | expo-notifications + Expo Push Service |
| Ads | `react-native-google-mobile-ads` (AdMob) — SCR-A02 bottom slot only |

**Do not use**: Vercel (Hobby plan forbids ad-monetized services) · Firebase Blaze · Next.js ·
react-native-web / Expo Web for the acceptance web · `@react-native-kakao/*` (unofficial) ·
Render / Railway / Fly.io. Rationale: `04` §2.

**Kakao login goes through Supabase Auth's official Kakao OAuth provider.** No unofficial SDK.
Sessions are stored in `expo-secure-store`, not `AsyncStorage`.

---

## 7. Terminology — one word per concept

Do not coin terms outside this table. Status names use the `PromiseStatus` English constants
verbatim in code, DB, and design; screen labels **always** go through `PROMISE_STATUS_LABEL`.

| Concept | Code | Screen label | Never use |
|---|---|---|---|
| 약속 | `promise` | 약속 | contract, agreement, 계약 |
| Promise entity type | `PromiseRecord` | — | `Promise` (collides with the JS global) |
| 작성자 / 상대방 / 증인 | `creator` / `partner` / `witness` | 작성자 / 상대방 / 증인 | owner, invitee, guest |
| 지킬 사람 (obligated party) | `obligor` | 지킬 사람 | assignee, target |
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

- The Supabase `service_role` key exists **only inside Edge Functions**. App and web ship the `anon`
  key only.
- `content_hash` is generated **only inside an Edge Function**, so a client cannot forge it.
  SHA-256, fixed key order, NFC-normalized strings (`02` §6).
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
| C-1 | Business registration → Kakao Biz App → **can we collect email?** | **Awaiting PO.** Default: proceed without email (`User.email` is already `string \| null`) |
| C-2 | Match icons to the original 100%? | Default: no — Expo MaterialIcons, slight corner-curvature difference |
| C-3 | Buy a domain for the acceptance web? | Default: start on the free Cloudflare address |
| C-4 | Pretty KakaoTalk share card for invites? | Default: out of MVP scope — OS share sheet, link only |
| N-1 | '리틀핑거' trademark / store name | Confirm before launch |
| N-2 | iOS launch timing | Decided in v2 |
| Q-5 | Onboarding pages 2 and 3 | Only page 1 is implemented |
| Q-6 | COMPLETED share card design | Out of scope |
| Q-7 | Max evidence photo count | Unlimited (confirmed S-10) |
