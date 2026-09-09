# Public test 26 follow-up

Date: 2026-09-09. Reported release: 26 (0.3.1). All ten requested changes are implemented. Backend changes are deployed and final integrated checks passed. Firebase web deployment completed and the deployed JavaScript SHA-256 matches the local build. The new 0.3.2 AAB build has not started.

## Approved decisions and implemented scope

1. Login: `LfNotice` grows with its text and constrains its width. The login wrapper centres the complete message without clipping.
2. Promise checking: `useKeyboardScroll` connects the comment input to focus, layout, content-size, and keyboard-show measurements. Delayed keyboard appearance triggers another measurement. The earlier fix had covered creation and amendment inputs but missed this screen.
3. Plain Korean: `이행` becomes `지킴`. The PO also approved `불이행 → 안 지킴`, `증빙 → 확인 사진`, `응답 제출 → 답변 보내기`, `파기 → 약속 취소`, `변경 철회 → 변경 요청 취소`, `승인 → 수락`, and `미확정 종결 → 확인 못함`, including grammatical forms. App, web, accessibility, and newly generated notification copy are updated. State codes and legal text remain unchanged. Additional recommendations in [the copy audit](public-test-26-copy-audit.md) are not approved scope.
4. Featured rewards: `다음 메뉴 선택권`, `주말 계획 결정권`, and `칭찬 세 가지` appear first. Korean and English labels are read from `app_configs.promise_featured_presets`.
5. Featured penalties: `설거지 1주일`, `소원권 1장 주기`, and `노래방 한 곡` appear first. The PO confirmed retaining `소원권`. These use the same remote configuration. The PO approved updating already-open editors through Realtime; foreground and reconnect refreshes recover missed changes. Selected and saved promise contents remain unchanged.
6. English reward and penalty suggestions omit Olive Young.
7. Korean reward and penalty money suggestions display `10,000원`.
8. Creation header: the app bar wraps its actions to centre the draft chip vertically.
9. My screen: the footer reads the installed native application version and build number through `expo-application`, including EAS-assigned build numbers.
10. Private aliases: the PO approved one owner-specific alias per counterpart across the owner's promises and devices. The detail screen provides an editor and reset. Current participant names in home/history/detail/checking views use the owner's alias; profiles and original approval records do not change. Other users cannot read aliases. Withdrawal removes both directions, and response shapes remain compatible with code 26's exact-key parsers.

QA also found a fixed-size D-Day badge wrapping `D-16` at font scale 1.5. `LfDday` now uses its original 56 dp size as a minimum and expands for the complete one-line label.

## Backend deployment and live verification

Applied migrations:

- `20260909072828_private_counterpart_aliases.sql`
- `20260909072842_remote_promise_presets.sql`

Deployed Edge Functions: `counterpart-alias-get`, `counterpart-alias-update`, and `push-send`.

Live Realtime smoke verification, the rollback-based alias smoke test, and privilege checks passed. The configuration row is seeded and `app_configs` is in the Realtime publication. These checks do not constitute a completed new app release. See [the operator runbook](../setup/promise-suggestions.md) for changing suggestions after users install 0.3.2.

## Verification and limits

- Final integrated gate: `npm test` passed 121 Vitest files / 2,207 tests and 90 mobile Jest suites / 953 tests. Five-project typecheck, agent instruction sync, and the web build passed. The existing web bundle-size warning remains (>500 KB).

- Earlier baseline checks passed: Vitest 117 files / 2,195 tests; mobile Jest 88 suites / 938 tests; five-project typecheck; web build; agent instruction sync. These counts predate the final combined scope and are not the final release gate.
- Approved copy checks passed: targeted Vitest 6 files / 143 tests and mobile Jest 15 suites / 259 tests; five-project typecheck exited 0.
- Independent alias checks passed: 3 files / 9 tests. An initial expiry fixture used only `closed_at`; it was corrected to expire the actual `end_date + 1` retention anchor. Expired and hidden access is checked through read and update paths.
- Android emulator API 36.1, 360 dp: Korean login text/centering, comment visibility above the keyboard, and draft-chip alignment were inspected at the relevant font scales 1.0/1.5. English checking input at 1.5 remained visible. Production screen components used mock backend responses through a temporary QA entry point.
- Alias and D-Day QA used the same emulator. `D-16` and `D-1234` remained on one line at scales 1.0/1.5 without overlap. Captures: `dday-ko-360-1.png`, `dday-ko-360-1.5.png`, `choices-dday-360-1.png`, and `choices-dday-360-1.5.png` under `apps/mobile/dist/followup-qa/`.
- The My footer displayed the debug binary's actual `Version 0.3.0 · Build 1`, verifying native version sourcing rather than a release binary.
- No physical Android device was connected. Samsung S25+ and Samsung Keyboard verification remain outstanding. Emulator evidence must not be reported as Samsung-device approval. Real PostgreSQL simultaneous withdrawal/save scheduling was not exercised by the independent PGlite review.

Temporary QA configuration was restored and its Metro server stopped. Logs under `dist/public-test-26-followup-*` and captures under `apps/mobile/dist/followup-qa/` are verification evidence, not release artifacts.

Next: prepare the new native AAB release. Code 26 users need the new client for remote suggestions and the alias editor; backend deployment alone does not add controls to an old binary.
