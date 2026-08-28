# 0012. Ink & sticker restyle (Setlog direction)

Date: 2026-08-27
Status: Accepted (PO-confirmed 시안 1a, 2026-08-27)

## Context

The PO commissioned a full visual direction change and confirmed the "잉크 & 스티커" (ink &
sticker) concept: a cream paper canvas, a single warm-ink foreground, butter/lavender/apricot
sticker containers, thick ink borders with hard offset "sticker" shadows, a black filled CTA, and
Gaegu (400/700) as the handwriting brand typeface. The deliverable arrived as a high-fidelity
reference bundle (`docs/디자인/setlog-restyle/`, landed in git before application) covering six
screens — SCR-A00·A01·A02·A03·A05(ACTIVE)·A08 — plus a complete token value swap.

This is the third PO-approved restyle after Fresh Green (2026-08-18) and Karrot/palette A
(ADR 0008): token *names and count* (115) stay frozen, *values* move, and the whole product
restyles through the one-source three-target pipeline. Per-screen decoration beyond the six
confirmed screens (A05's other 8 variants, MOD-01..04, W01..06 doodles/stickers), a hand-drawn
icon set, and a Promise Seam motion rework remain unconfirmed and were not built.

## Decision

1. **Token swap in place** — 72 of 115 values changed: ink `#221C13` takes primary/action/text
   anchor roles, background `#F3ECDC` cream, surface `#FFFDF4`, butter `#F6E7A3`
   (primary-container/success-container), lavender `#6B58A8`/`#E7DFF6` (record/reward),
   apricot `#B05F2C`/`#F8DDBE` (attention/penalty). Kakao/Google button colors and error
   `#C4433B` unchanged. Type scale up ~1 step (body 14→15 …), weights converge to Gaegu's two
   files (`--lf-weight-medium` 600→400, `--lf-weight-heavy` 800→700), radii round up (md 14,
   lg 16, record 18, 2xl 24), elevations become offset sticker shadows
   (`3px 4px 0 rgba(34,28,19,…)`, blur 0). `--lf-color-success` deliberately collapses to ink +
   butter — status is always carried by its text label (§8), so the mono palette does not
   reduce distinguishability.
2. **The override layer was merged, not shipped.** The bundle's `setlog-restyle.css` rules were
   folded into `design-reference/styles/components.css` (32 existing selectors edited in place +
   a new STICKER DECOR section for the 20 `.sl-*` rules) and
   `design-reference/styles/screens/app-entry.css` (the 13 entry/home selectors that load after
   components.css at equal specificity — appending them to components.css would have silently
   lost them). The six screen HTMLs were taken from the bundle minus the override `<link>`.
   A02's two inline-styled sparkle doodles became `.sl-dd--sparkle-home-*` classes in
   app-entry.css (the reference library forbids inline styles).
3. **Gaegu loads platform-natively.** RN: `@expo-google-fonts/gaegu` via `theme/fontAssets.ts` +
   `theme/fonts.ts` (`BRAND_FONT_FILES` {'400','700'}, type renamed `BrandFontWeight`);
   `_layout.tsx` untouched. Web: `@fontsource/gaegu` 400/700 imports in `main.tsx` — the
   reference's Google Fonts `@import` never runs on the self-hosted web (04 §5-3, PO 2026-07-29).
   Pretendard stays on disk as the woff2/CSS fallback; its RN ttf entries were dropped from
   `FONT_ASSETS` (unreferenced assets are not bundled).
4. **Components mirror the merged CSS**: LfButton (filled = ink fill + sticker shadow;
   outlined/tonal 2.4px ink border; kakao 2.5px + bold label; danger 2.2px on surface; text
   variant underlined), LfChip (2px ink border, butter/lavender/apricot sticker tones, tab chips
   2.2px), LfSwitch (ink-bordered track, ON = butter track + ink knob), LfCard (2.2px ink border
   + sticker shadow), LfHero (surface sticker card, radius 18, rotate −1.2°, apricot flag),
   PromiseListRow (hairline full-bleed row → bordered sticker card row + 46px lavender circular
   D-Day badge), LfInput/LfTextarea/LfPicker (2px ink, radius-md), LfChoice (selected = ink
   inversion), LfNotice (ink underline style, text-secondary), LfAvatar (2.4px ink), the four
   bottom sheets + history sheet (2.5px ink border, no bottom edge), LfFab (dead code, kept
   consistent: bottom-center + sticker shadow — the live create button is LfBottomNav's center,
   which restyles via token flow-through). New `LfMascot` and `LfDoodle`/`LfDoodleLayer`
   (react-native-svg, token colors only, decorative a11y flags, CSS `.sl-dd--*` placements
   mirrored as `DOODLE_PLACEMENTS`). A03 gained the typewriter intro line through the
   `Localized<T>` catalog (`promise-edit-labels.ts`, step 1 only).
5. **Web lockstep confirmed**: `apps/web/src/styles/components.css` received the same shared-class
   merges (user-confirmed 2026-08-27), keeping its documented divergences (pinky PNG). W screens
   carry the shared-class sticker look; their per-screen decorations stay unconfirmed.
6. **Supporting-copy legibility correction** (PO-confirmed 2026-08-27): `.lf-disclaimer` and RN's
   matching `LfText` variant move from micro 11.5/16, regular 400, `text-faint` to caption 12.5/18,
   bold 700, `text-secondary`. The immutable legal copy is unchanged; the rule also covers generic
   supporting guidance that shares this class, including SCR-W04's app-install push notice.
   Follow-up browser review widened that correction to the complete small-copy hierarchy:
   `.lf-card__meta`, `.lf-body--secondary`, `.lf-caption`, `.lf-field__label`, and
   `.lf-list-item__supporting` are label 14/22 + bold + `text-secondary`; `.lf-field__hint`, proof
   labels, and photo captions are caption 12.5/18 + bold. Proof text uses full `text` ink on
   `surface-muted`, where `text-secondary` measured only 4.41:1. RN mirrors the hierarchy through
   `caption`, `sectionTitle`, `listMeta`, and bold `secondary` body text. The A06 upload filename
   and A08 slot-release explanation were also restored in RN where the frozen reference already
   carried them.

## Deviations from the bundle (deliberate, recorded here)

- `--lf-font-brand` keeps `'Pretendard Fallback'` after `'Pretendard'` — the bundle dropped it,
  but it is the web CLS metric-fallback mechanism pinned by `seo.test.ts`, not a design value.
- `.lf-home__row-dday` font-size now reads `var(--lf-type-list-dday-size)` (16px) instead of the
  bundle's stale raw `15px` — the bundle itself bumped that token for this badge.
- Stamp tone modifiers (`.lf-stamp--reward/--broken/--neutral`, app-detail.css) still win over
  the new surface base — A05 ACTIVE uses no tone modifier so it renders exactly as the bundle
  preview, and the tone variants belong to unconfirmed screens where status distinction should
  survive until their own restyle pass.
- `.lf-card--emphasis` keeps its 2px record (lavender) border: no confirmed screen shows an
  emphasis card, and record-owns-information stays coherent in the new palette.
- RN `LfCard` flat variant zeroes the sticker shadow (a transparent surface with an offset
  shadow leaves a floating shadow box on Android).
- The A00 mascot accessibility label moved 새끼손가락 걸기 → 리틀핑거 마스코트 (both locales) —
  the PO-approved reference changed the image, and a stale label would lie to screen readers.

## Consequences

- `design-reference/` moves to a new frozen baseline: 잉크 & 스티커 (시안 1a). The bundle
  directory was deleted after application per the docs/handoff retention rule; the landing
  commit preserves it in history.
- Tests moved deliberately, never loosened: tokens.test.ts (palette hex/elevation/weight
  literals, the web `.lf-notice` structural regex → text-secondary), components.test.tsx (ink
  border widths, LfHero uniform radius+tilt, LfNotice/LfCard/brandSymbol values, + new decor
  smoke tests), fonts.test.ts (Gaegu package files, 2-weight map), the two `Pretendard-*`
  family assertions, seo.test.ts stays green via the font-brand deviation. WCAG AA pairs pass
  with the new values (cream-on-ink ≈ 15:1).
- Weight 800 no longer exists anywhere; heavy === bold (700). `PretendardWeight` is gone;
  `BrandFontWeight` is '400' | '700'.
- Known follow-ups for device QA (font-scale 1.5 reflow with Gaegu's wide tracking — D-Day
  badge/chip clipping; Android dashed-border rendering; elevation approximation of the offset
  sticker shadow) are listed in `docs/DEVELOPMENT_STATUS.md`.
- Verified 2026-08-27: typecheck (5 projects), vitest 104 files / 2,017 tests, jest-expo
  72 suites / 737 tests, Web build (133 modules), side-by-side Chrome comparison of the six merged
  reference screens against the bundle preview, follow-up 360×800 screenshots of A05·A06·A08·W04,
  and a 25-page / 77-element changed-class browser audit with no text or viewport horizontal
  overflow.
