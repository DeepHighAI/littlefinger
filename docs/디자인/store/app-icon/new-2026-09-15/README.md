# New mascot and app icon rollout

Date: 2026-09-15. Decision: [ADR 0028](../../../../adr/0028-po-transparent-mascot-and-launcher.md).

## Source and scope

The PO requested replacement of every in-app mascot and the launcher. The supplied
`icon-noback.png` is a **1536 × 1024 RGBA PNG with actual transparency**; corner alpha is zero.
It replaces the failed generative extraction attempts from the initial audit. No generated
redraw is used in production. The original `../littlefinger-icon-new.png` remains the
source for the yellow-field launcher and Play listing.

All requested mobile and acceptance-web mascot consumers now use the new identity.
Existing UI layout footprints, colors, typography, copy and policy are preserved.
**Optional Mobbin spacing improvements are not applied**; see
[mobbin-improvement-proposal.md](mobbin-improvement-proposal.md).

## Delivered / applied assets

| Asset | Use |
| --- | --- |
| `play-icon-512.png` | Play Console listing, 512 × 512 RGBA, 229072 bytes; also copied to the existing store export path |
| `icon-1024.png` | Original high-resolution general icon export; app `icon.png` regenerated from the same PO source |
| `icon-noback.png` | PO transparent source, retained unchanged |
| `mascot-face-e1.png` | 512 × 512 transparent face in reference/mobile/web; stable filename retained |
| `eyes-e1.png` | 200 × 80 transparent eye pair for narrow slots |
| `hand-solid.png`, `hand-color.png` | New black hand used by existing mirrored agreement loops; 804 × 763 masters, web color derivative 402 × 382 |
| Android foreground/background | 1024 × 1024; new transparent foreground on the existing yellow background |
| Android monochrome | White eye silhouette with alpha, also consumed by notification configuration |
| Splash | New transparent portrait in the existing splash slot |
| Web brand exports | 32/192 favicons, 180 touch icon and 1200 × 630 OG image |

[Asset preview](asset-preview.html) shows adaptive masks, background compositing and small sizes.
[PNG preview](asset-preview.png) and [home before/after](home-before-after.png) are directly viewable.
[asset-manifest.json](asset-manifest.json) records canonical hashes and dimensions.
[verification.json](verification.json) records measured adaptive/monochrome/Play checks.

## Consumer coverage

| Area | Applied replacement |
| --- | --- |
| Home header, trust strip, nickname, native invite entry/handoff, button mascot slot | Shared small face asset; existing tile/hint containers retained |
| Onboarding, login | Complete static portrait replaces the old body-plus-eyes composition |
| Home, notifications, blocked-user empty states | Shared `LfEmpty` / `LfBlob` portrait |
| History empty, not-found, update-required | Shared large `LfOval` portrait |
| Notification rows, invitation review header, draft helper | Extracted eye pair in existing eye-only slots |
| Invite/detail stamps and pending participant pair | Extracted hand; existing mirroring, animation, reduced-motion and participant opacity retained |
| Completion sheet | Complete portrait in the original celebration illustration area |
| Acceptance web W01, W02/W04 gates, W03, W06 | Complete portrait through shared `LfOval`; W03 agreement stamp retains the hand loop |
| Reference gallery | Same masters and CSS character presentation; archived design handoff bundles stay historical |

Large portraits are static: their eyes already belong to the supplied image, so overlaying
another hand loop would duplicate the face. Standalone agreement hands retain their original
motion. A body-only animation rig is a separate design treatment, not included in this swap.
Colored stamp corners, state icons and participant photos are not mascot replacements.

## Reproduce

From the repository root:

`node tools/export-new-brand-icons.cjs` — standalone Play/general exports.

`node tools/export-mascot-assets.cjs` — transparent face/eye/hand masters and synchronized copies.

`node tools/export-brand-icons.js` — launcher, adaptive, monochrome, splash and web brand exports.

`node tools/verify-brand-assets.cjs` — alpha safety, monochrome, Play file checks and preview.

The Android foreground size is computed from nonzero-alpha radial bounds rather than assumed
from its square canvas. The measured radius is **308.89 px**, inside **312.89 px** (66 dp safe
circle on a 108 dp / 1024 px layer). See [Android guidance](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).
The Play export meets [512 px / 32-bit PNG / 1024 KB requirements](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-GB).

## Verification

- Full Vitest: **124 files, 2231 tests passed**.
- Full mobile Jest: **95 suites, 972 tests passed**.
- Five-project typecheck passed; final post-cleanup run is recorded in `tmp/mascot-typecheck.log`.
- Acceptance-web production build passed; existing chunk-size advisory remains.
- Asset verifier: `PASS: adaptive alpha radius 308.89 <= 312.89; monochrome RGB is white; Play PNG 229072 bytes.`
- Browser captures: five reference screens at 360 dp, text scales 1.0/1.5, and eight production-build acceptance-web fixture routes; zero page JavaScript errors. Evidence lives in `.playwright-mcp/mascot-2026-09-15/`.
- DOM text scaling is reference-layout evidence, not native Android font-scale verification.
- Impeccable detector on changed web TSX: `[]`.
- Android prebuild completed and regenerated native launcher resources.
- Native x86_64 debug build: `BUILD SUCCESSFUL in 3m 36s`, 578 actionable tasks. Earlier failures came from interrupted Gradle transform caches; the final damaged SVG cache was quarantined and regenerated. Final log: `tmp/mascot-android-build-recovered.log`.
- Installed the debug APK in a read-only API 36.1 emulator at 720 × 1600 px / 320 dpi (360 × 800 dp). Confirmed the new launcher and onboarding/login portraits; captured both native font scales 1.0 and 1.5 with no portrait/text/action overlap in those screens. The floating Tools control in these screenshots belongs to the development environment.
- Native screenshots: `native-launcher.png`, `native-onboarding-1.png`, `native-onboarding-1.5.png`, `native-login-1.png`, `native-login-1.5.png` in the evidence directory. Authenticated native screens are covered by shared-component and screen tests, not a fresh signed-in emulator walkthrough. OAuth was not performed.
- `npm run check:agents`: `AGENTS.md 는 CLAUDE.md 와 동기화되어 있다.`

No production deployment, Play upload or release signing is performed by this task. Installed
users receive the new launcher after a new production app build is distributed.
