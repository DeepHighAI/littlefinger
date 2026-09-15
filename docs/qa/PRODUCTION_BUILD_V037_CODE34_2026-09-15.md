# Production build — 0.3.7 / code 34

## Delivery

**Rollout update (2026-09-15):** PO confirmed production Play publication. The held
web artifact was then deployed as Firebase Hosting version `94998852cee368b5`.
See [live web verification](INVITATION_HANDOFF_2026-09-15.md#production-web-rollout--2026-09-15).
The build-time delivery state below is retained as historical evidence.

This candidate supersedes code 33 for the combined mascot/icon and app invitation
review release. The PO owns Play Console upload and publication. No Play submission
or minimum-version flag change was performed. Web rollout waits for this app to be
available: older apps return witness invitations to the web.

| Field | Verified value |
|---|---|
| AAB | `dist/littlefinger-production-v0.3.7-code34.aab` |
| Package | `com.littlefinger.app` |
| Version / code | **0.3.7 / 34** |
| Bytes | 83,091,861 |
| SHA-256 | `f2a134481327fe07aa930a9c3eab625946fdb189120ddc3271babe46da7706af` |
| Upload certificate SHA-256 | `C1:E0:70:DE:41:70:DE:B9:0A:D4:32:C2:D5:21:99:1F:F7:8B:54:6F:CD:06:BB:90:0F:B8:46:A8:D3:97:37:BB` |
| Shipping source | `b9a41c7c84f557701bff8315470ebb24e0ae53ed` |
| SDK | min 24 / target 36 |
| ABIs | arm64-v8a, armeabi-v7a, x86, x86_64 |

## Changes

[ADR 0029](../adr/0029-app-invitation-review-and-public-decline.md) removes OAuth from
invitation web entry, uses app review before final acceptance, and brings witness
preview/join/sign/record/leave into the app. Token holders can explicitly decline
through the public Edge endpoint; no identity is invented. Existing account review
and agreement state rules remain except the PO-approved anonymous decline policy.
The Mobbin-informed landing groups the new mascot, sender and title above the two
main actions. Its installation hint links to Play for missing/older apps. The new
icon/mascot from ADR 0028 remains included throughout the native bundle.

## Build provenance

EAS remote version 33 was read; 34 was reserved and read back. Production environment
variables were freshly pulled. The established Windows local Gradle route used the
isolated C:/DEV/lf30 snapshot and the existing upload key. No dependency or native
plugin changes were introduced. Existing native compilation outputs were reused;
version/signing overrides were applied only to the generated local native project.
JBR 21, Gradle 9.3.1 and NDK 27.1.12297006; R8/resource shrinking and all ABIs retained.

The 367 frozen shipping inputs match the source
commit. The 206 bundled own sources
match their source text, including WitnessReview, the token route and witness route.
The AAB Hermes bundle equals Gradle's output. QA/mock entrypoints are absent.
All 92 native libraries match the
established code-30 native outputs, and the complete permission list is unchanged.
The native art verification matched 30 raster
resources and all four mascot assets against current source artwork.

## Verification output

- `npm test`: **126 Vitest files / 2,206 tests; 96 Jest suites / 977 tests passed**.
- `npm run typecheck`: five projects passed; `npm run check:agents`: synchronized.
- Gradle: **BUILD SUCCESSFUL in 8m 45s**.
- `bundletool validate`: PASS; `jarsigner`: **jar verified.** Upload certificate matched.
- Manifest/config: correct package/version/SDK, non-debuggable, production backend,
  web host and AdMob configuration, required invitation modules and no QA payload.
- Native bundle alignment: **PAGE_ALIGNMENT_16K**; all 46
  64-bit native libraries passed ELF LOAD alignment checks.
- Hermes scan: 38,468 strings inspected; private key markers,
  secret keys and service-role tokens absent.
- Web build passed (existing >500 kB chunk advisory). Screenshots and live server
  checks: [invitation verification](INVITATION_HANDOFF_2026-09-15.md).

Native screenshots use a fixture-only APK with mocked API responses; they verify
layout and explicit action handling, not Play signing or live account integration.
Play-installed App Links, Kakao in-app browser fallback, OAuth restoration and real
recipient/witness acceptance remain device acceptance checks after publication.

## Deployment order and retained artifacts

1. **Done:** additive DB migrations and invite-resolve/invite-decline-public/
   witness-preview Edge Functions deployed. Direct anonymous DB access denied.
2. **PO:** upload this AAB and publish the selected Play release.
3. **Next web release:** once 0.3.7 is available, publish the frozen web output with
   the repository's Firebase Hosting configuration and verify actual invitation flows.
   Existing apps can use the installation/update hint to reach Play.

Prepared web archive: `dist/littlefinger-web-invitation-v0.3.7.zip` (not deployed).
Private build logs, source maps, mapping, environment and inspection output are in
`release-archive/2026-09-15-v037-code34/`; these are ignored and not committed.
The adjacent AAB `.sha256` file matches the final artifact. No cloud build or Play
upload was submitted. Main/branch fast-forward checks returned `Already up to date.`
