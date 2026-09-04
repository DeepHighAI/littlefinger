# 0019. E-1 face launcher icon

Date: 2026-09-04
Status: Accepted (PO-provided final artwork)
Supersedes: ADR 0018 launcher, adaptive-icon, monochrome-icon and Play-listing decisions only

## Context

The installed Android build still showed ADR 0018's Type A Pinky Loop launcher after the pastel
restyle. The PO identified that as incorrect and supplied the final E-1 artboard: a yellow rounded
field, organic white face and small black hand-eye pair. The same composition already exists in the
Claude Design handoff as `design-reference/ui-ux/project/assets/icon-face-e1.png` and in the
permanent mobile master `apps/mobile/assets/images/mascot-face-e1.png`.

## Decision

The app launcher and store-listing icon use E-1. The opaque field is `#FFE59A`; platform masks own
the launcher's outer shape and no presentation shadow or corner treatment is baked into the export.
Android's adaptive foreground contains the centred E-1 face inside the safe area, its background is
the same yellow, and its monochrome layer contains the hand-eye pair for system tinting.

`tools/export-brand-icons.js` is the reproducible export path for `icon.png` and the three Android
adaptive layers. The PO-curated Play listing source is
`docs/디자인/store/app-icon/littlefinger-icon-512.png`; it is deliberately outside the launcher
export so regeneration cannot overwrite the store composition. Configuration tests pin both asset
families and the adaptive background colour. The deleted Type A `brand-symbol*` files are not
regenerated.

This decision authorizes the local launcher correction only. It does not authorize a 0.3.0 version
bump, EAS production build, or the remaining splash and cross-surface P8 derivatives.

Follow-up, 2026-09-04: the PO separately authorized merging/pushing the latest implementation and
creating its Google Play package. That later instruction activates the mobile P8 version, splash,
notification colour, and EAS build; it does not retroactively broaden the original launcher approval
or authorize deployment of the incomplete P7 web port.

## Verification

- `npm run typecheck` passed across all five TypeScript projects.
- `npm test` passed: Vitest 113 files / 2,159 tests; jest-expo 81 suites / 888 tests.
- The ARM64 release APK built successfully, passed ABI, embedded-bundle and APK-signature checks,
  and update-installed on an SM-N981N.
- The One UI launcher visibly showed the E-1 yellow field, organic white face and black hand-eye
  pair after installation.
