# Public test 26 Korean product copy audit

Date: 2026-09-09. Baseline: public test 26 (0.3.1), with ongoing fixes in the working tree.

## Scope and decision status

The PO requested plain conversational Korean for users aged 10–30 and explicitly approved replacing `이행` with `지킴`. The PO subsequently approved all seven additional terminology changes listed below. Those changes are implemented in ordinary product copy; the separate additional-candidates section remains unapproved.

The audit searched all mobile and web static label catalogs, the two catalog registries, localized strings outside those registries, shared status/error/notification/validation strings, and current notification generation paths. It includes visible text and accessibility labels. Code identifiers, comments, user-authored promise contents, historical records, and legal documents are not ordinary UI copy replacement targets.

Plain language does not require replacing every Sino-Korean word. Familiar, precise product terms should remain consistent; no slang or generational stereotypes are introduced.

## Implemented: explicitly approved wording

| Previous | Current | Product sources |
| --- | --- | --- |
| 이행 확인 | 지킴 확인 | `apps/mobile/src/screens/scr-a05-labels.ts`, `scr-a06-labels.ts`, `scr-a07-labels.ts`; `apps/web/src/screens/home-labels.ts`, `scr-w04-labels.ts`; `packages/shared/src/notification.ts` |
| 이행 결과 | 지킴 결과 | `apps/mobile/src/screens/scr-a07-labels.ts` |

The first replacement also covers loading/error text, finish confirmation explanations, history headings, and newly generated notifications. `불이행` is handled separately as `안 지킴`; unrestricted substring replacement would produce the incorrect `불지킴`.

Initial-unit verification: Vitest 2 files / 54 tests passed; mobile Jest 3 suites / 80 tests passed; the five-project `npm run typecheck` exited 0. After the seven additional approved changes, targeted Vitest passed 6 files / 143 tests and mobile Jest passed 15 suites / 259 tests. Visual verification belongs to the combined screen QA pass and is not claimed by this text audit.

## Implemented after PO confirmation: seven terminology changes

Paths in the mobile and web columns are relative to `apps/mobile/src/screens/` and `apps/web/src/screens/`, respectively.

| Current | Proposed | Mobile sources | Web/shared sources | Meaning to preserve |
| --- | --- | --- | --- | --- |
| 불이행 | 안 지킴 | `scr-a08-labels.ts`, `scr-a09-labels.ts` | `packages/shared/src/promise.ts`, `notification.ts` | BROKEN only; do not include disputed or unanswered results |
| 미확정 종결 | 확인 못함 | `scr-a08-labels.ts` | `packages/shared/src/promise.ts` | Deadline passed without both answers; does not imply failure to keep the promise |
| 증빙 | 확인 사진 | `scr-a05-labels.ts`, `scr-a06-labels.ts` | `scr-w04-labels.ts`, `scr-w05-labels.ts` | Include counts, expired-photo text, reports, alt text, and accessible actions |
| 제출 / 응답 제출 | 답변 보내기 | `scr-a06-labels.ts` | `scr-w04-labels.ts` | Sending the user's answer, not deciding the joint result |
| 수정 제출 | 수정한 답변 보내기 | `scr-a06-labels.ts` | `scr-w04-labels.ts` | Existing answer revision limits remain unchanged |
| 파기 요청 / 파기됨 | 약속 취소 요청 / 취소됨 | `scr-a05-labels.ts` including MOD-01, `scr-a09-labels.ts` | `scr-w04-labels.ts`; shared status and notification catalogs | Mutual cancellation after activation; distinguish from dismissing a dialog, withdrawing a request, and deleting a pending promise |
| 변경 철회 | 변경 요청 취소 | `scr-a05-labels.ts` approval history | `packages/shared/src/notification.ts` | Cancel only the pending request; current promise continues |
| 승인 / 승인하기 / 네, 승인합니다 | 수락 / 수락하기 / 네, 수락할게요 | `invite-review-labels.ts`, `promise-edit-labels.ts`, `scr-a05-labels.ts`, `scr-a07-labels.ts` | `home-labels.ts`, `scr-w02-labels.ts`, `scr-w03-labels.ts`, `scr-w04-labels.ts`; shared notifications | The same mutual approval operation and immutable approval history |

These approved display changes do not change enum values, transition rules, keepRate calculations, validation limits, or legal consent language. Sentence-level edits are necessary; do not perform unrestricted substring replacement.

## Additional candidates found in the full scan

These are recommendations for a later PO copy decision, not implemented changes.

| Current example | Recommended example | Sources | Review note |
| --- | --- | --- | --- |
| 약속 검토 | 약속 확인 | mobile `invite-review-labels.ts` | Natural review heading |
| 응답 완료 / 미응답 / 응답 없음 | 답변 완료 / 답변 전 / 답변 없음 | mobile `scr-a06-labels.ts`; web `scr-w04-labels.ts` | Also align waiting text, answer counts, and `내 응답` |
| 님의 응답을 기다리는 중 | 님의 답변을 기다리는 중 | mobile `scr-a05-labels.ts`; web `scr-w04-labels.ts` | Preserve whom the screen is waiting for |
| 버전 이력 | 변경 기록 | mobile `scr-a05-labels.ts`; web `scr-w04-labels.ts` | Preserve version numbers and access to every original version |
| 요청 시각 / 승인 시각 / 확인 시각 | 요청한 시간 / 수락한 시간 / 확인한 시간 | mobile `scr-a05-labels.ts`; web `scr-w03-labels.ts`, `scr-w04-labels.ts`, `scr-w05-labels.ts` | Keep exact timestamps and KST |
| 적용 시각 / 종료 시각 | 적용된 시간 / 끝난 시간 | mobile `scr-a05-labels.ts` | Refers to version validity, not the promise's selected end date |
| 약속이 종결되면 | 약속이 끝나면 | mobile `scr-a09-labels.ts`, `slot-labels.ts` | Preserve the existing set of states that releases slots |
| 날짜 종결 | 날짜에 끝남 | mobile `scr-a05-labels.ts` | Check rendered width before applying |
| 판정 권한은 없어요 | 누가 옳은지 판단하지 않아요 | mobile `mod-02-labels.ts` | Witness role stays read/confirm only |
| 누가 옳은지 판정하지 않아요 | 누가 옳은지 판단하지 않아요 | web `scr-w05-labels.ts` | Same witness explanation as mobile |
| 앱은 판정하지 않습니다 | 앱은 누가 옳은지 판단하지 않아요 | web `home-labels.ts` | Preserve neutral recorder policy |
| 둘이 합의한 약속 | 둘이 함께 정한 약속 | web `scr-w01-labels.ts` | Introductory copy only |
| 상호 약속 관리 서비스 | 둘이 함께 약속을 기록하고 지키는 서비스 | web `home-labels.ts` | Explain the behavior directly |
| 새 버전으로 다시 합의해요 | 새 내용으로 다시 함께 정해요 | web `home-labels.ts` | Preserve new-version approval, not silent editing |
| 마무리 합의 뒤 보관이 시작돼요 | 둘 다 마무리에 동의하면 보관이 시작돼요 | mobile `scr-a05-labels.ts`; related `scr-a06-labels.ts`, `promise-entitlement-labels.ts` | Timing and mutual agreement must remain explicit |
| 초대 링크를 무효화할까요? | 이 초대 링크를 사용 못 하게 할까요? | mobile `invite-labels.ts`; related status in `scr-a05-labels.ts` | A longer but clearer candidate; pending promise remains, link stops working |
| 초대가 만료됐어요 | 초대 기간이 끝났어요 | mobile `invite-labels.ts`; shared notifications | Keep expiry distinct from used, revoked, or blocked links |
| 초대 링크가 만료되었습니다. 상대에게 새 링크를 요청해 주세요. | 초대 기간이 끝났어요. 상대에게 새 링크를 부탁해 주세요. | mobile `invite-review-labels.ts`; web `scr-w06-labels.ts`; shared `errors.ts` has related copy | Error code and privacy behavior stay unchanged |
| 보관 만료 | 보관 종료 | mobile `scr-a05-labels.ts`, `promise-entitlement-labels.ts` | Confirm preferred concise date label; do not imply all participants lose access together |
| 보관 기간이 만료된 증빙입니다 | 보관 기간이 지난 사진이에요 | mobile `scr-a06-labels.ts`; web `scr-w04-labels.ts`, `scr-w05-labels.ts` | A05 already uses `지난` but still says `증빙` |
| 신고 접수로 가려진 이미지입니다 | 신고되어 가려진 사진이에요 | mobile `scr-a05-labels.ts`, `scr-a06-labels.ts`; web `scr-w04-labels.ts`, `scr-w05-labels.ts` | Does not imply a confirmed moderation violation |
| 재확인하기 | 다시 확인하기 | mobile `scr-a05-labels.ts` | Same reopening action |
| 지금 Google 로그인이 원활하지 않습니다 | 지금 Google로 로그인할 수 없어요 | mobile `login-labels.ts`; same Kakao error | Keep retry guidance and provider-specific label |
| 로그인을 취소했습니다 | 로그인을 취소했어요 | mobile `login-labels.ts` | Tone consistency only |
| 법적 문서를 열 수 없습니다 | 약관이나 개인정보 처리방침을 열 수 없어요 | mobile `login-labels.ts` | Error UI only; never rewrite the documents themselves |
| 처리 중 문제가 발생했습니다 | 처리 중 문제가 생겼어요 | web `lib/api-failure.ts`; server `functions/_shared/errors.ts` | Shared EC-C02 wording must remain aligned if approved |
| 본인은 상대방이 될 수 없어요 | 나 자신을 약속 상대방으로 초대할 수 없어요 | `packages/shared/src/errors.ts` | Preserve self-invitation restriction |
| 이 약속에 대한 권한이 없어요 | 이 약속에서 할 수 없는 작업이에요 | `packages/shared/src/errors.ts` | Review each E_FORBIDDEN context first; do not reveal a hidden promise exists |

## Reviewed and retained

- Established product terms: `약속`, `작성자`, `상대방`, `증인`, `지킬 사람`, `보상`, `벌칙`, `약속 지킴율`, `기록 지문`, `초대 링크`, `슬롯`, `혜택`, `보상형 광고`, `보관`, `영구 보관`, and `마무리` remain unchanged.
- `집계 중` is the approved below-minimum-sample label. `확인 못함` must not replace it: these are different conditions.
- Familiar controls such as `저장`, `삭제`, `취소`, `선택`, `필수`, `차단 해제`, `설정`, `공유`, `동의`, and `다시 시도` need no automatic replacement.
- Legal text in `apps/web/src/legal/legal-content.ts`, `packages/shared/src/legal.ts`, the immutable `LEGAL_DISCLAIMER` in `packages/shared/src/promise.ts`, and legally material deletion explanations in `account-deletion-labels.ts` are excluded from this UI rewrite. Their use of `이행`, `파기`, `당사자`, or `열람권` is not an overlooked UI defect.
- Shared validation messages remain specification-aligned. Public account-gate labels in `packages/shared/src/profile-name.ts`, date/day labels in `datetime.ts`, field suffixes in mobile `components/LfField.tsx`, the native push channel label, and web `components/LocaleSwitch.tsx` contain no additional priority terminology candidates.
- Reward/penalty suggestions in mobile `lib/promise-draft.ts` and the new shared preset contract were inspected separately. Their ordering, remote configuration, localized cultural references, and currency formatting belong to items 4–7 of the PO's request, not this terminology decision. Never rewrite already saved promise contents when preset labels change.
- English copy was inspected for catalog coverage but is not automatically retranslated by a Korean terminology change. Existing typed locale parity must be maintained.

## Coverage inventory

All `*-labels.ts` under both apps were included, not only files containing keyword matches.

Mobile catalogs: `app-version`, `blocked-users`, `invite`, `invite-review`, `login`, `mobile-chrome`, `mod-02`, `mod-03-completion-celebration`, `not-found`, `onboarding`, `profile-nickname`, `promise-edit`, `promise-entitlement`, `scr-a02`, `scr-a05` (including MOD-01), `scr-a06`, `scr-a07` (including notification semantics), `scr-a08`, `scr-a09`, `slot`, and `update-required`.

Web catalogs: `account-deletion`, `home`, `response-complete`, `scr-w01`, `scr-w02`, `scr-w03`, `scr-w04`, `scr-w05`, and `scr-w06`, plus legal content and localized shared/component helpers listed above.

Shared sources: `promise.ts`, `notification.ts`, `errors.ts`, `validation.ts`, `profile-name.ts`, `datetime.ts`, `legal.ts`, and the preset contract. Registry files were checked to locate catalogs; source search also covered catalogs newly added during this work.

## Notification generation and release boundaries

Old migrations contain Korean `이행` strings, but these are superseded function definitions. Current `lf_promises_close_due_checks` from `20260814000001_notification_outbox.sql` and `lf_dispatch_due_reminders` from `20260818000003_invitation_draft_batches.sql` enqueue events. The worker uses `packages/shared/src/notification.ts` to generate titles. The approved copy change therefore needs the relevant function deployment to affect new server notifications, not a SQL text-replacement migration.

Previously stored notifications and approval records are append-only. Do not overwrite them to make historical copy match new wording. This audit does not claim any production deployment or live-device verification.

The seven approved changes include their grammatical forms in catalog sentences and accessibility labels. Matching test expectations are updated. No additional candidates below that approved set have been implemented. Tests and typecheck must pass, and changed labels must be verified on 360 dp at font scales 1.0 and 1.5 on both surfaces. Additional candidates still require a separate PO decision.
