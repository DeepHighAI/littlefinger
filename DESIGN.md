# Littlefinger Design System

## Product character

Littlefinger is a mutual-promise recorder. Its visual character is **friendly but firm**: warm
enough to make a promise together, quiet enough to preserve a confirmed record without pretending
to be a court, contract, or judge.

The approved direction is **잉크 & 스티커 (Ink & Sticker)** — Setlog direction, 시안 1a,
PO-confirmed 2026-08-27 (ADR 0012). The product reads like a warm paper journal: one ink draws
everything, stickers carry the moods.

- **Cream paper canvas** (`#F3ECDC`) with off-white sticker surfaces (`#FFFDF4`); a single warm
  ink (`#221C13`) draws text, borders, and the primary action.
- **Sticker containers** carry semantics: butter for brand/positive surfaces, lavender for the
  durable record, apricot for time/response attention.
- **Thick ink borders + hard offset shadows** (blur 0) make surfaces read as stickers laid on
  paper; key stickers sit at a slight hand-placed tilt (stamp −0.8°, pinned banner −1.2°).
- **Pretendard is the single product typeface** for Korean, English, display, body, metadata, and
  record strings; decorative ink doodles and the butter mascot appear on entry screens only.

The implementation reference is `design-reference/` (the merged baseline). Existing product
policy and state semantics still outrank this document.

## Design influences

The current system follows a stationery/journal direction (Setlog): hand-drawn ink lines and
sticker sheets rather than app-chrome minimalism. The earlier Toss/Karrot neutral-hierarchy
philosophy (see ADR 0008) shaped the information hierarchy that this restyle inherits — one
focal action per screen, state as text, restrained use of accent colour.

## Colour system

Composition target: **cream/ink neutrals ~75% · butter ~12% · lavender ~8% · apricot/danger ~5%**.
This is a composition rule, not a per-screen quota.

| Role | Token | Value | Use |
|---|---|---:|---|
| Identity & primary ink | Ink | `#221C13` | Text, ink borders, logo, selection, filled CTA |
| Primary action | Action fill | `#221C13` | Black filled CTA (pressed `#000000`) |
| Action text | On action | `#FFFDF4` | Text/icon on the black CTA |
| Brand/positive surface | Butter | `#F6E7A3` | Mascot, status/done chips, ON switch track, success container |
| Durable record | Lavender | `#6B58A8` | Record metadata, information, unread state |
| Record surface | Lavender soft | `#E7DFF6` | Record/reward containers, D-Day badge |
| Attention text | Apricot ink | `#B05F2C` | Deadline/response text and icons |
| Attention surface | Apricot | `#F8DDBE` | Urgent chips, penalty container |
| Canvas | Cream | `#F3ECDC` | App background |
| Surface | Paper | `#FFFDF4` | Cards, rows, inputs, sheets |
| Muted surface | Cream muted | `#EAE1CB` | Muted panels |
| Secondary ink | Secondary | `#6F6552` | Body and metadata |
| Muted ink | Muted | `#9A8E75` | Hints — large/auxiliary text only on cream |
| Outline | Warm outline | `#E0D5BA` / `#B8AB92` | Dashed separators, soft boundaries (ink owns real borders) |
| Destructive | Danger | `#C4433B` | Errors and destructive/failure states only (container `#F8DFDB`) |

Rules:

1. Ink means identity, action, selection, and structure. Borders are ink; the CTA is ink-filled.
2. Lavender means information already recorded or requiring calm attention; it never implies success.
3. Apricot means time or response attention. It never means failure.
4. Red is reserved for errors, destructive actions, BROKEN, and failure feedback.
5. Success collapses to ink + butter — the mono palette is legal because state is always a text
   label (rule 6); colour never carries status alone.
6. State always has a text label; colour is supporting information only.
7. Do not add a new status colour without a product-policy decision and token update.
8. Kakao and Google login buttons keep their official guide colours; only the shape (pill + ink
   border) is themed.

## Brand mark

The approved identity is **E-1 face/eyes with the C-1 pinky motion** from the final Claude Design
handoff. The PO explicitly selected E-1 for the installed app icon on 2026-09-04, superseding the
Type A Pinky Loop launcher decision in ADR 0018.

- **Launcher icon:** yellow `#FFE59A` field, the E-1 organic white face, and its small black hand-eye
  pair. Android/iOS own the platform mask, so exported artwork has no baked outer corner radius,
  presentation margin, or shadow.
- **Android adaptive icon:** the same E-1 face is centred inside the adaptive safe area. The
  monochrome layer contains only the hand-eye pair so Android can apply the system theme colour.
- **In-product, all surfaces:** use `mascot-face-e1.png` for the complete face and `eyes-e1.png` for
  the hand-eye expression. C-1 remains the approved pinky-loop motion; screens do not redraw these
  assets independently.
- `node tools/export-brand-icons.js` reproducibly generates `icon.png`, the three Android adaptive
  layers, and `splash-icon.png` from the permanent E-1 masters. The Play listing icon is the PO-curated
  `docs/디자인/store/app-icon/littlefinger-icon-512.png`; launcher export must not overwrite it.
  The source artboard remains `design-reference/ui-ux/project/assets/icon-face-e1.png`.
- The PO authorized the `0.3.0` Google Play build package on 2026-09-04. The mobile P8 set therefore
  uses the E-1 splash and `#FFE59A` launcher/notification colour. Cross-surface derivatives remain
  coupled to the incomplete P7 web port and do not block an Android internal/open-test package.

## Typography

- Pretendard is the only user-visible typeface. Korean and English, headings and body copy,
  fingerprints, timers, and decorative intro lines all use the same family; there is no display
  or monospace exception (ADR 0014).
- The weight contract is regular 400, medium 600, bold 700, and heavy 800. React Native loads four
  static files because Android variable-font weight selection is unreliable; the reference and
  acceptance web self-host Pretendard Variable.
- The type scale sits one step larger than the previous system (body 15, label 14) to keep the
  handwriting face legible.
- User-visible captions, sentence-length metadata, secondary body copy, field labels, and list
  supporting copy use at least label size/body line height (14/22), bold 700, and
  `text-secondary`.
- Disclaimer, field hints, and photo-tile labels use caption size/line height (12.5/18) and bold
  700. Use `text-secondary` on cream/paper, but full `text` ink on `surface-muted` because the
  secondary pair is only 4.41:1 there. The micro scale and `text-faint` are not for user-visible
  guidance.
- Typography must reflow at font scale 1.5 without clipping or relying on fixed-height text boxes;
  D-Day badges, chips, and dense metadata rows are the first things to re-check on device.

## Shape, spacing, and containment

- Layout keeps the 4dp spacing rhythm and the 16dp mobile gutter.
- Sticker card: 2.2px ink border, 16dp radius, offset sticker shadow (3,4, blur 0). Ordinary home
  promises are sticker card rows with a 46dp lavender circular D-Day badge.
- Record/stamp surfaces: 18dp radius, 2.5px ink border, −0.8° tilt on the confirmation stamp.
  The tilt expresses "placed by hand", not a legal stamp metaphor.
- The imminent banner is a −1.2° tilted sticker strip; it and the response card are the only
  deliberately emphasized containers.
- Pills keep compact status/filter semantics (2px ink borders); selection inverts to ink fill.
- Sheets rise with a 2.5px ink border and no bottom edge; separators inside lists are 2px dashed
  warm outline.
- The create action is the labeled bottom-center button.

## Screen application

- **Home:** cream canvas; tilted sticker imminent banner with apricot flag; sticker card rows with
  lavender D-Day badges; ink/outline filter chips; black Create action bottom-center; two small
  sparkle doodles.
- **Create:** cream canvas, paper fields with 2px ink borders; ink-inverted selected choices;
  black Send CTA. The fixed top region contains only the app bar and three-step progress; it does
  not repeat the active step as a large title or description. Reward and penalty both include the
  Starbucks, Olive Young and locale-specific 10,000 won / 10-dollar presets; "Be my servant" is
  penalty-only.
- **Confirmed detail:** tilted stamp sticker with approvals and fingerprint; lavender record
  metadata; butter status chip; lavender reward / apricot penalty patches; equal neutral treatment
  for both DISPUTED claims.
- **Entry (onboarding/login):** butter mascot + ink doodles; pill step icons (paper/butter/
  lavender); Pretendard wordmark; underlined notice.
- **Profile:** butter trust hero with ink ring; ink-bordered slot card and switches; dashed row
  separators.
- **Acceptance web:** the same shared-class sticker look and semantic roles apply via the token
  and components.css lockstep; per-screen doodles/stickers for W01..06 await their own approval.

## Navigation and motion

- Home and Profile are peer destinations. Create is the one central primary action and always has
  a visible label.
- Bottom navigation owns its actual safe-area inset. Screens must not apply it a second time.
- Wizard steps move for 240ms. The Promise Seam settles once for 400ms. No loop, bounce, confetti,
  or celebratory judgement is used. (A sticker-styled Seam reinterpretation is unconfirmed.)
- Reduced-motion mode removes spatial movement and uses an immediate state or a short fade.

## Accessibility and integrity

- Every interactive target is at least 48dp.
- Foreground/background token pairs must meet WCAG AA for their text size.
- State is always expressed with text in addition to colour.
- DISPUTED claims are visually equal in size, order, colour, and icon treatment — the ink mono
  palette makes this easier, not harder.
- `LfDisclaimer` owns the immutable legal copy. Screens never pass replacement text.
- When ads are disabled, no ad component or reserved space is rendered.
- Doodles and the mascot are decorative: hidden from the accessibility tree and never carry
  information.

## Token pipeline

`design-reference/styles/tokens.css` is canonical. Values are mirrored into
`apps/mobile/src/theme/tokens.ts` and `apps/web/src/styles/tokens.css`.
Screens and components never contain design literals. A missing value is added to the token layer
first, then mirrored and tested.

## Decision log

- 2026-09-04: PO compacted SCR-A03's fixed header to app bar + wizard progress only so fields gain
  vertical space, added Starbucks/Olive Young/10,000-won presets to reward and penalty, and added
  "Be my servant" to penalty only. Korean display copy is `나의 노예가 되어라`.
- 2026-09-04: PO rejected the installed Type A launcher and explicitly selected the Claude Design
  E-1 face icon. The launcher, Android adaptive layers and Play listing export now use the yellow
  field, organic white face and black hand-eye pair (ADR 0019).
- 2026-08-31: PO selected the butter-field / solid-ink Type A launcher and ink/butter in-product
  pair. The shared silhouette remains unchanged; the white outlined treatments of ADR 0016/0017
  are superseded (ADR 0018).

- 2026-08-23: PO approved Soft Promise → Quiet Record for Home, Create, Promise Detail, Profile,
  the all-promises route, and matching semantic colour roles on the acceptance web.
- 2026-08-23: PO approved A — Pine Anchor · Warm Promise · Blue Record — as the full-product
  palette. The earlier single-green Fresh Green palette is superseded.
- 2026-08-23: PO approved the asymmetric friendly hero and the one-shot Promise Seam as the two
  signature elements.
- 2026-08-23: PO requested lighter filled actions and urgent chips, 26dp navigation/app-bar icons,
  and a warm-ivory pinky mark on the central Create action.
- 2026-08-27: PO confirmed the 잉크 & 스티커 (Setlog, 시안 1a) restyle — full token swap + six
  screens (A00·A01·A02·A03·A05 ACTIVE·A08). Palette A, the asymmetric hero, and the Karrot
  full-bleed home rows are superseded (ADR 0012). Per-screen decoration beyond the six screens,
  hand-drawn icons, and the Seam rework remain unconfirmed.
- 2026-08-27: PO confirmed Type A — Pinky Loop as the production brand mark: launcher = ink/paper,
  in-product = ink/butter with its inverse. The previous green mark and abstract oval-gap proposal
  are superseded (ADR 0013).
- 2026-08-31: PO selected the flat forced-perspective launcher artwork with butter field,
  paper-white hands, and ink outlines. This supersedes only ADR 0013's launcher rendering; the
  Type A in-product mask and splash treatment remain unchanged (ADR 0016).
- 2026-08-31: PO approved the detailed in-product Pinky Loop: the clipped left/right contours were
  restored without changing the hand gesture, the outline was supersampled for clean raster edges,
  and mobile now fixes every mark to butter/white/ink instead of container-dependent tinting
  (ADR 0017).
- 2026-08-27: PO replaced the Gaegu/Roboto Mono typography split with Pretendard for every Korean
  and English text role. Pretendard 400/600/700/800 is the single cross-surface contract (ADR 0014).
- 2026-08-30: PO approved the seven ADR 0015 surfaces as design-reference baselines (ADR 0015):
  MOD-05 혜택 시트 (rewarded 30-day extension + ₩2,000 permanent retention, plus its locked
  state), MOD-02 role-based witness capacity (free 1 + rewarded 1, locked slot), the SCR-A02
  in-feed banner after the fifth card at six or more rows, SCR-A05 ACTIVE with no end date and
  the AMEND_PENDING (FINISH) agreement, the SCR-A03 free-range helper line, MOD-01 with the
  "종료일 없음" choice, and the SCR-W04 / SCR-W05 no-end and finish views. P4 is amended:
  exposure ads stay out of every trust moment and the whole acceptance web, but a rewarded ad
  the user starts may live inside a trust-moment sheet for witness, duration, and
  personal-retention benefits (ADR 0015 D7). The retention row uses lavender (durable record),
  never success or attention colour.
