# App Links and location-disclosure audit — 2026-09-14

## Result

The Firebase Dynamic Links sunset is real, but this app does not use that service.
Its existing HTTPS `/i/{token}` links use Android App Links and Firebase Hosting.
No Dynamic Links migration or replacement AAB is indicated by the evidence.

The location disclosure is not evidence of an unwanted GPS implementation. Code 32
has no fine/coarse/background location permission; it does embed Google Mobile Ads
25.0.0 through react-native-google-mobile-ads 16.3.3. AdMob's documented IP processing
can infer approximate location. The incorrect operational instruction was to remove
location from Data safety because photo EXIF is stripped. That instruction is corrected.

## Live checks and limits

- `https://littlefinger-app.web.app/.well-known/assetlinks.json`: HTTP 200,
  `application/json`, no redirect, exact JSON match to the repository.
- Google's Digital Asset Links `assetlinks:check`: `linked: true` for all three
  repository fingerprints (upload/development and both recorded Play signing keys).
- Build-32 manifest: `autoVerify=true`, HTTPS host `littlefinger-app.web.app`, `/i/`.
- `/i/00000000-0000-0000-0000-000000000000`: HTTP 200 application shell. This proves
  Hosting routing, not that a fabricated token is valid or that an invitation was accepted.
- Source/dependency search found no `firebase-dynamic`, `dynamiclinks`, `page.link`
  or `app.goo.gl` dependency in apps/packages/server/lockfile.
- No ADB device was attached. Per-device verification/user defaults and an actual
  valid-invitation acceptance flow were not re-tested in this audit.
- Public Play Data safety (English/US) was HTTP 200 and lists **Approximate location**,
  optional collection, for app functionality and advertising. Location is absent from
  the public sharing section. SDK diagnostics and app interactions are already declared.
  This is the published page, not access to unpublished Console answers or drafts.
- The live privacy JS bundle `assets/main-CD8FUidP.js` still contains the blanket
  no-location statement. Local policy source also contains it in Korean and English.
- AAB embedded `play-services-ads.properties` and `play-services-ads-api.properties`
  both report 25.0.0. Do not confuse the RN wrapper version with the native SDK version.

Raw read-only evidence is in ignored `.expo/link-location-audit/`. No invitations,
account settings, ad flags, Console declarations or production releases were changed.

## Corrections completed

`docs/setup/play-data-safety.md` now distinguishes SDK-derived approximate location
from GPS/photo metadata, includes SDK interaction/diagnostic collection, and removes
the claim that only two IDs are shared. `docs/setup/open-testing-po-guide.md` no longer
instructs the operator to uncheck location. The product's current ad behavior is preserved.

Disabling personalization or deleting AD_ID alone does not establish zero IP-derived
location processing. A requirement to remove all such processing needs a separate
ad-system change, including banner/native/rewarded flows, and an audit of the replacement
before updating declarations. Do not silently disable the approved monetization features.

## Proposed privacy clarification — PO approval required

The following is reviewable draft copy, not an enacted legal-policy revision. The
repository working agreement reserves legal wording decisions for the PO. The existing
uncommitted web/privacy work is preserved; this audit does not overwrite it.

Replace the blanket no-location sentence and add an adjacent SDK-specific explanation:

**Korean draft**

> 회사는 전화번호와 연락처 목록을 수집하지 않으며, 기기의 GPS 등 위치 권한을 요청하거나 증빙 사진의 위치 메타데이터를 저장하지 않습니다. 다만 앱에 포함된 Google AdMob 광고 SDK는 광고 제공·분석·부정 이용 방지를 위해 IP 주소를 수집·공유할 수 있으며, 이를 통해 대략적인 위치를 추정할 수 있습니다. 이는 기기의 정밀 위치정보를 수집하는 것과 구분됩니다.

**English draft**

> The Company does not collect phone numbers or contact lists, request device location permissions such as GPS, or store location metadata from evidence photos. However, the Google AdMob advertising SDK included in the app may collect and share IP addresses for advertising, analytics, and fraud prevention, and may use them to estimate approximate location. This is distinct from collecting precise device location.

The SDK collection list should also identify app interactions, performance diagnostics
and device/app-set/ad identifiers as applicable. On approval, update both locales,
policy version/effective date and the published web policy together; reconcile Play's
location purposes, sharing status and optionality with actual SDK behavior. Do not
remove the current approximate-location declaration while the underlying processing remains.

## Sources

Verification: `npm test --workspace=@littlefinger/mobile -- --runInBand
config/app-links-config.test.js config/android-permissions.test.js` returned
`Test Suites: 2 passed, 2 total` and `Tests: 8 passed, 8 total`.
`npm run typecheck` passed all five projects without diagnostics. Changes are
documentation-only; no screen implementation or AAB was changed. Full test suites
and physical-device UI checks were not repeated for these documentation edits.

- [Firebase Dynamic Links sunset FAQ](https://firebase.google.com/support/dynamic-links-faq).
- [Android App Links verification](https://developer.android.com/training/app-links/verify-applinks).
- [Google Mobile Ads disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure):
  current page documents 25.4.0; the inspected AAB uses 25.0.0. This is a documentation-led
  risk/disclosure assessment, not packet-capture proof of every SDK request.
- [Non-personalized ads](https://support.google.com/admob/answer/7676680?hl=en).
- [Published app Data safety](https://play.google.com/store/apps/datasafety?id=com.littlefinger.app&hl=en&gl=US).
