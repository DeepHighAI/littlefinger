# Littlefinger Design System

## Product character

Littlefinger is a mutual-promise recorder. Its visual character is **friendly but firm**: warm
enough to make a promise together, quiet enough to preserve a confirmed record without pretending
to be a court, contract, or judge.

The approved direction is **Soft Promise → Quiet Record**, expressed through the A palette:
**Pine Anchor · Warm Promise · Blue Record**.

- **Soft Promise** applies to Home, Create, and pre-confirmation detail. Use neutral canvas, mint
  promise surfaces, apricot attention cues, conversational copy, and one clear action.
- **Quiet Record** applies once a version has been activated. Use a neutral canvas, symmetric
  record surfaces, precise alignment, and record blue for durable information.
- Profile uses a neutral canvas with one green trust hero.

The implementation reference is `design-reference/design_handoff_develop/`. Existing product
policy and state semantics still outrank this document.

## Design influences

The system follows the colour philosophy of Toss and Karrot without copying either brand colour.

- Toss: a broad neutral foundation lets one action or piece of information become the focal point;
  saturated colour is used intentionally, not as page paint. See Toss Tech's
  [colour-system update](https://toss.tech/article/43385) and
  [brand-symbol research](https://toss.tech/article/43061).
- Karrot: semantic colour families and seed tokens keep brand, information, attention, and danger
  roles distinct. See [SEED colour foundations](https://seed-design.io/foundations/color/palette)
  and the [SEED Design repository](https://github.com/daangn/seed-design).

## Colour system

Target distribution is **neutral 70% · green 18% · blue 9% · attention/danger 3%**. This is a
composition rule, not a per-screen quota.

| Role | Token | Value | Use |
|---|---|---:|---|
| Identity | Pine | `#0B6B4B` | Logo, progress, selected navigation, confirmation |
| Promise surface | Mint | `#E7F4ED` | Promise hero, approval, positive support surface |
| Primary action | Action | `#78CEA5` | Filled CTA and central Create action |
| Pressed action | Action pressed | `#62BF92` | Pressed filled CTA |
| Action text | Action ink | `#12382B` | Text/icon on Action |
| Durable record | Record blue | `#466FA8` | Confirmed metadata, information, unread state |
| Record surface | Blue soft | `#EAF1FB` | Record and information containers |
| Attention surface | Promise apricot | `#FFF1E6` | Deadline, response-needed, checking, amendment |
| Attention text | Attention ink | `#B86A24` | Text/icon on Promise apricot |
| Canvas | Canvas | `#F7F8F6` | App background |
| Primary ink | Ink | `#191C1B` | Main text |
| Secondary ink | Secondary | `#5F6864` | Body and metadata |
| Muted ink | Muted | `#7B837F` | Hints and tertiary metadata |
| Divider | Divider | `#E2E6E3` | Hairlines |
| Strong divider | Strong divider | `#CFD6D2` | Inputs and stronger boundaries |
| Destructive | Danger | `#C4433B` | Errors and destructive/failure states only |
| Destructive surface | Danger soft | `#FCECEA` | Error container |

Rules:

1. Green means identity, action, progress, approval, or trust. It is not the default page colour.
2. Blue means information already recorded or requiring calm attention; it never implies success.
3. Apricot means time or response attention. It never means failure.
4. Red is reserved for errors, destructive actions, BROKEN, and failure feedback.
5. Neutral surfaces carry ordinary lists, forms, navigation, and most copy.
6. State always has a text label; colour is supporting information only.
7. Do not add a new status colour without a product-policy decision and token update.

## Typography

- Pretendard is the product typeface.
- Weight 800 is reserved for D-day and confirmation headlines.
- Weight 700 is for titles; 400/600 is for body, labels, and metadata.
- Typography must reflow at font scale 1.5 without clipping or relying on fixed-height text boxes.

## Shape, spacing, and containment

- Layout uses the existing 4dp spacing rhythm and a 16dp mobile gutter.
- Friendly hero: 28dp corners with a 12dp lower-left tail. It is the single deliberate asymmetric
  shape and must not spread to ordinary cards.
- Record surface: symmetric 16dp corners, a quiet outline, and no ornamental stamp metaphor.
- Ordinary home promises are full-width rows separated by hairlines. Explicit containers are
  reserved for the hero and items that need a response.
- Pills are for compact status/filter semantics, not as a default container for content.

## Screen application

- **Home:** neutral canvas; Mint promise hero; Apricot response-needed cue; Blue trust/record entry;
  Action only for the response CTA and central Create action.
- **Create:** neutral canvas and white fields; Pine progress; Blue helper; Apricot review attention;
  Action for Next/Send.
- **Confirmed detail:** neutral canvas; Blue Soft record block and Record Blue metadata; Mint only
  for mutual approval/confirmation; equal neutral treatment for both DISPUTED claims.
- **Profile:** neutral canvas; Mint trust hero with Pine ring; Blue settings icons; red only for
  logout/withdrawal danger affordances where applicable.
- **Acceptance web:** the same semantic roles apply. Confirmation uses Mint; record information
  uses Blue; time/response attention uses Apricot; ordinary content stays neutral.

## Navigation and motion

- Home and Profile are peer destinations. Create is the one central primary action and always has
  a visible label.
- Bottom navigation owns its actual safe-area inset. Screens must not apply it a second time.
- Wizard steps move for 240ms. The Promise Seam settles once for 400ms. No loop, bounce, confetti,
  or celebratory judgement is used.
- Reduced-motion mode removes spatial movement and uses an immediate state or a short fade.

## Accessibility and integrity

- Every interactive target is at least 48dp.
- Foreground/background token pairs must meet WCAG AA for their text size.
- State is always expressed with text in addition to colour.
- DISPUTED claims are visually equal in size, order, colour, and icon treatment.
- `LfDisclaimer` owns the immutable legal copy. Screens never pass replacement text.
- When ads are disabled, no ad component or reserved space is rendered.

## Token pipeline

`design-reference/styles/tokens.css` is canonical. Values are mirrored into
`apps/mobile/src/theme/tokens.ts`, `apps/web/src/styles/tokens.css`, and the approved handoff bundle.
Screens and components never contain design literals. A missing value is added to the token layer
first, then mirrored and tested.

## Decision log

- 2026-08-23: PO approved Soft Promise → Quiet Record for Home, Create, Promise Detail, Profile,
  the all-promises route, and matching semantic colour roles on the acceptance web.
- 2026-08-23: PO approved A — Pine Anchor · Warm Promise · Blue Record — as the full-product
  palette. The earlier single-green Fresh Green palette is superseded.
- 2026-08-23: PO approved the asymmetric friendly hero and the one-shot Promise Seam as the two
  signature elements.
- 2026-08-23: PO requested lighter filled actions and urgent chips, 26dp navigation/app-bar icons,
  and a warm-ivory pinky mark on the central Create action.
