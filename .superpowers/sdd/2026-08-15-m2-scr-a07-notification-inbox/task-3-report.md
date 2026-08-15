# SCR-A07 Task 3 Report — Mobile Notification Inbox

## Status

Completed with the required local verification. SCR-A07 is an authenticated Expo Router screen with newest-first KST sections, readable unread emphasis, server-backed read actions, and only the existing push-navigation route allowlist.

## What changed

- Added `apps/mobile/src/app/notifications.tsx`, the protected SCR-A07 route. It loads the INAPP list, renders loading, empty, retryable error, and grouped notification states, and deliberately contains no ad slot.
- Added the SCR-A07 labels and KST presentation helpers. Relative labels are `방금`/minutes/hours for today, then the required KST yesterday and earlier-date formats.
- Tapping an unread item immediately removes its unread text/dot emphasis and navigates once while the single-read mutation runs. A rejected mutation intentionally stays optimistic until an explicit refresh reloads server state.
- Added `notification-inbox-native.ts`, the native binding for Task 2's list/read/read-all wrappers and caller-held UUID keys.
- Reused and exported the existing push deeplink mapping for inbox navigation. Missing promise IDs cannot construct a parameterized route.
- Added `/notifications` under the authenticated Stack and a 48dp `알림` entry action to SCR-A02. No SCR-A05 unread badge was added.

## TDD evidence

### RED

Command: `npm run test --workspace=@littlefinger/mobile -- --runInBand apps/mobile/src/screens/scr-a07-notifications.test.tsx`

Before the screen existed, all 8 SCR-A07 cases failed against the intentional test-only missing-screen fallback: loading, empty, retryable error, newest-first KST sections/relative time, unread emphasis, single read/navigation/duplicate suppression, read-all suppression, and rejected-read refresh reconciliation.

Command: `npm run test --workspace=@littlefinger/mobile -- --runInBand apps/mobile/src/screens/scr-a02-home.test.tsx`

Before the SCR-A02 entry was added, 1 of 19 tests failed because the `알림` action did not exist. The failure specifically showed no accessible button with that name.

### GREEN

Command: `npm run test --workspace=@littlefinger/mobile -- --runInBand apps/mobile/src/screens/scr-a07-notifications.test.tsx apps/mobile/src/screens/scr-a02-home.test.tsx apps/mobile/src/screens/root-layout.test.tsx apps/mobile/src/lib/push-navigation.test.ts`

Result: 4 suites / 51 tests passed.

The final small refactor captures one render-time `now` instant so a KST section boundary cannot disagree with an item's relative timestamp. The same focused suite and `npm run typecheck` were rerun afterwards and passed.

## Visual comparison

Compared the screen structure against the read-only `design-reference/screens/app/scr-a07-notifications.html` and its `app-support.css` rules at the 360x800 token scale:

- Preserved the app-bar shape (back, title, read-all), 16dp app gutter, section/list spacing, 48dp minimum targets, 38dp icon containers, card padding/radius, accent pinky for NT-01, urgent icon treatment, unread tint + bold title + visible `읽지 않음` text + dot, and no ads.
- Deliberate additions: loading/empty/retryable-error states required by Task 3, and a 48dp refresh icon so an optimistic failed read can be explicitly reconciled from the server.
- Existing C-2 MaterialIcons substitution remains; this task did not add a new icon-library difference.
- Pixel screenshot comparison could not run: no `adb`, Android SDK environment variable, or emulator is available in this workspace. The structural comparison above is therefore not a device visual-diff substitute.

## Final verification

- Focused mobile Jest: 4 suites / 51 tests passed.
- `npm test`: Vitest 56 files / 1,416 tests passed; mobile Jest 27 suites / 298 tests passed.
- `npm run typecheck`: passed for shared, mobile, web, Edge Functions, and Supabase tests.
- `npm run check:agents`: passed (`AGENTS.md 는 CLAUDE.md 와 동기화되어 있다.`).
- `git diff --check`: passed before staging; the cached check is run immediately before commit.

## Files changed

- `apps/mobile/src/app/{_layout,home,notifications}.tsx`
- `apps/mobile/src/lib/{notification-inbox-native,push-navigation}.ts`
- `apps/mobile/src/screens/{root-layout,scr-a02-home,scr-a07-notifications}.test.tsx`
- `apps/mobile/src/screens/{scr-a02-labels,scr-a07-labels,scr-a07-notification-presentation}.ts`

## Self-review and concerns

- The shared notification-inbox contract is used unchanged; no database, Edge Function, remote, Supabase config, or origin push operation was performed.
- `.claude/settings.local.json` remains untracked and untouched.
- Expo's local generated typed-route file was stale after the new file was added; the local Expo start attempt timed out before it regenerated. The source Stack route is protected and covered by the route test, while the SCR-A02 push uses a narrow `as never` only to avoid incorrectly rejecting the valid new route against that ignored stale generated file. A normal Expo dev start should regenerate it.

## Fix Round 1

### Review fixes

- Replaced the permanent handled-item set with unread-read-mutation in-flight suppression. A first tap still navigates immediately, a duplicate tap while the mutation is pending is suppressed, and the item navigates again after the request settles without sending a second read mutation.
- Added one explicit notification inbox reducer. Read operations move through `PENDING`, `SUCCEEDED`, and `FAILED`; a completion revision lets a refresh preserve mutations completed after that refresh began while allowing a later authoritative refresh to reconcile a rejected request. A single-read success merges the returned `read_at`; read-all success keeps its known target IDs locally read without inventing a server timestamp. Read-all is a no-op with no unread targets and cannot resend after success.
- Added an exhaustive current `NotificationEvent` mapping to confirmation, approval response, amend, reminder, fulfillment, and result semantics. The approved icon/tone mapping is centralized in presentation constants and all semantic labels are in the SCR-A07 label module.
- Constrained the body/meta row to one ellipsized line with a zero-min-width container. Each item's accessibility label now includes title, body, relative time, and read status. The visible unread status uses `LfText`; Material icons use the existing 19dp `type.heading` token.
- Regenerated Expo typed routes with the normal Expo start type-generation path and removed the home route's `as never` cast. In this workspace's monorepo install layout, the first normal start exposed `MODULE_NOT_FOUND: expo-router/_ctx-shared`; rerunning the same offline start with the app `node_modules` as `NODE_PATH` generated `/notifications`, after which full typecheck passed.

### TDD evidence

#### RED

Command: `npm run test --workspace=@littlefinger/mobile -- --runInBand apps/mobile/src/screens/scr-a07-notifications.test.tsx`

After removing two ambiguous test queries, the valid RED result was 1 failed suite, 20 failed tests, and 6 passed tests. The failures covered the missing token/a11y/one-line presentation, post-settlement navigation, stale-refresh race reconciliation, read-all no-op/success behavior, and all 15 event-to-icon mappings.

#### GREEN

The same focused command first passed 1 suite / 26 tests. A final reducer-contract RED then failed exactly 1 of 27 tests because read-all success had not yet merged a local view-item flag into `items`; after adding `locallyRead` without fabricating `read_at`, the focused suite passed 27/27. Regression coverage includes post-settlement retap, concurrent refresh plus successful read, read-all success followed by tap with no extra mutation, no-unread read-all, null-`promise_id` parameterized deeplink rejection, all current event mappings, and one-line/accessibility presentation.

### Typed route and dependency evidence

- `npx expo export --platform android`: passed, 1,593 modules bundled and `dist` exported.
- Offline Expo start type generation with app-local module resolution: `.expo/types/router.d.ts` contains `/notifications`; the temporary server was terminated after generation.
- `as never` was removed from the SCR-A02 notification action; subsequent `npm run typecheck` passed all five TypeScript projects.
- `npx expo install --check`: `Dependencies are up to date` (the sandboxed attempt could not reach the registry, so the check was rerun with network permission).

### Final verification

- Focused SCR-A07 Jest: 1 suite / 27 tests passed.
- `npm test`: Vitest 56 files / 1,416 tests passed; mobile Jest 27 suites / 317 tests passed.
- `npm run typecheck`: passed for shared, mobile, web, Edge Functions, and Supabase tests.
- `npm run check:agents`: passed (`AGENTS.md 는 CLAUDE.md 와 동기화되어 있다.`).
- `git diff --check`: passed.

### Visual and scope notes

- The original 360x800 structure and token geometry remain unchanged except for the requested one-line clipping and explicit unread status. Current events absent from the static reference deliberately use semantic MaterialIcons: `person-off`, `sync-alt`, `alarm`, `notification-important`, and neutral `fact-check`; C-2's rounded-corner icon difference remains.
- Device screenshot comparison remains unavailable because this workspace has no Android SDK, `adb`, or emulator. Structural comparison used the frozen SCR-A07 HTML and `app-support.css`; this is not a pixel-diff substitute.
- No shared DB/Edge contract, remote, Supabase config, dependency manifest, or origin was changed. `.claude/settings.local.json` remains untracked and untouched.

## Fix Round 2

### Race fence

- The screen now issues a monotonically increasing load ID from the one `refresh()` path used by initial load, manual refresh, and retry.
- The reducer owns `latestLoadId`. Only success or failure matching that ID can update items, read-operation reconciliation, or error state; an older response returns the current state unchanged.
- The existing completion-revision logic remains independent of the load fence, so a read completed during the latest request is still preserved against that request's stale payload, while an explicit later refresh after a rejected read still adopts authoritative server unread state.

### TDD evidence

#### RED

Command: `npm run test --workspace=@littlefinger/mobile -- --runInBand apps/mobile/src/screens/scr-a07-notifications.test.tsx`

Result before production changes: 1 failed suite, 2 failed tests, 27 passed. After load A started, a read completed, and load B returned first, late A success replaced B's authoritative read item with stale unread data. In the symmetric case, late A rejection displayed the load-error UI over B's successful current items.

#### GREEN

The same focused command passed 1 suite / 29 tests after adding the screen-issued load ID and reducer fence. Both late success and late failure are ignored, and all prior optimistic-read, revision, read-all, navigation, and rejected-read reconciliation cases remain green.

### Final verification

- Focused SCR-A07 Jest: 1 suite / 29 tests passed.
- `npm test`: Vitest 56 files / 1,416 tests passed; mobile Jest 27 suites / 319 tests passed.
- `npm run typecheck`: passed for shared, mobile, web, Edge Functions, and Supabase tests.
- `npm run check:agents`: passed (`AGENTS.md 는 CLAUDE.md 와 동기화되어 있다.`).
- `git diff --check`: passed.
- Scope is limited to the SCR-A07 screen, reducer, regression tests, and this report. `.claude/settings.local.json` remains untracked and untouched; no remote operation was performed.
