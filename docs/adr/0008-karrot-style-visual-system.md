# 0008. Karrot-style hierarchy and the Littlefinger role palette

Date: 2026-08-23
Status: Accepted, amended by palette A (PO-approved via preview boards, 2026-08-23)

## Context

The PO asked for a UI/UX refresh toward 당근 (Karrot)'s look and feel. Karrot's
visual identity comes less from its orange brand color than from its neutral
system: a cool gray hierarchy, hairline dividers instead of shadows, slightly
squarer radii, full-bleed list rows instead of cards, and dark-ink filter chips
that reserve the brand color for CTAs and accents.

The project already had one PO-approved restyle precedent: Fresh Green
(2026-08-18) redefined token *values* in place while keeping every token *name*,
so all 27 reference screens, the RN app, and the acceptance web restyled through
the three-target token pipeline without markup changes.

## Decision

Four decisions were confirmed with the PO through /design-consultation
(D1–D7, 2026-08-23), previewed on a live comparison board rendering the real
reference screens, then applied:

1. **Progressive scope** — tokens everywhere first; Karrot layout patterns
   piloted on the home screen (SCR-A02) only, expansion decided after seeing it
   in the app.
2. **Keep the brand green.** Primary `#00BF40` and the pinky symbol stay.
   Only neutrals, shape, and elevation adopt Karrot values, taken verbatim from
   Karrot's public seed-design v3 tokens (`@seed-design/rootage-artifacts@2.6.0`):
   - Text ink `#1A1C20` / `#555D6D` / `#868B94` / `#B0B3BA` (gray-1000/800/700/600)
   - Surfaces muted `#F3F4F5` (gray-200); outlines `#EEEFF1` / `#DCDEE3` (gray-300/400)
   - Radius xs 6 / sm 8 / md 10 / lg 12 / xl 12 / 2xl 20 (seed r1_5–r5)
   - Elevation reduced to whisper shadows; hairlines separate surfaces
   - Error aligned to seed red-800 `#CA1D13`; penalty container to seed
     carrot-200 `#FFE8DB` (distinct from primary now that orange is free)
3. **Home adopts the Karrot pattern** (both reference HTML and RN `home.tsx`):
   filter chips with ink-filled selection (`.lf-tab` restyle, `LfChip`
   ink/outline tones), full-bleed promise rows with hairline dividers
   (`.lf-home__row*`, `PromiseRow`), the pinned promise as a rounded banner
   strip (`.lf-home__pinned`, `PinnedBanner`), and status rendered as bold meta
   text instead of a chip (§8: state is always text, never color alone).
4. **Memorable thing: 친근한 신뢰** — the design reads friendly first, with the
   record's weight expressed at the confirmation moments, not everywhere.

## 2026-08-23 amendment: palette A

After the hierarchy refresh, user feedback identified that applying one green family to brand,
actions, information, and attention made the service monotonous and visually inexpensive. A second
comparison board tested colour philosophies inspired by Toss and Karrot without copying either
service's brand colour. The PO approved **A — Pine Anchor · Warm Promise · Blue Record** for the
full product.

The original layout decisions in this ADR remain. Decision 2's Fresh Green values are superseded by
the semantic palette in `DESIGN.md`:

- Pine `#0B6B4B` owns identity, progress, selection, approval, and trust.
- Action `#78CEA5` with ink `#12382B` owns filled primary actions.
- Record Blue `#466FA8` with Blue Soft `#EAF1FB` owns durable record and information.
- Apricot `#FFF1E6` with ink `#B86A24` owns deadline and response attention.
- Canvas `#F7F8F6` and neutral ink/dividers carry most of the interface.
- Danger `#C4433B` is reserved for error, destructive action, BROKEN, and failure feedback.

The target composition is neutral 70%, green 18%, blue 9%, attention/danger 3%. Colour always
supports a text label and does not alter any domain status semantics.

## Consequences

- `design-reference/` was edited under the same rule as the earlier Fresh Green migration: a
  PO-approved restyle is the one sanctioned way the reference moves. The home
  screen's markup changed this time (pattern pilot), so the RN port diff target
  for SCR-A02 is the new row layout.
- The token pipeline stays three-target and machine-checked: canonical
  `design-reference/styles/tokens.css` → `apps/mobile/src/theme/tokens.ts`
  (tokens.test.ts parity, updated literal shadow assertions) →
  `apps/web/src/styles/tokens.css` (byte-equal values).
- `LfText` gained reference-backed variants (`listTitle`, `listMeta`,
  `listStatus`, `dday`, `ddayXl`, `containerFlag`, `containerTitle`) and
  `LfChip` gained `ink`/`outline` tones, keeping design literals out of screen
  code.
- Filled action contrast and all semantic foreground/background pairs remain enforced by
  `tokens.test.ts`. Pine no longer carries ordinary CTA, information, and attention simultaneously.
- The row pattern remains a home/list hierarchy decision. The A colour roles apply globally to
  mobile, acceptance web, and the reference gallery without changing screen structure.
- Verified 2026-08-23: typecheck (5 projects), vitest 1976 tests, jest-expo 650
  tests, and visual screenshots of the applied reference home/empty screens.
