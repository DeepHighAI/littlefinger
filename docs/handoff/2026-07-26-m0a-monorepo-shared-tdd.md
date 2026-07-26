# Handoff — M0-A: monorepo restructure + `packages/shared` TDD

Date: 2026-07-26 · Previous session ended at the 70% context rule.

## Goal and status

Execute the front half of `04` §10 M0 with TDD: introduce git, restructure into npm workspaces with
a read-only `design-reference/`, and build `packages/shared` test-first.

**Status: mostly done.** 111 tests green, typecheck clean, gallery verified non-regressed.
`validation.ts` and `api.ts` are the remaining files in `packages/shared`.

## Decisions made (PO-approved, do not re-litigate)

| # | Decision |
|---|---|
| D1 | On naming conflicts, **`02` wins over `04`** (doc priority). `keeper` not `obligor`; `INVITE_TTL_HOURS`, `CHECK_DEADLINE_DAYS`, `WITNESS_MAX`, `REMINDER_OFFSETS_DAYS` |
| D1' | npm scope `@littlefinger/*` · app id `com.littlefinger.app` · root package name `littlefinger`. **`PromiseRecord` type name stays** |
| D2 | Vitest for `packages/shared` + `apps/web`; **jest-expo** for `apps/mobile` (not yet created) |
| D3 | Strict TDD on domain logic; `04` §12 hard constraints enforced by tests; tokens by parity test; screens by visual diff |
| D4 | This sprint needs no external accounts |

`04` §3's "move `promise.ts` byte-for-byte unchanged" is **deliberately superseded** by D1.

## Files created / modified

Restructure (commit `357f4f3`):
- `design-reference/` ← `src/screens`, `src/styles`, `assets`, `index.html`, `tools/serve.js`,
  `docs/flows.html`, `design/concept-4.html`, `design/README.md`
- `packages/shared/src/promise.ts` ← `src/types/promise.ts`
- new: root `package.json` (workspaces), `tsconfig.base.json`, `packages/shared/{package.json,tsconfig.json}`,
  `vitest.config.ts`, `.gitattributes`
- deleted: root `tsconfig.json` (superseded)

Path fixes made **during** the move (necessary, not optional):
- `design-reference/styles/tokens.css` font url `../../assets/` → `../assets/`
- `design-reference/index.html` dropped the `src/` segment
- `design-reference/docs/flows.html` `../src/` → `../`
- `design-reference/serve.js` `ROOT` is now `__dirname`

`packages/shared/src/` (one commit per TDD cycle):
`text.ts` · `config.ts` · `errors.ts` · `datetime.ts` · `keep-rate.ts` · `promise.ts` ·
`transitions.ts` · `index.ts`, each with a `.test.ts` beside it.

Docs: `CLAUDE.md` §3 commands, §5-1 repo state, §5-2 contract table, §7 `keeper`, §11 Q-7 →
`AGENTS.md` regenerated. `README.md` structure + preview command. `design-reference/README.md`.

## Verification state

All passing as of handoff:

- `npm test` → 7 files, **111 tests passed**
- `npm run typecheck` → clean, strict flags untouched
- `npm run check:agents` → in sync
- Gallery: 27/27 iframes render, Pretendard loads, zero console errors, no surviving `src/` paths.
  `docs/flows.html` loads all 3 stylesheets.
- `datetime.test.ts` re-run green under `UTC`, `Asia/Seoul`, `America/New_York`, `Pacific/Kiritimati`
  — device-timezone independence is proven, not assumed.

Nothing is skipped or left broken.

## The exact next step

**Write `packages/shared/src/validation.test.ts` first, watch it fail, then implement
`validation.ts`.** Rules are `02` §5 (already extracted below so you need not re-read the 97 KB file):

| Field | Key | Required | Rule | Failure copy |
|---|---|---|---|---|
| 제목 | `title` | ✅ | 2–40자, 개행 불가 | `제목을 2자 이상 입력해 주세요.` |
| 약속 내용 | `body` | ✅ | 5–1000자, 최대 20줄 | `어떤 약속인지 5자 이상 적어주세요.` |
| 카테고리 | `category` | ✅ | `HABIT`/`BET`/`MONEY`/`ETC` | — (미선택 시 CTA 비활성) |
| 종료일 | `endDate` | ✅ | 내일 ~ 오늘+`END_DATE_MAX_DAYS`, KST | `종료일은 내일부터 1년 안으로 정해주세요.` |
| 지킬 사람 | `keeper` | ✅ | `CREATOR`/`PARTNER`/`BOTH`, 기본 `BOTH` | — |
| 보상·벌칙 | `reward`,`penalty` | — | 0–100자 | — |
| 수정 제안 | `amendSuggestion` | ✅(제안 시) | 5–300자 | `어떤 부분을 바꾸고 싶은지 알려주세요.` |
| 거절 사유 | `declineReason` | — | 0–200자 | — |
| 한 줄 의견 | `comment` | — | 0–200자 | — |
| 리마인드 이메일 | `email` | — | RFC 5322 | `이메일 형식을 확인해 주세요.` |
| 증빙 | `evidences[]` | — | ≤`EVIDENCE_MAX_COUNT`장, 장당 ≤`EVIDENCE_MAX_MB`MB, JPEG/PNG/WEBP/HEIC | `E_UPLOAD_FAILED` |

Non-negotiables for this file:
- **Validate after `normalizeInput`**, and count with `codepointLength` — never `String.length`.
- `endDate` bounds come from `END_DATE_MAX_DAYS` and `toKstDate(now)`; never device-local dates.
- Server re-validates `endDate` at approval time (T-03/T-08), so expose the rule as a pure function
  both client and Edge Function can call.
- Do not invent failure copy. Anything not in the table above is `PO 확인 필요`.

Then: `packages/shared/src/api.ts` (Supabase wrappers) — blocked on the PO's Supabase project.

After `packages/shared` is complete → **M0-B**: `tokens.ts` port (90 tokens, px = dp 1:1),
`expo install react-native-svg` (missing from `04` §4-6 but SCR-A01's 핑키 logo is SVG paths),
the 6 base components, and SCR-A01 eyeballed against the gallery.

## Blocked / PO confirmation needed

1. **Supabase project** → URL + `anon` key. (`service_role` never leaves Supabase Secrets.)
2. **Kakao Developers app** → REST API key + 3 Redirect URIs (Supabase callback, app deep link, web domain).
3. **C-1 — 사업자등록 유무.** No Biz App means no user email; default is to proceed without it
   (`User.email` is already `string | null`, so no type change).

## Known spec errata found (not yet back-propagated into `docs/기획/`)

- `04` §5-2 says 111 `lf-*` classes; the actual count is **110**.
- `04` §4-6's dependency list omits **`react-native-svg`**, required by SCR-A01.
- `02` §2-3 specifies trim / newline collapse / control-char removal but **never mentions NFC**,
  while `04` §7-3 requires NFC for `content_hash`. Resolved for now by normalizing NFC only inside
  the hash routine (Edge Function), not in general input normalization. Worth confirming.
