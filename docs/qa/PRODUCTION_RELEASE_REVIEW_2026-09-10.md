# Production release review — September 10, 2026

## Outcome

The PO accepted `littlefinger-v0.3.2-code27-fixes-20260910.apk` on a physical device.
The reported back-navigation, login-copy and acceptance-action corrections are closed,
including keeping witness invitation in the scrolling detail body (ADR 0025).
The exact device/font-scale matrix was not separately supplied by the PO.

No additional missing product feature was established in this bounded release review.
One reproducible CI test-environment defect was found and corrected. In a subsequent
September 10 message, the PO confirmed completion of the previously numbered items
2 (advertising), 3 (Play-installed verification), and 4 (console review). These gates
are closed based on the PO's report; do not reopen them based on the earlier snapshot.
The new production AAB and its technical inspection are now complete:
[0.3.2 / code 28 artifact record](PRODUCTION_BUILD_CODE28_2026-09-10.md).
The preview APK uses Google test ad units; advertising acceptance comes from the PO's
separate confirmation, not from that preview artifact.
The previous production code 27 AAB predates these UI corrections and must not be reused.

## Git and verification

Both `codex/supabase-e2e` and `origin/feature/ui-restyle-codex` are already ancestors
of `main`. Fetch found no new upstream commits before this pass; no merge is needed.
The accepted native corrections and APK/device record are committed as `c288c7c`.

The prior main CI run [34328641235](https://github.com/DeepHighAI/littlefinger/actions/runs/34328641235)
failed in the witness route case of `apps/web/src/App.test.tsx`: its URL was stubbed,
but the anonymous client key came implicitly from the developer's ignored environment.
With both Supabase environment values empty, this reproduced locally as **1 failed /
11 passed**. Explicitly supplying `test-anon-key` in the existing test setup produces
**12 passed** under the same empty-environment condition. Fetch remains mocked; no
production credential or service is needed. No product runtime was changed by this fix.

Full pre-commit checks: 121 Vitest files / 2,207 tests, 91 mobile Jest suites / 956
tests, five-project typecheck, instruction synchronization and whitespace validation.
Logs: `dist/release-review-final-*.log`; isolated CI reproduction/retest logs:
`dist/release-review-ci-{repro,retest}.log`. Native visual evidence and APK signature,
ABI, installation and startup checks are in [the test-27 record](../notes/public-test-27-followup.md).

## Earlier read-only service snapshot

Observed September 10, project `vepnrrmxvsytguocicfe`; no service configuration or
business records were changed. This snapshot predates the PO's later verification
confirmation. Counts below are historical observations, not current release blockers.

- All **79** local migration versions match remote; no local-only or remote-only version.
- All **59** listed Edge Functions are ACTIVE. The September 9 alias functions and
  `push-send` deployment are present. This is deployment inventory evidence, not a
  byte-for-byte audit of every deployed function.
- `ads_enabled=true`, `rewarded_ads_enabled=true`, `min_app_version=0.2.0`.
- `ADMOB_SSV` grants: **0**; GRANTED reward intents: **0**. Current intents are
  7 PENDING and 3 REJECTED; the latest pending intent is September 9, 06:41:55 UTC.
  These aggregates establish no successful grant evidence; they do not identify the
  cause of an unsuccessful ad load or callback.
- Security Advisor: 18 INFO findings for intentionally server-only, RLS-enabled
  tables without client policies; one existing leaked-password-protection WARN;
  no ERROR. Email/password is recorded as disabled in prior operational evidence,
  but Dashboard Auth configuration was not freshly fetched in this pass.
  [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
  [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Latest [keep-alive run](https://github.com/DeepHighAI/littlefinger/actions/runs/34311617579)
  succeeded September 9; latest [weekly backup](https://github.com/DeepHighAI/littlefinger/actions/runs/34059645197)
  succeeded September 6. No restore drill was performed here.

## Release checklist after PO confirmation

| Priority | Work | Required completion evidence |
|---|---|---|
| Complete — PO report | Actual UMP consent and privacy-options reopening | PO confirmed verification of the previously numbered advertising item 2 on September 10. No new agent-run device check is claimed. |
| Complete — PO report | Production-unit rewarded ad and server grant | Included in the same PO confirmation of item 2. The earlier zero-grant snapshot is not used to reopen this accepted check. |
| Complete — artifact inspected | Build a new AAB from committed main using EAS `production` | 0.3.2 / code 28, build `2b788a13-38cf-48c5-a89f-9bd9afdba0df`, source `70e47af`. Bundle validation, upload signature, production configuration, module/fixture/credential scans and ARM64/16 KB ELF/ZIP alignment passed. See the [artifact record](PRODUCTION_BUILD_CODE28_2026-09-10.md). |
| Complete — PO report | Play internal-testing installation and core flows | PO confirmed verification of the previously numbered item 3 on September 10. The PO did not identify an additional artifact in that message; do not invent a build ID or mark the unbuilt new AAB as tested. |
| Complete — PO report | Console readiness and declarations | PO confirmed verification of the previously numbered item 4 on September 10. This is verification acceptance, not an assertion that publication occurred. Existing `eas submit --profile production` targets **internal / draft**; PO retains Play upload/publication ownership. |

Before the new build, an EAS inventory check after that confirmation found the latest production build
still at 0.3.2 / code 27, created September 9 (`7c9cc306-3605-4a55-aa45-b981c035203d`,
source `15202b6`). The September 10 build is the accepted preview APK. Neither is a
production AAB from dependency-fix commit `8a017cd`. EAS subsequently incremented the
remote counter to 28 and produced the newly inspected AAB; do not reuse the old AAB.

The current source commit `8a017cd` passed [remote CI](https://github.com/DeepHighAI/littlefinger/actions/runs/34435403977).
The production-environment JavaScript export already passed 2,201-source module
verification. The completed code 28 artifact checks cover native AAB validation, package/version,
upload signature, actual production configuration, ARM64/16 KB compatibility, and
confirmation that install-time patches and the normal application entry reached the
build. No additional blocking code defect was established by this review.

Google's current guidance confirms [UMP test geography and privacy-options behavior](https://developers.google.com/admob/android/privacy),
[16 KB compatibility checks](https://developer.android.com/guide/practices/page-sizes), and
[bundle preparation / release-error review](https://support.google.com/googleplay/android-developer/answer/9859348?hl=en).
Do not add new settings or republish an already-correct message merely to force a form.

## Broader QA and maintenance

These are evidence gaps or maintenance work, not newly demonstrated runtime defects.

- Final release-device coverage should include evidence upload, cold-start push/link
  handling and actual push delivery/quiet hours. Existing historical checklists do not
  establish that every variant was exercised on the newest candidate.
- Retention notification/expiry/purge scenarios (ADR0015 device rows 16–18) still lack
  a consolidated populated-workflow acceptance record. Use isolated staging fixtures;
  ordinary production records must not be fast-forwarded or purged to complete a checklist.
- Creator-side permanent purchase and two-party FINISH were explicitly classified as
  optional broader coverage in the September 6 review. Do not reclassify the PO's prior
  skipped account switch as a proven product failure.
- The [September 10 dependency cleanup](../notes/dependency-security-2026-09-10.md)
  reduces `npm audit --omit=dev --json` from 21 findings to **5 high / 0 moderate**.
  Decoder and UUID receive fixed versions with consumer compatibility checks.
  Remaining findings are the locally patched `image-size` version and its Metro
  parents; npm does not recognize local patches. Install scripts must apply the
  committed patches, and the final AAB must pass module verification. No framework
  downgrade or audit suppression is used. The full audit separately retains two
  existing development-only Vitest findings.
- Existing web chunk-size/CLS work and font-asset size cleanup are optimization backlog.
  No fresh performance benchmark or full remote concurrency/worker replay was run here.

## Superseded checklist items

P6/P7 redesign, startup AppState retry, partner permanent-purchase interruption recovery,
refund/reconcile revocation, single-page onboarding and app-ads.txt file setup already
have later completion evidence. The old 100-daily-confirmations ad gate was superseded
by ADR 0022; exposure ads are enabled. Do not reopen these solely because older sections
of the status history or the August device matrix still say pending.

The exact APK's physical acceptance closes the September 10 UI reports. The PO's
subsequent explicit verification closes advertising, Play-installation and console
review items. Production code 28 generation and artifact inspection are complete;
this review does not publish a production-track release.
