# 0020. Ink & block restyle (시안 1a, 45° hard shadow) — and the pastel baseline it replaced

Date: 2026-09-07
Status: Accepted (PO-confirmed bundle 2026-09-06; applied 2026-09-06 → 2026-09-07; web deployed 2026-09-07)

Supersedes the **visual system** of ADR 0012 (잉크 & 스티커). Keeps: the ADR 0011 layouts, the
E-1 brand mark (ADR 0019), Pretendard as the single typeface (ADR 0014 — weights change here), and
every ADR 0015 surface. Product policy, state transitions, labels, the legal disclaimer, ad rules,
`packages/shared` and `supabase` are untouched.

## Context

Two restyles happened between ADR 0012 and this record, and only the second has a bundle in the
repo. Both are recorded here so the visual baseline has a single traceable history.

### The pastel baseline (2026-09-03, shipped without an ADR)

The PO approved the Claude Design 확정안 「리틀핑거 파스텔 스티커」 (15 artboards, E-1 mascot, C-1
pinky loop) on 2026-09-03 and it was applied as the fourth restyle through commits `9896c3e` …
`0860177` (2026-09-03 → 2026-09-04), then packaged as 0.3.0 / Play codes 22–24. ADR 0019 went to
the launcher icon, so the restyle itself was only recorded in
`docs/plans/2026-09-03-pastel-sticker-restyle.md` (deleted with this ADR; git history keeps it).
PO decisions D1–D9 of that plan are the ones that still shape today's layouts:

- **D3 — bottom tab bar removed.** App bar avatar → 마이, bell → 알림, a floating pill CTA →
  약속 만들기; the 지난 약속 entry became the third home chip plus a 마이 row (ADR 0011 D3 kept).
- **D4 — SCR-A03 keeps the three-step wizard**, restyled per step. **D9 (2026-09-04)** compacted
  its fixed header to app bar + progress only and added the Starbucks / Olive Young / 10,000-won
  presets to reward and penalty, with `나의 노예가 되어라` as penalty-only.
- **D5 — adopt the 확정안 copy** (ko verbatim), while status labels, legal, error and §5
  validation copy stayed immutable; the PENDING partner name generalized to 상대방.
- **D6 — SCR-A04** ships a Kakao-yellow (`#FEE500`) share button with the existing
  '초대 링크 공유하기' label and the OS share sheet (C-4), an outlined 링크 복사하기, the KakaoTalk
  preview bubble and the expiry progress bar.
- **D7 — status → pastel mapping**: PENDING paper outline · ACTIVE mint · AMEND_PENDING sky ·
  CHECKING pink · COMPLETED mint · BROKEN pink · DISPUTED paper neutral · UNRESOLVED / DECLINED /
  CANCELED cream muted; text always ink, red only for errors. The four semantic faces (yellow,
  mint, pink, sky) were introduced here; ink & block only re-saturates them.
- **D1 / D2 — every undesigned app surface and the whole acceptance web** were extrapolated from
  the 확정안 rules, previewed in the gallery, confirmed, then implemented. **D8 — E-1 everywhere**
  (launcher, adaptive, splash, notification icon, in-app, web favicon/OG, store 512).
- Routine calls that still hold: Material Symbols Rounded static subset for RN via
  `tools/subset-icon-font.js` (closed C-2); no dashed placeholder for a disabled ad slot; the
  disclaimer keeps the ADR 0012 legibility tier (12.5/18, bold, secondary); Android status bar in
  canvas colour with dark icons; `design-reference/` migrated whole (41 pages) as the frozen
  baseline. Focus ring `#2F6FB3` was derived (not in the 확정안) and reported to the PO.

### The ink & block bundle (2026-09-06)

On 2026-09-06 the PO delivered a revised redesign handoff, `design-reference/design_handoff_ink_block/`
(README, `CLAUDE_CODE_PROMPT.md`, drop-in `tokens.css`, a style guide and four screen boards as
`.dc.html` prototypes). It is **"잉크 & 블록" — 시안 1a, 45° hard shadow**: a neo-brutalist reading
of the same product — thick ink borders, blur-free 45° ink block shadows, the four faces saturated,
square (r14) components, a paper app-bar block. Token *names* stay; *values* and the component
grammar change. A first bundle (`redesign-2026-09-06/`) had been implemented in sessions 1–3 and
was replaced by the revised one on PO decision (E7 / E10 below); it differed in five ways —
r14 header block instead of a pill, **yellow filled CTA/FAB with a paper trailing square (no black
fill anywhere)**, paper hero arrow, irregular-oval mascot instead of circles, A01 Kakao/Google r14
with ink shadows.

The bundle's viewer thumbnails and three third-party UI captures were not committed (copyright);
the rest is read-only reference.

## PO decisions (2026-09-06, chat-confirmed — not derivable from the bundle)

| # | Item | Decision |
|---|---|---|
| E1 | The README's five "PO 컨펌 필요" items — ① home app-bar bell + avatar → 메뉴 sheet ② status dot → 40 dp status tile ③ tilt abolished ④ four faces saturated ⑤ pill buttons → r14 blocks + full-width home CTA | **All five approved** |
| E2 | SCR-A00 onboarding · SCR-A01 login ("기존 유지") | Layout and markup kept; token drift (colour, weight, tilt 0) applies naturally. No token fork |
| E3 | Weights 500 / 900 | Pretendard v1.3.9 official static files may be downloaded (`Pretendard-Medium/Black.ttf`, Version 1.309, 14,716 glyphs — identical to the existing four) |
| E4 | Scope · order | **App + web, everything.** Tokens → components → gallery batches with confirmation → RN screens → acceptance web → ADR 0020 / DESIGN.md. Nine sessions under the 70 % handoff rule |
| E5 | `CANCELED` tone (missing from the handoff) | Same as DECLINED / UNRESOLVED: **muted + `remove`** |
| E6 | The nine screens the bundle does not cover | The 2026-09-03 D1 procedure: extrapolate by the rules → gallery preview → confirm → implement |
| E7 | Revised bundle vs first bundle | **"이전 번들은 무시, 새 번들이 확정"** — the README's six confirmation items count as confirmed by that statement |
| E8 | README weight 700 (not in the 500/600/800/900 scale) | Unselected tabs and chips → **600**; every other 700 → **800** |
| E9 | The three press tokens the first-bundle session had added | **Bundle parity: 179 tokens exactly.** Press values are literals, recorded in the exception table below |
| E10 | First bundle | Deleted; the revised bundle is the only reference |
| E11 | A00 / A01 (README "기존 유지" vs the artboards) | A01 mascot follows the artboard's **two-layer oval** (A00 keeps its SVG blob); both keep the **old pale yellow `#FFE59A`** and a **−2° tilt** — three literals, exceptions below |

Working rule the PO set for the whole port: implement one screen, capture it beside the `.dc.html`
artboard, report a colour/size/shadow/radius diff table, then move on; **when a value must differ
from the README, ask first.** Artboard prototypes are `content-box`, so their boxes measure +4/+5
and the device +16 wider than the README numbers — the README numbers, not the artboard pixels,
are the target.

## Decision

1. **Token swap in place, 179 tokens** (`tokens.test.ts` pins the count; the canonical file is
   value-identical to the bundle's `tokens.css`). Three are new — `--lf-elevation-sm`,
   `--lf-type-appbar-size`, `--lf-status-tile`. Values: canvas / chrome `#F3ECDC` → `#FBF8F1`,
   muted `#EAE1CB` → `#EFE9DC`, yellow `#FFE59A` → `#FFD43B`, mint `#B7E1D1` → `#5FD3A5`, pink
   `#FFB5C1` → `#FF6F91`, sky `#A9D3FF` → `#6CB4FF`, `primary-soft #FFF6CC`, secondary / muted /
   faint text unified to `#6F6552`, outline `#EFE9DC`, outline-strong `#6F6552`, outline-icon and
   frame border ink, scrim `rgba(34,28,19,.42)`. Shadows: card / fab `5px 5px 0 #221C13`, sm
   `3px 3px 0 #221C13`, sheet `none`. Radii xs 8 · sm 10 · md/lg/xl 14 · 2xl 12 · hero 20 ·
   pill 999. Borders chip / dashed / pending 2, card / outline / sheet 2.5. **All four tilt tokens
   are `0deg`** (names and classes kept). Type: weights regular 500 · medium 600 · bold 800 ·
   heavy 900; wordmark 40/46, display 36/42, headline 30/36, title 24/30, card-title 22/28,
   sheet-title 20, appbar 16; tracking tight −0.03em, wordmark −0.04em. Sizes: icon button 36,
   CTA / FAB 56, tab 34, meta chip 28, textarea 84, card padding 16, ring stroke 12, avatar-xl 56,
   thumb 84, progress 10, fade 130, mascot 28 / 34 / 46, eyes-blob 68, status tile 40.
2. **Fonts and icons.** RN registers Pretendard **500 / 600 / 800 / 900** static files
   (`Pretendard-Medium.ttf` and `Pretendard-Black.ttf` added; 400 / 700 removed); `TextFontWeight`
   is `'500' | '600' | '800' | '900'`. The web keeps the variable woff2. The Material Symbols Rounded
   subset moved to weight 500 (matching the guide's `@import`) and gained `all_inclusive`,
   `balance`, `bolt`, `menu`, `remove` (56 names in the subset list).
3. **Component grammar** (`components.css` rewritten, `Lf*` mirrored):
   - App bar = paper block, r14, 52 h, margin 8 16 0, 2.5 ink, 5 px shadow. Home: yellow irregular
     oval tile (36×34, mascot 28) + wordmark 22/900/−0.04em + a "메뉴 ☰" button with a 9 px pink
     unread dot. Sub screens: square back button 36 r10 + centred title 16/800 + right action.
     Bell and avatar moved into the **home menu sheet** (new `home-menu-sheet.tsx` /
     `scr-a02-home-menu.html`): four tiles 알림 (unread badge) · 마이 · 지난 약속 · 슬롯 n/m, same
     routes. Counts come from the inbox first page `unread_count` and `loadSlotStatus()`; a failure
     leaves the count null and never blocks the sheet.
   - Buttons r14, **no black fill**: filled 56 h yellow + ink label + 2.5 border + 5 px shadow +
     a paper trailing square 40 r10; outlined 50 h paper + 3 px; kakao 54 h `#FEE500` r14 + 3 px
     (`kakaoLogin` on A01 / W01 keeps 5 px); Google r14 ink 2.5 + 3 px in official colours; tonal
     36 h yellow; text = underline; disabled opacity .3 without shadow. Home 약속 만들기 = full-width
     56 h yellow with a paper `add` square (`LfFab`).
   - Chips: status 28 h r8 tone background; filter tabs 34 h r10 (selected yellow + 3 px, unselected
     paper + ink); choice 36 h r10. No pill chips.
   - Cards r14 · 2.5 · 5 px, padding 16; flat = no shadow. List rows carry a **40 dp status tile**
     (`LfStatusTile`, `status-tone.ts`): DRAFT `edit` yellow · PENDING `hourglass_empty` paper
     dashed · ACTIVE `bolt` mint (no end date `all_inclusive` sky) · AMEND_PENDING `sync_alt` sky ·
     CHECKING `notification_important` pink · COMPLETED `check` mint · BROKEN `close` pink ·
     DISPUTED `balance` muted · UNRESOLVED / DECLINED / CANCELED `remove` muted (E5). `LfStatusDot`
     and `.lf-status-dot` are gone.
   - Hero (imminent) = yellow face r14, no rotation / blob / eyes, a pink badge at −14 px
     ("D-1 · 내일까지"), a paper arrow square 46 r12.
   - Sheet r20 top, 2.5 ink, **no shadow**, handle 40×5 solid ink, title 20/800 + close 36;
     segmented control = one 2 px box r10 with 2 px vertical dividers (`LfSegmented`, `tab` roles).
   - Stamp: no tilt and no rotate in the pop-in, r14 + 5 px, borderless pastel corner blobs under
     `overflow: hidden`, hand loop and spark kept; COMPLETED = the whole card mint.
   - Inputs 48 h r10 2 px without shadow; picker 3 px; focus 3 px (+ web outline); switch 52×32
     r999 with an always-ink knob, ON track yellow.
   - Detail D-Day = 56 r14 yellow square. Notifications: unread = yellow card + 5 px + ink dot,
     read = paper flat. Trust ring 88 / 12 mint with a double ink ring. Empty state = 170 circle +
     56 mint circle.
   - Mascot art = **irregular ovals** (outer yellow 2.5 ink + 5 px, borderless white inner oval):
     A09 130×104 + eyes 60, MOD-03 170×136 + hand loop, W01 190×152 + loop + spark, W03 60×56,
     W06 190×152 muted + eyes 80. Only the A02 empty state keeps the A00 SVG blob 240×211 (yellow
     `#FFD43B`, `drop-shadow(5px 5px 0)`, loop scale .5). No circular (r999) art remains.
   - Acceptance web W01–W06: same grammar, browser bar kept, no ads, one primary CTA per page,
     W02 decline = underlined text button, hover = translate(−1,−1) + 6 px.
4. **RN rendering.** Hard shadows are RN 0.86 New Architecture **`boxShadow` arrays** in the
   `elevation` tokens (Android `elevation` cannot draw a blur-free ink offset); `sheet` is an empty
   array. Ovals are **SVG paths** (`LfOval`, `ovalPath` implements the CSS radius-scaling rule) with
   the 5 px shadow as the same path offset, so `overflow: hidden` never clips it. 48 dp is met with
   `hitSlop` where the README size is smaller (icon button 36, tonal 36, segmented 38, compact 44,
   menu 40) — the gallery's `::after` rule in RN form. Press feedback = `translate(3,3)` + shadow
   5 → 2 (3 → none), 120 ms, colour unchanged. `LfText` variants `appbar`, `appbarBrand`,
   `titleHeavy`, `note` were added; inside a four-face tone context (`LfInkContext`) secondary and
   meta text are drawn in ink.
5. **Reference ↔ web lockstep** now covers three files: `components.css` and `screens/web.css` are
   byte-identical to the reference, and the web `base.css` equals the reference **above** its
   `/* WEB ONLY */` section (fixed screen + safe-area insets — the P3 pass found `base.css` had
   silently drifted, so the assertion was added). `index.html` / `app.html` theme-color is
   `#FBF8F1`.
6. **Gallery = 42 pages** (34 app incl. the new menu sheet, 8 web). Batch 1 (22 confirmed
   artboards + menu sheet) and batch 2 (13 extrapolated pages, E6) were each captured beside the
   artboards with Playwright and confirmed at their checkpoints before P5 started.
7. **A00 / A01** keep their layout (E2). A01's mascot is the artboard's two-layer oval; A00 keeps the
   SVG blob; both keep `#FFE59A` and `−2deg` as component literals (`LOGIN_YELLOW`, `LOGIN_TILT` in
   `LfBlob.tsx` / `LfOval.tsx`).

## Exceptions — literals and substitutions (deliberate, recorded here)

The PO chose bundle fidelity over new tokens (E9); the token count stays frozen at 179, so these
values live as component literals or scale substitutions. Do not "fix" them by adding tokens.

| Kind | Value | Where |
|---|---|---|
| Press | `translate(3px,3px)`; shadow 5 → 2 px, 3 → none; disabled = no shadow | `LfButton`, `.lf-btn`, tabs, pickers |
| Oval radii | `62% 38% 55% 45% / 42% 60% 40% 58%` (outer and inner) | `.lf-oval`, `LfOval.ovalPath` |
| Mascot tile / oval art | 36×34 (app bar), 38×36, 60×56; A09 130×104, MOD-03 170×136, W01 / W06 190×152 | app bar, `LfOval`, W screens |
| Sizes with no token | segmented 38 h · avatar md 44 · Google 52 h · compact button 44 h · trailing icon 22 · badge 24 · notice 32 · wizard bar 8, top 18 · caption line 19 · stamp padding 22/18/16 · A02 blob 240×211 · loop scale .5 / .7 · eyes 60 / 80 · ad chip 24 · web hover 6 px · radio 24 / 12 · proof icons 24 / 22 / 14 | the owning component or route file, each named as a `const` |
| A00 / A01 | `#FFE59A` fill, `−2deg` tilt (E11) | `LfBlob.tsx`, `LfOval.tsx` |
| Scale substitution | artboard 10 px tile captions → eyebrow 11; A05 / W01 headline 26/32 → title 24/30; filled CTA label → appbar 16 (the only 16 step); base avatar → avatar-lg 48 (no 44 token); kakao label 16 (README) though artboards vary 15/16/17; Google label 17 (artboards 15/17); README weight 700 → 600 unselected / 800 elsewhere (E8) | everywhere those appear |
| Contrast | secondary text (`#6F6552`) is **never** placed on the four faces (yellow gives 4.03:1); focus on mint / pink / sky is the ink 3 px block shadow because the `#2F6FB3` outline measures 2.80 / 1.96 / 2.38 (< 3:1); the outline stays on canvas / paper / muted / yellow (4.89 / 5.09 / 4.29 / 3.64) | `LfText` ink context, CSS `:focus-visible`, `tokens.test.ts` pairs |
| Spec over artboard | A08 bottom ad slot kept (§8-1); A06 comment textarea kept (F-07); A05 shows a content card, people list and (non-ACTIVE) approvals on every status; fingerprint on every stamp except PENDING; DECLINED / CANCELED get a muted `remove` stamp; hero keeps its end-date line; notification unread keeps its text label (§8-7); MOD-03 keeps an accessibility close button; MOD-02 keeps '초대 링크 공유하기' (C-4); W03 has no install card (EC-I03) — app / web re-entry sits in the bottom action bar; W06 has no primary CTA (`02` §4-3-3); W02 keeps the creator avatar row and a visible amend-field label; W04 keeps the version-history button and the DISPUTED claim grammar; W05 keeps the checkbox and the danger 나가기; 48 dp beats the artboard's 44 h 수정 제안 | routes, W screens |
| Structure | SCR-I has an app bar without a back control (deep-link entry); A04 preview bubble has no sender avatar (`apps/mobile/src/lib/**` frozen, and the a04 test forbids the partner name); `.lf-detail__actions` owns `display: flex`; `.lf-hint` tone is the `--sky` modifier (a `lf-card--sky` pair loses to load order); browser-bar buttons are OS chrome, outside the icon-button rule; the finish request lives in the no-end sky info card, amend actions in the 협의 card, 숨기기 / 신고 / 차단 in a text / danger row (no overflow menu) | A05, SCR-I, A04, CSS |
| RN specifics | proof thumbnails and the stamp keep their shadow outside any `overflow: hidden` (image carries the inner radius); A06 claim chips are paper on both sides (P1); COMPLETED stamp time uses the `chip` variant (12/800) for the CSS 12.5/800; Kakao in RN is 5 px only on A01 | `fulfillment/[promise_id].tsx`, `LfStamp`, `LfButton` |

## Consequences

- `design-reference/` is the new frozen baseline (잉크 & 블록). The bundle stays as read-only
  reference at `design-reference/design_handoff_ink_block/`. The two plans
  (`docs/plans/2026-09-03-*`, `docs/plans/2026-09-06-*`) are deleted with this ADR.
- **Tests moved, never loosened** (per session): `tokens.test.ts` (count 179, weights typed with
  `satisfies TextFontWeight`, elevation parity parses CSS `box-shadow`, contrast pairs as above,
  web pins `#FFD43B` / `#5FD3A5` / `#6CB4FF` / `#FF6F91`, notice as a block badge, three-file
  lockstep); `fonts.test.ts` (four static files); `typography.test.ts`; `components.test.tsx`
  (every literal — weights, caption 13/19, ink context, yellow / press buttons, segmented, notice,
  app-bar menu, kakao 3 px / kakaoLogin 5 px, variants list); `scr-a02-home.test.tsx` (section title
  → selected tab; bell / avatar → 메뉴 button → sheet tiles with inbox / slot mocks);
  `scr-a07-notifications.test.tsx` (unread headline ink); `scr-a08-profile.test.tsx` (language =
  tabs + hitSlop); `scr-a01-login.test.tsx` (Google border ink); `not-found.test.tsx` (title heavy);
  `scr-a03-promise-create.test.tsx`; `mod-03-completion-celebration.test.tsx` (a11y-hidden oval,
  `includeHiddenElements`); `scr-a05-promise-detail.test.tsx` (`promise-seam` → `promise-stamp`);
  `mod-01-promise-amend.test.tsx` (`tab` roles); web `seo.test.ts` (theme-color), `LfMascot.test.tsx`
  (blob → oval), `scr-w01` / `scr-w04` / `scr-w06` tests (oval classes, `tab` queries).
- Deleted: `LfStatusDot`, `LfPromiseSeam` (no consumer since P6-C; the DESIGN.md "one-shot Seam" is
  gone with it), the transitional `.lf-status-dot` / `.lf-chip--cream` / `.lf-avatar-button`
  selectors, the LEGACY `.lf-pinky*` / `.lf-pinky-badge` / `.sl-*` block, Pretendard 400 / 700
  files, `stepCount` in `promise-edit-labels.ts` (duplicate of the wizard label), the three press
  tokens.
- Verified 2026-09-07 before this ADR: five-project typecheck; Vitest 114 files / 2,179 tests;
  jest-expo 84 suites / 928 tests; `build:web` (616 kB main chunk, pre-existing warning); eight web
  routes captured 360×800 with fixtures (`tools/capture-web-screens.js`) and eyeballed against the
  artboards; 42 gallery pages with zero console errors / overflow at the checkpoints.
  `firebase deploy --only hosting:web` ran 2026-09-07 → `https://littlefinger-app.web.app`.
- **Not verified — open device QA.** No P5 / P6 RN screen has been seen on a device: the emulator
  sign-in is blocked (dev email test accounts retired server-side). First checks when a Kakao /
  Google sign-in is available: `boxShadow` inside clipping (stamp, proof thumbs), the 56 h CTA and
  chips at font scale 1.5, Android hard-shadow rendering, the KakaoTalk in-app browser safe-area on
  the deployed web.
- Out of scope, PO item: `app.json` splash `#F3ECDC` and notification colour `#FFE59A` still carry
  pastel-era values.
- `DESIGN.md` is rewritten for this system; `CLAUDE.md` §5-3 / §5-4 point here.
