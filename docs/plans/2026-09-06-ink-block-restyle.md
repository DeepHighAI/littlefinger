# 잉크 & 블록 리디자인 — 구현 계획 (PO 승인, 2026-09-06)

## 1. Context

PO가 `design-reference/redesign-2026-09-06/`(원래 이름 `resesigh-2026-0906`, 오타 정리)에 넣은 리디자인 핸드오프 —
스타일 가이드 1, 화면 보드 4(A02~A09 · A05 7상태 · A06 · 메뉴 시트 · MOD-01~05 · W01/W02/W03/W05/W06), `handoff/tokens.css`,
비교 보드 1 — 를 제품 전체에 적용한다. 시안은 **"잉크 & 블록"(시안 1a, 45° 하드 섀도)**: 현재 기준선 파스텔 × 잉크 & 스티커(2026-09-03,
P0~P8 적용, ADR 미기록) 위에 **토큰 이름은 그대로 두고 값만 바꾸고**, 컴포넌트 문법(필 헤더 · 메뉴 시트 · 상태 타일 · r14 블록 버튼 ·
풀폭 CTA · 그림자 없는 시트)을 바꾼다. 디자인만 바꾼다 — 상태 전이 · 핸들러 · 상태 라벨 · 법적 고지 · 광고 규칙 · `packages/shared` ·
`supabase`는 손대지 않는다.

레포에 넣지 않은 것: 뷰어 `.thumbnail`(WebP), `uploads/*.png` 3장(타사 UI 캡처 — 저작권상 커밋 부적절). 핸드오프 나머지는 읽기 전용 보관.

## 2. PO 결정 (2026-09-06 컨펌)

| # | 항목 | 결정 |
|---|---|---|
| E1 | 핸드오프 "PO 컨펌 필요" 5항목 — ① 홈 앱바 종·아바타 → 메뉴 시트 ② 상태 도트 → 40 상태 타일 ③ 틸트 폐지 ④ 4색 채도 상향 ⑤ 필 → r14 블록 버튼 + 홈 CTA 풀폭 | **5개 전부 승인** |
| E2 | SCR-A00 온보딩 · A01 로그인 ("기존 유지") | **레이아웃·마크업 유지, 토큰 변경(색·무게·틸트 0)은 자연 반영.** 토큰 분기 없음 |
| E3 | 무게 500/900 정적 폰트 | **Pretendard v1.3.9 공식 정적 파일 다운로드 허용** (`…/dist/public/static/alternative/Pretendard-{Medium,Black}.ttf`, Version 1.309 · 14716 글리프 — 기존 4종과 동일) |
| E4 | 범위·순서 | **앱+웹 전체.** 토큰·컴포넌트 → 갤러리 배치 컨펌 → RN 화면 → 수락 웹 → ADR 0020/DESIGN.md. 9세션, 70% 규칙 핸드오프 |
| E5 | `CANCELED` 톤(핸드오프 누락) | DECLINED/UNRESOLVED와 같은 **뮤트 + `remove`** |
| E6 | 미포함 화면 9종 | 9/3 D1 절차: 규격으로 확장 설계 → 갤러리 프리뷰 → 컨펌 → 구현 |

Routine 판단(통보 항목): 아이콘 서브셋 wght 400 → **500**(가이드 `@import`와 일치) · 눌림 3px를 리터럴로 두지 않으려 `--lf-press-offset: 3px`
토큰 추가(179 → **180**) · 포커스 링 `#2F6FB3`은 민트/핑크/스카이 위 3:1 미달(2.80/1.96/2.38) → 4색 위 포커스 표시는 잉크 3px 블록 섀도, outline은
캔버스/종이/뮤트 입력에만 · 보조 텍스트 `#6F6552`는 옐로 위 4.03이라 4색 위에는 잉크만 · Android 하드 섀도는 RN 0.86 New Architecture `boxShadow`.

## 3. 디자인 사양 (핸드오프 정본 요약)

### 3-1. 토큰 값 변경 (64개 + 신설 4개)
- **색**: 캔버스/크롬 `#F3ECDC`→`#FBF8F1` · 뮤트 `#EAE1CB`→`#EFE9DC` · 옐로 `#FFE59A`→`#FFD43B`(primary-container, brand-symbol-on-action) ·
  민트 `#B7E1D1`→`#5FD3A5`(success-container) · 핑크 `#FFB5C1`→`#FF6F91`(attention/penalty-container) · 스카이 `#A9D3FF`→`#6CB4FF`
  (record/reward-container, primary-pale) · primary-soft `#FFF6CC` · text-muted/faint → `#6F6552` · outline `#EFE9DC`, outline-strong `#6F6552`,
  outline-icon `#221C13` · frame-border `#221C13` · scrim `rgba(34,28,19,.42)`.
- **그림자**: card/fab `5px 5px 0 #221C13` · **신설 sm `3px 3px 0 #221C13`**(선택 탭·outlined·kakao·피커·포커스) · sheet `none`. 눌림 = translate(3,3) + 그림자 5→2(sm 3→0), 120ms, 색 불변.
- **모서리**: xs 8(상태 칩) · sm 10(탭·입력·타일·사각 버튼) · md/lg/xl 14(카드·CTA·보상/벌칙) · 2xl 12(아이콘 타일) · hero 20(시트) · pill 999(헤더·아바타·마스코트 원).
- **테두리**: chip/dashed/pending 2 · card/outline/sheet 2.5. **틸트 4종 0deg**(토큰·클래스 유지).
- **타이포**: 무게 500/600/800/900 · wordmark 40/46 · display 36 · headline 30/36 · title 24/30 · card-title 22/28 · sheet-title 20 · **신설 appbar 16** ·
  자간 tight -0.03em, wordmark -0.04em.
- **크기**: icon-button 36(사각 r10, hitSlop/::after로 48) · cta/fab 56 · tab 34 · chip-meta 28 · textarea 84 · card-padding 16 · trust-ring-stroke 12 ·
  avatar-xl 56 · thumb 84 · progress 10 · fade 130 · mascot-sm 28, -lg 46 · eyes-blob 68 · **신설 status-tile 40** · **신설 press-offset 3**.

### 3-2. 컴포넌트 문법
1. 앱바 = 흰 필(52h, margin 8 16 0, 2.5 잉크, 5px 그림자). 홈: 옐로 원 34(마스코트 28) + 워드마크 22/900/-0.04em + "메뉴 ☰"(미읽음 핑크 점 9).
   하위: 사각 뒤로 36 r10 + 제목 16/800 중앙 + 우측 액션. 종(알림)·아바타(마이)는 **메뉴 시트** 타일 4개(알림 배지 · 마이 · 지난 약속 · 슬롯 n/m)로 이동, 라우팅 동일.
2. 버튼 r14: filled 56h 잉크 + 2.5 테두리 + 5px 그림자 + 우측 옐로 사각 40 r10 아이콘 · outlined 50h 종이 + 3px · kakao 54h `#FEE500` r14 + 3px ·
   google 앱은 1px 회색 유지, 웹 W01만 잉크 2.5 + 3px · tonal 36h 옐로 · text 밑줄 · disabled opacity .3 그림자 없음. 홈 "약속 만들기" = 좌우 16 풀폭 56h.
3. 칩: 상태 28h r8 톤 배경 · 필터 탭 34h r10(선택 옐로 + 3px, 비선택 종이 + 잉크 700) · 선택 칩 36h r10. 필 모양 칩 없음.
4. 카드 r14 · 2.5 · 5px. 리스트 행 padding 14 16 + **상태 타일 40 r10**(DRAFT edit/옐로 · PENDING hourglass_empty/종이 점선 · ACTIVE bolt/민트, 무기한 all_inclusive/스카이 ·
   CHECKING notification_important/핑크 · AMEND_PENDING sync_alt/스카이 · COMPLETED check/민트 · BROKEN close/핑크 · DISPUTED balance/뮤트 ·
   DECLINED/UNRESOLVED/CANCELED remove/뮤트) + 제목 15/800 + 메타 12/600 + D-Day 칩 28h r8. flat 카드 = 그림자 없음.
5. 히어로(임박): 옐로 면 r14, 회전·블롭·눈 제거, 상단 -14px 핑크 배지("D-1 · 내일까지"), 잉크 사각 화살표 46 r12, margin-top 10.
6. 시트 r20 상단 · 2.5 · 그림자 없음 · 핸들 40×5 잉크 불투명 · 제목 20/800 + 닫기 36 · 세그먼트 = 단일 2px 박스 r10 세로 2px 분할.
7. 스탬프: 틸트·pop-in rotate 없음, r14 + 5px, 모서리 파스텔 블롭(테두리 없음, overflow hidden), 손 루프·스파크 유지. COMPLETED = 카드 전체 민트.
8. 입력 48h r10 2px 그림자 없음 · 피커 3px · 포커스 3px(+웹 outline) · 스위치 52×32 r999 노브 항상 잉크, ON 옐로.
9. D-Day 상세 56 r14 옐로 사각. 알림 미읽음 = 옐로 카드 + 5px + 잉크 도트, 읽음 = 종이 flat. 지킴율 링 88/12 민트 + 잉크 이중 링. 빈 상태 = 원 170 + 민트 원 56.
10. 수락 웹 W01·W02·W03·W05·W06 동일 문법, 브라우저바 유지, 광고 없음, 주 CTA 1개, W02 거절 = 밑줄 텍스트 버튼.

### 3-3. 불변
상태 라벨(`PROMISE_STATUS_LABEL`) · `LEGAL_DISCLAIMER` 5곳 · 에러/§5 검증/알림 문구 · 광고 비활성 시 무렌더(점선 플레이스홀더는 갤러리 전용) · DISPUTED 양측 종이 톤·동일 크기·순서 ·
48dp · 상태 = 타일/칩 + 텍스트 · 카카오/Google 공식 색 · 마스코트 E-1 · C-1 루프 2600ms · reduced motion 정지 · 라우팅 · testID · a11y 역할/라벨 · i18n 키.

### 3-4. 대비 (계산값)
잉크/옐로 11.85 · 잉크/민트 9.13 · 잉크/핑크 6.38 · 잉크/스카이 7.73 · 잉크/뮤트 13.96 · 보조/캔버스 5.41 · 보조/종이 5.63 · 보조/뮤트 4.74(9/3의 4.41 편차 해소) ·
보조/옐로 **4.03 실패** · 포커스링/캔버스 4.89 · /종이 5.09 · /뮤트 4.29 · /옐로 3.64 · /민트 2.80 · /핑크 1.96 · /스카이 2.38 · onPrimary/잉크 16.57.

## 4. 현재 코드 사실 (2026-09-06 탐색)
- 토큰 176개(`apps/mobile/src/theme/tokens.test.ts` 개수 고정) → 180. `tokens.ts` 손 유지(생성기 없음): `elevation` 객체, `tilt` deg 문자열, `weight` 문자열, `letterSpacing` em 숫자(환산은 `LfText`만), `NOT_PORTED_TOKENS` 6.
- `apps/web/src/styles/tokens.css` = 값 동일 + 3가지 문서화된 차이(헤더 · `@import` 없음 · 폰트 경로). `components.css` 바이트 동일 테스트. `screens/web.css` 오늘 동일(정규식만). **`base.css`는 드리프트(테스트 없음).**
- 하드코딩 틸트 `apps/mobile/src/app/promise/[promise_id].tsx:153,165` `'-0.8deg'`. `components.test.tsx` 리터럴 2.2/20/22/'-1.2deg'/9999/44/도트.
- `LfStatusDot` 소비자 = `PromiseListRow`뿐. `LfAvatar` md = `size.iconButton`(44)에 결합 → 36이 되면 분리 필요. `notifications.tsx:82` 미읽음 행이 스카이(`recordContainer`) — 가이드는 옐로.
- RN 0.86.2 · Expo 57 · Reanimated 4.5 → New Architecture → `boxShadow` 스타일 사용 가능(현재 미사용).
- 갤러리 `design-reference/screens/app/` 33 + `web/` 8 = 41면. 9/3 파스텔 리스타일 ADR 없음(0019 = 런처 아이콘). `DESIGN.md`는 ADR 0012 기준.

## 5. 단계

### 5-0. 실행 원칙
커밋 = 검증 가능한 최소 단위(`cd /c/DEV/littlefinger && npm run typecheck && npx vitest run && (cd apps/mobile && npx jest)`; 웹 커밋 `npm run build:web`; CLAUDE.md 커밋
`npm run sync:agents && npm run check:agents`). 세 토큰 타깃 같은 커밋. reference ↔ web CSS 3개(`components.css`·`base.css`·`screens/web.css`) 바이트 동일.
프리뷰(갤러리 + Chrome MCP) → PO 컨펌 → 구현. 테스트는 옮기되 느슨하게 하지 않는다. 동결: `packages/shared/**` · `supabase/**` · `apps/mobile/src/lib/**` ·
`screens/*-state.ts` 리듀서 · 라우트 파일(예외: `home.tsx` 앱바 배선, 톤 표). **P3~P7 웹 배포 금지.** 보고는 한국어, 출력 인용.

### P0 — 번들 · 계획 · 메모리 (S1) ✔
`mv` 오타 정리, `.thumbnail`·`uploads/` 삭제, 이 파일, STATUS 상단 절(AdMob 후속 이관), 메모리 `po-ink-block-restyle-decisions`.

### P1 — 폰트 · 아이콘 (S1) ✔
`Pretendard-Medium/Black.ttf` 추가(6 무게 등록, 400/700은 P2에서 내림), `tools/subset-icon-font.js` ICONS += all_inclusive · balance · bolt · menu · remove, wght 500 →
서브셋 재생성(52 아이콘: 웹 woff2 53.7 KB · 앱 TTF 10.5 KB). 이동한 테스트: `fonts.test.ts` 키·파일 표.

### P2 — 토큰 (S1)
`design-reference/styles/tokens.css` ← 핸드오프 값 + `--lf-press-offset: 3px`(180개, `@import` wght 500) · 웹 사본 · `tokens.ts`(`type.appbar`, `size.statusTile`, `size.pressOffset`,
`elevation` = `boxShadow` 배열 {offsetX, offsetY, blurRadius 0, spreadDistance 0, color 잉크}, `sheet` 빈 배열, `weight` 500/600/800/900, `tilt` '0deg') · 폰트 400/700 파일·등록 제거.
이동하는 테스트: `tokens.test.ts` 개수 180 · 웹 핀(`#FFD43B`/`#5FD3A5`) · weight · elevation(CSS 파싱 패리티) · 대비(`textSecondary/primaryContainer` 삭제, `textSecondary/surfaceMuted` 추가,
포커스 링은 캔버스/종이/뮤트/옐로만 + 4색은 `text` 3:1) · 핀 `recordContainer #6CB4FF`/`attentionContainer #FF6F91` · `typography.test.ts` 500/600/800/900 · `fonts.test.ts` 4종 ·
`components.test.tsx` 2.2→`border.card`. 검증: 세 러너 + `build:web` + 갤러리 색 스왑 육안. PO 통보: A02·A05·W02 갤러리 캡처("색만 바뀐 상태").

### P3 — 레퍼런스 CSS (S2)
`components.css` 재작성(§3-2 전부: `.lf-appbar` 필 + `__mascot/__wordmark/__menu`, `.lf-icon-button` 36 r10, `.lf-btn` r14/눌림/`:focus-visible`, `.lf-fab` 풀폭, `.lf-chip/.lf-tab` r8/r10 + `--quiet` 삭제,
`.lf-card` 14/2.5, **`.lf-status-tile` 신설**(`.lf-status-dot` 삭제), `.lf-dday-circle` 사각, `.lf-stamp` 회전 제거, `.lf-sheet` r20 + `.lf-segmented`, 입력 r10 + 피커/포커스 sm, 스위치 노브 잉크,
`.lf-outcome/.lf-list-item/.lf-settings` 14/2.5, `.lf-blob--circle`), `base.css`(캔버스 상태바, 프레임 잉크 8), `screens/*.css`(`.lf-hero-card` 옐로 + `__badge` + `__arrow`, 틸트·블롭 제거), `gallery.css`/`index.html` 마스트헤드.
웹 사본 3개 바이트 동일 + **`base.css`·`screens/web.css` 바이트 동일 단언 신설**. 4색 컨테이너 안 `text-secondary` 전수 제거(grep). 검증: 세 러너 + `build:web` + 갤러리 41면 콘솔 0·오버플로 0.

### P4 — 갤러리 (S2~S3, PO 컨펌 배치)
배치 1(확정 22 + 메뉴 시트 `scr-a02-home-menu.html` 신규 → 42면): A02·A02-empty·A03·A04·SCR-I·A05×7·A06·A07·A08·A09·MOD-01~05·W01/W02/W03/W05/W06. A00·A01 무수정(E2, 드리프트 캡처 첨부).
배치 2(확장 13, E6): A05 no-end·declined·finish-pending·unresolved, MOD-01 no-end, MOD-05 locked, blocked-users, profile-nickname, not-found, update-required, W04, W04-finish, W05-no-end.
체크포인트마다 Chrome MCP 갤러리 ↔ `.dc.html` 나란히 캡처. **컨펌 없이 P5 금지.**

### P5 — RN 컴포넌트 (S4)
`LfText`(`appbar`·`appbarBrand` 변형, 4색 톤 컨텍스트 안에서는 보조/메타도 잉크) → `LfIconButton` 36 r10 hitSlop 6 → `LfAppBar` 필 + `menu` prop → **`home-menu-sheet.tsx`** 신규(타일 4, 라벨 카탈로그 등록,
미읽음 수 = 알림함 첫 페이지 `read_at null` 카운트, 슬롯 = `loadSlotStatus`) → `LfButton` r14/56·50·44/trailing 사각/눌림(`pressOffset`) → `LfFab` 풀폭 → `LfCard`(r14, `tilt` 제거, `shadow` prop) →
`LfChip/LfChoice` r8·r10 → **`LfStatusTile`**(`status`, `noEnd`; `status-tone.ts`에 타일 표; `LfStatusDot` 삭제) → `LfHero` 배지 → `LfSheet` r20 + `LfSegmented` → `LfStamp` → 입력 3종 → `LfSwitch` →
`LfTrustRing` 12 + 이중 링 → `LfAvatar`(md = avatarSm 34) → `LfEmpty`/`LfBlob` 원 → `PromiseListRow`. 이동하는 테스트: `components.test.tsx` 리터럴 전부, `scr-a02-home.test.tsx` 종/아바타 → `button '메뉴'` → 시트 타일.
실기기 A02·A08: `boxShadow`가 `overflow:hidden`(스탬프) 안에서 잘리면 잉크 View 래퍼로 대체.

### P6 — RN 화면 (S5~S7)
A: `home.tsx`·`notifications.tsx`(미읽음 옐로)·`profile.tsx`·`history.tsx`(A00/A01 무수정). B: `promise/edit.tsx`·`invite.tsx`·`fulfillment/[promise_id].tsx`·축하/슬롯 시트.
C: `promise/[promise_id].tsx`(전 변형, `-0.8deg` 리터럴 제거, D-Day 사각)·변경/증인/혜택 시트·`i/[token]`·지원 화면 4. 문구 단언만 이동. 배치마다 실기기 360×800 1.0/1.5.

### P7 — 수락 웹 (S8)
`scr-w01~w06.tsx` 재마크업(W01 Google 웹 변형, W02 거절 텍스트 버튼), `index.html`·`app.html` theme-color `#FBF8F1`(`seo.test.ts`), `base.css` 재동기화 + `/* WEB ONLY */` 구획. 빌드 캡처 8경로 → 배포 보류 해제.

### P8 — 문서 (S9)
`docs/adr/0020-ink-and-block-restyle.md`(파스텔 기준선 + 잉크&블록, E1~E6, routine, 편차 목록, tests moved, Supersedes ADR 0012 시각 시스템), `DESIGN.md` 재작성, STATUS 상단, `design-reference/README.md`,
`CLAUDE.md` §3/§5-1/§5-3/§5-4 → `sync:agents`. `docs/plans/` 두 파일 삭제. 마지막 핸드오프. 브랜드 파생물(`app.json` 스플래시 `#F3ECDC`·알림 `#FFE59A`)은 범위 밖 — PO 확인 항목으로만 제시.

## 6. 리스크
| 리스크 | 대응 |
|---|---|
| Android 하드 섀도 | `boxShadow`(New Arch). 잘리면 잉크 View 래퍼. `FlatList` contentContainer 우/하 패딩 ≥ 5 |
| 배율 1.5 · 56h CTA | `minHeight`만, `numberOfLines` 금지, 배치마다 1.5 캡처 |
| 36dp 아이콘 버튼 | hitSlop 6 → 48, 인접 버튼 간격 ≥ 12 |
| 4색 위 보조 텍스트 | `LfText` 톤 컨텍스트 + CSS 규칙 + grep 감사 |
| 포커스 링 3:1 | 4색 위는 잉크 블록 섀도, ADR 편차 |
| 웹 CSS 드리프트 | `base.css`·`web.css` 바이트 동일 단언 |
| AdMob 후속 | STATUS 상단에 이관, 이 작업과 별개로 9/6 23:15 KST 이후 재확인 |

## 7. 세션 분할
| S1 | P0·P1·P2 | 세 러너, 토큰 180, 폰트/아이콘, 색 스왑 캡처 3장 |
|---|---|---|
| S2 | P3 · P4 배치 1 | CSS + 웹 사본 3개, 22면+메뉴 시트, 체크포인트 1 |
| S3 | P4 배치 2 | 13면, 체크포인트 2 — **컨펌 없이 S4 금지** |
| S4 | P5 | 컴포넌트·메뉴 시트·StatusTile, jest, 실기기 A02·A08 |
| S5~S7 | P6 A·B·C | 실기기 캡처 1.0/1.5 |
| S8 | P7 | 웹 8경로, 배포 보류 해제 |
| S9 | P8 | ADR 0020, DESIGN.md, STATUS, CLAUDE.md 동기화, 플랜 삭제 |

핸드오프 `docs/handoff/2026-09-06-ink-block-sN.md` 하나만 유지(Kakao findings 예외). 70% 규칙: 배치 도중이면 그 화면까지 마치고 "다음 화면 = X, 갤러리 HTML = Y, 옮겨야 할 테스트 = Z:줄".

## 8. 완료 판정
세 러너 + `check:agents` + `build:web` + `git diff --check` 통과(수치 인용) · 갤러리 42면 콘솔 0·오버플로 0·확정 22쌍 일치 · 실기기 전 화면 1.0/1.5 · 웹 8경로 빌드 캡처 ·
불변식(광고 무렌더 · 디스클레이머 diff 0 · DISPUTED 동일 톤 · 48dp · 상태 = 타일+텍스트) · 문서(ADR 0020 · DESIGN.md · STATUS · CLAUDE.md/AGENTS.md · 플랜 삭제 · 핸드오프 1개).
