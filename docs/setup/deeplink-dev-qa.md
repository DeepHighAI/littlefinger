# Deep-link invite QA — dev-build manual runbook

Verifies the 2026-08-20 deep-link work (ADR 0007) on a real Android device. This is the manual
QA the specs require (`01` §11) and automated tests cannot cover: OS-level link routing through
KakaoTalk's in-app browser and Chrome, and the store fallback. Run it once per build type and
record results in `docs/qa/MANUAL_E2E.md`.

## 0. Two mechanisms, two different pass conditions

Understanding this first prevents mis-diagnosing failures:

| Path | Mechanism | Works with local debug APK? |
|---|---|---|
| SCR-W01 "앱에서 계속하기" CTA | `intent://` URI — launches by **package name** (`com.littlefinger.app`), no domain verification involved | **Yes** |
| Plain link tap in Chrome/browser | Android App Links — needs the APK's **signing cert** listed in `/.well-known/assetlinks.json` | **No** (see below) |

`assetlinks.json` on `littlefinger-app-philwoo.web.app` carries the **EAS development
certificate**. The local ARM64 debug APK
(`C:\Users\batis\AppData\Local\Temp\littlefinger-firebase-debug-arm64-v8a.apk`) is signed with a
different local cert, so auto-open from Chrome will not verify with that APK — that is a
certificate mismatch, not a code bug. Scenario B's final PASS therefore needs an EAS-signed
development build; everything else can be tested with the local debug APK.

## 1. Prerequisites

- Galaxy device (ARM64) with USB debugging, KakaoTalk installed and signed in.
- The APK installed (`adb install <apk>`), plus Metro for the dev client — the only launch
  recipe that works on this Windows machine:

  ```bash
  cd apps/mobile
  CI=1 EXPO_NO_TYPESCRIPT_SETUP=1 npx expo start --dev-client --port 8143
  adb reverse tcp:8143 tcp:8143
  adb shell am start -a android.intent.action.VIEW -d "littlefinger://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8143"
  ```

  (`CI=1` disables hot reload; reload via the dev menu. Verify with
  `curl http://localhost:8143/status` → `packager-status:running`.)
- Two identities: a **creator** account in the app and a **partner** KakaoTalk account that
  receives the link. Dev builds include the email test login (accounts in the E2E docs), so the
  partner can also be a test account.

## 2. Produce an invite link

In the app: create a promise → 초대 링크 보내기 → share to KakaoTalk (or copy the link and
paste it into a chat). Link shape: `https://littlefinger-app-philwoo.web.app/i/<token>`.
Sending it to 나와의 채팅 on the partner's KakaoTalk is the easiest single-device setup.

## 3. Scenario A — KakaoTalk → CTA → in-app review (app installed)

1. On the partner device, tap the link inside KakaoTalk → the in-app browser opens SCR-W01.
2. **Expect**: primary CTA **앱에서 계속하기** (Android only), with 웹으로 계속하기 below it.
3. Tap 앱에서 계속하기 → the app opens on the invite review screen.
4. If signed out: the review route shows Kakao/Google login **and stays on `/i/<token>`**
   after login — it must not bounce to home.
5. **Expect** on review: promise content, 법적 고지(disclaimer), and 승인 / 거절 / 수정 제안.
6. Approve → **expect** the app lands on that promise's detail screen (`/promise/<id>`).
7. EC-A01 spot check: before approving, background the app and reopen the link — the review
   screen must reopen without consuming the invite.

## 4. Scenario B — plain link tap in Chrome (App Links auto-open)

Run with the **EAS-signed dev build** for the definitive result.

1. Check verification state first:

   ```bash
   adb shell pm get-app-links com.littlefinger.app
   ```

   **Expect** `littlefinger-app-philwoo.web.app: verified`.
2. Paste the invite link into Chrome's address bar and tap it (or tap it in any non-Kakao
   app) → **expect** the app opens directly on the review screen, no browser, no chooser.
3. With the local debug APK the domain will report not-verified and Chrome stays on web
   SCR-W01 — record that as expected-with-debug-cert, and use the CTA instead.

## 5. Scenario C — app not installed → store fallback

1. Uninstall the app from the partner device.
2. KakaoTalk → tap the link → SCR-W01 → tap 앱에서 계속하기.
3. **Expect**: the Play Store opens. Until the store listing exists (M4) it shows
   "항목을 찾을 수 없습니다" — the **Play Store app opening is the PASS condition**, not the
   listing.
4. Back in the browser, 웹으로 계속하기 → login → the full web approval path must still work
   (the fallback keeps web approval intact — PO decision 2026-08-20).
5. iPhone check if available: the CTA must **not** render on iOS (EC-I03 unchanged).

## 6. Scenario D — witness token stays on the web

Open a **witness** invite link while the app is installed → the app shows the browser
hand-off card (unchanged behavior); witness confirmation happens on the web (SCR-W05).

## 7. Server-side evidence — `surface = 'APP'`

The app's approval must be recorded as an APP-surface action (RN fetch sends no `Origin`
header; the Edge Function derives the surface from that). In Supabase Dashboard → SQL editor,
read-only:

```sql
select role, action, surface, acted_at
from approvals
where promise_id = '<promise id from Scenario A>'
order by acted_at;
```

**Expect**: the partner's APPROVE row has `surface = 'APP'`; an approval done through the web
path (Scenario C step 4) has `surface = 'WEB'`.

## 8. Record results

Append PASS/FAIL per scenario to `docs/qa/MANUAL_E2E.md` with screenshots and **which APK**
(local debug vs EAS dev) was used. Report anything unexpected as-is — especially any case
where a link opens the wrong surface, since that is the one failure automated tests cannot
see.
