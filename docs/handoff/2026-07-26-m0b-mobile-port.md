# Handoff — M0-B: Expo app, tokens, base components, SCR-A01

Date: 2026-07-26. Continues `2026-07-26-m0a-monorepo-shared-tdd.md`.

## Status: M0-B complete

`npm test` → **287 tests green** (Vitest 169 in `packages/shared`, jest-expo 118 in `apps/mobile`).
`npm run typecheck` clean across both packages with every strict flag on.

## What was built

| Path | What |
|---|---|
| `apps/mobile/` | Expo SDK 57.0.8 / RN 0.86.0 / React 19.2.3, Expo Router, jest-expo |
| `src/theme/tokens.ts` | all 90 tokens, guarded by a parity test against the CSS source |
| `src/theme/fonts.ts` | brand font resolution — the single swap point for Pretendard |
| `src/components/` | LfText, LfStack, LfRow, LfButton, LfCard, LfIcon, LfPinky, LfNotice |
| `src/app/index.tsx` | SCR-A01 login |

## Decisions that deviate from `04`, with reasons

1. **Easing tokens keep raw cubic-bezier coefficients** instead of `Easing.bezier(...)` (§5-1).
   Building the curve inside `tokens.ts` would make the token layer import
   react-native-reanimated. Animation code composes `Easing.bezier(...easing.standard)`.
2. **`react-native-web` and `react-dom` removed** from the Expo template. §2 forbids using Expo Web
   for the acceptance web; leaving them installed invites exactly that.
3. **`react-native-svg` added** — missing from §4-6's dependency list, but SCR-A01's logo is SVG paths.
4. **Auth/Supabase dependencies deferred to M1.** §4-6 installs them during setup; installing
   packages months before first use only invites version drift.
5. **Screen-specific numbers stay in the screen file.** §5-1 says promote a missing value into
   `tokens.css`, but `design-reference/` is read-only — and these values live in
   `screens/app-entry.css` in the original, so they were never tokens. They are named constants
   with the source noted.

## Verification, and what it does not cover

The token port is checked mechanically: `tokens.test.ts` parses
`design-reference/styles/tokens.css` and compares. **Mutation-checked** — changing one hex digit,
lowering `touchMin` below 48, or dropping one token each fail the suite.

The 48dp touch target is enforced across every button variant and size; lowering it fails seven
tests at once. Disabled buttons and token-sourced colours are likewise mutation-checked.

SCR-A01 was verified by **measuring the original in a browser** rather than by eye. Rendered
values match the ported constants exactly: badge 136×136 / radius 46, body gutter 28, wordmark
30/38, kakao button height 52 and `rgb(254,229,0)`, pinky xl 64, and all five strings.

**Not covered: a real side-by-side look on a device.** That needs an Android emulator or handset,
which this environment does not have. Structure, copy, dimensions and colours are pinned by test
and by measurement; letterform and antialiasing differences are not.

## Two known visual gaps

1. **Pretendard `.ttf` files are missing.** The repo holds only a web-only `woff2`. RN needs four
   static weights (400/600/700/800) — see `PRETENDARD_FILES` in `src/theme/fonts.ts`. Until they
   land, `brandFontFamily()` returns `undefined` and the app renders in the system font at the
   correct weights, so layout matches but letterforms differ. Naming an unbundled font family risks
   breaking Android rendering, which is why it is gated rather than set optimistically.
   **To finish: drop the four files into `apps/mobile/assets/fonts/`, register them with
   `expo-font`, and flip `BRAND_FONTS_LOADED` to true.** One file changes.
2. **Icons are Expo's MaterialIcons, not Material Symbols Rounded** — corner curvature differs
   slightly. Known and accepted (open issue C-2). Screens never import icons directly; `LfIcon` is
   the only entry point, so swapping later touches one file.

## Testing notes worth keeping

- **RNTL 14 made `render()` async.** Without `await`, you get an object with no query methods and a
  confusing "render function has not been called" from `screen`. Tests use the awaited return value
  rather than the global `screen`.
- RNTL 14 needs **`test-renderer`**, not the deprecated `react-test-renderer`. It is by the RNTL
  maintainer.
- `react-test-renderer` had to be pinned to React's exact version; `--legacy-peer-deps` would have
  hidden a real mismatch.
- Decorative icons are hidden from the accessibility tree on purpose, so their tests query with
  `includeHiddenElements: true`.

## The exact next step

**M0-B is done; M0-5 is next** — Supabase schema, RLS and the keep-alive workflow (`04` §10 M0-5).
That is the start of the backend surface.

**The PO asked to be told the moment backend work finishes**, so they can run an independent Codex
agent verification pass over it. Backend means `supabase/`: migrations from `02` §6-2, RLS from
`02` §9, the Edge Functions in `04` §7-3, and the `pg_cron` jobs J-01…J-10. Report at that
checkpoint and wait — do not roll on into M1.

Before schema work starts, `.env` needs checking: verify whether project `vepnrrmxvsytguocicfe`
issues a legacy `anon` JWT or an `sb_publishable_...` key.

## Still blocking

- **C-3** — the Cloudflare Pages subdomain, needed to finish the Supabase redirect allowlist.
- **Pretendard `.ttf` × 4** — needed for a faithful visual diff.
- Kakao console setup per `2026-07-26-kakao-supabase-oauth-findings.md`; **비즈 앱 전환 first**,
  or Kakao login fails entirely with KOE205.
