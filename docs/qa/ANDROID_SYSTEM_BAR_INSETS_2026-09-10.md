# Android system bar overlap verification

The PO reported that production **0.3.2 / code 29** places the home create button
behind Android's three-button navigation bar. The same failure was reproduced on
an Android API 36.1 emulator before the fix. The home menu's last row also overlapped
the navigation bar.

## Cause and change

- `home.tsx`: `SafeAreaView` applies padding, but its direct absolutely positioned
  `LfFab` and `LfBottomFade` children use the outer containing block. An inner,
  flex-filling `View` now contains the app bar, list, fade and CTA. Its bounds follow
  the native safe area, including changes while the app is running.
- `LfSheet.tsx`: a React Native `Modal` has its own native window. A
  `SafeAreaProvider` inside that window measures its actual insets, and the sheet's
  `SafeAreaView` applies the bottom/left/right edges. This covers all consumers of
  the common sheet, including menu, slots and promise entitlements.
- `promise-entitlement-sheet.tsx`: remove the activity's inset from its scroll
  padding; the common sheet now owns the modal inset. Existing token spacing stays.
- Jest uses the safe-area library's official provider mock because Jest cannot
  emit native window measurement events. Three obsolete per-file hook mocks were
  removed. Native layout evidence below verifies the behavior Jest cannot render.

No OS navigation setting is changed by the product. No fixed navigation-bar height,
new design token, edge-to-edge opt-out, or device-specific branch was added. A native
zero inset therefore adds no system-bar space.

## Relevant official examples

Android documents the same FAB obscured by the navigation bar and recommends
applying system-bar insets for both button and gesture navigation:
[Handle overlaps using insets](https://developer.android.com/develop/ui/views/layout/edge-to-edge#handle-overlaps).
Expo explains that `SafeAreaView` supplies padding or margin:
[Safe areas](https://docs.expo.dev/develop/user-interface/safe-areas/).
The safe-area library recommends additional providers for modal roots:
[SafeAreaProvider](https://appandflow.github.io/react-native-safe-area-context/api/safe-area-provider/).

## Native verification

Environment: `Littlefinger_E2E_API_36_1`, 1080x2400 pixels, density 480
(360x800 dp), font scales 1.0 and 1.5. A headless emulator was driven with adb.
Production-mode Metro bundles import the actual home, menu, sheet and theme source;
backend, ads and router effects are fixture substitutes. A bottom-edge tap produces
a native alert showing the requested route. These are layout/touch checks, not
live authentication, purchase or backend end-to-end checks.

The local QA APKs reuse the code 27 native runtime, replacing the JS bundle and
assets and signing with the debug key. Source maps confirmed fixture inclusion and
the absence of the real mobile API module. They are **not release candidates**.
No code 29 AAB was modified or uploaded. Temporary Metro configuration was restored.

| Check | Result |
|---|---|
| Before fix, three-button navigation | Home CTA and menu bottom row visibly obscured |
| After fix, three-button, font 1.0 / 1.5 | CTA and menu bottom row fully above the bar |
| After fix, gesture, font 1.0 / 1.5 | CTA and menu clear of the gesture area |
| Switch three-button to gesture with app running | CTA follows the changed native inset |
| Home list, font 1.5, scroll to end | Final trust strip fully readable above the CTA |
| Tap home CTA near bottom `(500,2178)` | Native alert confirms `/promise/edit` callback |
| Tap bottom menu tile `(800,2160)`, font 1.5 | Native alert confirms `/profile` callback |

`dumpsys window` measured three-button navigation at `[0,2256][1080,2400]`
(48 dp) and gesture navigation at `[0,2328][1080,2400]` (24 dp).
At framebuffer column x=100, the visible yellow CTA face was y=2180..2255
before the fix, cut off exactly at the three-button bar. Afterward it was
y=2036..2187 in three-button mode and y=2108..2259 in gesture mode. The 72-pixel
position difference matches the 24-dp difference between the system insets.
The same CTA bounds held at font scale 1.5.

Visual comparison and touch evidence:

- [Home before](assets/android-system-bars-2026-09-10/home-before.png) /
  [home after](assets/android-system-bars-2026-09-10/home-after.png)
- [Menu before](assets/android-system-bars-2026-09-10/menu-before.png) /
  [menu after](assets/android-system-bars-2026-09-10/menu-after.png)
- [Gesture home](assets/android-system-bars-2026-09-10/home-gesture.png)
- [Large text, final list item](assets/android-system-bars-2026-09-10/home-large-scrolled.png)
- [Large text, three-button menu](assets/android-system-bars-2026-09-10/menu-large.png) /
  [large text, gesture menu](assets/android-system-bars-2026-09-10/menu-large-gesture.png)
- [Home bottom-edge tap](assets/android-system-bars-2026-09-10/home-tap.png) /
  [menu bottom-edge tap](assets/android-system-bars-2026-09-10/menu-tap.png)

Limitations: the reported Samsung device was not connected. A fully hidden
navigation bar could not be induced with the emulator's legacy `policy_control`
setting (the native inset remained visible); that setting was deleted afterward.
The animated empty-state screen prevented `uiautomator dump` from becoming idle,
so screenshots, system inset frames and verified touch callbacks are the evidence.
Other sheet consumers passed existing component/screen tests but were not each
opened on the emulator. A new production AAB and physical-device release check
are still needed to deliver the fix to installed users.

## Automated checks

Final `npm test` exited 0:

```text
Test Files  122 passed (122)
Tests       2220 passed (2220)
Test Suites: 92 passed, 92 total
Tests:       960 passed, 960 total
```

`npm run typecheck` exited 0 across all five projects. `npm run check:agents`
passed; `git diff --check` passed. Local detailed logs are
`dist/insets-final-tests.log` and `dist/insets-final-typecheck.log`.
