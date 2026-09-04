# Google Play graphic assets

Status date: 2026-09-04 KST. These are the PO-provided replacement assets for the Google Play main
store listing. They supersede the former root-level `store-icon-512.png` and
`feature-graphic-1024x500{,-en}.png` working files. They have not been uploaded in this repository
session; the 2026-09-03 listing remains live until the PO replaces it in Play Console.

## Inventory and validation

| Asset | Authoritative path | Validation |
|---|---|---|
| App icon | `app-icon/littlefinger-icon-512.png` | 512×512, 32-bit sRGBA PNG, 24,900 bytes, alpha 1.0 on every pixel |
| Feature graphic (ko) | `feature-graphic/littlefinger-feature-1024x500-ko.png` | 1024×500, 24-bit sRGB PNG, 60,897 bytes, no alpha |
| Feature graphic (en) | `feature-graphic/littlefinger-feature-1024x500-en.png` | 1024×500, 24-bit sRGB PNG, 63,739 bytes, no alpha |
| Phone screenshots (ko) | `screenshots-ko/01-onboarding-ko.png` … `10-profile-ko.png` | 10 candidates, each 1080×1920, 24-bit sRGB PNG, no alpha |
| Phone screenshots (en) | `screenshots-en/01-onboarding-en.png` … `10-profile-en.png` | 10 candidates, each 1080×1920, 24-bit sRGB PNG, no alpha |

Visual inspection confirmed the E-1 icon, localized feature-graphic copy, matching ko/en sequence,
and the intended ten-screen story: onboarding, home, create, invite, detail, check-in, completed,
celebration, notifications, and profile.

Google Play accepts at most eight screenshots for each supported device type. Keep all ten source
candidates here, but select and order exactly eight per locale before upload. This selection is a
**PO confirmation item**; no candidate is deleted automatically. The current dimensions satisfy
Google's 9:16 recommendation and mandatory 320–3840px bounds. See the official
[Google Play preview-asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151).

## SHA-256 manifest

```text
657517BED18910CB1C7927607A8BE02DED7F86BE767D8291056F521CA83EF6DE  app-icon/littlefinger-icon-512.png
D1786A7EC4C8A872601DEBF522D1603C543A73F0B6AB1E549B7FF3E762D2356C  feature-graphic/littlefinger-feature-1024x500-en.png
8D6D373991189B27D7BF84D695738FCEE3BF7E5D880933128C278F2F7AAE2030  feature-graphic/littlefinger-feature-1024x500-ko.png
DA58335F43D1F3ECF44C1164DB37F5878A0F6F9042AFEAE68D9A60E90A7A5098  screenshots-en/01-onboarding-en.png
DC1CDF58A56A2E231D0FF6352D0BD8F5CC95CF813EE15959E139047C3E071B4B  screenshots-en/02-home-en.png
AF08ECC3D35470A1403476411BE6469BFF7711996C54A024A1DAB1BCB7536D55  screenshots-en/03-create-en.png
F0B338A2014098419CD9737821923F70FEE8E01A6255E3E8030E0DB8A912FF26  screenshots-en/04-invite-en.png
743B8E7074D47BE00A0E0B4C13C9228AAD95825F3527D31DF141F09B0A2FB470  screenshots-en/05-detail-en.png
C2EAD20ED5FEACBA02E2FFFD8D39FF99E2826C3FD5473F1290A6AF6F9D2976E5  screenshots-en/06-checkin-en.png
1733E24EE97BDA26A7C1749A682533324398950C797EF9FF2DC3E3D0628C630E  screenshots-en/07-completed-en.png
025330D4C56E8C74DE0282426DB8BBE14B360D6AF5672A8473E37832FFC1E52A  screenshots-en/08-celebrate-en.png
BEFFFA0D270E660471D04C914B38D9D02C05DDC85E6F481CC8E23312FAB9846C  screenshots-en/09-notifications-en.png
C426869003E70AFB377A03FBDC2FF882820888EDA83F6EB050B8A17A5ACE3863  screenshots-en/10-profile-en.png
E0AD005D8C238074651D65A84BC0A6AA529D23B0818948DB336230F1EB46DBB8  screenshots-ko/01-onboarding-ko.png
630A69D206E31441B90826822634072477C5756517568171533D4ABBB915FFFC  screenshots-ko/02-home-ko.png
05980B8CF360F3F66A46111F45A0515010A6A3011A56E8A1D25B9BAE8DF8531D  screenshots-ko/03-create-ko.png
C1C78289756935945451A00E5653DA164A7B6ED9D9851F0A7A6F23A6E3408180  screenshots-ko/04-invite-ko.png
942F3E069FA1C40D6756E5C9877E3BA73DFC7F2C9C72071263275E421B2F9D30  screenshots-ko/05-detail-ko.png
27E39259ABB134BE2447514F8EB0899794A2246F8458384CC50B5E4C489F0039  screenshots-ko/06-checkin-ko.png
A659C688D91ADBE910CFE1524ACDDED81A28A56C8F21F76AD050C7376093E8C1  screenshots-ko/07-completed-ko.png
E9E6BD4DD2F0528C82E7724FCCCB2A5405E5B2FEC703E72984FC2C72729759CB  screenshots-ko/08-celebrate-ko.png
CD9C716C0F773A81A4AC0F94E4D51C0B5A8717D2AE01408CB08ABF11CF024756  screenshots-ko/09-notifications-ko.png
D617BC47C72396E60E09DE004B72EC6809637EB1FAA14B8306E5281B515E0BC8  screenshots-ko/10-profile-ko.png
```

## Upload boundary

- Upload ko files only to the ko-KR listing and en files only to the en-US listing.
- Preserve the selected numeric order in both locales.
- Do not run `tools/export-brand-icons.js` over this directory. The Play icon is a curated listing
  asset and is intentionally separate from the native launcher export pipeline.
- After Play Console upload, record the selected eight filenames, upload time, and console status in
  `docs/setup/play-store-listing.md` and `docs/DEVELOPMENT_STATUS.md`.
