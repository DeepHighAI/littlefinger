# UI/UX restyle brief — for the Codex agent

Mission: improve littlefinger's UI/UX **without changing any behavior**. Everything functional —
payments, slots, ads wiring, navigation, server contracts — shipped recently and is verified on
device (internal-test versionCode 6). Your job is visual/interaction polish only.

Read these before anything else (in order):

1. `AGENTS.md` — the full working rules (Korean comments, no design literals, verification loop).
2. `DESIGN.md` — the approved visual contract: palette A (Pine anchor · Warm promise · Blue
   record) over Karrot-style neutrals/radii/hairlines. Its §4 hierarchy and §8 hard constraints
   outrank any restyle idea.
3. `docs/DEVELOPMENT_STATUS.md` — what exists today (top two sections are enough).

## How styling works here (one source, three targets)

```
design-reference/styles/tokens.css      ← canonical tokens (approved baseline)
  → apps/mobile/src/theme/tokens.ts     ← RN mirror, px = dp 1:1 (shadows→objects, easing→bezier)
  → apps/web/src/styles/tokens.css      ← byte-equal copy
design-reference/styles/components.css  ← 110 lf-* classes (modifiers become RN props)
design-reference/styles/screens/*.css   ← screen-specific classes
design-reference/screens/**             ← the approved screen library (SCR-A00..A09, MOD-01..04, SCR-W01..06)
apps/mobile/src/components/Lf*.tsx      ← closed variant systems (LfText variants, LfChip tones, …)
```

Rules that make a restyle safe:

- **Never write a design literal** (hex/px/radius) in screen or component code. Missing value →
  add the token to all three targets first. `apps/mobile/src/theme/tokens.test.ts` pins the token
  count, byte-equality with the web copy, literal RN shadow objects, and WCAG contrast — if you
  add/change tokens, that test moves with you deliberately, never by loosening it.
- **The reference is the source of truth.** A visual change lands in `design-reference` AND the
  RN screen AND (if the class is shared) the web copy in the same change set. Reference edits are
  allowed only as PO-approved restyles: preview → PO confirms → apply → record in an ADR and, if
  the system itself changed, `DESIGN.md`.
- **Approval loop (mandatory):** propose each change with a preview the PO can see (serve the
  gallery: `npm run preview` → http://localhost:4173, or screenshots), get an explicit 컨펌,
  then implement. No un-previewed visual changes.

## Freeze list — do not touch

These carry freshly shipped, device-verified behavior. Changing them is out of scope:

- `packages/shared/**` (domain/API contracts), `supabase/**` (server, migrations, config).
  Never run any `supabase` CLI command; `supabase config push` is forbidden project-wide.
- `apps/mobile/src/lib/**` (API/native wrappers, purchase flow), `src/screens/*-state.ts`
  (reducers), navigation routes and `_layout.tsx`, `app.config.js` / `app.json` / `eas.json`.
- Behavioral semantics inside screens: accessibility roles/labels, testIDs, label catalog keys,
  handlers, conditional rendering logic. Restyle the *presentation* of screens/components, not
  their logic. User-facing copy changes are possible but are a PO-confirm item and must go
  through the `Localized<T>` catalogs (`src/screens/*-labels.ts`, registered in
  `labels-registry.ts`) — never hardcoded.
- Invariants that look stylistic but are not: ad slots exist on SCR-A02/A07/A08 only and render
  nothing when disabled (no reserved space); `LfDisclaimer` text is verbatim-immutable; DISPUTED
  UI must never imply a verdict (color/order/icons — P1); 48dp touch targets; state is never
  color-only; no legal-contract look (stamps/courtrooms).

## What will catch mistakes

- `npm run typecheck` (5 projects) · `npx vitest run` (root) · `cd apps/mobile && npx jest`.
  All three must stay green — the jest suites pin roles/labels/texts, so a pure restyle should
  pass without test edits (exceptions: style-pinning tests like `tokens.test.ts`, and the few
  asserts that check a semantic color, e.g. pinned D-day = success token).
- `npm run check:agents` if you edit `CLAUDE.md` (edit CLAUDE.md only, then `npm run sync:agents`).

## Current visual state (2026-08-26)

Palette A + Karrot grammar are applied app-wide. Home (SCR-A02) uses full-bleed hairline rows
with 진행/대기 ink-chip tabs and a history entry; SCR-A09 (history, 4 tabs) and MOD-04 (slot
paywall sheet) are the newest screens and have reference pages. SCR-A08 reference was refreshed
to match the shipped profile.

Known improvement candidates (previously identified, none started — all still need the
propose→confirm loop):

- SCR-A07 알림함 / SCR-A08 마이: convert card-style lists to the Karrot full-bleed hairline row
  pattern used on home (pre-authorized direction; still preview-confirm the concrete design).
- SCR-A05's 9 status variants: visual consistency pass across the variants.
- Empty states: unify tone/illustration across screens (home, history, notifications).
- Web (SCR-W01..06): CLS 0.1666 measured on the invite route — layout-shift polish.
- New surfaces (MOD-04 sheet, profile slot row, SCR-A09) shipped function-first; fit-and-finish
  welcome.

## Working conventions

- Branch off `feature/paid-slots-and-ads` (holds everything current; `main` is behind).
- Commits: English imperative, `type: description` ≤72 chars; Korean code comments; do not
  commit `.env*`, keys, or generated artifacts. Do not push, deploy, or build release artifacts —
  hand verified changes back for review instead.
- Report to the PO in Korean, quoting actual command output (§1-4 rule: never claim success
  without the verification output).
