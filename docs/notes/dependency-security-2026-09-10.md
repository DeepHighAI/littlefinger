# Dependency security cleanup — September 10, 2026

## Scope and changes

Keep the accepted Expo 57 / React Native 0.86.2 application baseline while addressing
the three advisory roots from the production dependency audit. No screen, native SDK,
domain behavior or service configuration changes are part of this cleanup.

Only two existing resolved package versions change:

- `xcode@3.0.1` receives `uuid@11.1.1` through a parent-scoped npm override. This is
  the patched release with a CommonJS entry point. Xcode only calls `uuid.v4()`;
  project UUID generation and a project write/parse round trip are regression tested.
  The vulnerable v3/v5 short-buffer calls now throw.
- `query-string@7.1.3` receives `decode-uri-component@0.5.0`. Its small compatibility
  patch reads the ESM default export and preserves the old plus-to-space behavior,
  including fragments. Unicode, arrays, null/empty values and long malformed runs
  are regression tested. Synchronous `require(esm)` is supported by this project's
  Node 22 runtime and React Native's supported Node version floor (20.19.4).

`image-size@1.2.1` has no published fixed release. A local patch validates ICNS
header lengths before advancing and rejects entries shorter than a header. It keeps
dimension extraction from a large file's partial prefix, as used by the package's
bounded file reader. ISO boxes require a complete header and a positive effective
length; a zero declared size means the remaining file, preserving valid EOF boxes.
This also prevents JXL partial-stream parsing from repeatedly consuming the same box.
Valid ICNS/HEIF dimensions and checked-in mobile PNG assets have regression coverage.

The versioned patches live in `patches/`. Root `postinstall` runs
`patch-package --error-on-fail`; a patch conflict stops installation. `patch-package`
is an exact production dependency so omitting development dependencies does not
silently omit the security patches. No package version is falsified and no advisory
is suppressed. Keep install scripts enabled for CI and EAS builds.

The existing Metro safe query-string resolver remains in place. The Android source-map
verifier additionally rejects build-only `image-size` and `uuid` modules. The patched
query-string package is covered for Node consumers, but the app still bundles its
existing safe parser.

## Audit interpretation

`npm audit --omit=dev --json`: **21 (5 high / 16 moderate) → 5 (5 high / 0 moderate)**.
All remaining entries are `image-size` and its propagated Metro parent findings.
Npm audit evaluates published versions, so it continues to report the locally patched
1.2.1 release. This is a verified local mitigation, not a claim of an audit-clean tree
or an upstream security release. Revisit the patch when upstream publishes a fix.

The full audit additionally reports two existing development-only moderate entries,
`vitest` / `@vitest/mocker`, from one redirect-mock development-server advisory. This
repository uses Node/jsdom tests and does not configure its public mocker/interceptor
plugins. A supported Vitest major upgrade is separate maintenance; this bounded
production cleanup does not replace the test runner.

Do not use `npm audit fix --force`: its proposed Expo/Router/native-package downgrades
would replace the accepted framework baseline. The lockfile adds patch-package and
its dependencies without changing other existing resolved versions.

## Verification

Fresh `npm ci` succeeded and automatically applied both patches. In memory-limited,
isolated child processes, the original registry ICNS/JXL zero-length inputs aborted
the process; patched parsers rejected the same inputs normally. Child-process deadlines
in the regression suite prevent a reintroduced loop from hanging the whole runner.
Final `npm test`: **122 Vitest files / 2,220 tests** and **91 mobile Jest suites /
956 tests** passed. Five-project typecheck, `check:agents`, final postinstall reapplication
and whitespace checks passed. The first full run hit the new child-process deadline
under parallel database-test load; a 15-second isolated-process deadline preserves the
hang guard with sufficient startup headroom, and the final full run passed.
No screen code changed, so no new visual comparison was required.

Android Hermes export with EAS production environment values and
`EAS_BUILD_PROFILE=production` passed. `verify:android-bundle` passed against its
source map: **2,201 sources**, with the existing safe parser and real ads/IAP modules
present, and image-size/uuid/legacy query parser/QA substitutions absent. Export uses
the normal Expo Router entry. This is a JavaScript export check, not a native AAB build.
Use `eas env:exec production` before setting the production build profile in its child
command; setting the profile on the outer CLI makes app-config validation require ad
variables before EAS has loaded them.

`npx expo install --check` exits 1 with recommended SDK 57 patch updates (including
Expo 57.0.21 and RN 0.86.3). The mobile manifest and these installed native-package
versions are unchanged from the accepted baseline. This is existing version-update
maintenance, not a passed check; upgrading the native stack needs a separate candidate
and physical-device validation. The two dev-only Vitest findings also remain open.
No production AAB is created or submitted by this cleanup.

Subsequent artifact work completed the production **0.3.2 / code 28** AAB, including
cloud patch application and actual runtime correspondence checks. See the
[code 28 artifact record](../qa/PRODUCTION_BUILD_CODE28_2026-09-10.md).

Local evidence: `dist/dependency-cleanup-*.log` and audit JSON files. The final AAB
must still pass its own module and native-library checks. The PO subsequently accepted
advertising, Play-installed device verification and console review; see the updated
[production release review](../qa/PRODUCTION_RELEASE_REVIEW_2026-09-10.md).

## Sources and maintenance triggers

- [UUID advisory and patched versions](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
- [Decoder advisory and 0.5.0 fix](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).
- Image-size [ICNS advisory](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and
  [JXL/HEIF advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq).
- [Node CommonJS / ESM interoperability](https://nodejs.org/docs/latest-v22.x/api/modules.html#loading-ecmascript-modules-using-require).
- [Development-only Vitest advisory](https://github.com/advisories/GHSA-82fw-gwwq-j7x9).

Remove each override/patch only after its parent accepts a fixed compatible dependency
and the consumer/security regression tests plus Android module verification pass.
