# Handoff — pastel sticker restyle, session 1 (P0 · P1 · P2)

Plan: `docs/plans/2026-09-03-pastel-sticker-restyle.md` (§2 PO decisions D1–D8, §5 phases P0–P9,
§G session split). This file is the baton for **session 2 = P3 (reference CSS grammar) + P4 batch 1**.

## Goal and status

Replace the whole visual system with the PO-approved 확정안 「리틀핑거 파스텔 스티커」
(`design-reference/redesign-2026-09-03/ui-ux/project/리틀핑거 파스텔 스티커.dc.html`).
Session 1 finished P0, P1 and P2 — 8 commits on `main` after `6ef2629`:

| Commit | What |
|---|---|
| `9896c3e` | chore: drop the superseded design handoff bundle (`design_handoff_develop`, PO-deleted) |
| `6e37501` | docs: land the pastel sticker handoff bundle as read-only (`design-reference/redesign-2026-09-03/`, 68 files; the 7.6 MB zip was deleted, not committed) |
| `f9588e6` | docs: add the pastel sticker restyle plan (`docs/plans/…`) |
| `be9463b` | feat: add the E-1 mascot masters to all three targets (+ `apps/mobile/config/brand-assets.test.js`) |
| `3372e74` | feat: subset Material Symbols Rounded for RN and web (47 icons, web woff2 50.4 KB, app static TTF 9.8 KB, two byte-equal codepoint maps, `tools/subset-icon-font.test.ts`) |
| `b8295ff` | refactor: route every app icon through the Symbols subset (`LfIcon` = `createIconSet`, closed `LfIconName`; C-2 closed; jest mock moved to `@expo/vector-icons.createIconSet`) |
| `94e60d8` | feat: move the token pipeline to the pastel sticker palette (117 → 183 tokens, three targets) |

Not started: P3 onward. `LfPinky`, `LfDoodle`, `LfBottomNav`, `brand-symbol*.png` and the old
`components.css` grammar are all still in place — the app compiles and every gate is green, but
visually it is "old grammar with new colours" until P3–P6 land.

## Files created / modified (beyond the commits above)

- Tokens: `design-reference/styles/tokens.css` (canonical, 183), `apps/web/src/styles/tokens.css`
  (derived: same `:root`, web header, no `@import`, `/fonts/` path), `apps/mobile/src/theme/tokens.ts`
  (new exports `letterSpacing`, `tilt`; `border` 6 keys; `size` +39; `easing.pinky`; `duration.pinky`),
  `apps/mobile/src/theme/tokens.test.ts` (count 183, two new groups, pastel WCAG pairs, container-role
  distinctness, focus-ring on four stickers).
- Icons: `tools/subset-icon-font.js` (ESM, exports `ICONS`/`STATIC_INSTANCE`), `apps/mobile/assets/fonts/MaterialSymbolsRounded-subset.ttf`,
  `apps/mobile/src/theme/icon-codepoints.ts`, `apps/web/src/components/icon-codepoints.ts`,
  `apps/mobile/src/theme/{fonts,fontAssets}.ts` (`ICON_FONT_FAMILY` preloaded with the text fonts),
  `apps/mobile/src/test/jest-setup.js`, 16 call-site files (`arrow_back`, `arrow_forward`, …),
  `scr-a07-notification-presentation.ts` (`cancel`, `sync_alt`, `notification_important`, `inventory_2`;
  `'pinky'` kept until `LfEyes` exists in P5).
- Assets: `design-reference/assets/images/{mascot-face-e1,eyes-e1,hand-color,hand-solid,icon-face-e1}.png`,
  `apps/mobile/assets/images/` (first four), `apps/web/src/assets/images/` (three byte copies + 402px `hand-color.png`).

## Decisions made

- All eight PO decisions are in the plan §2 and in memory; none were re-opened.
- Focus ring `#2F6FB3` is a **derived** value (not in the 확정안): 4.41:1 on cream, ≥4.5 on paper,
  3.12–4.19 on the four stickers. Reported to the PO with the P2 screenshots; no objection yet.
- The icon subset keeps `east`, `home`, `person`, `more_vert` for the web/bottom-nav consumers that
  P5/P7 will retire; drop them from `ICONS` in the P7 token-cleanup commit.
- Screenshots for PO checkpoints are taken with the **Playwright MCP** (`browser_navigate` →
  `browser_take_screenshot fullPage`) against `node design-reference/serve.js` on 4173; the Chrome
  extension was not connected in this session. Playwright writes into the repo root — move the
  PNGs to the scratchpad, never commit them.

## Verification state (all at `94e60d8`)

- `npm run typecheck` — 5 projects, exit 0.
- `npx vitest run` (root) — **113 files / 2,159 tests** pass.
- `cd apps/mobile && npx jest --silent --ci` — **81 suites / 874 tests** pass. (Run jest from
  `apps/mobile`; from the root it picks up 400+ foreign suites.)
- `npm run build:web` — 134 modules, built.
- Gallery after the token swap: A02 · A05 · W02 captured and sent to the PO (only console entry is
  the pre-existing `favicon.ico` 404).
- Not done: on-device icon check (no `adb` on this machine) — fold into the S4 device pass.

## Blocked / PO-confirmation items

- P2 notice sent (colour swap + focus ring). No PO checkpoint blocks P3.
- Open-testing follow-ups still with the PO: `docs/setup/open-testing-po-guide.md` §1–§11 and §12
  hand-back (광고 ID declaration, consent screen, Search Console branding). Unrelated to the restyle;
  do not bump `app.json` version or start an EAS build until the PO says so (plan §F).
- Web deploy hold starts with P3 (CSS grammar changes before the web markup follows in P7) — write
  it into `DEVELOPMENT_STATUS.md` when P3 lands.

## Exact next step (session 2)

1. Read plan §5 P3 and §3-4; read `design-reference/styles/components.css` (1,284 lines) and
   `styles/screens/*.css` once, in sections.
2. Rewrite `components.css` + `base.css` + `screens/*.css` to the pastel grammar (delete `.lf-pinky*`,
   `.sl-*`, `.lf-bottom-nav*`; add `.lf-mascot`, `.lf-eyes`, `.lf-pinky-loop` + keyframes,
   `.lf-blob`, `.lf-stamp`, pill CTA `.lf-btn__trailing`, chip tones/kinds, card tones/tilt,
   `.lf-eyebrow`, `.lf-status-dot`, `.lf-switch`, `.lf-ring`, `.lf-sheet` handle/title row,
   `.lf-fade`, inputs 2px/r12/48). Copy `components.css` and `screens/web.css` **byte-equal** to
   `apps/web/src/styles/` (web-only rules go in a `/* WEB ONLY */` tail present in both copies).
3. Move the `tokens.test.ts` CSS regexes listed in plan P3 and add the reference↔web byte-equality
   assertion; run the three runners + `npm run build:web`; Playwright console/overflow audit of the
   36 gallery pages.
4. Commit `feat: rewrite the reference component grammar for pastel stickers`, then start P4
   batch 1 (15 designed artboards → lf-* HTML) and stop at the PO checkpoint 1 with 15 side-by-side
   captures (gallery page vs `…파스텔 스티커.dc.html#4x`, 390 px wide).
5. Write `docs/handoff/2026-09-0X-pastel-restyle-s2.md` and delete this file in the same commit.
