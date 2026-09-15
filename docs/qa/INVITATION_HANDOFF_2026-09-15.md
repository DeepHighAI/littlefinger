# Invitation handoff verification — 2026-09-15

Implementation: [ADR 0029](../adr/0029-app-invitation-review-and-public-decline.md).

## Verified behavior

- Partner and witness token entry shows sender/title and app/decline actions, with no web OAuth.
- Legacy review/witness invitation paths use the same landing. Joined-witness record links open the native witness route.
- Android intent preserves the token and has a Play fallback. Installation instructions require reopening the original invitation.
- Anonymous decline requires explicit confirmation, changes the intended invitation only, and is idempotent. No invented actor or account-attributed approval.
- Native witness preview does not consume the invitation. Explicit FULL confirmation joins and signs; LIMITED joins without signing hidden content. Failed signing retries without a second join. Existing witnesses can view the record and explicitly leave.

## Automated evidence

`npm test`: 126 Vitest files / 2,206 tests; 96 mobile Jest suites / 977 tests passed.
`npm run typecheck`: all five projects passed. `npm run check:agents`: synchronized.
Web production build passed, with the existing >500 kB chunk advisory.
Transaction tests use PGlite's actual Postgres engine; queued single-connection races are not a multi-connection lock stress test.

## Visual evidence

[Screenshots](invitation-handoff-2026-09-15/) show partner, witness, English, desktop, decline confirmation/completion, and native witness preview/signature completion.
Web: 360x800 and 1280x900, Android browser UA; no page errors or horizontal overflow. Large-text case scales fonts to 1.5. Agent-browser-owned Chromium with mocked endpoints and the production host routed to local preview; no real invitation is changed.
Native: read-only API 36.1 emulator at 360x800 dp and font scales 1.0/1.5. A fixture-only APK renders the actual WitnessReview component with mocked endpoints; explicit confirmation reaches the signed state. The template APK resource table maps the mascot to res/Kw.png, which is replaced by the current source PNG for the fixture. The production AAB is built and inspected separately; this fixture is never submitted.

## Server deployment

Applied 20260915092900_app_invitation_handoff and its promise-index follow-up.
Deployed invite-decline-public, witness-preview and invite-resolve using `--use-api`.
Live probes: malformed public decline 422 E_VALIDATION; unknown token 404 E_NOT_FOUND; unauthenticated witness preview 401. No production participant/invitation was mutated by verification.
Live privileges: anon ledger SELECT false, authenticated INSERT false, anon decline RPC EXECUTE false, service_role EXECUTE true.
Security advisor: the new server-only ledger intentionally has RLS with no client policy (INFO). Existing password-protection warning is unrelated; auth configuration remains Dashboard-owned.

## Delivery boundary

Native functionality requires the new Play build. Code 33 and older hand witness links back to the web, so publishing this handoff first would create a loop. Server additions are deployed; web output is prepared but not published. PO uploads/releases the new AAB, then the web can be switched (the installation hint also links to Play for older installed clients) and verified on a Play-installed build. Kakao in-app browser, store fallback, OAuth account restoration and real Play delivery remain device acceptance checks.


## Production web rollout — 2026-09-15

The PO confirmed 0.3.7 / code 34 is live on the production Play track. The reported
old mascot/OAuth screenshot was the still-held web release, not missing native code.
Deployed the previously verified, unchanged 21-file web artifact using
`firebase deploy --only hosting:web --project littlefinger-app-philwoo --non-interactive`:
**Deploy complete!** Hosting live version: `94998852cee368b5`.

All 21 production responses match the frozen artifact SHA-256 values. HTML uses
`public, max-age=0, must-revalidate`; hashed assets remain immutable.
Production-host browser verification: partner, witness and desktop have zero OAuth
buttons, a successfully loaded new `mascot-face-e1-DCchrxZG.png`, app intent and decline
actions, no page errors and no horizontal overflow. Decline confirmation/completion
and English/large-text screens also rendered. Only invitation API data was mocked;
HTML, JS, CSS, fonts and artwork came from the live server. No real invitation was
accepted or declined. Fresh screenshots: [partner](invitation-handoff-2026-09-15/live-partner.png)
and [witness](invitation-handoff-2026-09-15/live-witness.png).

The app and web rollout hold is now resolved. No new AAB or reinstall is required for
this web publication. Existing open browser documents must reload (close/reopen the
original Kakao invitation link) to run the newly deployed page. Real cross-device
acceptance remains a device check; this deployment did not exercise an actual token.
