# 0017. Detailed butter-white in-product Pinky Loop

Date: 2026-08-31
Status: Accepted (PO-confirmed detailed preview v4, 2026-08-31)
Supersedes: ADR 0013 decision 3 (mobile in-product colour application) and its original raster mask

## Context

The Type A Pinky Loop established the correct gesture, but its 730×458 raster mask touched both
horizontal canvas edges. This clipped the outer hand contours before any screen rendered the mark.
The source edge also showed visible pixel stepping when scaled, and React Native's per-container
tint variants could not express the launcher-aligned butter field, paper-white hands, and ink
outline requested for in-app imagery.

The PO approved detailed preview v4 after confirming that the hand gesture itself must stay fixed.
Only the missing side contours, raster edge quality, and colour treatment change.

## Decision

1. **Geometry preservation:** restore the short missing left and right outer contours while keeping
   the fingers, palms, central hook, proportions, and relative hand positions unchanged.
2. **Clean raster master:** rebuild the silhouette with supersampling and Lanczos downsampling. The
   canonical 730×458 RGBA mask centres the mark in an 80% safe-area envelope, keeping transparent
   padding on all sides instead of touching the horizontal edges.
3. **One shared mask:** mobile, acceptance web, and `design-reference` keep byte-identical
   `brand-symbol.png` copies so geometry cannot drift between surfaces. The web's on-action bitmap
   is regenerated from the same corrected alpha.
4. **Fixed mobile palette:** the React Native mark uses a dedicated RGBA derivative with paper-white
   `#FFFDF4` hands and a thin flat ink `#221C13` outline on a butter `#F6E7A3` field. `LfPinky`
   renders it with `contain` and no tint; the prior `default`, `onContainer`, and `onPrimary`
   recolouring contract is removed.
5. **Regression lock:** tests pin the corrected shared-mask, web on-action, and mobile colour-asset
   hashes and verify their dimensions and RGBA encoding.

## Consequences

- In-app brand imagery now matches the selected launcher palette while retaining the simpler Type A
  hand geometry.
- Both outer hand contours remain visible at every existing `LfPinky` size, and antialiased edges no
  longer inherit the jagged pixels from the previous mask.
- The central Create action no longer inverts the mark; a fixed butter/white/ink patch protects the
  brand treatment from its surrounding container colour.
- Acceptance-web colour roles do not change in this decision, but they receive the corrected shared
  geometry.
