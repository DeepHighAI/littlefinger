# 0018. Unified butter-and-ink app icons

Date: 2026-08-31
Status: Accepted (PO-selected attachment)
Supersedes: ADR 0016 launcher artwork and ADR 0017 decision 4 (mobile palette)

## Decision

The selected board is saved in
`docs/디자인/icon-proposals/2026-08-31-butter-ink-final.png`. All app-icon surfaces use its
solid Type A Pinky Loop: butter background with ink hands for the launcher and light/butter
in-product containers, inverted to butter hands on ink actions. The white-filled, outlined
forced-perspective launcher and opaque white/butter mobile patch are retired.

Retain ADR 0017's corrected 730×458 shared alpha master: its gesture and contour padding already
match the selected Type A artwork. Do not generate a new interpretation of the hands. Native,
web, and reference keep sharing this geometry. Product colours remain the canonical tokens
`brand-symbol` (#221C13) and `primary-container` (#F6E7A3); mockup texture is not baked into assets.

`tools/export-brand-icons.js` (ImageMagick 7) reproducibly exports the 1024px launcher, Android
foreground/background/monochrome layers, transparent in-product ink derivative, butter-circle
splash, and opaque 512px Play listing icon. It strips metadata and verifies that both adaptive
silhouettes stay inside Android's 66dp safe circle on the 108dp layer. Platform masks own launcher
corners; no presentation frame, rounded corners, or shadows are baked in.
The platform envelope follows the [Android adaptive-icon guidance](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).

`LfPinky` applies semantic tint without changing aspect ratio or accessibility behavior. Both the
bottom-navigation Create action and `LfFab` opt into the inverse tone; all other call sites use
ink. Web/reference already use these two colour roles and need no screen-layout change.

## Verification

Asset hashes and dimensions are pinned in the native configuration tests. Component regressions
cover both tints, transparent backgrounds, and inverse-tone usage on both Create controls.
Release validation and the resulting AAB identity are recorded in `docs/DEVELOPMENT_STATUS.md`.
