# Littlefinger Design System

## Product character

Littlefinger is a mutual-promise recorder. Its visual character is **friendly but firm**: warm
enough to make a promise together, quiet enough to preserve a confirmed record without pretending
to be a court, contract, or judge.

The approved direction is **잉크 & 블록 (Ink & Block)** — 시안 1a, 45° hard shadow, PO-confirmed
2026-09-06 and applied to every app screen and the acceptance web by 2026-09-07 (ADR 0020). It is a
neo-brutalist reading of the paper journal: one ink draws everything, four saturated faces carry
the moods, and every container is a block sitting on paper.

- **Paper canvas** (`#FBF8F1`) with off-white paper surfaces (`#FFFDF4`); a single warm ink
  (`#221C13`) draws text, borders, and the shadows themselves.
- **Four faces carry semantics**: yellow for brand / selection / the primary action, mint for
  progress and completion, pink for deadline / response / failure / penalty, sky for the durable
  record, amendment and reward. Text on a face is always ink.
- **Thick ink borders + blur-free 45° block shadows** (`5px 5px 0` / `3px 3px 0`) make surfaces
  read as blocks laid on paper. Nothing tilts; nothing blurs. Sheets have borders and no shadow.
- **Block shapes**: r14 cards, buttons and app bar; r10 tabs, inputs and tiles; r8 status chips;
  r20 sheet tops. Pills survive only on avatars, mascot circles, the switch and progress bars.
- **Pretendard 500 / 600 / 800 / 900** is the single product typeface for every user-visible string.

The implementation reference is `design-reference/` (the frozen baseline) and the bundle it was
built from, `design-reference/design_handoff_ink_block/` (read-only). Existing product policy and
state semantics still outrank this document.

## Design influences

The system is a neo-brutalist take on the stationery / journal direction of ADR 0012 (Setlog):
hard shadows and block shapes instead of stickers and tilt. The information hierarchy is inherited
from the Toss / Karrot phase (ADR 0008) and the 2026-09-03 pastel restyle (recorded in ADR 0020):
one focal action per screen, state as text, no bottom tab bar, the three-step creation wizard.

## Colour system

Composition target: **paper / canvas / ink neutrals ~75% · yellow ~12% · mint + sky ~8% ·
pink / danger ~5%**. This is a composition rule, not a per-screen quota.

| Role | Token | Value | Use |
|---|---|---:|---|
| Ink | `text` · `primary` · `action-fill` · `outline-icon` | `#221C13` | Text, borders, shadows, switch knob, unread dot, wordmark |
| Paper | `surface` · `on-primary` · `on-action` | `#FFFDF4` | Cards, rows, inputs, sheets, app-bar block, trailing squares |
| Canvas | `background` · `surface-chrome` | `#FBF8F1` | Screen background, status bar, browser bar |
| Muted | `surface-muted` · `outline` | `#EFE9DC` | Read-only faces, DISPUTED / UNRESOLVED / DECLINED / CANCELED tiles, dashed row dividers |
| Secondary ink | `text-secondary` · `text-muted` · `text-faint` · `outline-strong` | `#6F6552` | Meta, captions, dashed placeholders — **never on the four faces** |
| Yellow | `primary-container` · `brand-symbol-on-action` | `#FFD43B` | Brand tile, selection, filled CTA, imminent hero, DRAFT, unread notification, ON switch |
| Mint | `success-container` | `#5FD3A5` | ACTIVE, COMPLETED, the confirmed stamp, trust-ring fill |
| Pink | `attention-container` · `penalty-container` | `#FF6F91` | Deadline, response needed, CHECKING, BROKEN, penalty, hero badge, menu unread dot |
| Sky | `record-container` · `reward-container` · `primary-pale` | `#6CB4FF` | Durable record, AMEND_PENDING, no end date, reward, progress fill, slots tile |
| Danger | `error` / `error-container` | `#C4433B` / `#F8DFDB` | Errors and destructive actions only |
| Kakao · Google | `kakao*` · `google*` | `#FEE500` · `#191919` / `#FFFFFF` · `#1F1F1F` · `#747775` | Official colours, unchanged |
| Focus ring (web) | `focus-ring` | `#2F6FB3` | On canvas / paper / muted / yellow only |
| Scrim | `scrim` | `rgba(34,28,19,.42)` | Behind sheets |

Rules:

1. Ink means identity, structure and depth: borders are ink, shadows are ink, the wordmark is ink.
   The primary action is **yellow with an ink label** — there is no black filled button.
2. Yellow means brand, selection and "act here". It is the only face that may fill a CTA.
3. Mint means progress or completion; it never implies a judgement about a person.
4. Pink means time or response attention and failure states (CHECKING, BROKEN, penalty). It never
   means an error — red does.
5. Sky means information already recorded or under negotiation, and the reward.
6. Red is reserved for errors, destructive actions and failure feedback.
7. State always has a text label; the tile, chip or face is supporting information only. The
   status → face → icon table lives in `status-tone.ts` and `PROMISE_STATUS_LABEL` names it.
8. Text on any of the four faces is ink. Secondary ink sits only on canvas, paper and muted
   (yellow measures 4.03:1 against it and fails AA).
9. Do not add a new status colour without a product-policy decision and a token update.
10. Kakao and Google login buttons keep their official colours; only the shape (r14 + ink border +
    block shadow) is themed.

## Brand mark

The approved identity is **E-1 face / eyes with the C-1 pinky motion** (ADR 0019). The PO
selected E-1 for the installed app icon on 2026-09-04, superseding the Type A Pinky Loop launcher
of ADR 0018.

- **Launcher icon:** yellow `#FFE59A` field, the E-1 organic white face, and its small black
  hand-eye pair. Android/iOS own the platform mask, so exported artwork has no baked outer corner
  radius, presentation margin, or shadow.
- **Android adaptive icon:** the same E-1 face is centred inside the adaptive safe area. The
  monochrome layer contains only the hand-eye pair so Android can apply the system theme colour.
- **In-product:** the mascot lives inside **irregular ovals** (`LfOval`, `.lf-oval` — outer yellow
  `#FFD43B` with a 2.5 ink border and the 5 px block shadow, a borderless white inner oval):
  A09 130×104 with eyes 60, MOD-03 170×136 with the hand loop, W01 190×152 with loop and spark,
  W03 60×56, W06 190×152 muted with eyes 80. The home app bar carries a 36×34 yellow oval tile
  with the 28 face. Only the A02 empty state keeps the A00 SVG blob (240×211). Use
  `mascot-face-e1.png` for the complete face and `eyes-e1.png` for the hand-eye expression; C-1
  remains the approved pinky-loop motion. No circular (r999) mascot art remains.
- **Entry exception (ADR 0020 E11):** SCR-A00 keeps its SVG blob and SCR-A01 its two-layer oval,
  both in the old pale yellow `#FFE59A` with a −2° tilt as component literals.
- `node tools/export-brand-icons.js` reproducibly generates `icon.png`, the three Android adaptive
  layers, and `splash-icon.png` from the permanent E-1 masters. The Play listing icon is the
  PO-curated `docs/디자인/store/app-icon/littlefinger-icon-512.png`; launcher export must not
  overwrite it. The source artboard remains `design-reference/ui-ux/project/assets/icon-face-e1.png`.
- `app.json` derivatives follow the tokens: splash background = canvas `#FBF8F1`, notification
  accent = yellow `#FFD43B` (re-derived 2026-09-07, PO-delegated). The adaptive-icon field stays the
  curated `#FFE59A` because it is part of the E-1 launcher bitmap, not a token derivative.

## Typography

- PO copy update (2026-09-07, ADR 0021): use one language per locale, with no decorative English
  prefix on Korean labels. Approved compact Korean replacements must fit their existing slots;
  do not shrink text or spacing to make copy fit. The current gallery includes these copy changes.

- Pretendard is the only user-visible typeface — Korean and English, headings and body, the
  fingerprint, timers and the wordmark (ADR 0014). `word-break: keep-all` on the web.
- The weight contract is **regular 500, medium 600, bold 800, heavy 900**. React Native loads four
  static files (`Pretendard-Medium / SemiBold / ExtraBold / Black.ttf`) because Android
  variable-font weight selection is unreliable; the reference and acceptance web self-host
  Pretendard Variable. Weight 700 does not exist: unselected tabs and chips use 600, everything the
  bundle called 700 uses 800 (ADR 0020 E8).
- Scale (size / line / weight): wordmark 40 / 46 / 900 (the header wordmark is 22 / 900) ·
  display 36 / 42 / 900 · headline 30 / 36 / 800 · title 24 / 30 / 800 · card title 22 / 28 / 900 ·
  sheet title 20 / 26 / 800 · stamp 17 / 22 / 900 · app-bar title and CTA label 16 / 800 ·
  body 15 / 22 / 600 · row title 15 / 20 / 800 · label and button 14 / 800 · chip 13 / 800 ·
  status chip 12 / 800 · meta 12 / 18 / 600 secondary · caption and disclaimer 12.5 / 18 / bold
  secondary · eyebrow 11 / 16 / 800 / .12em secondary.
- Tracking: tight −0.03em on display, headline and title; −0.04em on the wordmark; .12em / .16em
  on eyebrows.
- Inside a four-face container everything is ink, including meta and captions (`LfInkContext` in
  RN, the tone rules in `components.css`).
- Typography must reflow at font scale 1.5 without clipping or fixed-height text boxes; the 56 h
  CTA label, status chips and the D-Day square are the first things to re-check on device.

## Shape, spacing, and containment

- Layout keeps the 4 dp spacing rhythm, the 16 dp app gutter and the 20 dp web gutter.
- **Radii:** 8 status chips and badges · 10 tabs, inputs, tiles, square icon buttons, segmented
  controls · 12 hero arrow and thumbnails · 14 cards, CTA, app bar, outcomes · 20 sheet top ·
  999 avatars, mascot circles, switch, progress bar.
- **Borders:** 2 px chips, inputs, tiles, avatars, switch · 2.5 px cards, buttons, app bar, sheets ·
  2 px dashed `#6F6552` ad slot, add-photo tile, locked witness slot · 2 px dashed `#EFE9DC`
  settings dividers.
- **Shadows** (blur 0, ink 100%): `5px 5px 0` cards, primary CTA, app bar, hero, FAB, stamp ·
  `3px 3px 0` selected tab, outlined / Kakao / Google buttons, picker, thumbnails, focus · none for
  flat cards, sheets and inputs. Press = `translate(3px,3px)` with the shadow reduced 5 → 2 /
  3 → none for 120 ms; hover on the web = `translate(−1px,−1px)` + 6 px. Disabled = opacity .3 and
  no shadow.
- **No tilt.** The four tilt tokens are `0deg`; A00 / A01 alone keep a −2° literal.
- **Sizes:** app bar 52 h (margin 8 16 0) · icon button 36 (48 touch via `::after` / `hitSlop`) ·
  CTA and FAB 56 h · secondary 50 h · Kakao 54 h · Google 52 h · tab 34 h · choice 36 h · status
  chip 28 h · input 48 h · switch 52×32, knob 20 · status tile 40 · hero arrow 46 · D-Day 56 ·
  avatars 34 / 44 / 48 / 56 · thumbnail 84 · progress 10 h · sheet handle 40×5.

## Component grammar

- **App bar** — paper block r14, 2.5 ink, 5 px shadow. Home: yellow oval tile + wordmark + a
  "메뉴 ☰" button (pink unread dot). Sub screens: square back button + centred 16 / 800 title +
  right action. Bell and avatar live in the **home menu sheet** (알림 · 마이 · 지난 약속 · 슬롯 n/m).
- **Buttons** — filled: yellow 56 h, ink label, paper trailing square 40 r10 with the icon;
  outlined: paper 50 h + 3 px; Kakao: `#FEE500` r14 + 3 px (5 px on the login screens); Google:
  official colours, ink border, 3 px; tonal: yellow 36 h r10; text: underlined. Home 약속 만들기 is
  the full-width yellow block above a 130 h paper fade.
- **Chips and tabs** — status chips 28 h r8 on their face; filter tabs 34 h r10, selected yellow
  with 3 px; choice chips 36 h r10, selected yellow. No pill chips.
- **Cards** — r14, 2.5 ink, 5 px, padding 16; `flat` drops the shadow. List rows carry a **40 dp
  status tile** (icon on its face: DRAFT `edit` yellow · PENDING `hourglass_empty` paper dashed ·
  ACTIVE `bolt` mint, no end date `all_inclusive` sky · AMEND_PENDING `sync_alt` sky · CHECKING
  `notification_important` pink · COMPLETED `check` mint · BROKEN `close` pink · DISPUTED `balance`
  muted · UNRESOLVED / DECLINED / CANCELED `remove` muted) beside a 15 / 800 title, 12 / 600 meta
  and a 28 h D-Day chip. A CHECKING row adds a full-width 44 h "지켜졌나요? 답하기" button.
- **Hero (imminent)** — yellow r14 block with a pink badge overhanging the top-left corner
  ("D-1 · 내일까지") and a paper arrow square 46 r12. No rotation, blob or eyes.
- **Sheets** — r20 top, 2.5 ink, no shadow, solid 40×5 handle, 20 / 800 title with a 36 close;
  segmented controls are one 2 px box r10 with vertical 2 px dividers, selected item yellow.
- **Stamp** — r14 + 5 px, no tilt and no rotate in the pop-in, borderless pastel corner blobs
  clipped by the card, the hand loop and spark on top; COMPLETED turns the whole card mint.
- **Inputs** — 48 h r10, 2 px, no shadow; the picker and the focused field gain 3 px (+ the web
  outline). Switch 52×32 with an always-ink knob, ON track yellow.
- **Records** — detail D-Day = 56 r14 yellow square; outcome cards sky (reward) / pink (penalty);
  proof thumbnails 84 r12 with 3 px; trust ring 88 / 12 mint with a double ink ring.
- **Notifications** — unread = yellow card + 5 px + ink dot + the "읽지 않음" label; read = paper
  flat. Settings groups are flat cards with dashed dividers.
- **Acceptance web** — the same grammar through the three shared CSS files, the browser bar kept,
  one primary CTA per page, W02 decline as an underlined text button, no ads anywhere.

## Screen application

- **Home:** brand app bar; greeting 30 / 36; three filter tabs; the yellow hero; status-tile rows;
  the in-feed banner slot after the fifth card at six or more rows (ADR 0009 · 0015); the
  full-width yellow create block. Empty state = A00 blob mascot + a yellow highlight span.
- **Menu sheet:** avatar 48 + nickname 18 / 900 + keepRate; a 2×2 grid of r14 cards routing to
  the existing notification, profile, history and (slots) profile screens.
- **Create:** app bar with the "작성 중" status chip; three 8 h progress bars + "1/3 · 내용"; two
  section cards; the CTA right-aligned in a paper action bar with 임시저장 as a text link. The
  reward and penalty presets (Starbucks, Olive Young, 10,000 won / 10 dollars, 나의 노예가 되어라
  penalty-only) stay.
- **Invite:** stamp with yellow corner blobs; Kakao share (3 px) + outlined link copy; the KakaoTalk
  preview bubble (2 px ink, r 4 / 14); the countdown card with a yellow `schedule` tile and a sky
  progress bar.
- **Detail:** status chip + date line + 24 / 30 title (+ the D-Day square on ACTIVE and the invite
  review); content card, people list, approvals; a compact stamp on the non-ACTIVE statuses;
  bottom actions = outlined secondary + yellow primary; 숨기기 / 신고 / 차단 as a text / danger row.
  **DISPUTED shows both claims as paper cards of equal size with paper chips** — no tone, order or
  icon may hint at a verdict.
- **Fulfillment:** answer tiles with a mint `check` / pink `close` tile and a 24 ring radio;
  selected = yellow + 5 px; proof tiles 84 r12; the waiting state is a flat paper row.
- **Entry (onboarding / login):** unchanged layout with token drift; blob / oval mascot in
  `#FFE59A` at −2°; Kakao 5 px + Google 3 px blocks.
- **Profile:** avatar 56 with a yellow 3 px shadow, the trust-ring card, the slots row with a sky
  tile and a yellow tonal "추가", flat settings cards with switches, the language segmented control.
- **Acceptance web:** W01 landing with the 190×152 oval and the pink countdown notice; W02 review
  as a 5 px content card; W03 completion with a mint stamp and the app / web re-entry bar; W04
  participant view with pink / sky cards and 56 h CTAs; W05 witness confirm; W06 expired with the
  muted oval and no primary CTA.

## Navigation and motion

- There is no bottom tab bar. Home is the hub: the app bar's 메뉴 opens the menu sheet, and every
  other screen returns through its square back button. Create is the one central primary action
  and always has a visible label.
- Press feedback moves the block 3 px along its shadow for 120 ms and never changes colour.
- Sheets rise for 240 ms on `emphasized-decelerate` while the scrim fades in.
- The stamp pops from scale .92 to 1 over 400 ms with no rotation. Wizard steps move for 240 ms.
- The C-1 pinky loop runs on a 2,600 ms cycle; reduced-motion mode stops it, removes spatial
  movement and uses an immediate state or a short fade. No confetti or celebratory judgement.

## Accessibility and integrity

- Every interactive target is at least 48 dp; 36 / 38 / 44 h controls expand their touch box with
  `::after` on the web and `hitSlop` in RN.
- Foreground / background token pairs must meet WCAG AA for their text size; ink on the four faces
  measures 11.85 / 9.13 / 6.38 / 7.73. Focus on mint, pink and sky is the ink 3 px block shadow
  because the blue outline fails 3:1 there.
- State is always expressed with text in addition to the tile, chip or face.
- DISPUTED claims are visually equal in size, order, colour and icon treatment.
- `LfDisclaimer` owns the immutable legal copy. Screens never pass replacement text.
- When ads are disabled, no ad component or reserved space is rendered.
- Ovals, blobs and the mascot are decorative: hidden from the accessibility tree and never carry
  information.

## Token pipeline

`design-reference/styles/tokens.css` is canonical — **179 tokens**, value-identical to the bundle.
Values are mirrored into `apps/mobile/src/theme/tokens.ts` (px = dp; shadows become `boxShadow`
arrays, easing coefficients stay numbers, weights become strings) and `apps/web/src/styles/tokens.css`.
`components.css` and `screens/web.css` are byte-identical between the reference and the web;
the web `base.css` is identical above its `/* WEB ONLY */` section. Screens and components never
contain design literals; a missing value is added to the token layer first, then mirrored and
tested. The only literals allowed are the ones in the ADR 0020 exception table (press offsets,
oval radii, the A00 / A01 entry values and the handful of README sizes without a token) — do not
grow that table without a PO decision.

## Decision log

- 2026-09-07: 잉크 & 블록 applied to every RN screen and the acceptance web; the web deployed to
  `littlefinger-app.web.app`; ADR 0020 records this baseline and the 2026-09-03 pastel one.
- 2026-09-06: PO confirmed the 잉크 & 블록 bundle (E1–E11): menu sheet replaces bell + avatar,
  40 dp status tiles, tilt abolished, the four faces saturated, r14 blocks and a yellow CTA (no
  black fill), Pretendard 500 / 900 added and 400 / 700 removed, 179 tokens with press values as
  literals, A00 / A01 kept with their old yellow and −2° tilt. The pastel values and the ADR 0012
  sticker grammar are superseded.
- 2026-09-04: PO compacted SCR-A03's fixed header to app bar + wizard progress only so fields gain
  vertical space, added Starbucks/Olive Young/10,000-won presets to reward and penalty, and added
  "Be my servant" to penalty only. Korean display copy is `나의 노예가 되어라`.
- 2026-09-04: PO rejected the installed Type A launcher and explicitly selected the Claude Design
  E-1 face icon. The launcher, Android adaptive layers and Play listing export now use the yellow
  field, organic white face and black hand-eye pair (ADR 0019).
- 2026-09-03: PO approved the 파스텔 × 잉크 & 스티커 restyle (D1–D9): bottom tab bar removed, the
  wizard kept, Kakao-yellow share button, status → pastel faces, E-1 everywhere, the Material
  Symbols subset for RN. Recorded retroactively in ADR 0020.
- 2026-08-31: PO selected the butter-field / solid-ink Type A launcher and ink/butter in-product
  pair. The shared silhouette remains unchanged; the white outlined treatments of ADR 0016/0017
  are superseded (ADR 0018).
- 2026-08-30: PO approved the seven ADR 0015 surfaces as design-reference baselines (ADR 0015):
  MOD-05 혜택 시트 (rewarded 30-day extension + ₩2,000 permanent retention, plus its locked
  state), MOD-02 role-based witness capacity (free 1 + rewarded 1, locked slot), the SCR-A02
  in-feed banner after the fifth card at six or more rows, SCR-A05 ACTIVE with no end date and
  the AMEND_PENDING (FINISH) agreement, the SCR-A03 free-range helper line, MOD-01 with the
  "종료일 없음" choice, and the SCR-W04 / SCR-W05 no-end and finish views. P4 is amended:
  exposure ads stay out of every trust moment and the whole acceptance web, but a rewarded ad
  the user starts may live inside a trust-moment sheet for witness, duration, and
  personal-retention benefits (ADR 0015 D7). The retention row uses the record face (sky since
  2026-09-03), never success or attention colour.
- 2026-08-27: PO confirmed the 잉크 & 스티커 (Setlog, 시안 1a) restyle — full token swap + six
  screens (A00·A01·A02·A03·A05 ACTIVE·A08). Palette A, the asymmetric hero, and the Karrot
  full-bleed home rows are superseded (ADR 0012).
- 2026-08-27: PO confirmed Type A — Pinky Loop as the production brand mark (ADR 0013); replaced
  the Gaegu/Roboto Mono typography split with Pretendard for every text role (ADR 0014).
- 2026-08-23: PO approved Soft Promise → Quiet Record, palette A (Pine Anchor · Warm Promise ·
  Blue Record), the asymmetric friendly hero and the one-shot Promise Seam. All four are
  superseded; the Seam component was deleted with ADR 0020.
