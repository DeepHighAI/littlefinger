# Batch 1 verification — 2026-09-15

Initial status (superseded by the release below): verified locally, not deployed or committed. Research completed before
implementation. Claude implemented the agreed batch; Codex reviewed the diff and independently
checked HTTP behavior and the home CTA. Original adjacent Claude terminal retained after settlement.

## Actual results

These are the initial batch checks. The former full-suite failure was resolved in the release
follow-up below; production is now deployed and verified.

| Check | Observed result |
|---|---|
| Claude: `npx vitest run apps/web/src/seo.test.ts apps/web/src/screens/home-static.test.ts packages/shared/src/app-links.test.ts` | `3 files, 27 tests passed` |
| Claude: `npm run typecheck` | Exit 0, all five projects |
| Claude: `npm run build:web` | Exit 0; robots, sitemap and campaign link emitted |
| Claude: full root `npx vitest run` | 2,228 passed, 1 failed; see existing failure below |
| Codex: `node tools/verify-marketing-http.mjs http://127.0.0.1:5107` | `Marketing HTTP verification: 23 checks passed (http://127.0.0.1:5107)` |
| Codex: `node --check tools/verify-marketing-http.mjs` | Exit 0 |
| Codex: browser, 360 × 800 | No horizontal overflow; actual CTA has campaign=home; no browser errors |
| Codex: controlled before/after CTA screenshot comparison | `Visual href-only regression: 0 changed pixels, 360x800` |
| Codex: `git diff --check` | Exit 0 |
| Codex: `npm run check:agents` | `AGENTS.md 는 CLAUDE.md 와 동기화되어 있다.` |

The screenshot baseline is the same built page with only `utm_campaign=home` removed from the
DOM href, then restored. It isolates this batch's only UI-file change; it is not a comparison
of all pre-existing legal/home edits against a clean commit. Both captures hide the scrollbar
identically and use a fixed viewport. An initial full-page diff had inconsistent capture widths
(345 vs 360), so it was discarded and replaced by the equal-size comparison. Codex visually
inspected the final capture. Temporary screenshots are not durable release evidence.

The HTTP verifier checks robots text, root-only sitemap XML, static home and request canonical,
public legal paths without inherited canonical/noindex, 14 synthetic private-route forms with
noindex, and the original Google verification file. No real invite tokens or account data were used.

## Windows emulator limitation and reproducible workaround

Unmodified firebase-tools 15.1.0 / superstatic 10.0.0 served files but applied no custom response
headers on this machine, including existing cache headers. `glob-slash` uses Windows `path`
normalization, converting URL slashes to backslashes before minimatch. Direct probes confirmed
that no rules matched. WSL Ubuntu was present but had no Linux Node runtime.

For local verification only, a temporary CommonJS preload set the installed `glob-slash`
export's `normalize` function to `value => path.posix.normalize(path.posix.join('/', value))`.
The emulator was then started with `node --require <temporary-preload.cjs> <firebase-tools>/lib/bin/firebase.js
emulators:start --only hosting --project demo-littlefinger-marketing --config <temporary-config.json>`.
The temporary config copied the project's web hosting rules, used a relative path to the built
dist directory, and listened on 127.0.0.1:5107. No dependencies, production rules or project config
were altered to accommodate the emulator bug. With this URL-only normalization, all 23 HTTP
checks passed. This is a patched verification environment, not proof of deployed behavior.

After a reviewed deployment, run the same verifier against `https://littlefinger-app.web.app/`
and save its output with the deployment ID. Sitemap submission follows that check.

## Initial existing failure (resolved in release follow-up)

Claude's full root Vitest run found the already-present
`apps/web/src/i18n-parity.test.ts` failure: untracked `screens/legal-document-labels.ts#VERSION_LINE`
is not registered in the web label registry. It belongs to the pre-existing legal changes and
was not changed in this marketing batch. The whole tree is therefore **not test-clean**.
The mobile Jest suite was not run because this batch has no mobile implementation changes.

Before a combined release, resolve the legal catalog registration and verify that work, review
the pre-existing privacy/home edits together with this batch, and repeat the relevant release checks.
Production headers, search-console ownership, sitemap receipts, indexation, prompt observations,
and acquisition/activation baselines remain unverified. No public guide or community post was
published. Positioning remains pending the PO's answer; all three guide pages are drafts only.

## Release follow-up — 2026-09-15 10:27 KST

The PO requested the next step. Codex replaced the function-root `VERSION_LINE` export with a
normal `LEGAL_DOCUMENT_LABEL` catalog containing `versionLine` in each locale, registered it,
and updated the static and React consumers. Wording is byte-identical. Existing tests now cover
the catalog and exact static/React privacy markup parity without weakening any assertion.

Final results:

- Focused Vitest: **5 files / 30 tests passed**.
- `npm test`: **123 Vitest files / 2,229 tests passed; 95 Jest suites / 972 tests passed**, exit 0.
- `npm run typecheck`: exit 0, all five projects.
- `npm run build:web`: exit 0, 141 modules; existing 500 kB chunk-size advisory remains.
- Privacy catalog refactor visual diff: **0 pixels changed (360 × 800)**, actual prior build vs
  rebuilt page. Korean and English title/version and home operator text checked; no horizontal
  overflow or browser errors. Existing privacy text was not rewritten.
- `git diff --check` and `npm run check:agents`: exit 0.
- `firebase deploy --only hosting:web --project littlefinger-app-philwoo --non-interactive`:
  **Deploy complete!**, 20 files; legacy site, database and native app not deployed.
- `node tools/verify-marketing-http.mjs https://littlefinger-app.web.app/`:
  **Marketing HTTP verification: 23 checks passed (https://littlefinger-app.web.app)**.

Live channel receipt, fetched using `firebase hosting:channel:list`:

- Release: `projects/littlefinger-app-philwoo/sites/littlefinger-app/channels/live/releases/1789435640651000`
- Version: `projects/littlefinger-app-philwoo/sites/littlefinger-app/versions/0febf2c75e226e5c`
- Release time: `2026-09-15T01:27:20.651Z` (10:27:20 KST).

The reviewed release includes the pre-existing static privacy page and home operator attribution.
SHA-256 comparisons of live `index.html`, `privacy.html` and `assets/main-C0VwpfxI.js` match the
local build exactly. Live home/privacy browser checks also passed without errors or overflow.
Legal policy content, OAuth branding settings and product positioning were not changed. Code is
still uncommitted. Search-console results are recorded separately in the console execution report;
deployment and HTTP verification alone do not prove indexing or acquisition lift.

Console follow-up: Task `task_be159f76045f` completed with GSC submission/baseline and explicit
Naver/Bing/Play access blockers. Diagnostic Task `task_f0a10bc9e445` stopped at Claude's session
limit and was fenced with its terminal retained. No successful Google live-fetch result was
obtained. See [console execution](2026-09-15-console-execution.md) for the unresolved fetch error
and the inspection UI's indexing-request confirmation.

## Solo first-content release — 2026-09-15 11:26 KST

Published `https://littlefinger-app.web.app/guides/promise-record` after the PO requested
sitemap diagnosis, search registration and first publication. Console access remained blocked,
so the verified publication proceeded independently; registration is not marked complete.

- Typed ko/en catalog; static Korean body; distinct title/description/Open Graph metadata;
  canonical HTTP Link on the public path and HTML alias; home and sitemap links.
- Copy explicitly requires Kakao/Google sign-in, explains Android creation/web participation
  and neutral recording, and uses a hypothetical example. Play campaign: `web/guide/promise_record`.
- `npx vitest run apps/web`: **29 files / 268 tests passed**.
- Final title-only adjustment: guide tests **2 passed**, production build repeated successfully.
- `npm run typecheck`: exit 0 across five projects.
- `npm run build:web`: exit 0, 145 modules; existing chunk-size advisory remains.
- `npm run check:agents` and `git diff --check`: exit 0.
- Browser: ko/en, 360×800 and English text enlarged 1.5×, no horizontal overflow or app errors.
- Static/React body screenshot comparison: **0 changed pixels**. Exact built static root markup
  substituted into the isolated loaded page; fonts settled, locale control and scrollbar hidden
  identically. This is a markup/render comparison, not a JavaScript-disabled navigation test.
- Home anchor DOM activation navigated to the guide. Browser-tool pointer clicks reported success
  without navigation; native pointer navigation is not claimed verified. No product fix was made
  based solely on this tool behavior. Static/React markup parity is also covered by a unit test.
- Firebase deploy: **Deploy complete!**, 21 files.
- Production verifier: **Marketing HTTP verification: 25 checks passed (https://littlefinger-app.web.app)**.
- Version: `bbdcfe65bac233e5`; release: `1789439192266000`;
  release time: `2026-09-15T02:26:32.266Z`.

No full mobile/shared suite rerun for this web content change; the earlier full-suite results above
belong to the technical release. No indexing, search traffic or acquisition increase is claimed.
