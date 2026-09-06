# Handoff: 리틀핑거 "잉크 & 블록" 리디자인 (시안 1a · 2026-09-06)

> **Claude Code에게:** 이 폴더는 디자인 참조 번들이다. `design/*.dc.html`은 의도한 룩과 동작을 보여 주는 HTML 프로토타입이며 그대로 복사해 쓰는 코드가 아니다. 목표는 **littlefinger 모노레포의 기존 환경**(React Native/Expo 앱 `apps/mobile`, Vite 웹 `apps/web`, 갤러리 `design-reference/`)에서 기존 패턴(`Lf*` 컴포넌트, 토큰 파일 3중 미러, `lf-*` 클래스)으로 **재현**하는 것이다. `CLAUDE_CODE_PROMPT.md`를 그대로 붙여 시작하면 된다.

## Overview

리틀핑거(둘이 새끼손가락 걸고 약속을 기록·이행 확인하는 앱)의 시각 리스타일. 기존 "파스텔 × 잉크 & 스티커"(2026-09-03, ADR 0012 기반)를 **네오브루탈리즘 "잉크 & 블록"**으로 바꾼다: 굵은 잉크 테두리, 45° 방향의 흐림 없는 잉크 블록 그림자, 채도를 올린 4색, 사각(r14) 컴포넌트, 종이 배경의 헤더 블록. **기능·라우팅·서버 계약·문구는 바꾸지 않는다.**

## Fidelity

**High-fidelity.** 색·치수·타이포·그림자·모서리는 확정값이다. 픽셀 단위로 재현한다. 단, 구현은 코드베이스 규칙(디자인 리터럴 금지 → 토큰만 사용)을 따른다.

## 적용 범위와 예외

| 구분 | 화면 | 처리 |
|---|---|---|
| 리디자인 | SCR-A02 홈(목록·빈 상태), A03 작성, A04 초대 전송, SCR-I 초대 검토, A05 7상태(ACTIVE·PENDING·CHECKING·AMEND_PENDING·COMPLETED·BROKEN·DISPUTED), A06 이행 확인, A07 알림, A08 마이, A09 지난 약속, MOD-01~05, **메뉴 시트(신규)**, SCR-W01·W02·W03·W05·W06 | `design/리디자인 0N…` 참조 |
| **기존 유지** | **SCR-A00 온보딩, SCR-A01 로그인** | 화면 레이아웃·블롭 SVG·문구 그대로. 단 토큰 값이 바뀌므로 색·그림자·버튼 모서리는 자동으로 새 값이 적용된다(카카오/Google 버튼 r14 · 잉크 그림자, 옐로 #FFD43B). 블롭 틸트(-2°)는 이 두 화면만 유지 → 컴포넌트 레벨에서 고정값 사용 |
| 미포함 (같은 규격으로 조합) | A05 no-end · declined · finish-pending · unresolved, blocked-users, profile-nickname, not-found, update-required, W04 | 스타일 가이드 §5 컴포넌트 규칙으로 구성 |

## 작업 순서 (권장)

1. **토큰 교체** — `tokens.css`(이 폴더)로 `design-reference/styles/tokens.css`를 교체. 같은 값을 `apps/mobile/src/theme/tokens.ts`(RN 객체: shadow → `{shadowColor:'#221C13', shadowOffset:{width:5,height:5}, shadowOpacity:1, shadowRadius:0, elevation:0}`)와 `apps/web/src/styles/tokens.css`(바이트 동일)에 반영. 신설 토큰 2개(`--lf-elevation-sm`, `--lf-type-appbar-size`) → `tokens.test.ts` 카운트 +2, 대비 검사 갱신.
2. **components.css / Lf\* 변경** — 아래 "컴포넌트 변경표"대로. 클래스·prop 이름은 유지하고 스타일만 바꾼다.
3. **화면별 구조 변경** — 홈 앱바(메뉴 시트), 리스트 행(상태 타일), 히어로 카드(배지), FAB(풀폭). 아래 "화면별 변경".
4. **갤러리 갱신** — `design-reference/screens/**`를 새 기준선으로 갱신, `npm run preview`로 PO 컨펌.
5. **기록** — ADR 신규(예: `0020-ink-and-block-restyle.md`), `DESIGN.md` §색/§형태 갱신.
6. **검증** — `npm run typecheck` · `npx vitest run` · `cd apps/mobile && npx jest`. 롤·라벨·testID 스냅샷은 바뀌면 안 된다.

## Design Tokens (확정값)

### 색
| 역할 | 값 | 토큰 |
|---|---|---|
| 잉크 (텍스트·테두리·그림자·primary) | `#221C13` | `--lf-color-text / -primary / -action-fill` |
| 종이 (surface) | `#FFFDF4` | `--lf-color-surface / -on-primary / -on-action` |
| 캔버스 (background · chrome) | `#FBF8F1` | `--lf-color-background / -surface-chrome` |
| 뮤트 (읽기 전용·비활성 면) | `#EFE9DC` | `--lf-color-surface-muted / -outline` |
| 보조 텍스트 (secondary·muted·faint 통합) | `#6F6552` | `--lf-color-text-secondary / -muted / -faint / -outline-strong` |
| 옐로 — 브랜드·선택·주 CTA·임박 | `#FFD43B` | `--lf-color-primary-container / -brand-symbol-on-action` |
| 민트 — 진행 중·완료·확정 | `#5FD3A5` | `--lf-color-success-container` |
| 핑크 — 마감·응답 필요·불이행·벌칙 | `#FF6F91` | `--lf-color-attention-container / -penalty-container` |
| 스카이 — 기록·보상·변경 협의·진행바 | `#6CB4FF` | `--lf-color-record-container / -reward-container / -primary-pale` |
| 오류 (실제 오류만) | `#C4433B` / 컨테이너 `#F8DFDB` | `--lf-color-error*` |
| 카카오 (변경 금지) | `#FEE500` / `#191919` | `--lf-color-kakao*` |
| Google (변경 금지) | `#FFFFFF` / `#1F1F1F` / 테두리 `#747775` | `--lf-color-google*` |
| 스크림 | `rgba(34,28,19,.42)` | `--lf-color-scrim` |
| 포커스 링 (웹) | `#2F6FB3` | `--lf-color-focus-ring` |

4색 위 글자는 항상 잉크(대비: 옐로 12.9 · 민트 8.9 · 핑크 6.4 · 스카이 7.9). 4색 위에 보조 텍스트 색 금지.

### 타이포 (Pretendard 단일 서체, `word-break: keep-all`)
| 역할 | size / line / weight / tracking | 토큰 |
|---|---|---|
| 헤더 워드마크 "리틀핑거" | 22 / 1 / 900 / -0.04em | `--lf-letter-spacing-wordmark` |
| A01 큰 워드마크 | 40 / 46 / 900 / -0.04em | `--lf-type-wordmark-size` |
| display | 36 / 42 / 900 / -0.03em | `--lf-type-display-size` |
| headline (홈 인사) | 30 / 36 / 800 / -0.03em | `--lf-type-headline-size` |
| title (상세 제목) | 24 / 30 / 800 / -0.02em | `--lf-type-title-size` |
| card-title (히어로) | 22 / 28 / 900 / -0.02em | `--lf-type-card-title-size` |
| sheet-title | 20 / 26 / 800 | `--lf-type-sheet-title-size` |
| stamp | 17 / 22 / 900 | `--lf-type-stamp-size` |
| appbar-title | 16 / — / 800 | `--lf-type-appbar-size` (신설) |
| CTA label | 16 / — / 800 | |
| body | 15 / 22 / 600 | `--lf-type-body-size` |
| row-title | 15 / 20 / 800 | |
| label · button | 14 / — / 800 | `--lf-type-label-size` |
| chip · tab | 13 / — / 800 (미선택 700) | `--lf-type-chip-size` |
| status chip | 12 / — / 800 | |
| meta | 12 / 18 / 600 · 보조색 | `--lf-type-meta-size` |
| caption · 디스클레이머 | 12.5 / 18 / 700 · 보조색 | `--lf-type-caption-size` |
| eyebrow | 11 / 16 / 800 / .12em · 보조색 | `--lf-type-eyebrow-size` |

무게 매핑: `--lf-weight-regular` 500 · `-medium` 600 · `-bold` 800 · `-heavy` 900.

### 테두리 · 모서리 · 그림자
- 테두리: **2px** 칩·입력·아이콘 타일·아바타·스위치(`--lf-border-chip`) / **2.5px** 카드·버튼·헤더·시트(`--lf-border-card / -outline / -sheet`) / **2px dashed #6F6552** 광고 자리·사진 추가·잠긴 자리 / **2px dashed #EFE9DC** 설정 행 구분
- 모서리: **8** 상태 칩·배지 (`--lf-radius-xs`) / **10** 탭·입력·아이콘 타일·사각 아이콘 버튼·세그먼트 (`-sm`) / **12** 히어로 화살표·썸네일 (`-2xl`) / **14** 카드·CTA·헤더·보상/벌칙 (`-md/-lg/-xl`) / **20** 시트 상단 (`-hero`) / **999** 아바타·마스코트 원·스위치·진행바 (`-pill`)
- 그림자 (blur 0, 잉크 100%): **`5px 5px 0 #221C13`** 카드·주 CTA·헤더·히어로·FAB (`--lf-elevation-card / -fab`) / **`3px 3px 0 #221C13`** 선택 탭·보조 버튼·카카오·Google·피커·썸네일 (`--lf-elevation-sm`, 신설) / **없음** flat 카드(설정 묶음·읽은 알림·읽기 전용)·시트·입력
- 틸트: `--lf-tilt-*` 전부 **0deg** (A00·A01 블롭만 컴포넌트 고정값 -2deg 유지)

### 간격 · 크기
- 간격 스택 4/6/8/10/12/14/16/20/24 변경 없음. 화면 가터 16.
- 앱바 52h, `margin: 8px 16px 0`. 사각 아이콘 버튼 36×36 r10 (터치 48은 기존 `::after` 규칙). 
- CTA 56h · 보조 버튼 50h · 카카오 54h · Google 52h · 탭 34h · 선택 칩 36h · 상태 칩 28h · 입력 48h · 스위치 52×32(노브 20) · 상태 타일 40 r10 · 히어로 화살표 46 r12 · D-day 배지 56 r14 · 아바타 sm 34 / md 44 / lg 48 / xl 56 · 썸네일 84 r12 · 진행바 10h · 시트 핸들 40×5.

## 컴포넌트 변경표 (`components.css` ↔ `apps/mobile/src/components/Lf*.tsx`)

| 컴포넌트 | 변경 |
|---|---|
| `.lf-appbar` / `LfAppBar` | 종이 배경 블록: `margin 8 16 0 · 52h · r14 · 2.5 잉크 · elevation-card`. 좌 사각 아이콘 버튼 36, 중앙 제목 16/800, 우 액션(아이콘 버튼 또는 상태 칩). `--brand`(홈): 마스코트 타일(36×34, 옐로, 불규칙 타원 `border-radius: 62% 38% 55% 45% / 42% 60% 40% 58%`, 2px 잉크) + 워드마크 22/900 + 우측 **"메뉴 ☰" 버튼**(미읽음 핑크 점 9px, 2px 잉크). 종·아바타 버튼 제거 → 메뉴 시트 |
| `.lf-icon-button` / `LfIconButton` | 44 원 → **36 사각 r10 2px 종이**. 히어로 화살표는 46 r12 종이 + 2px 잉크(잉크 채움 아님) |
| `.lf-btn` / `LfButton` | **검정 채움 버튼 폐지.** `--filled`(주 CTA) = 옐로 `#FFD43B` 56h r14 2.5 잉크 + elevation-card, 우측 `.lf-btn__trailing` = **종이** 사각 40 r10 2px 잉크 + 아이콘 22. `--outlined` = 종이 50h 2.5 잉크 + elevation-sm. `--kakao` r14 2.5 잉크 + elevation-card(로그인) / sm(그 외). `--google` r14 2.5 잉크 + elevation-sm(공식 색 유지). `--tonal` 옐로 36h r10. `--text` 밑줄 offset 3. disabled opacity .3 + 그림자 제거. 눌림: `translate(3px,3px)` + 그림자 2px(sm은 0), 120ms |
| `.lf-fab` / `LfFab` | 중앙 필 → **좌우 16 풀폭 56h r14 옐로** + 종이 사각 40(`add` 26). 하단 페이드 130h |
| `.lf-tab` / `LfChip kind=filter` | 34h r10 2px. 선택 = 옐로 800 + elevation-sm. 미선택 = 종이 700 **잉크**(보조색 폐지) |
| `.lf-chip` / `LfChip` | 상태 칩 28h r8 2px 12/800, 톤 배경(옐로 작성 중·민트 진행/완료·핑크 응답/불이행·스카이 변경·종이 승인 대기/의견 불일치·뮤트 D-day/카테고리). 필 모양 없음 |
| `.lf-choice` / `LfChoice` | 36h r10 2px, 선택 옐로 800 / 미선택 종이 700 |
| `.lf-card` / `LfCard` | r14 2.5 잉크 elevation-card, padding 16. `--flat` 그림자 없음. `--tilt*` no-op |
| `.lf-card--list` / `PromiseListRow` | padding 14 16, gap 12. `LfStatusDot`(10) → **`LfStatusTile`(40 r10 2px, 톤 배경 + Material 아이콘 20)**: ACTIVE 민트 `bolt` · 종료일 없음 스카이 `all_inclusive` · CHECKING 핑크 `notification_important` · COMPLETED 민트 `check` · BROKEN 핑크 `close` · AMEND 스카이 `sync_alt` · PENDING 종이 점선 `hourglass_empty` · DISPUTED 뮤트 `balance` · DRAFT 옐로 `edit`. 우측 D-day 칩 28h r8 종이. CHECKING 행은 아래에 풀폭 44h r10 "지켜졌나요? 답하기" 보조 버튼(elevation-sm) |
| `.lf-hero-card` / `LfHero` | 옐로 면 r14 2.5 elevation-card, 회전·블롭·눈 제거. `margin-top 10` + 좌상단 `top:-14 left:14` **핑크 배지**(26h r8 2px 12/800, eyebrow 텍스트 "D-1 · 내일까지"). 제목 22/28/900, 참여자 12/700. 우측 종이 사각 화살표 46 r12 |
| `.lf-stamp` / `LfStamp` | 회전 제거(pop-in에서 rotate 삭제), r14 elevation-card. 모서리 파스텔 블롭 = 테두리 없는 면(overflow hidden). 손 필 100×60 r999 종이 2px. `--completed` 민트 배경 |
| `.lf-sheet` / `LfSheet` | r 28→**20**, 2.5 잉크(하단 열림), 그림자 없음, 핸들 40×5 잉크. padding 10 18 24 |
| `.lf-segmented` | 단일 2px 잉크 박스 r10, 항목 38h, 선택 옐로 800, 세로 2px 잉크 구분선 |
| `.lf-input .lf-textarea .lf-picker` / `LfInput LfTextarea LfPicker` | r10 2px 종이. 피커 elevation-sm(기본). 포커스 elevation-sm(+웹 outline 2px #2F6FB3 offset 3) |
| `.lf-switch` / `LfSwitch` | 52×32 r999 2.5 잉크. ON 트랙 옐로, OFF 종이. **노브 항상 잉크** 20 |
| `.lf-outcome` | r14 2.5 elevation-card, `--reward` 스카이 / `--penalty` 핑크. eyebrow·값 잉크 |
| `.lf-list-item` (알림) | r14 2.5, 아이콘 40 r10 2px 톤 배경. 읽지 않음 = 옐로 + elevation-card + 잉크 점 10. 읽음 = 종이 flat |
| `.lf-settings` | flat 카드 r14, 행 48h, 구분 2px dashed #EFE9DC, 14/800 |
| `.lf-lang-pair` | 세그먼트로 통합(옐로 선택 / 종이) |
| `.lf-dday-circle` | 56 **r14 사각** 옐로 2px + elevation-sm, 15/900 |
| `.lf-ring` / `LfTrustRing` | 트랙 뮤트 12, 채움 민트, 안·밖 잉크 원 2.5, 값 18/900 |
| `.lf-progress` | 10h r999 2px 잉크, 채움 스카이 |
| `.lf-avatar` | 잉크 원 + 옐로 글자 유지. 대기 = 뮤트 + 2px dashed #6F6552 |
| `.lf-photo / .lf-proof` | 84 r12 2px 종이 + elevation-sm. 추가 타일 2px dashed #6F6552 |
| `.lf-ad-slot / .lf-home__ad` | 2px dashed #6F6552 r14. 비활성 시 렌더 없음(기존 규칙) |
| `.lf-browserbar` (웹) | OS 크롬 — 유지, 하단 2px 잉크 선만 |
| `.lf-blob__*` / `LfBlob` | 마스코트 = 기존 E-1 **흰 블롭 + 옐로 블롭 SVG**(A00 경로 그대로). 리디자인 화면은 옐로 `#FFD43B`, 회전 0, `filter: drop-shadow(5px 5px 0 #221C13)`. 손 루프(C-1) 구조 그대로: 컨테이너 115×44, 왼손 래퍼 `scaleX(-1)`, 애니메이션은 img에만, 스파크 옐로. 홈 빈 상태 손 scale .5, 로그인 손 scale .7 |
| 갤러리 `.lf-device` | 프레임 8px `#221C13` r22, `12px 12px 0 #221C13` |

## 화면별 변경 (구조가 바뀌는 곳만)

- **SCR-A02 홈**: 앱바 → 브랜드 블록 + 메뉴 버튼. 인사 30/36. 탭 3개(진행 중 N · 대기 N · 지난 약속). 히어로(옐로 + 배지). 행 = 상태 타일 + 제목 + 메타 + D-day 칩. 인피드 배너 자리(6건 이상, 5번째 뒤). FAB 풀폭. 빈 상태 = 블롭 마스코트(240×211) + 안내 + 옐로 하이라이트 "약속 만들기"(2px 잉크 r6).
- **메뉴 시트 (신규, PO 컨펌)**: 홈 "메뉴" → 바텀시트. 상단 아바타 48 + 닉네임 18/900 + 지킴율, 닫기 36. 2열 그리드 카드(r14 elevation-card): 알림(옐로, 미읽음 배지 핑크) · 마이 · 지난 약속 · 슬롯 N/5(스카이 타일). 라우팅은 기존 `/notifications` `/profile` `/history` 그대로.
- **SCR-A03**: 진행 표시 = 3개 바 8h(활성 잉크 / 비활성 종이 2px) + "1/3 · 내용" 12/800. 섹션 카드 2개(elevation-card). CTA 우측 정렬.
- **SCR-A04**: 스탬프(옐로 모서리 블롭), 카카오(sm) · 링크 복사(outlined), 카톡 미리보기 말풍선(2px 잉크 r 4/14), 카운트다운 카드(옐로 타일 `schedule` + 22/900 + 진행바). 재발송 disabled.
- **SCR-A05 공통**: 헤더 상태 칩 + 날짜 메타 + 제목 24/30 + (ACTIVE·SCR-I) D-day 사각 56. 하단 액션 = 보조(outlined) + 주(옐로 CTA). DISPUTED: 양측 카드 **동일 톤·동일 크기**(종이, 종이 칩), 판정 암시 금지, 증인 행 "(참고용 · 판정 아님)" 잉크 강조.
- **SCR-A06**: 선택 카드 = 선택 옐로 + elevation-card + 라디오(24 원, 잉크 점 12) / 미선택 종이. 아이콘 타일 민트 `check` / 핑크 `close`.
- **SCR-A08**: 아바타 56(옐로 3px 그림자), 지킴율 링 카드, 슬롯 행(스카이 타일 + 옐로 tonal "추가"), 리마인드 설정 flat 카드 + 스위치, 언어 세그먼트, 링크 묶음 flat 카드.
- **MOD-03**: 시트 중앙 정렬, 민트 마스코트 블롭, 24/900 제목, 지킴율 변화 옐로 칩(elevation-sm), 옐로 CTA, 밑줄 "공유하기".
- **MOD-04/05**: 안내 핑크 박스(2px r10), 오퍼 카드 옐로(MOD-04) / 스카이(MOD-05, 내부 CTA elevation-sm).
- **웹 W01~W06**: 브라우저바 유지. 본문 gutter 20. 만료 배지 핑크(elevation-sm). W05 약속 카드 옐로 배경. W06 마스코트 뮤트 배경.

## Interactions & Motion

- Press: `transform: translate(3px,3px)` + 그림자 5→2 (sm 3→0), 120ms `--lf-easing-standard`. 색 변화 없음. RN: `Pressable` style 함수로 `transform`·`shadowOffset` 교체.
- Hover(웹만): `translate(-1px,-1px)` + 그림자 6px.
- Focus: elevation-sm + (웹) outline 2px #2F6FB3 offset 3.
- Disabled: opacity .3, 그림자 제거, 문구가 이유를 말함.
- Sheet present: 240ms `--lf-easing-emphasized-decelerate` 아래→위, 스크림 .42 동시 페이드.
- Stamp pop: scale .92→1 + opacity 400ms, **rotate 없음**.
- 손 루프: `lf-pinky-l` 2600ms `cubic-bezier(.32,.72,0,1)` + `lf-pinky-spark` 유지. `prefers-reduced-motion`이면 정지.

## 불변 규칙 (DESIGN.md §8 · 그대로 유효)

48dp 터치 타깃 · 상태는 색+텍스트 병기 · DISPUTED 양측 동일 무게, 판정 암시 금지 · `LfDisclaimer` 문구 불변 · 광고 슬롯 비활성 시 공간 없음 · 카카오/Google 공식 색 · 빨강은 오류 전용 · 접근성 롤·라벨·testID·라벨 카탈로그 키 변경 없음.

## PO 컨펌 필요 항목 (구현 전 프리뷰 → 컨펌)

1. 홈 앱바 종·아바타 → 메뉴 시트 통합 (진입점만 이동)
2. 리스트 행 상태 도트 → 40px 상태 타일 (`LfStatusDot` → `LfStatusTile`)
3. 스티커 틸트 폐지 (A00·A01 제외)
4. 4색 채도 상향 (역할 동일)
5. 필 버튼 → r14 블록, 검정 채움 CTA → 옐로 CTA
6. 헤더 필 → r14 블록

## 검증 체크리스트

① `tokens.test.ts` 카운트 +2, 3타깃 바이트 동일성 재고정 ② 4색 위 잉크 대비 ≥ 4.5 ③ jest 롤·라벨·텍스트 스냅샷 변경 없음 ④ 아이콘 버튼 36 + `::after`로 48 터치 유지 ⑤ DISPUTED 양측 동일 톤 ⑥ `ads_enabled=false`에서 공간 0 ⑦ 디스클레이머 diff 없음 ⑧ `npm run typecheck` · `npx vitest run` · `npx jest` 그린.

## Assets

`design/assets/` — 레포 `design-reference/assets/`와 동일 파일: `PretendardVariable.woff2`, `mascot-face-e1.png`, `icon-face-e1.png`, `eyes-e1.png`, `hand-solid.png`, `hand-color.png`, `brand-symbol.png`. 아이콘은 Material Symbols Rounded(wght 500) 유지 → RN `LfIcon`.

## Files

- `README.md` — 이 문서
- `CLAUDE_CODE_PROMPT.md` — Claude Code에 붙일 시작 프롬프트
- `tokens.css` — 교체용 토큰 파일(값 확정)
- `design/리틀핑거 리디자인 · 인덱스.dc.html` — 시작점(모든 화면 링크)
- `design/리틀핑거 스타일 가이드.dc.html` — 시각 가이드(컴포넌트 견본 포함)
- `design/리디자인 01~04 ….dc.html` — 화면 프로토타입(canvas, 스크롤·줌)
- `design/support.js`, `design/assets/` — 프로토타입 열기용 런타임·에셋 (브라우저에서 `.dc.html` 직접 열기)
