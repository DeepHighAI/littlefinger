# Marketing search continuation

## Goal of the session and current status

Resume September 16 in `C:\DEV\littlefinger`. PO priority: sitemap diagnosis → Google search
registration → first content. Research and strategy are saved in `docs/marketing/`; do not redo.
First guide is live: https://littlefinger-app.web.app/guides/promise-record
Latest release: `bbdcfe65bac233e5`, September 15 11:26 KST. Source remains uncommitted.
At 14:50 KST, homepage indexing confirmed; guide not indexed; sitemap list still fetch-error/0 pages.
At 12:07/12:10 KST, Google live tests successfully fetched sitemap/guide with crawling and indexing
allowed; guide canonical correct. One sitemap resubmission accepted. Guide indexing request rejected
for daily quota, explicitly asking to retry tomorrow. This is not a server fetch failure diagnosis.

## Files created/modified (paths)

- Guide: `apps/web/src/screens/promise-guide{,-labels,-static}.ts*`, `promise-guide.test.tsx`.
- Wiring: `apps/web/src/{App.tsx,routes.ts,labels-registry.ts}`, `screens/home{,-labels,-static}.ts*`,
  `apps/web/vite.config.ts`, `apps/web/src/seo.test.ts`, `firebase.json`.
- Discovery: `apps/web/public/{robots.txt,sitemap.xml}`, `tools/verify-marketing-http.mjs`.
- Prior batch: `packages/shared/src/app-links{,.test}.ts`, legal-label registry/static privacy fixes.
- Permanent records: `docs/marketing/` (especially `next-actions.md`, `verification.md`,
  `2026-09-15-console-execution.md`), `docs/DEVELOPMENT_STATUS.md`, environment notes.
- Preserve all other dirty files, especially legal content, setup guides and the App Links/location
  audit. Use `git status --short`; do not reset, blanket commit, or redeploy unrelated work.
- This replaces `2026-09-10-r8-measurement.md`; its completed results remain in
  `docs/qa/ANDROID_R8_COMPARISON_2026-09-10.md`, status and environment notes. Preserve the July 26
  Kakao reference exception in this directory. Do not resume the old Android measurement task.

## Decisions made + why

- Codex works SOLO per PO; no Claude delegation or revival of Orca run `run_9b30450d1404`.
- Google first; Bing/Naver optional later. OAuth branding review deferred.
- Existing web/spec positioning used for first guide; ko/en copy explicitly requires sign-in.
- No repeated sitemap submission or same-day quota retries. Submission, live fetch and indexing
  are different outcomes. Do not request indexing of sitemap XML.
- No background jobs or retry automation installed. Temporary preview/browser stopped; user Chrome
  remains open. Do not assume incognito authentication survives overnight.

## Verification state (what passed, what did not)

- Technical batch: 2,229 Vitest + 972 Jest passed. Content batch: 29 web files / 268 tests passed,
  five-project typecheck and build passed; guide tests rerun after final title adjustment: 2 passed.
- Production HTTP verifier: 25 checks passed. Static/React body comparison: 0 changed pixels at
  360×800; ko/en and enlarged text checked. Native pointer navigation tool was unreliable; DOM
  anchor activation passed. Exact methods/limitations in `docs/marketing/verification.md`.
- Current console outcomes above were read directly; quota request was NOT accepted.
- No new code changes in the last console passes. No need to repeat builds/tests for status docs.

## Blocked / PO-confirmation items

- Google quota: retry September 16 after reset; sitemap processing/error update is pending.
- If Chrome session is gone, operator must reopen signed-in GSC. Never request credentials.
- Naver earlier browser tool refused registration; do not bypass using another tool. Manual only
  if PO later prioritizes it. Bing login and Play metrics are deferred, not current blockers.

## The exact next step

Read `docs/marketing/next-actions.md` and the latest console checkpoint. Check actual date first.
Read computer-use skill and its versioned `orca skills get computer-use` guide as needed, then
list Chrome windows; prior incognito window ID `2165830` is only a hint, not a durable selector.
Inspect existing `https://littlefinger-app.web.app/` property in GSC. Recheck sitemap processing and
guide indexing. If guide remains unindexed and quota has reset, request guide indexing ONCE;
record actual confirmation or refusal. No sitemap resubmission unless new evidence justifies it.
Report in Korean, update permanent status/console/next-actions docs, and distinguish accepted
request from actual indexing. No immediate PO task if the signed-in console remains accessible.
