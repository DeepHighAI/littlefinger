# 0016. Butter forced-perspective launcher icon

Date: 2026-08-31
Status: Accepted (PO-confirmed selected artwork, 2026-08-31)
Supersedes: ADR 0013 decision 2 (launcher rendering only)

## Context

ADR 0013 aligned the launcher and in-product brand mark around the Type A silhouette. The PO later
reviewed a launcher-specific redraw because the compact silhouette cropped both hands and rendered
the linked little fingers on one flat plane. The accepted redraw keeps the pinky-promise gesture but
shows both complete hands and uses flat forced perspective: the linked fingers are nearest, while
the other fingers, palms, and wrists progressively recede.

The launcher artwork needs platform-specific exports. A legacy square bitmap can carry the whole
composition, while Android adaptive icons need independent background, foreground, and monochrome
layers so platform masks do not crop the hands.

## Decision

1. **Launcher-only rendering:** the selected 2026-08-31 two-hand illustration replaces the Type A
   silhouette only for the installed app icon. The Type A in-product mask, acceptance-web mark, and
   splash artwork remain unchanged.
2. **Palette:** the launcher uses a butter `#F6E7A3` field, paper-white `#FFFDF4` hands, and warm-ink
   `#221C13` outlines. Both hands use the same colours.
3. **Perspective:** depth comes from flat silhouette scale, taper, convergence, and overlap. The
   linked little fingers are the nearest focal point; the geometry progressively recedes toward the
   wrists. No 3D material treatment is introduced.
4. **Platform exports:** `icon.png` preserves the selected full-square composition. Android keeps a
   solid butter background layer, a transparent colour foreground inside the established safe-zone
   envelope, and a monochrome alpha derivative for themed icons and notifications. Platform masks
   own corner clipping and presentation shadows.
5. **Regression lock:** the native configuration test pins all exported bitmap hashes and asserts
   the butter adaptive background colour.

## Consequences

- Installed-app artwork intentionally differs from the simpler in-product Type A mask while keeping
  the same gesture and brand palette.
- Android circle, squircle, and themed-icon treatments retain the complete hand silhouettes.
- The next Google Play build must advance its version code because launcher resources are packaged
  into the signed bundle.
- The screen-library baseline does not change; this decision affects native launcher resources only.
