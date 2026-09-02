# App Links — Play App Signing cert append (M4 operator runbook)

`apps/web/public/.well-known/assetlinks.json` must list the EAS development certificate and every
certificate used by **Google Play App Signing**. Store builds are re-signed by Google Play, so a
missing fingerprint silently makes affected invite links open in the browser instead of the app.
The contract test catches repository drift, but only a store-installed device proves which signing
certificate Play actually delivered.

Run this once the app is in Play Console (closed testing counts — testers install store-signed
builds too).

## 1. Get the Play signing cert fingerprint

Play Console → the app → **Setup → App signing** (테스트 및 출시 → 설정 → 앱 서명) → section
**App signing key certificate** → copy the **SHA-256 certificate fingerprint**
(colon-separated hex, same shape as the one already in the file).

## 2. Append — never replace

Edit `apps/web/public/.well-known/assetlinks.json`: append the Play fingerprint to
`sha256_cert_fingerprints`, keeping every existing entry so development builds and builds signed
with an older/alternate Play key keep verifying:

```json
"sha256_cert_fingerprints": [
  "C1:E0:70:DE:41:70:DE:B9:0A:D4:32:C2:D5:21:99:1F:F7:8B:54:6F:CD:06:BB:90:0F:B8:46:A8:D3:97:37:BB",
  "<PLAY_APP_SIGNING_SHA256>",
  "<OTHER_PLAY_SIGNING_SHA256_IF_PRESENT>"
]
```

## 3. Update the contract test

`apps/mobile/config/app-links-config.test.js` pins the complete fingerprint list. Add the Play
fingerprint constant and extend the expected array — the test exists precisely so the deployed
file and the repo cannot drift.

## 4. Deploy and verify

```bash
npm test && npm run typecheck
npx firebase deploy --only hosting
curl -s https://littlefinger-app.web.app/.well-known/assetlinks.json
```

Then on a device with the **store-installed** build:

```bash
adb shell pm get-app-links com.littlefinger.app   # expect: verified
```

Before trusting the Console copy, extract the certificate from the store-installed APK with
`apksigner verify --print-certs` and compare it. Android re-checks the domain on install; an
already-installed build may need `adb shell pm verify-app-links --re-verify com.littlefinger.app`
or a reinstall.

## Notes

- Do **not** remove an existing cert entry — App Links allows any number, and Play key upgrades can
  leave more than one store signing certificate in active use.
- If the Play fingerprint ever rotates (key upgrade), repeat from step 1.
- Full manual QA scenarios: `docs/setup/deeplink-dev-qa.md`.
