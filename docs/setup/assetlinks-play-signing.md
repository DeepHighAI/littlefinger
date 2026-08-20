# App Links — Play App Signing cert append (M4 operator runbook)

`apps/web/public/.well-known/assetlinks.json` currently lists **one** SHA-256 fingerprint: the
EAS development certificate. Store builds are re-signed by **Google Play App Signing** with a
different key, so **without this runbook every store install loses App Links** — invite links
tapped in Chrome open the browser instead of the app, silently. Nothing in CI catches it; only
a store-installed device shows it.

Run this once the app is in Play Console (closed testing counts — testers install store-signed
builds too).

## 1. Get the Play signing cert fingerprint

Play Console → the app → **Setup → App signing** (테스트 및 출시 → 설정 → 앱 서명) → section
**App signing key certificate** → copy the **SHA-256 certificate fingerprint**
(colon-separated hex, same shape as the one already in the file).

## 2. Append — never replace

Edit `apps/web/public/.well-known/assetlinks.json`: add the Play fingerprint as a **second**
entry in `sha256_cert_fingerprints`, keeping the EAS dev cert so development builds keep
verifying:

```json
"sha256_cert_fingerprints": [
  "C1:E0:70:DE:41:70:DE:B9:0A:D4:32:C2:D5:21:99:1F:F7:8B:54:6F:CD:06:BB:90:0F:B8:46:A8:D3:97:37:BB",
  "<PLAY_APP_SIGNING_SHA256>"
]
```

## 3. Update the contract test

`apps/mobile/config/app-links-config.test.js` pins the fingerprint list (constant
`EAS_DEVELOPMENT_CERT_SHA256`). Add the Play fingerprint constant and extend the expected
array — the test exists precisely so the deployed file and the repo cannot drift.

## 4. Deploy and verify

```bash
npm test && npm run typecheck
npx firebase deploy --only hosting
curl -s https://littlefinger-app-philwoo.web.app/.well-known/assetlinks.json
```

Then on a device with the **store-installed** build:

```bash
adb shell pm get-app-links com.littlefinger.app   # expect: verified
```

Android re-checks the domain on install; an already-installed build may need
`adb shell pm verify-app-links --re-verify com.littlefinger.app` or a reinstall.

## Notes

- Do **not** remove the dev cert entry — both certs stay listed; App Links allows any number.
- If the Play fingerprint ever rotates (key upgrade), repeat from step 1.
- Full manual QA scenarios: `docs/setup/deeplink-dev-qa.md`.
