# ADR 0028: Use the PO transparent mascot and launcher

Date: 2026-09-15

Status: Accepted for asset replacement. Optional layout improvements remain unapproved.

## Context

The PO requested replacement of every in-app mascot and the app icon, following the
2026-09-15 usage audit. The PO also requested Mobbin research with approval before any
additional design improvements. Initial generative background extraction failed; the PO
then supplied `icon-noback.png`, a 1536 × 1024 RGBA image with transparent corner pixels.

## Decision

- Use the PO yellow-field original for general launcher/Play/web metadata exports, and
  the supplied transparent image for the in-product face and adaptive foreground/splash.
- Crop/resize the supplied artwork deterministically. Derive eyes and one hand from the
  dark pixels in the face, preserving their original color and silhouette. No generative
  redraw is included in production.
- Keep the existing `mascot-face-e1`, `eyes-e1`, `hand-color`, `hand-solid` filenames as
  stable paths. Both hand variants use the new black hand; the web color variant remains
  a 402 × 382 derivative. Synchronize reference/mobile/web and lock hashes in tests.
- Replace large body-plus-eye compositions with one complete static portrait, preventing
  duplicate faces. Existing standalone stamp hand animation, reduced-motion behavior,
  participant pair representation and status icons remain intact.
- Keep the existing illustration box sizes and all UI layout, copy, policy and tokens.
  The small face containers stay; stamp-corner shapes remain colored decorations.
- Compute adaptive foreground size from actual nonzero-alpha radial bounds with a small
  resampling margin inside the Android 66 dp safe circle. Preserve the existing yellow
  adaptive background and use extracted eye alpha for the monochrome/notification asset.
- Update the frozen reference artwork and character presentation as part of the expressly
  requested replacement. The archived design handoff bundles remain historical references.

## Consequences

The complete face is static because the supplied image includes both eyes. Animating eyes
inside this portrait would require a separate clean body asset and a new animation treatment;
this task preserves the independent agreement hand loop instead of inventing that treatment.

PNG size grows with the 3D artwork: the face is about 157 KB. All assets are bundled locally;
there is no new image request to an external service. The acceptance web build remains valid.

The existing Android native directory is regenerated for verification so its launcher resources
reflect the new PNGs. A new production build and distribution are still required for installed
users to receive the launcher change. No Play or web deployment is implied by this source change.

## Separate proposal

[Mobbin improvement proposal](../디자인/store/app-icon/new-2026-09-15/mobbin-improvement-proposal.md)
contains M1 login spacing and M2 empty-state grouping. Both require explicit PO approval and
are not included here.

## Verification

See the [asset README](../디자인/store/app-icon/new-2026-09-15/README.md), generated
`verification.json`, and the visual evidence under `.playwright-mcp/mascot-2026-09-15/`.
