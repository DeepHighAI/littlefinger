# 0013. Type A Pinky Loop brand mark

Date: 2026-08-27
Status: Accepted (PO-confirmed final board, 2026-08-27)
Supersedes: the green brand-symbol asset retained through ADR 0012

## Context

The Ink & Sticker restyle established ink and butter as the identity pair but deliberately left a
new hand-drawn icon set unconfirmed. The shipped brand symbol still used the older green two-hand
asset, while the Android launcher, adaptive icon, splash image, acceptance web, and React Native
component all consumed separate derivatives. Changing only one would make the installed app and
the product surface disagree.

The PO compared an abstract oval-gap mark with **Type A — Pinky Loop** and selected Type A. The
selected silhouette shows two equal hands with their little fingers visibly hooking in the centre.
The PO also fixed the colour application: launcher icon = ink field with white hands; in-product
mark = ink on butter or its butter-on-ink inverse.

## Decision

1. **One silhouette:** the approved Type A board is converted to a monochrome 730×458 RGBA alpha
   mask. Mobile, acceptance web, and `design-reference` keep byte-identical copies named
   `brand-symbol.png`. The two hands are never tinted independently.
2. **Launcher system:** legacy `icon.png` and Android adaptive layers use ink `#221C13` behind
   paper white `#FFFDF4`. The foreground stays transparent and inside the existing safe-zone
   envelope. The platform, not the bitmap, owns corner clipping and launcher shadows.
3. **In-product system:** the default mark is ink on butter `#F6E7A3`; the inverse is butter on
   ink. React Native tints the shared mask with `brandSymbol` / `brandSymbolOnAction`. The web uses
   an exact butter derivative instead of a CSS filter approximation. The prior lavender `record`
   tone is removed from `LfPinky`.
4. **Supporting native assets:** the splash uses the primary in-product badge (ink hands on a
   butter circle) on the cream canvas. Android monochrome notification artwork reuses the same
   Type A alpha, with butter as the notification accent colour.
5. **Regression lock:** tests pin the shared-mask hash, require byte equality across the three
   targets, pin every Android bitmap hash, and assert the launcher/splash/notification colours in
   `app.json`.

## Consequences

- Every rendered Littlefinger brand mark now has the same hand geometry and only the approved
  ink/butter/paper colour roles.
- The acceptance reference changes under explicit PO approval; its old inline SVG paths remain as
  inert fallback markup while CSS masks them with the canonical asset.
- The next Google Play internal-test bundle must use a new version code because launcher assets
  are part of the signed Android package.
- This decision approves the brand mark only. It does not approve a replacement for the general
  Material icon set or the deferred Promise Seam redesign.
