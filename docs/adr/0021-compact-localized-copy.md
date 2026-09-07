# 0021. Compact localized copy

Date: 2026-09-07
Status: Accepted

## Decision

The PO approved compact everyday Korean replacements after reviewing a 360-wide comparison of
the DISPUTED header at normal and 1.5 text scale. The long proposed explanation is not adopted:
the header uses `대화 후 확인해요`. Replacements must not increase rendered text width, and must
not rely on smaller fonts, tighter spacing, truncation or a changed layout.

The approved replacements are:

| Previous Korean copy | Approved Korean copy |
|---|---|
| 약속 2개 순항 중. | 약속 2개 지켜요! |
| 임박한 약속 | 곧 끝나요 |
| 승인 대기 | 수락 대기 |
| 변경 협의 중 | 변경 대기 |
| 이행 확인 중 | 결과 확인 중 |
| 의견 불일치 | 답이 달라요 |
| 재협의로만 종결돼요 | 대화 후 확인해요 |
| 이행 확인하기 | 지켰는지 확인 |
| 이행 확인 필요 | 결과 확인 필요 |
| 증빙 사진 | 확인 사진 |
| 응답 수정 | 답변 수정 |
| 응답 기한 | 답변 기한 |
| 응답 시각 | 답한 시간 |
| 승인 이력 | 수락 기록 |
| 버전 이력 보기 | 이전 내용 보기 |
| 요청 철회 | 요청 취소 |
| 변경·파기 요청 | 변경·취소 요청 |
| 초대 링크 무효화 | 초대 링크 막기 |
| 초대 링크 유효 시간 | 초대 남은 시간 |
| 리마인드 설정 | 알림 설정 |
| 리마인드 발송 시각 | 약속 알림 시간 |
| D-7 리마인드 | 7일 전 알림 |
| D-Day 리마인드 | 당일 알림 |
| 금전 | 돈 |

Apply the same reminder pattern to the existing D-3 and D-1 choices. Counts remain dynamic.
Each locale uses its own language: remove decorative English prefixes from Korean gallery/web
labels and translate the language-setting title and choices through the existing catalogs.

## Boundaries

This supersedes older display-copy constraints in ADR 0020 and the specification label tables,
not domain behavior. Keep status codes, transitions, colors, fonts, spacing, record integrity and
both immutable legal disclaimers. `불이행` and `미확정 종결` remain unchanged. No reward-count
claim is introduced: promise rewards are optional free text and are not automatic app payouts.

The frozen gallery receives only the approved copy changes, not a restyle. Archived handoff
bundles remain unchanged. Application tests use the new visible labels while preserving their
existing interaction and state-transition coverage.

## Verification

- Full test run: Vitest 114 files / 2,179 tests; jest-expo 84 suites / 928 tests passed.
- Final language-control follow-up: five web test files / 94 tests passed, including visible
  labels, accessible names, locale switching and persistence.
- Five-project typecheck, web build, agent-document sync and whitespace checks passed.
- All 24 approved replacements fit within their previous advance width in the four bundled
  Pretendard weights (96 comparisons). Legal disclaimer exports are unchanged.
- Browser comparison covered 27 updated gallery pages at 360-wide content and text scales
  1.0/1.5: 126 changed-text comparisons, no new wrapping or horizontal overflow. Existing
  multiline profile explanation remains multiline. The PO explicitly skipped Android device
  re-verification and authorized commit/push and deployment on 2026-09-07.

## Release

Implementation commit `db05f8e` was pushed to main and deployed to Firebase Hosting target
`hosting:web` on 2026-09-07. Live HTML returns HTTP 200; the JS and CSS assets match the local
build by SHA-256. Android changes are committed and await a separate native build.
