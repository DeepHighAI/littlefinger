# ADR 0024: Private counterpart aliases and live promise suggestions

Date: 2026-09-09. Status: Accepted by the PO.

## Context

Public test 26 (0.3.1) exposed clipped login text, a fulfillment comment hidden by the keyboard,
an uncentred draft chip, and missing installed-version information. The PO also requested private
counterpart names, remotely editable reward/penalty suggestions, and simpler Korean UI language.

## Decisions

### Private counterpart aliases

An alias belongs to the viewing account and target account, not to an individual promise. It applies
across that pair's promises and the owner's devices. It never changes the target's profile nickname
or becomes visible to another viewer. Only a creator or partner with current access to their shared
record may manage the counterpart's alias. Witnesses and unrelated users cannot manage it.

The detail screen opens a sheet that distinguishes the original profile name from the private alias.
An empty field or reset removes the alias. The limit is 40 normalized Unicode code points, matching
profile nicknames. Keyboard input stays raw while editing; normalization happens when saving.

`user_aliases` has owner-only reads and server-only writes. JWT-authenticated Edge Functions call
transactional RPCs; the client cannot supply another owner. Withdrawal clears aliases in either
direction. Current list/detail/fulfillment names are resolved for the viewer on the server while
preserving the existing response keys, so code 26 parsers remain compatible. Approval/version
history, record fingerprints and stored profile names remain unchanged.

### Remotely editable suggestions

`app_configs.promise_featured_presets` contains three featured rewards and three featured penalties
for each of Korean and English. Featured suggestions precede the remaining local options.

- Rewards: `다음 메뉴 선택권`, `주말 계획 결정권`, `칭찬 세 가지`.
- Penalties: `설거지 1주일`, `소원권 1장 주기`, `노래방 한 곡`. The PO confirmed that `소환권` was a typo.
- Korean money suggestions use `10,000원`. English options omit Olive Young.

The editor reads the setting, refreshes after Realtime subscription/reconnection and database
changes, and refreshes on app foreground. Stale requests cannot overwrite newer results. Invalid
or unreachable configuration preserves the last valid choices or bundled defaults.

Changing suggestions never rewrites selected, manually typed or saved reward/penalty values.
Those strings belong to the promise once chosen. Existing records and drafts are not migrated.
The first app release containing this feature is required; later operator changes require no rebuild.

### Plain Korean UI

Ordinary UI and newly generated notifications use `지킴` for `이행`, `안 지킴` for `불이행`,
`확인 사진` for `증빙`, `답변 보내기` for answer submission, `약속 취소` for `파기`,
`변경 요청 취소` for withdrawing a change, `수락` for `승인`, and `확인 못함` for `미확정 종결`.
Sentences use grammatical forms such as `취소됨` and `수정한 답변 보내기` where appropriate.
These are display-copy changes: codes, transitions, calculations, legal copy and historical records
retain their contracts. Other audit recommendations remain unapproved.

### Responsive screens and version identification

Notice and suggestion components may grow to show their labels. The fulfillment screen connects
the shared keyboard-scroll behavior and remeasures after keyboard/layout changes. App-bar actions
centre their children. The My footer reads the installed native version and build number from
`expo-application`, not the potentially different JavaScript project version.

## Verification and release

Authorization, legacy response parsing, alias withdrawal/reset, realtime refresh ordering, retained
input values, locale parity and existing regression suites are required checks. Android screen QA
covers 360 dp and font scales 1.0/1.5. Emulator checks with mocked server responses do not constitute
Samsung S25+ or Samsung Keyboard approval; this limitation must remain explicit in release reports.

The rollout includes the two database migrations, new alias Edge Functions, updated notification
copy and acceptance web, and a new Android build. Do not change minimum supported version, auth
settings, ad switches or historical data as part of this rollout. The PO handles Google Play release.
