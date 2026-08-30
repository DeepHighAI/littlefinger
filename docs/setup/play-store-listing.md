# Play Store listing — 0.2.0

Date: 2026-08-30. Companion to `monetization-retention-release.md` §2-7 (release notes) and §2-6
(manifest check). Store text is product copy: it follows CLAUDE.md §8-3 — **no legal-contract
wording** (no 계약 / 서명 / 법적 효력 / 공증 / contract / binding / notarize; the product records a
약속, it does not adjudicate one) — and it never promises escrow or automatic penalties (§8-6).

## 1. What's new (release notes, ≤ 500 characters each)

Paste as-is into 출시 노트 for `ko-KR` and `en-US`.

**ko-KR** (281 chars)

```
0.2.0 새로운 기능
• 증인 자리 늘리기: 광고를 보면 이 약속의 증인 자리가 하나 더 열려요.
• 약속 기간 늘리기: 작성자는 광고를 보고 종료일 범위를 30일씩 늘릴 수 있어요.
• 내 기록 보관하기: 끝난 약속의 기록은 30일 동안 보관돼요. 광고로 30일씩 늘리거나 영구 보관(₩2,000)을 구매할 수 있어요.
• 종료일 없는 약속: 영구 보관을 구매한 작성자는 종료일 없이 약속을 제안할 수 있고, 두 사람이 합의해 마무리해요.
• 홈 목록에 약속이 6개 이상이면 광고가 한 번 표시돼요.
```

**en-US** (476 chars)

```
What's new in 0.2.0
• Extra witness spot: watch an ad to open one more witness spot on a promise.
• Longer promises: the creator can watch an ad to extend the end-date range by 30 days.
• Keep your record: finished promises stay for 30 days. Add 30 days with an ad, or buy permanent access (₩2,000).
• Open-ended promises: a creator with permanent access can propose no end date; you both agree when to finish.
• One banner ad appears in the home list at six or more promises.
```

Prices shown are the ₩2,000 display fallback; the store-localized price is authoritative
(ADR 0015 D5), so the note says "₩2,000" only in the Korean and English notes for the KR storefront.

## 2. Listing and app-content flags

| Play Console location | Set to | Why |
|---|---|---|
| 앱 콘텐츠 → 광고 | **예, 광고 포함** | A02 banner + three native slots + rewarded units (ADR 0009, 0015) |
| 인앱 상품 (수익 창출) | `promise_slot_plus1` ₩1,000 and `promise_permanent_access` ₩2,000 both **활성** | Play derives the "인앱 구매" badge from active products; there is no separate toggle |
| 앱 콘텐츠 → 콘텐츠 등급 (IARC) | Answer **yes** to digital purchases and **yes** to ads; no user-generated public content (promise text is shared only with invited participants) | Badge and rating consistency |
| 앱 콘텐츠 → 타겟층 및 콘텐츠 | **만 14세 이상**: tick 13–15, 16–17, 18+ (never 12 and under) | Terms require 만 14세 이상. Ticking 13–15 requires AdMob "최대 광고 콘텐츠 등급" ≤ T — PO to confirm in AdMob → 앱 → 차단 제어 |
| 앱 콘텐츠 → 데이터 보안 | Re-submit from `docs/setup/play-data-safety.md` | See §4 |
| 스토어 설정 → 스토어 등록정보 → 개발자 웹사이트 | `https://littlefinger-app.web.app` | AdMob crawls it for `app-ads.txt` |
| 개인정보처리방침 URL | `https://littlefinger-app.web.app/legal/privacy` | Must be the 2026-08-30.1 page |
| 계정 삭제 URL (데이터 보안) | `https://littlefinger-app.web.app/account-deletion` | Unchanged |
| 앱 액세스 권한 | "일부 기능 제한" with license-tester instructions: Google sign-in, then the reviewer account listed in 라이선스 테스트 | Reviewers must reach a rewarded row and the ₩2,000 sheet |

## 3. Permission set to verify in the AAB manifest

Run `java -jar bundletool-all-1.18.1.jar dump manifest --bundle dist/littlefinger-internal-v0.2.0-code<N>.aab`
(runbook §2-6) and compare every `<uses-permission>` against this table. This is a **check list,
not an expectation list** — the Expo plugins merge their own permissions and the exact set is only
known from the dump.

| Permission | Must be | Source |
|---|---|---|
| `android.permission.INTERNET` | present | app |
| `com.google.android.gms.permission.AD_ID` | present | `react-native-google-mobile-ads` — required because 광고 = 예; if absent, the Data safety "advertising ID" answer is wrong the other way |
| `com.android.vending.BILLING` | present | `expo-iap` — required for both products |
| `android.permission.POST_NOTIFICATIONS` | present | `expo-notifications` (Android 13+) |
| `android.permission.ACCESS_NETWORK_STATE` | expected | ads SDK / Expo |
| `android.permission.VIBRATE`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `com.google.android.c2dm.permission.RECEIVE` | expected | `expo-notifications` + FCM |
| `android.permission.READ_MEDIA_IMAGES` / `READ_EXTERNAL_STORAGE` (maxSdk 32) | expected | `expo-image-picker` (evidence photos) |
| `android.permission.CAMERA`, `RECORD_AUDIO` | **finding if present** — the picker is gallery-only; if the dump shows them, the `expo-image-picker` plugin options must be tightened before the next build, and they must be declared in Data safety meanwhile | `expo-image-picker` default merge |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `READ_PHONE_STATE`, `SYSTEM_ALERT_WINDOW`, `READ_CONTACTS`, `QUERY_ALL_PACKAGES` | **must be absent** | none justified; any of them is a release blocker |

Also confirm from the same dump: `package="com.littlefinger.app"`, `versionCode="<N>"`,
`versionName="0.2.0"`, `minSdkVersion 24`, `targetSdkVersion 36`, and that the
`react-native-google-mobile-ads` `APPLICATION_ID` meta-data is the real `ca-app-pub-…~…` app id,
not the Google test id `ca-app-pub-3940256099942544~3347511713` (a production build carrying the
test app id means the EAS environment was not applied).

Record the final permission list in `docs/DEVELOPMENT_STATUS.md` next to the build code.

## 4. Data safety diff (pointer)

The form answers live in `docs/setup/play-data-safety.md` and are maintained there. What changed
in this batch and therefore needs re-submission of the form:

- Rewarded ads: AdMob server-side verification sends the advertising id and an opaque per-user id
  to Google (ADR 0015 D6).
- Purchases: Play purchase tokens for `promise_permanent_access` are verified server-side and
  bound to user + promise (D5).
- Retention: records are deleted per participant after expiry, with a de-identified aggregate kept
  for keepRate (D4) — affects the "data deletion" answers.
- Legal documents are 2026-08-30.1 (terms + privacy).

## 5. Wording guard (§8-3)

Before saving any listing field, search the text for: 계약, 서명, 법적, 효력, 공증, 증거, 판결,
contract, sign, legally, binding, notar, evidence, verdict. None may appear. Preferred words:
약속 / 기록 / 확인 / 증인 / 지킴율; promise / record / confirm / witness / keep rate. The app
description must not claim the record has legal effect and must not describe the 벌칙 as anything
other than a text record.
