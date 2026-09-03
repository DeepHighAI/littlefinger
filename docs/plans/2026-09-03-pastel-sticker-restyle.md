# 파스텔 × 잉크 & 스티커 리디자인 — 구현 계획 (PO 승인, 2026-09-03)

## 1. Context

Claude Design에서 확정된 리디자인 **「리틀핑거 파스텔 스티커」** (Turn 4, 파스텔 × 잉크 & 스티커, E-1 마스코트, C-1 손 애니메이션)를
제품 전체에 적용한다. 소스는 `design-reference/redesign-2026-09-03/ui-ux/project/리틀핑거 파스텔 스티커.dc.html`
(15 아트보드) + `assets/*.png`. `current/`는 현재 baseline의 바이트 동일 복사본(brand-symbol.png 메타데이터만 다름) —
디자이너가 손댄 것 없음. `리틀핑거 옐로 리디자인.dc.html`은 Turn 1~4 이력이며 확정 표시 없음(E-1 아이콘·C-1 손 포즈만 공통).

현재 baseline은 잉크 & 스티커 (ADR 0012, 2026-08-27) + 핑키 루프 브랜드 마크(ADR 0013·0016·0017·0018) + Pretendard(ADR 0014).
이번 작업은 **네 번째 PO 승인 리스타일**이며 ADR 0012와 같은 파이프라인으로 간다:
`design-reference/styles/tokens.css` → `apps/mobile/src/theme/tokens.ts` → `apps/web/src/styles/tokens.css`,
`components.css` → `Lf*` 컴포넌트 props, 화면은 SCR-ID 1:1. 토큰 이름/개수 고정 테스트(`tokens.test.ts`, 117개)와
브랜드 마크 해시 고정 테스트는 **의도적으로 옮기며, 절대 느슨하게 하지 않는다**.

앱은 open testing 0.2.0 / versionCode 21로 라이브(첫 구글 심사 대기). 리디자인은 별도 빌드(0.3.0 / code 22)로 나가며 출시 시점은 PO 결정.

## 2. PO 결정 (2026-09-03, 본 세션에서 컨펌)

| # | 항목 | 결정 |
|---|---|---|
| D1 | 확정안에 없는 앱 화면(A05 변형 6종+무기한/마무리, MOD-01·02·05, /i/[token], 차단 목록, 닉네임, 강제 업데이트, 404) | **확정안 규칙으로 확장 설계** → 갤러리 프리뷰 → 컨펌 → 구현 |
| D2 | 수락 웹 SCR-W01~W06 (8페이지) | **이번에 함께 확장 재설계** (토큰·components.css 동기화 + 페이지 레이아웃도 확정안 문법으로) |
| D3 | 하단 탭바 | **제거.** 앱바 아바타→마이, 종→알림함, 플로팅 필 CTA→약속 만들기. '지난 약속' 진입점은 홈 필터 칩 옆 세 번째 칩 + 마이 목록 행 (ADR 0011 D3 진입점 유지) |
| D4 | SCR-A03 | **3단계 위저드 유지** + 각 단계에 확정안 카드/섹션 라벨/파스텔 칩/보상·벌칙 스티커/필 CTA 적용 |
| D5 | 문구 | **확정안 문구 채택** (ko 그대로, en은 작성 후 PO 검토). 상태 라벨·법적 고지·에러·§5 검증 문구는 불변. 승인 대기 단계의 상대 이름은 '상대방'으로 일반화 |
| D6 | A04 초대 버튼 | **카카오 노란 버튼(#FEE500) + 현재 라벨 '초대 링크 공유하기'**, 동작은 OS 공유 시트 유지. '링크 복사하기'는 아웃라인 필. 카톡 미리보기 말풍선·만료 카운트다운 진행바 포함 |
| D7 | 상태→파스텔 | 승인 대기=종이 외곽선 · 진행 중=민트 · 변경 협의=스카이 · 이행 확인 중=핑크 · 완료=민트 · 불이행=핑크 · 의견 불일치=종이 중립 · 미확정·거절·파기=크림 뮤트. 글자는 항상 잉크, 빨강은 에러 전용 |
| D8 | 브랜드 마크 | **전부 E-1로 교체** (런처·적응형·스플래시·알림 아이콘·인앱·웹 파비콘/OG·스토어 512). Play 콘솔 아이콘/스크린샷 교체는 PO 작업 가이드로 |

내가 내린 routine 판단(계획 승인으로 갈음, 프리뷰에서 재확인):
- 아이콘: Material Symbols Rounded(wght 400·FILL 0·opsz 24)로 통일. 웹의 기존 서브셋 생성기 `tools/subset-icon-font.js`를 확장해 RN용 TTF도 생성 → C-2 종결.
- 마이(A08)는 확정안에 뒤로가기가 없지만 하단 탭바 제거로 진입이 스택 push가 되므로 앱바에 뒤로 원형 버튼을 둔다.
- A07 광고 자리 점선 플레이스홀더는 그리지 않는다 — "비활성 시 공간 예약 없음" 불변식(ADR 0009) 유지.
- 디스클레이머는 확정안의 11.5/400이 아니라 ADR 0012 가독성 보정(12.5/18·700·text-secondary)을 유지 — 프리뷰에서 PO가 보고 판단.
- 확정안의 iOS 크롬(노치·홈 인디케이터·9:41)은 프리뷰 장식. Android는 시스템 상태바를 크림 배경/어두운 아이콘으로.
- `design-reference/`는 **36화면 전부 새 시스템으로 이전**해 새 frozen baseline이 된다 (핸드오프 번들은 `design-reference/redesign-2026-09-03/`로 이름 정리 후 읽기 전용 보관). 갤러리가 곧 PO 프리뷰 수단.

## 3. 확정안에서 추출한 디자인 사양 (토큰 정본)

### 3-1. 팔레트 (변경분만; 나머지는 현행 유지)
| 역할 | 현행 | 신규 | 비고 |
|---|---|---|---|
| 브랜드/선택 컨테이너 (`primary-container`, `success-container`→분리) | 버터 #F6E7A3 | **옐로 #FFE59A** | 선택 칩·CTA 아이콘 원·읽지 않음 카드·토글 ON |
| 진행·완료 (`success-container`, ACTIVE/COMPLETED 칩·도트, 지킴율 링) | 버터/잉크 | **민트 #B7E1D1** | 신규 |
| 마감·벌칙 (`attention-container`, `penalty-container`, CHECKING/BROKEN) | 살구 #F8DDBE | **핑크 #FFB5C1** | 알림 배지 도트도 핑크 |
| 기록·보상 (`record-container`, `reward-container`, AMEND_PENDING, 무기한, 진행바) | 라벤더 #E7DFF6 | **스카이 #A9D3FF** | |
| 파스텔 위 글자 (`record`, `attention`, `reward-label`, `penalty-label`, `on-*-container`) | 라벤더 잉크 #6B58A8 / 살구 잉크 #B05F2C 등 | **잉크 #221C13** | 색 글자 폐지 |
| `primary-pale` (#CDBCEC 라벤더) | | 스카이 #A9D3FF | |
| `brand-symbol-on-action` | 버터 | 옐로 #FFE59A | |
| `focus-ring` (#6B58A8) | | 파생값 필요: 크림/종이 위 3:1 이상이면서 잉크와 달라야 함 (예: 스카이 잉크 #2F6FB3) | 확정안에 없음 — PO 통보 |
| 유지 | 잉크 #221C13 · 크림 #F3ECDC · 종이 #FFFDF4 · 뮤트 #EAE1CB · 외곽선 #E0D5BA/#B8AB92/#8A7E66 · 보조 글자 #6F6552 · 뮤트 글자 #706652 · 에러 #C4433B/#F8DFDB · 카카오 #FEE500/#191919 · 스크림 rgba(20,15,8,.42) | | |

### 3-2. 타이포 (Pretendard 400/600/700/800 유지, px = dp)
| 신규/변경 토큰 | 값 | 사용처 |
|---|---|---|
| `type-wordmark` / `line-wordmark` | 38 / 44, 800, ls .04em | A01 워드마크 |
| `type-display` (30→) | **34 / 42**, 800, ls -.02em | A00 헤드라인 |
| `type-headline` (신규) | 26 / 34, 800, ls -.02em | A02 인사 |
| `type-title` (22→) | **24 / 32**, 800, ls -.02em | 화면 h2, A06 질문, MOD-03 |
| `type-sheet-title` | 22, 800 | MOD-04 제목, 카운트다운(ls .02em) |
| `type-card-title` | 19 / 26, 800 | 임박 카드 |
| `type-stamp` | 17, 800 | 스탬프 헤드라인, 선택 카드 |
| `type-body` 15 · `type-label` 14 · `type-caption` 12.5 · `type-micro` 11.5 | 유지 | |
| `type-chip` 13 · `type-meta` 12 · `type-eyebrow` 11 (700, ls .12em / 헤더 .16em) | 신규 | 섹션 라벨 `TITLE · 제목` |
| `letter-spacing-tight -0.02em` · `-wide .12em` · `-wordmark .04em` | 신규 | |

### 3-3. 형태
- 둥글기: 카드 **22**, 리스트/아웃컴 카드 **20**, 입력 **12**, 썸네일/점선 **16**, 시트 상단 **28**, 아이콘 타일 24, 필 999.
- 잉크 테두리: 칩·입력·아이콘 버튼·아바타 **2**, 카드 **2.2**, 아웃라인 버튼 **2.4**, 시트·카카오·블롭 스트로크 **2.5**, 대기 아바타 3 dashed, 구분선 2 dashed `outline`.
- 그림자: 카드 `3 4 0 rgba(34,28,19,.14)`, CTA `3 4 0 …,.22`, 시트 `0 -6 24 …,.12` — **현행과 동일**.
- 기울기: 스탬프/선택됨/슬롯 제안/신뢰 카드 **-0.8°**, 임박 카드·필 배지 **-1.2°**, 히어로 블롭 **-2°**, 히스토리 빈 블롭 **3°**.
- 크기: 앱바 **52**(56→), 아이콘 버튼 44, 필 CTA **52**(cta 54→) + 안쪽 아이콘 원 40, 카카오 54, 하단 쌍 버튼 50, 필터 칩 32, 선택 칩 36, 메타 칩 30, 상태 칩 28, 입력 48, 텍스트영역 min 80, 토글 52×32(노브 20), 지킴율 링 88(stroke 10, 이중 잉크 링 r41/r31), D-Day 원 56, 아바타 34/44/48/52, 썸네일 76/84, 상태 도트 10(+2 잉크 링), 진행바 8, 하단 그라디언트 140/110.

### 3-4. 컴포넌트 문법 (확정안 → 컴포넌트 매핑)
- **필 CTA**: 잉크 배경 + 종이 글자 15/700 + 오른쪽 옐로 원 40(2px 잉크 테두리; 빈 상태/축하 시트에서는 테두리 없음) + 아이콘/마스코트, CTA 그림자. 화면 하단 우측 정렬 또는 플로팅 중앙(홈).
- **아웃라인 버튼**: 투명 배경 2.4 잉크, 50 높이, 필. 비활성 opacity .3.
- **원형 아이콘 버튼** 44: 종이 배경 2px 잉크 (앱바 뒤로/닫기/공유/더보기/종). 아바타 원 44: 잉크 배경 옐로 글자.
- **스티커 카드**: 종이 배경, 2.2 잉크, r22, 카드 그림자, 패딩 18. `tone` 옐로/민트/핑크/스카이/뮤트 변형(글자 잉크). `flat`(그림자 없음). `tilt`.
- **칩**: 필, 2px 잉크. 선택=옐로 700, 미선택=크림/종이 600 보조색. 상태 칩 28: 파스텔 배경(D7). 메타 칩 30: 크림 배경.
- **섹션 라벨(eyebrow)**: `TITLE · 제목` 11/700/.12em 뮤트 글자. 필수 표기는 잉크색 `필수`.
- **입력**: 2px 잉크, r12, 48, 15/600; 텍스트영역 min 80 14/22; 피커는 leading 아이콘 + trailing expand_more.
- **스탬프 카드**(A04·A05 ACTIVE·COMPLETED): -0.8° 종이 카드, 모서리 파스텔 블롭(민트/옐로), 100×60 종이 필 안 C-1 애니메이션(28), 헤드라인 17/800, 시각, 참여자 칩(민트 도트+이름+시각), `RECORD · XXXX-XXXX-XX` 지문.
- **승인 대기 스탬프**: 아바타 — 검은 손 30×28(mirror) — 점선 20 — 손 25% — 점선 아바타.
- **보상/벌칙 스티커** 2열: 스카이 `REWARD · 보상` / 핑크 `PENALTY · 벌칙`, r20, 14/700.
- **알림 행**: 읽지 않음=옐로 카드+잉크 도트, 읽음=종이 flat. 유형별 아이콘 원 40: 성립=종이+눈, 이행확인=핑크 notification_important, 리마인드=크림 alarm, 변경=스카이 sync_alt, 증인=민트 draw.
- **토글**: 52×32 필 2.2 잉크, ON 옐로+잉크 노브 우, OFF 종이+#8A7E66 노브 좌.
- **지킴율 링**: 88, 트랙 #EAE1CB 10, 진행 민트 10 round, 잉크 이중 링, 중앙 18/800.
- **시트**: 종이, 2.5 잉크(하단 없음), r28 상단, 핸들 40×5 잉크 30%, 제목 22/800 + 닫기 원 44, 시트 그림자, 스크림.
- **빈 상태**: -2° 블롭(흰+파스텔 보조 블롭, 2.5 스트로크) + 애니메이션 눈, 안내 14/22 보조, 옐로 하이라이트 스팬.
- **히어로 블롭**(A00 330×290, A01 220×200): 흰 블롭 + 옐로 블롭, 눈 110×52 오버레이.
- **하단 페이드**: 크림 그라디언트 위 플로팅 CTA.

### 3-5. 마스코트 E-1 · 애니메이션 C-1
- 자산(전부 RGBA): `mascot-face-e1.png` 512² (투명 위 손-눈 한 쌍, 앱바 30/32·FAB 34·시트 헤더 32·헤더 타일 56), `eyes-e1.png` 200×80 (정적 눈: 임박 카드 56×22, A03 헤더 44×18, A09 빈 블롭 74×30, 알림 아이콘 26×10), `hand-color.png` 804×763 (C-1 컬러 손), `hand-solid.png` (검은 손: 눈 애니메이션·대기 스탬프), `icon-face-e1.png` 512² (앱 아이콘: 옐로 바탕 흰 블롭 + 손 눈).
- **C-1 루프** (`lf-pinky-l`, 2.6s, cubic-bezier(.32,.72,0,1), infinite): 0–15% `translate(4,0) rotate(8°)` → 45–60% `translate(-3,-2) rotate(-6°)` → 75% `translate(-2,-1) rotate(-3°)` → 100% 처음. 왼손은 컨테이너 `scaleX(-1)` 미러, 애니메이션은 안쪽 이미지에만, transform-origin 50% 90%. 손 폭 = size×804/763, 두 손 간격 = size×.12(컬러) / ×.5(눈). 스파크: 옐로 원 size×.22, 상단 18% 중앙, 0–40% op0 s.4 → 52% op1 s1.1 → 70% op0 s1.3.
- 크기: 28(스탬프 안), 40(타일), 72(대형), 눈 44(hand-solid, 간격 .5).
- Reduced motion: 0% 포즈 정지, 스파크 없음.

### 3-6. 아이콘 (Material Symbols Rounded 400/FILL 0/opsz 24)
확정안 사용: add, ads_click, alarm, arrow_back, arrow_forward, block, bookmark, cancel, check, check_circle, close, description, draw, event, expand_more, hourglass_empty, image, inventory_2, more_horiz, notification_important, notifications, person_add, photo_camera, privacy_tip, radio_button_checked, radio_button_unchecked, redeem, refresh, schedule, send, share, sync_alt, trending_up.
현행 웹 34개·모바일 26개(MaterialIcons 이름)와 합집합으로 서브셋. 확정안은 행 링크 chevron 자리에 `arrow_forward`, 더보기에 `more_horiz`를 쓴다.

## 4. 현재 코드 인벤토리 (탐색 결과 요약)

- **토큰**: `design-reference/styles/tokens.css` 117개(테스트가 개수 고정) · `apps/mobile/src/theme/tokens.ts`(colors 47·type·line·weight·radius·border{sheet}·space·gutter·size·elevation 객체·easing 배열·duration{hook:3400 미사용}) · `apps/web/src/styles/tokens.css`(값 동일, 폰트 경로만 다름). 동기화 스크립트 없음 — `apps/mobile/src/theme/tokens.test.ts`가 유일한 게이트(개수·값·웹 패리티·components.css 셀렉터 정규식·WCAG 쌍).
- **components.css** 1284줄, `lf-*` 계열(btn/card/chip/tab/icon-button/list/sheet/stamp/dday/field/input/choice/claim/outcome/meta/stat/compare/avatar/notice/fingerprint/progress/empty/preview/appbar/row-link/onboarding + `sl-*` 데코 20규칙). 웹 복사본은 이미 드리프트(pinky·home__ad·web.css 230줄).
- **모바일 컴포넌트** 37개 (`apps/mobile/src/components/`): LfButton(7 variant·3 size), LfCard(5 variant), LfChip(8 tone), LfText(18 variant, color prop 금지), LfIcon(MaterialIcons, 이름 집합 열려 있음), LfPinky(PNG 브랜드 마크, **21곳 사용**), LfMascot(SVG 블롭+눈+입, 2곳), LfDoodle(6종 8배치, 3화면 — **확정안에 없음 → 제거**), LfAppBar, LfBottomNav(**제거**), LfFab, LfHero, LfEmpty, LfNotice, LfHelper, LfField, LfInput/Textarea/Picker/Choice/Switch, LfStack/Row, LfWizardProgress, LfAvatar, LfTrustRing, LfTrustStrip, LfPromiseSeam(원샷 애니), LfAdSlot/LfBannerAd, GoogleMark, PromiseListRow, 시트 5종(completion-celebration=MOD-03, promise-amend=MOD-01, promise-entitlement=MOD-05, slot-paywall=MOD-04, witness-invite=MOD-02).
- **모바일 화면** (`apps/mobile/src/app/`): index(A01)·onboarding(A00)·home(A02)·promise/edit(A03 위저드 743줄)·invite(A04)·promise/[promise_id](A05 1442줄, 변형은 `screens/scr-a05-detail-state.ts`의 TONE 표)·fulfillment/[promise_id](A06)·notifications(A07)·profile(A08, 리마인드 토글 4개+시각 있음)·history(A09)·i/[token]·blocked-users·profile-nickname·update-required·+not-found·_layout.
- **상태→톤**: `scr-a05-detail-state.ts:74` TONE 표 → `LfChip` tone → 색. D7 매핑을 여기서 바꾼다.
- **애니메이션**: reanimated 4.5.1·react-native-svg 15.15.4 있음, expo-image 없음. 루프 애니 없음(`withRepeat` 미사용).
- **브랜드 자산**: `apps/mobile/assets/images/{icon,android-icon-foreground/background/monochrome,splash-icon,brand-symbol,brand-symbol-in-app}.png`, `app.json` adaptiveIcon 배경 #F6E7A3·스플래시 배경 #F3ECDC·알림 색 #F6E7A3, 네이티브 파생물 `android/app/src/main/res/**`, 생성기 `tools/export-brand-icons.js`, 스토어 `docs/디자인/store/store-icon-512.png`. 해시 고정 테스트 존재(ADR 0013).
- **웹**: `apps/web/src/screens/scr-w0{1..6}-*.tsx` + `home/response-complete/legal-document/account-deletion`, 컴포넌트는 LfPinky/LfIcon/LfDisclaimer/LocaleSwitch만, 나머지는 raw `lf-*` 클래스. CSS 로드 순서 font-fallback→tokens→icons→base→components→screens/web.css. 파비콘/OG 이미지 **없음**. 아이콘은 자체 서브셋 woff2(34개, `icon-codepoints.ts` 생성).
- **테스트 게이트**: jest-expo 80 suites/824, Vitest 110 files/2,142, typecheck 5 projects, `check:agents`. 스타일 고정: `tokens.test.ts`, `components.test.tsx`(테두리 두께·기울기·색), `fonts.test.ts`, `apps/web/src/typography.test.ts`, `seo.test.ts`, 브랜드 해시 테스트, config 테스트(`apps/mobile/config/*.test.js`가 app.json 색 검증).
- **문구 카탈로그**: `apps/mobile/src/screens/*-labels.ts` 22개(`labels-registry.ts` 등록, i18n-parity 테스트), 웹 `scr-w0x-labels.ts` + cross-surface 테스트.

## 5. 구현 계획

### 5-0. 실행 원칙 (모든 단계에 적용)

- **커밋 단위 = 검증 가능한 최소 단위.** 각 커밋 전 `npm run typecheck && npx vitest run && (cd apps/mobile && npx jest)`. 웹을 건드린 커밋은 `npm run build:web` 추가. CLAUDE.md를 건드린 커밋은 `npm run sync:agents` 후 `npm run check:agents`.
- **세 타깃 동시 착지.** `design-reference/styles/tokens.css` → `apps/mobile/src/theme/tokens.ts` → `apps/web/src/styles/tokens.css`는 항상 같은 커밋. `components.css`도 reference ↔ web 같은 커밋. P3~P7 사이 웹 마크업이 CSS를 따라오지 못하는 구간이 생기므로 **그 구간 웹 배포 금지**를 핸드오프와 `DEVELOPMENT_STATUS.md`에 명시.
- **프리뷰 → PO 컨펌 → 구현.** 갤러리(`npm run preview`, lf-* 클래스 HTML, 인라인 스타일 금지)가 유일한 프리뷰 매체. 확정안 15개는 Chrome MCP로 `design-reference/redesign-2026-09-03/ui-ux/project/리틀핑거 파스텔 스티커.dc.html#4x`와 나란히 놓고 확인, 확장 21개(+갤러리 신규 5개)는 배치별 명시 컨펌 후에만 RN/웹 구현.
- **테스트는 옮기되 느슨하게 하지 않는다.** 아래 각 단계의 "이동하는 테스트" 밖의 단언(i18n 패리티, a11y 역할·라벨·testID, 상태 전이, 핸들러, EC-* 케이스)은 손대지 않는다.
- **동결 목록** (`packages/shared/**`, `supabase/**`, `apps/mobile/src/lib/**`, `screens/*-state.ts` 리듀서, 라우트 파일·`_layout.tsx`)은 D3가 허용한 두 가지(하단 탭 배선 제거, 앱바→마이/알림 내비 추가)와 `scr-a05-detail-state.ts`의 TONE 표만 예외.
- **보고는 한국어, 명령 출력 인용.** 주석은 한국어로 "왜"만.
- claude_design MCP(`api.anthropic.com/v1/design/mcp`)는 이 세션에 연결되어 있지 않다. 로컬 번들이 그 프로젝트의 export 본이므로 그것을 정본으로 쓴다.

### A. 단계별 계획

#### P0 — 결정 고정 · 번들 정리 (세션 1)

목표: 계획을 저장소 안에 두고, 확정안 번들을 읽기 전용 위치로 옮긴다.

1. 워킹트리에 **미커밋 삭제**로 남아 있는 `design-reference/design_handoff_develop/**`(추적 15파일, 이전 handoff)를 커밋한다 — PO가 지운 것이므로 실행 시 한 줄 확인 후 진행.
2. `git mv design-reference/redesign-2026-09-03 design-reference/redesign-2026-09-03`(오타 정리). 번들 내부(`ui-ux/project/*.dc.html`, `assets/`, `support.js`, `image-slot.js`, `current/`)는 그대로 — 갤러리 프리뷰가 `support.js`로 아트보드를 렌더한다. 미추적 `redesign-2026-09-03.zip`(7.6 MB)은 폴더와 중복이므로 커밋하지 않고 PO 확인 후 삭제.
3. 이 계획 §1~§5를 `docs/plans/2026-09-03-pastel-sticker-restyle.md`로 저장(CLAUDE.md §1-1: ADR 착지 시 삭제).
4. `docs/handoff/2026-09-03-open-testing-release.md`는 이번 세션의 새 핸드오프가 대체할 때 삭제(§G).

이동하는 테스트: 없음. 검증: `npx vitest run apps/web/src/seo.test.ts`, `npm run preview`로 `/redesign-2026-09-03/ui-ux/project/리틀핑거%20파스텔%20스티커.dc.html`이 Chrome에서 열리는지 확인.

커밋: `chore: drop the superseded design handoff bundle` · `docs: land the pastel sticker handoff bundle as read-only` · `docs: add the pastel sticker restyle plan`

#### P1 — 자산 · 아이콘 폰트 (세션 1)

목표: E-1 마스코트 5종을 세 타깃에 넣고, Material Symbols Rounded 서브셋을 RN까지 확장해 C-2를 닫는다. 기존 `brand-symbol*.png`와 `LfPinky`는 **아직 지우지 않는다**(P5에서 소비자와 함께 제거).

1. 마스터 5종을 `design-reference/assets/images/`에 복사(정본): `mascot-face-e1.png`(512², RGBA), `eyes-e1.png`(200×80), `hand-color.png`(804×763, 398 KB), `hand-solid.png`(804×763), `icon-face-e1.png`(512²). `apps/mobile/assets/images/`에 앞 4종 바이트 동일 복사. `apps/web/src/assets/images/`에 `mascot-face-e1.png`·`eyes-e1.png`·`hand-solid.png` 바이트 동일 + `hand-color.png`는 402px 폭 파생물(웹 3초 예산; §E).
2. 새 테스트 `apps/mobile/config/brand-assets.test.js`: 마스터 5종 크기·RGBA·SHA-256 고정, 모바일/reference 바이트 동일, 웹 `hand-color.png` 폭 402 고정.
3. `tools/subset-icon-font.js` 확장(§E): ICONS = 현행 웹 34 ∪ 모바일 26 ∪ 확정안 33, 출력 3종 — 웹 woff2(기존 경로), `apps/mobile/assets/fonts/MaterialSymbolsRounded-subset.ttf`(`targetFormat:'sfnt'`, `variationAxes:{wght:400,FILL:0,GRAD:0,opsz:24}` 정적 인스턴스화 — subset-font 2.5.0 지원 확인됨), 코드포인트 맵 두 벌(`apps/web/src/components/icon-codepoints.ts` 기존 + `apps/mobile/src/theme/icon-codepoints.ts` 신규, 내용 동일).
4. `tools/subset-icon-font.test.ts`(Vitest): 두 맵 바이트 동일 · TTF를 fontkit으로 열어 가변 축이 없고(정적) 모든 코드포인트에 글리프가 있음 · woff2 글리프 수 = 맵 크기.
5. `apps/mobile/src/theme/fontAssets.ts`에 `'MaterialSymbolsRounded': require(...ttf)` 추가(`_layout.tsx`의 `useFonts(FONT_ASSETS)`가 그대로 프리로드 — 레이아웃 무수정). `theme/fonts.ts`에 `ICON_FONT_FAMILY` 상수.
6. `apps/mobile/src/components/LfIcon.tsx`: `createIconSet(ICON_CODEPOINT, ICON_FONT_FAMILY, require(...ttf))`, `LfIconName = keyof typeof ICON_CODEPOINT`(닫힌 집합). 27개 호출처 이름 교체: `arrow-back→arrow_back`, `notifications-none→notifications`, `chevron-right→arrow_forward`(확정안 규칙), `east→arrow_forward`, `link-off→link_off`, `trending-up→trending_up`, `photo-camera→photo_camera`, `privacy-tip→privacy_tip`, `expand-more→expand_more`, 나머지 동일명. `scr-a07-notification-presentation.ts`의 `NotificationIcon`: `'pinky'→'eyes'`(LfEyes 렌더), `'person-off'→'cancel'`, `'sync-alt'→'sync_alt'`, `'notification-important'→'notification_important'`, `'fact-check'→'inventory_2'`, `'alarm'` 유지.

이동하는 테스트: `theme/fonts.test.ts`(FONT_ASSETS 키 = 텍스트 4 + 아이콘 1) · `scr-a07-notifications.test.tsx` 아이콘 이름 단언 · `components.test.tsx` LfIcon 3건(렌더 타입). 유지: 접근성 라벨/장식 숨김, `firebase-config.test.js` brand-symbol 해시(자산 아직 유지).

검증: `node tools/subset-icon-font.js` 출력(아이콘 수·KB) 인용, 세 러너 통과, 에뮬레이터 A02·A08 아이콘 두부 없음 스크린샷.

PO 체크포인트: 없음(routine — 아이콘 통일). 커밋: `feat: add the E-1 mascot masters to all three targets` · `feat: subset Material Symbols Rounded for RN and web` · `refactor: route every app icon through the Symbols subset`

#### P2 — 토큰 (세션 1)

목표: §B의 추가·재값을 세 타깃에 같은 커밋으로 넣는다. **삭제는 하지 않는다**(소비자가 남아 있음 — P7 끝에서 삭제).

1. `design-reference/styles/tokens.css`: §B대로 재값 + 추가(그룹 주석 "파스텔 × 잉크 & 스티커, 2026-09-03 PO 컨펌"). Google Fonts `@import`는 갤러리 아이콘용이므로 유지.
2. `apps/web/src/styles/tokens.css`: 값 바이트 동일, `@font-face` 경로만 `/fonts/PretendardVariable.woff2` 유지(`seo.test.ts`).
3. `apps/mobile/src/theme/tokens.ts`: `colors` 재값, `type`/`line` 추가, 신규 객체 `letterSpacing`(em 숫자, 소비자가 `fontSize × em` 환산), `tilt`(문자열 `'-0.8deg'`), `border`·`size` 확장, `easing.pinky`, `duration.pinky`. `NOT_PORTED_TOKENS` 6개 그대로.
4. `LfText.tsx`는 이 단계에서 **값만** 따라간다(`title` 24/32 등). 변형 개편은 P5.

이동하는 테스트 (`tokens.test.ts`): 개수 `117 → 183`(커밋 직전 파서 결과로 재확인) · `groups`에 `letter-spacing-`/`tilt-` 추가(`unitless`가 em·deg 처리, tilt는 문자열 비교) · 웹 패리티 리터럴(`color-record`/`color-attention` `#221C13`, `primary-container #FFE59A`, `success-container #B7E1D1`) · "정보·주의·위험 역할 구분"을 컨테이너 3색으로 이동(`#A9D3FF`/`#FFB5C1`/`#F8DFDB`) · WCAG 쌍 §B 추가 · "주요 높이" 신규 줄(`inputHeight`·`iconCircle`·`trustRing`…) · `elevation`·`easing`·`weight` 단언 유지 · CSS 셀렉터 정규식은 P2에서 그대로 통과(P3에서 이동).

검증: 세 러너 + `npm run build:web`. 갤러리 36면 색 스왑 육안 감사(미정의 변수 → 투명 배경 없음).

PO 체크포인트: 갤러리 색 스왑 스크린샷 3장(A02·A05·W02) 통보. **포커스 링 `#2F6FB3`은 확정안에 없음 — 통보 항목.** 커밋: `feat: move the token pipeline to the pastel sticker palette`

#### P3 — 레퍼런스 CSS · 컴포넌트 문법 (세션 2)

목표: `components.css`·`base.css`·`screens/*.css`를 §3-4 문법으로 다시 쓰고, 웹 CSS 사본을 같은 커밋으로 맞춘다.

1. `design-reference/styles/components.css` 재작성. 삭제: `.lf-pinky*`(+키프레임), `.sl-*` 전부, `.lf-bottom-nav*`, `.lf-stat-hero`, `.lf-home__row-dday`. 추가/개편: `.lf-mascot(--sm/--md/--lg)`, `.lf-eyes(--row/--header/--card/--blob)`, `.lf-pinky-loop(--sm/--md/--lg/--eyes, __hand, __hand--left scaleX(-1), __img 애니메이션 transform-origin 50% 90%, __spark)` + `@keyframes lf-pinky-l`/`lf-pinky-spark` + `prefers-reduced-motion`(0% 정지·스파크 숨김), `.lf-blob(--hero/--login/--empty/--corner-mint/--corner-yellow)`, `.lf-stamp(--active/--completed/--pending, __pill 100×60)`, `.lf-appbar`(52 투명 중앙 제목, `--brand`), `.lf-icon-button`(44 종이 원, `__dot` 핑크), `.lf-avatar-button`, `.lf-fab`(플로팅 필 + `__trailing`), `.lf-fade`, `.lf-btn__trailing(--plain)`, `.lf-btn--outlined`(투명 2.4 50 disabled .3), `.lf-btn--tonal`(옐로 36), `.lf-chip--yellow/mint/pink/sky/muted/paper/cream` + `--filter/--select/--meta/--status`, `.lf-card`(r22 2.2 패딩 18) + `--list/--yellow…/--flat/--tilt/--tilt-hero`, `.lf-eyebrow(__required)`, `.lf-outcome--reward/--penalty`, `.lf-status-dot`, `.lf-switch`, `.lf-ring`, `.lf-sheet(__title-row)`, `.lf-countdown`, `.lf-progress`, `.lf-dday-circle`, 입력 3종(2px r12 48/80), `.lf-choice`, `.lf-list-item--unread`, `.lf-divider--dashed`.
2. `base.css`: 상태바 크림 배경 + 어두운 아이콘.
3. `screens/{app-entry,app-create,app-detail,app-support,web}.css` 재작성(화면 전용 규칙만).
4. `gallery.css`·`index.html` 마스트헤드: 핑키 SVG → `<img class="lf-mascot lf-mascot--sm">`, lede "파스텔 × 잉크 & 스티커 (2026-09-03)".
5. `apps/web/src/styles/components.css`·`screens/web.css`를 reference와 **바이트 동일** 복사. 웹 전용 규칙은 양쪽 `web.css` 맨 아래 `/* WEB ONLY */` 구획에만(드리프트 0). `icons.css` 무변경.

이동하는 테스트 (`tokens.test.ts` CSS 정규식): `.lf-card--container .lf-dday` → `.lf-chip--mint` 배경 success-container · `.lf-list-item--unread` 헤드라인 색 → 옐로 배경 · 소문구 계층(`.lf-field__label` → eyebrow 11/700/wide/muted, `.lf-card__meta`·`.lf-list-item__supporting` → meta 12/400/muted, `.lf-body--secondary`·`.lf-caption` → 14/22/400 secondary, `.lf-field__hint` 12.5/18/700 유지, `.lf-proof` 잉크 유지, `.lf-trust-card__note` → micro/400/secondary) · 디스클레이머 12.5/18/700 **유지** · 포커스 outline 유지 · **신규**: reference↔web `components.css`·`web.css` 바이트 동일 단언.

검증: 세 러너 + `npm run build:web` + Chrome MCP 갤러리 36면 콘솔 경고 0·가로 오버플로 0. PO 체크포인트: 없음(웹 배포 보류 시작 통보). 커밋: `feat: rewrite the reference component grammar for pastel stickers`

#### P4 — 레퍼런스 화면 (PO 컨펌 배치) (세션 2~3)

목표: 갤러리 36면 + 신규 5면 = 41면을 lf-* HTML로 다시 쓴다. 프리뷰 스캐폴딩(`lf-device`, `frame.js`, `screen-page.css`, `lf-browserbar`) 유지, iOS 크롬은 옮기지 않는다.

- **배치 1 — 확정안 15** (아트보드 → lf-* 변환): `scr-a00-onboarding`(4a) · `scr-a01-login`(4e) · `scr-a02-home`(4b) · `scr-a02-home-empty`(4f) · `scr-a03-promise-create`(4c, 3단계 유지 + 4c 문법 — D4) · `scr-a04-invite-sent`(4g, 카카오 노란 버튼 + '초대 링크 공유하기' + 아웃라인 '링크 복사하기' + 말풍선 + 카운트다운 — D6) · `scr-a05-active`(4d) · `scr-a05-pending`(4h) · `scr-a05-completed`(4i) · `scr-a06-fulfillment-check`(4j) · `scr-a07-notifications`(4k, 광고 플레이스홀더 미표시) · `scr-a08-profile`(4l + 뒤로 원 + '지난 약속' 행) · `scr-a09-history`(4m) · `mod-03-completion-celebrate`(4n) · `mod-04-slot-paywall`(4o). 문구는 확정안 ko(D5), 승인 대기 상대 이름은 '상대방'.
  PO 체크포인트 1: Chrome MCP 두 탭(갤러리 / dc.html `#4x`) 390px 캡처 15쌍. 확인 항목: 디스클레이머 12.5/700 유지, 앱바 마스코트 30 통일, 알림 미읽음 도트(홈 데이터 없음 → 생략). 커밋: `feat: port the fifteen confirmed artboards to the reference gallery`
- **배치 2 — 앱 확장 13 + 신규 5** (§D): `scr-a05-{amend-pending,checking,broken,disputed,unresolved,declined,active-no-end,finish-pending}`, `mod-01-amend-request(-no-end)`, `mod-02-witness-invite`, `mod-05-entitlement-sheet(-locked)`, 신규 `scr-i-invite-review`·`scr-blocked-users`·`scr-profile-nickname`·`scr-update-required`·`scr-not-found`(index.html ④에 figure 5 추가 → 41면).
  PO 체크포인트 2: 18장 + "파생 원본" 캡션. DISPUTED는 두 주장 카드 동일 톤·순서 명시. 커밋: `feat: extrapolate the unconfirmed app surfaces in the gallery`
- **배치 3 — 웹 8**: `scr-w01`~`scr-w06` + `w04-finish` + `w05-no-end`. PO 체크포인트 3: 8장 + LEGAL_DISCLAIMER 위치. 커밋: `feat: restyle the acceptance web reference screens`

이동하는 테스트: 없음. 검증: 배치마다 갤러리 콘솔/오버플로 감사 + `npx vitest run`.

#### P5 — RN 컴포넌트 (세션 4)

목표: §C의 API를 구현하고 `LfPinky`·`LfDoodle`·`LfBottomNav`·`brand-symbol*.png`를 제거한다. 화면은 컴파일만 유지.

순서: `LfText` 변형 개편 → `LfMascotFace`/`LfEyes`/`LfPinkyLoop`/`LfBlob` 신규(`LfMascot.tsx` 재작성 + `LfPinkyLoop.tsx`) → `LfButton`(trailing) → `LfCard`(tone/tilt) → `LfChip` + `LfStatusDot` 신규 + `screens/status-tone.ts`(`statusToneOf`) → `LfIconButton`·`LfAvatarButton` 신규 → `LfAppBar` → `LfFab` + `LfBottomFade` 신규 → `LfSwitch` → `LfTrustRing` → `LfEmpty` → `LfStamp` 신규 → `LfSheet` 신규(5개 시트 껍데기만 교체) → `LfHero` → `PromiseListRow` → 나머지 값 정렬 → `LfPinky.tsx`·`LfDoodle.tsx`·`LfBottomNav.tsx` 삭제 → `home.tsx`·`profile.tsx` 하단 탭 배선 제거(D3) → `brand-symbol*.png` 삭제.

이동하는 테스트 (`components.test.tsx` 등): "LfPinky" describe → "LfMascotFace/LfEyes/LfPinkyLoop"(자산 소스·장식 숨김·reduced motion progress 0·왼손 scaleX -1) · "LfFab" 트레일링 원 안 마스코트 · "LfCard" tone/tilt/flat · "LfButton" cta 52·trailing 원·48dp/pill/kakao/google 유지 · "히어로" r22·-1.2°·눈 · "하단 내비" 삭제 → "LfAppBar"(뒤로 원·아바타 액션 role button) · "LfTrustRing" 88/10/민트/잉크 링 · `pinkyLoopDuration(true) === 0` · "M4 48dp"에 Switch/IconButton · "잉크&스티커 장식" describe → "LfBlob 토큰 색만" · `firebase-config.test.js` brand-symbol 730×458 해시 삭제(런처·스플래시·스토어 해시는 P8까지 유지) · `scr-a05-detail-state.test.ts` tone 열 D7 · `scr-a02-home.test.tsx` `'작성'`→`'약속 만들기'`, `tab '마이'`→`button '마이'` · `scr-a08-profile.test.tsx` 하단 탭 → `button '뒤로'` + `'지난 약속'` 행 · `mobile-chrome-labels.ts`(`home` 삭제, `create`·`back`·`history` ko/en 동시). 무수정: `LfAdSlot.test`·`LfBannerAd.test`·시트 테스트.

검증: jest 전체, typecheck, 실기기 A02·A08 스크린샷(하단 탭 없음, 플로팅 필 CTA, 앱바 원형 버튼). 커밋: `feat: add E-1 mascot, eyes, blob and pinky loop components` · `feat: restyle Lf* components to the pastel sticker grammar` · `feat: replace the bottom tab bar with appbar actions and a floating CTA` · `chore: remove LfPinky, LfDoodle and the Type A brand assets`

#### P6 — RN 화면 (배치) (세션 5~7)

각 배치: 갤러리 HTML을 옆에 두고 화면을 재구성(SCR-ID 1:1, 상태·핸들러·a11y·testID 불변, 문구는 `*-labels.ts`만). 배치 끝마다 실기기 360×800 + 글꼴 배율 1.5 스크린샷.

- **배치 A(세션 5)**: `index.tsx`(A01) · `onboarding.tsx`(A00, 단계 아이콘 행 제거 → 테스트 단언 이동) · `home.tsx`(A02: 인사 26/34 닉네임+건수, 필터 칩 + '지난 약속' 칩, 히어로 카드, 상태 도트 행, 플로팅 필 + 페이드) · `notifications.tsx`(A07) · `profile.tsx`(A08) · `history.tsx`(A09). 커밋: `feat: restyle entry, home, inbox, profile and history screens`
- **배치 B(세션 6)**: `promise/edit.tsx`(A03, D4) · `invite.tsx`(A04, D6) · `fulfillment/[promise_id].tsx`(A06) · `completion-celebration-sheet.tsx`(MOD-03, `LfPinkyLoop size="lg"`) · `slot-paywall-sheet.tsx`(MOD-04). 커밋: `feat: restyle creation, invite, fulfillment and celebration flows`
- **배치 C(세션 7)**: `promise/[promise_id].tsx`(A05 전 변형 §D) · `promise-amend-sheet.tsx`(MOD-01) · `witness-invite-sheet.tsx`(MOD-02) · `promise-entitlement-sheet.tsx`(MOD-05) · `i/[token].tsx` · `blocked-users.tsx` · `profile-nickname.tsx` · `update-required.tsx` · `+not-found.tsx`. 커밋: `feat: restyle promise detail variants, sheets and support screens`

이동하는 테스트: 화면 테스트의 **문구 단언만** 카탈로그 변경에 맞춰(배치 보고에 파일:줄 열거). 역할·라벨·testID·핸들러·EC 단언 무수정. PO 체크포인트: 배치마다 실기기 스크린샷 묶음(정상 + 1.5) + "의도적 편차" 표.

#### P7 — 수락 웹 (세션 8)

1. `apps/web/src/components/LfPinky.tsx` → `LfMascot.tsx`(`LfMascotFace`/`LfEyes`/`LfPinkyLoop`, CSS 클래스 기반), 테스트 이름 동반.
2. `scr-w0*.tsx` 8개를 배치 3 HTML 구조로 재마크업(`PinkyBadge` → `lf-blob--login`). `home`·`response-complete`·`legal-document`·`account-deletion`은 공용 클래스 흐름만 → 스크린샷 검토.
3. `index.html`·`app.html`(바이트 동일 유지): `theme-color #F3ECDC`, 파비콘/OG(§E), 폰트 preload·아이콘 `font-display:block` 유지.
4. **토큰 삭제 커밋**: 소비자 없는 9개(`type-hero-dday-size`, `type-list-dday-size`, `line-hero-dday`, `radius-hero-tail`, `radius-record`, `bottom-nav-content-height`, `center-fab`, `nav-icon`, `duration-hook`) 세 타깃 제거 → 개수 `183 → 174`.

이동하는 테스트: `scr-w01`/`scr-w03` 테스트의 `src` `'brand-symbol'` → 마스코트 자산 · `seo.test.ts` 파비콘/OG 단언 추가. 유지: `i18n-cross-surface`, `i18n-ko-only-guard`, 흐름/EC.

검증: `npx vitest run`, `npm run build:web`, Chrome MCP 8경로 스크린샷 + 콘솔 0. PO 체크포인트: 빌드 스크린샷 + OG 카드 → **웹 배포 보류 해제**. 커밋: `feat: restyle the acceptance web to the pastel sticker system` · `feat: add the E-1 favicon set and share image` · `refactor: retire design tokens that lost their last consumer`

#### P8 — 브랜드 파생물 · app.json (세션 9, PO "출시 가능" 신호 후)

1. `tools/export-brand-icons.js` 확장(§E) 실행 → `apps/mobile/assets/images/{icon,android-icon-foreground,android-icon-background,android-icon-monochrome,splash-icon}.png`, `docs/디자인/store/store-icon-512.png`, `apps/web/public/brand/*` 재생성.
2. `apps/mobile/app.json`: `adaptiveIcon.backgroundColor #FFE59A`, `expo-notifications.color #FFE59A`, 스플래시 배경 `#F3ECDC` 유지, `version 0.3.0`. 권한·플러그인·앱링크 무수정. versionCode는 EAS 원격 — **PO 신호 전 프로덕션 빌드 금지**.
3. `docs/setup/open-testing-po-guide.md`에 "Play 콘솔 아이콘 512·피처 그래픽·스크린샷 교체" 절(D8, PO 작업).

이동하는 테스트: `firebase-config.test.js` 런처/적응형/스플래시/스토어 해시 재고정 + 색 단언 · `brand-assets.test.js` 파비콘·OG 크기. 검증: 세 러너, `npx expo prebuild --clean --platform android`(로컬, 미커밋)로 mipmap 육안, `android-permissions.test.js` 통과. PO 체크포인트: 런처(라이트/다크/테마)·스플래시·알림 아이콘 스크린샷. 커밋: `feat: switch launcher, splash and notification artwork to E-1`

#### P9 — 문서 · ADR · 기준선 동결 (세션 9)

1. `docs/adr/0019-pastel-sticker-restyle-and-e1-mascot.md`: Context(§1), Decision(D1~D8 + routine), 파이프라인, 편차 목록(디스클레이머 유지 · 앱바 마스코트 30 · 뮤트 카드 eyebrow 잉크 · 알림 미읽음 도트 생략 · 광고 플레이스홀더 미표시 · 포커스 링 파생 · 웹 hand-color 402), "tests moved deliberately", Supersedes ADR 0012 시각 시스템·0013/0016/0017/0018(각 Status 줄에 `Superseded by 0019`).
2. `DESIGN.md` 전면 재작성(§3 사양이 정본).
3. `docs/DEVELOPMENT_STATUS.md` 상단 "Visual-system baseline: 파스텔 × 잉크 & 스티커 (2026-09-03, ADR 0019)".
4. `CLAUDE.md`: §3 갤러리 27→41 · §5-1 수치 · §5-3 시스템 설명 · §5-4 아이콘 gotcha(Symbols 서브셋 TTF, 닫힌 이름) · §11 C-2 닫힘 · §4 표 5행에 새 캔버스 경로 병기. `npm run sync:agents`.
5. `design-reference/README.md` 갱신. `docs/plans/2026-09-03-pastel-sticker-restyle.md` 삭제(ADR 착지).
6. 마지막 핸드오프가 직전 것을 대체(§G).

검증: `npm run check:agents`, 세 러너, `git diff --check`. 커밋: `docs: record ADR 0019 and rewrite DESIGN.md for the pastel baseline` · `docs: sync agent guidance and status for the pastel restyle`

### B. 토큰 diff

기준 117개 → P2 후 **183** → P7 삭제 후 **174**(각 커밋 직전 파서 결과로 재확인).

재값(이름 유지): `color-primary-container` #F6E7A3→**#FFE59A** · `color-primary-pale` #CDBCEC→#A9D3FF · `color-brand-symbol-on-action`→#FFE59A · `color-surface-chrome`→#F3ECDC · `color-focus-ring` #6B58A8→**#2F6FB3**(파생) · `color-record` #6B58A8→#221C13 · `color-record-container` #E7DFF6→**#A9D3FF** · `color-attention` #B05F2C→#221C13 · `color-attention-container` #F8DDBE→**#FFB5C1** · `reward-container/on-reward-container/reward-label` → #A9D3FF/#221C13/#221C13 · `penalty-container/on-penalty-container/penalty-label` → #FFB5C1/#221C13/#221C13 · `color-success-container` #F6E7A3→**#B7E1D1** · `type-display-size` 30→34 · `type-title-size/line-title` 22/30→24/32 · `radius-md/lg/xl` 14/16/16→16/20/22 · `appbar-height` 56→52 · `cta-height`/`fab-height` 54→52 · `action-height` 48→50 · `tab-height` 38→32 · `appbar-icon` 26→20.

추가(66): type/line 12(`type-wordmark-size 38` `line-wordmark 44` `line-display 42` `type-headline-size 26` `line-headline 34` `type-sheet-title-size 22` `type-card-title-size 19` `line-card-title 26` `type-stamp-size 17` `type-chip-size 13` `type-meta-size 12` `type-eyebrow-size 11`) · letter-spacing 4(`tight -0.02em` `wide 0.12em` `wider 0.16em` `wordmark 0.04em`, 신규 그룹 `letterSpacing`) · border 5(`chip 2` `card 2.2` `outline 2.4` `dashed 2` `pending 3`) · tilt 4(`sticker -0.8deg` `hero -1.2deg` `blob -2deg` `empty 3deg`, 신규 그룹 `tilt`) · size 39(`input-height 48` `kakao-height 54` `icon-circle 40` `card-padding 18` `chip-select-height 36` `chip-meta-height 30` `chip-status-height 28` `switch-width 52` `switch-height 32` `switch-knob 20` `trust-ring 88` `trust-ring-stroke 10` `dday-circle 56` `avatar-sm 34` `avatar-lg 48` `avatar-xl 52` `thumb 76` `thumb-lg 84` `status-dot 10` `progress-height 8` `sheet-handle-width 40` `sheet-handle-height 5` `fade-height 140` `fade-height-sm 110` `mascot-sm 30` `mascot-md 34` `mascot-lg 56` `pinky-sm 28` `pinky-md 40` `pinky-lg 72` `pinky-eyes 44` `eyes-row 26` `eyes-header 44` `eyes-card 56` `eyes-blob 74` `hero-blob-height 290` `login-blob-height 200` `stamp-pill-width 100` `stamp-pill-height 60`) · motion 2(`easing-pinky cubic-bezier(0.32,0.72,0,1)` `duration-pinky 2600ms`).

삭제(9, P7): 위 P7 목록. `NOT_PORTED_TOKENS` 6개 그대로.

포커스 링 파생 `#2F6FB3`: 크림 4.42 · 종이 ≥4.5 · 스카이 3.33 · 옐로 4.19 · 민트 3.64 · 핑크 3.12(모두 ≥3:1, 잉크와 다름). 핑크가 빡빡 — PO 통보 시 함께 제시.

WCAG 쌍 추가: 4.5:1 — `text` × {옐로, 민트, 핑크, 스카이} · `textSecondary/primaryContainer`(4.63) · `textMuted/surface`(5.55) · `textMuted/background`(4.81). 실패라 편차 기록 — `textMuted/surfaceMuted` 4.34, `textSecondary/surfaceMuted` 4.41 → 뮤트 카드의 eyebrow·메타는 잉크로. 3:1 비텍스트 — 포커스 링 × 6면.

### C. 컴포넌트 API 변경 (`apps/mobile/src/components/`)

- `LfText` 변형 재편: `wordmark` `display` `headline` `title` `sheetTitle` `cardTitle` `stamp` `heading` `subtitle` `bodyStrong`(15/20/700 행 제목) `body` `label` `bodySm`(14/22) `caption` `meta`(12 muted) `eyebrow`(11/700/wide muted, `required` 접미 잉크) `chip` `countdown` `micro` `error` `disclaimer`. 삭제: `confirmationHeadline` `containerAccent` `containerFlag` `containerTitle` `listTitle` `listMeta` `listStatus` `dday` `ddayXl` `heroDday`. letterSpacing 환산은 여기서만. `color` prop 금지 유지.
- `LfIcon`: `name: LfIconName`(생성 맵 키, 닫힘), `createIconSet` 기반.
- 신규 `LfMascotFace`(`size sm 30/md 34/lg 56`), `LfEyes`(`row 26×10/header 44×18/card 56×22/blob 74×30`), `LfPinkyLoop`(`size sm 28/md 40/lg 72/eyes 44`, `variant color|solid`, `spark`; 손 폭 size×804/763, 왼손 컨테이너 scaleX -1, `withRepeat(withTiming(1,{duration.pinky, Easing.bezier(...easing.pinky)}),-1)` + `interpolate` 키프레임 [0,.15,.45,.6,.75,1] → tx [4,4,-3,-3,-2,4] / ty [0,0,-2,-2,-1,0] / rot [8,8,-6,-6,-3,8]deg, transformOrigin 50% 90%; 스파크 [0,.4,.52,.7,1] → op [0,0,1,0,0] / scale [.4,.4,1.1,1.3,1.3]; `useReducedMotion`이면 progress 0·스파크 미렌더; `pinkyLoopDuration(reduce)` export; 화면 blur 시 `cancelAnimation`), `LfBlob`(`variant hero|login|empty|cornerMint|cornerYellow`, `tilt`, children 오버레이; react-native-svg 2.5 잉크 스트로크, 토큰 색만).
- 삭제: `LfMascot`(SVG 얼굴) → Blob+Loop, `LfDoodle`/`LfDoodleLayer`, `LfBottomNav`, `LfPinky`.
- `LfButton`: `size default 50 | cta 52 | compact 44(min 48)`, kakao 54 고정; 신규 `trailing?: LfIconName | 'mascot'`(40 옐로 원, 패딩 6/6/6/22), `trailingBorder?`(기본 true); filled 라벨 700, outlined 투명 2.4, disabled .3, tonal = 옐로 36.
- `LfCard`: `variant` 삭제 → `tone paper|yellow|mint|pink|sky|muted`, `flat`, `tilt sticker|hero|none`, `shape card(r22)|list(r20)`, 패딩 18, 테두리 2.2 모든 톤.
- `LfChip`: `tone paper|yellow|mint|pink|sky|muted|cream`, `kind status 28|meta 30|filter 32|select 36`, `selected`, `dot`. `ink`/`outline` 삭제. 글자 항상 잉크.
- 신규 `LfStatusDot`(10 + 2 잉크 링) + `screens/status-tone.ts`의 `statusToneOf(status)`(A05·홈 행·히스토리 공유; `scr-a05-detail-state.ts` TONE 표가 위임).
- 신규 `LfIconButton`(44 종이 원, `badge` 핑크 도트, hitSlop 48), `LfAvatarButton`(44 잉크 원 옐로 글자), `LfBottomFade`(Svg 그라디언트), `LfStamp`(`variant active|completed|pending`, 헤드라인/시각/참여자 칩/지문, 100×60 필 안 Loop sm), `LfSheet`(2.5 잉크, r28, 핸들, 제목 22 + 닫기 원, 스크림).
- `LfAppBar`: 52 투명, `leading back|close`, `brand`(마스코트 30 + 워드마크), `actions`. `LfFab`: 플로팅 필 52 + 트레일링 원 `LfMascotFace md`. `LfSwitch`: 52×32/노브 20, 래퍼 48. `LfTrustRing`: 88/10/민트/이중 잉크 링. `LfEmpty`: Blob empty + Loop solid eyes, `highlight`. `LfHero`: r22 -1.2° eyebrow + 19/26 + 옐로 블롭 + Eyes card + 44 잉크 원, 카드 전체 Pressable. `PromiseListRow`: r20 + StatusDot + 메타 칩 30, 응답 필요 행은 핑크 톤 + 컴팩트 아웃라인 CTA. `LfHelper`: 스카이 flat + Eyes header. `LfAvatar`: 2px 잉크, `size md|lg|xl`, `pending`(3 dashed). 입력 3종 2px r12 48/80. `LfChoice` 선택=옐로 스티커. `LfWizardProgress` 도트 20×6.
- **LfPinky 21곳 매핑**: `completion-celebration-sheet`→Loop lg · `+not-found`/`update-required`→Blob empty + Eyes blob · `LfAppBar`/`LfTrustStrip`→MascotFace sm · `index.tsx`/`onboarding.tsx` 단계 행→제거(히어로는 Blob + Loop solid eyes) · `invite.tsx`→Stamp pending · `notifications.tsx`→Eyes row · `LfBottomNav`→삭제 · `i/[token]` 247→MascotFace lg, 341→Eyes header · `LfEmpty`·`LfFab`(md)·`LfHelper`(Eyes header)·`LfHero`(Eyes card)·`LfPromiseSeam`(Eyes row) · `components.test.tsx`→새 describe.
- 웹: `LfPinky.tsx`→`LfMascot.tsx`(같은 세 export, `lf-mascot--*`/`lf-eyes--*`/`lf-pinky-loop--*`); W01 `PinkyBadge`→`lf-blob--login`; W03→Stamp 안 Loop sm.
- A07 아이콘 원 톤(`scr-a07-notification-presentation.ts`): CONFIRMATION 종이+eyes · FULFILLMENT 핑크 notification_important · REMINDER 크림 alarm · AMEND 스카이 sync_alt · APPROVAL(거절) 뮤트 cancel · RESULT 종이 inventory_2(중립).

### D. 확장 규칙 (확정안 없는 21 + 갤러리 신규 5)

| 표면 | 규칙 (파생 아트보드 · D7 톤) |
|---|---|
| A05 AMEND_PENDING | 4d 골격 + 4h 헤더. 칩 스카이. 스탬프 자리에 스카이 flat "변경 제안" 카드(전/후 행) + 하단 쌍(아웃라인 거절 / 필 승인 `check`). |
| A05 FINISH pending | 위 규칙, 비교 카드 → "마무리 요청" 스카이 카드(∞ 도트), 승인/거절 쌍. |
| A05 CHECKING | 4d 유지(스탬프 민트). 칩 핑크. 내용 위 핑크 카드: 응답 기한 카운트다운 22/800 + 필 CTA "지켜졌나요? 답하기" → A06; 응답 완료면 종이 카드 "응답 완료 · 상대 응답 대기". |
| A05 BROKEN | 4i 골격. 칩 핑크, 블롭 핑크, 헤드라인 기존 문구. 보상/벌칙 스티커 순서·크기 동일(강조 배지 없음 — §8-3). |
| A05 DISPUTED | 4i 골격. 칩 종이. 두 주장 카드 같은 종이 톤·크기·기존 순서, 아이콘·색 차이 없음(§8-4). |
| A05 UNRESOLVED | 4i 골격. 칩 뮤트, 블롭 뮤트, 주장 행 "응답 없음". |
| A05 DECLINED·CANCELED | 4h 골격에서 카운트다운 제거. 칩 뮤트, 내용 카드 뮤트(eyebrow 잉크), 스탬프·하단 버튼 없음. |
| A05 ACTIVE 무기한 | 4d. D-Day 원 스카이 `∞`. 스카이 카드 "종료일 없음 · 마무리 요청" + 필 CTA(기존 finish 플로우). |
| MOD-01 변경·파기 | 4o 시트 크롬 + 4c 필드 문법. 변경/파기 = 선택 칩 36. 필 CTA 우하단. 무기한 변형은 "종료일 없음" 칩. |
| MOD-02 증인 초대 | 4o 크롬. 자리 행 = 아바타 44 + 상태 칩(민트 완료/종이 대기), 잠긴 자리 = 뮤트 행 + 스카이 원 `redeem`. 필 CTA `person_add`. |
| MOD-05 혜택 | 4o 크롬. 혜택 행 = 스카이 원(`redeem`/`inventory_2`) + 14/700 + 12, 잠김 = 뮤트 행. 구매 필 CTA(원 테두리 없음), 규칙 14/22 secondary, 재촉 없음. |
| `/i/[token]` | 4h + W02 문법. 마스코트 타일 56, 미리보기 카드(4d 내용 + 보상/벌칙), LEGAL_DISCLAIMER 그대로, 승인 필 / 거절 아웃라인. |
| blocked-users | 4l 리스트 카드(48 행 + dashed 구분선, `block`), 해제 = 컴팩트 아웃라인. 빈 상태 = 4f 블롭. |
| profile-nickname | 4c 필드 문법(eyebrow `필수` 잉크, 입력 48, 힌트 12.5), 필 CTA, 뒤로 원. |
| update-required | 4f 빈 블롭(-2°) + 헤드라인 24/32 + 필 CTA(스토어). |
| not-found | 4f 블롭 3° + 헤드라인 + 아웃라인 "홈으로". |
| W01 초대 랜딩 | 4e: 220×200 블롭 + 눈, 헤드라인 26/34, 미리보기 카드, 카카오 54 + 구글. 광고 없음. |
| W02 약속 검토 | 4d 내용 카드 + 보상/벌칙 + 디스클레이머 + 승인 필(`check`) + 아웃라인 쌍(거절/수정 제안). 수정 제안 시트 = 4o. |
| W03 승인 완료 | 4i 스탬프(민트 블롭, 손 루프) + 지문 + 앱 설치 안내 카드(종이 flat). |
| W04 참여 약속 | 4b 행(도트 + 메타 칩) + 4d 상세. W04-finish: 스카이 마무리 카드 + 승인/거절. |
| W05 증인 확인 | 4j 선택 카드(선택 옐로) + 서명 필 CTA(`draw`). W05-no-end: ∞ 메타 칩. |
| W06 링크 만료 | 4f 블롭 + 헤드라인 + 아웃라인 CTA(스토어). 다섯 사유 문구 불변. |

### E. 자산 파이프라인

현행 `tools/export-brand-icons.js`: `brand-symbol.png`(730×458) 마스터 + `tokens.css` 색으로 ImageMagick 7(`magick`)이 런처 1024·적응형 배경/전경/모노크롬(66dp 안전원 `hypot` 검증)·인앱·스플래시 512·스토어 512(불투명)를 생성.

확장(마스터 `design-reference/assets/images/`, 색은 토큰): 런처 `icon.png` 1024 = `icon-face-e1.png` Lanczos 2배 · `android-icon-background.png` = `primary-container` 단색 · `android-icon-foreground.png` = `icon-face-e1.png`에서 옐로 바탕만 알파 제거(`-fuzz` ≤3%, 흰 블롭 경계 보호) 후 안전원 안 중앙 배치 + 기존 검증 · `android-icon-monochrome.png` = `mascot-face-e1.png` 알파를 흰색 채움 · 스플래시 `splash-icon.png` 512 = `mascot-face-e1.png`(imageWidth 76, 배경 #F3ECDC) · 알림 아이콘 = 모노크롬 재사용, `color #FFE59A` · 스토어 512 = 런처 축소 불투명 · 웹 `apps/web/public/brand/{favicon-32,favicon-192,apple-touch-icon-180,og-image(1200×630 크림 바탕 런처 480 r22%)}.png` + `index.html`/`app.html` `<link rel="icon">`·`apple-touch-icon`·`og:image`(절대 URL)+`width/height` · 인앱 4종은 도구가 `cp`로 바이트 복사, 웹 `hand-color` 402 폭만 파생. 해시 재고정: 도구 실행 → sha256 출력 → 테스트 표 갱신 → 같은 커밋(출력 인용).

아이콘 폰트(`tools/subset-icon-font.js`): ICONS 합집합(정렬) → 웹 woff2(기존) + `apps/mobile/assets/fonts/MaterialSymbolsRounded-subset.ttf`(`targetFormat:'sfnt'`, `variationAxes:{wght:400,FILL:0,GRAD:0,opsz:24}`) + 코드포인트 맵 두 벌(`packages/shared`는 동결이므로 `apps/*` 생성 사본, `tools/subset-icon-font.test.ts`가 바이트 동일 고정). 갤러리는 CDN `@import` 유지.

### F. 리스크

| 리스크 | 대응 |
|---|---|
| Android elevation ≠ 오프셋 스티커 그림자 | 현행 근사(elevation 1/8/12) 유지, 파스텔 톤 카드 4종 실기기 확인, `flat`은 0. |
| 글꼴 배율 1.5에서 필 CTA/트레일링 원 리플로 | `minHeight`만 잠금, `numberOfLines` 금지, 원 `alignSelf:'center'`; 배치마다 1.5 스크린샷. |
| PNG 마스코트 30dp에서 손 ≈10dp | 512 마스터 유지(3× 밀도 90px) — 실기기 확인, 흐리면 crop 자산 검토(PO 통보). |
| 서브셋 TTF 가변 축 | `variationAxes` 핀 정적화, 테스트가 `fvar` 부재 고정. |
| Reanimated 무한 루프 배터리/접근성 | 화면당 루프 1개, reduced motion 정지, blur 시 `cancelAnimation`, UI 스레드 전용. |
| 갤러리·웹 CSS 드리프트 | `tokens.test.ts`에 reference↔web 바이트 동일 단언(P3), `/* WEB ONLY */` 구획 양쪽 동일. |
| 오픈 테스팅 심사 진행 중 | 코드 21 AAB는 제출 완료. `app.json` version·아이콘은 P8에서만, EAS 프로덕션 빌드는 PO 신호 후. P3~P7 웹 배포 보류. |
| 웹 CLS/성능 | preload·`font-display:block` 유지, 마스코트 `<img width/height>`, hand-color 402, `seo.test.ts` 고정. |
| 뮤트 표면 보조 글자 대비(4.34/4.41) | 뮤트 카드 eyebrow·메타 잉크 — ADR 편차. |
| 토큰 삭제 전 소비자 누락 | 삭제는 P7 마지막; typecheck + 갤러리 육안(투명 배경). |

### G. 세션 분할 · 핸드오프

핸드오프: `docs/handoff/YYYY-MM-DD-pastel-restyle-sN.md`, **항상 하나** — 새 파일 커밋에서 직전 삭제(첫 세션은 `2026-09-03-open-testing-release.md` 대체; durable 내용은 STATUS에 있음). Kakao findings 파일은 참조 예외. 6항목(목표/상태, 파일, 결정, 검증, PO 항목, 다음 단계) 그대로.

| 세션 | 범위 | 종료 기준 |
|---|---|---|
| S1 | P0·P1·P2 | 세 러너 통과, 토큰 183, 아이콘 TTF·맵 생성, 갤러리 색 스왑 3장 + 포커스 링 통보 |
| S2 | P3·P4 배치 1 | CSS 재작성 + 웹 사본, 확정안 15면, 체크포인트 1 제시 |
| S3 | P4 배치 2·3 | 확장 18면 + 웹 8면, 체크포인트 2·3. **컨펌 없이 S4 금지** |
| S4 | P5 | components.test 이동, 구 자산 삭제, jest 통과, A02·A08 실기기 |
| S5 | P6 배치 A | 6화면, 스크린샷(정상/1.5), 문구 단언 이동 목록 |
| S6 | P6 배치 B | 5화면 + 시트 2 |
| S7 | P6 배치 C | A05 전 변형 + 시트 3 + 지원 5, DISPUTED 동일 톤 명시 |
| S8 | P7 | 웹 8경로 빌드 스크린샷, 파비콘/OG, 토큰 174, 웹 배포 보류 해제 요청 |
| S9 | P8·P9 | 파생물·해시, ADR 0019, DESIGN.md, STATUS, CLAUDE.md 동기화, 플랜 삭제, 마지막 핸드오프 |

각 세션은 70% 컨텍스트 규칙을 따른다 — 배치 도중이면 그 화면까지만 마치고 핸드오프에 "다음 화면 = X, 갤러리 HTML = Y, 옮겨야 할 테스트 = Z:줄"을 적는다.

## 6. 전체 검증 (완료 판정)

1. `npm run typecheck`(5 프로젝트) · `npx vitest run` · `cd apps/mobile && npx jest` · `npm run check:agents` · `npm run build:web` · `git diff --check` — 전부 통과, 수치 인용.
2. 갤러리 41면 Chrome MCP 감사: 콘솔 경고 0, 가로 오버플로 0, 확정안 15쌍 나란히 캡처 일치.
3. 실기기(360×800, 글꼴 배율 1.0/1.5): A00~A09·MOD-01~05·`/i/[token]`·지원 화면 스크린샷, 하단 탭 없음·플로팅 CTA·마스코트·루프 애니메이션·reduced motion 정지 확인.
4. 웹 8경로 프로덕션 빌드 스크린샷 + OG 카드, `seo.test.ts` 통과.
5. 불변식 재확인: 광고 비활성 시 무렌더 · LEGAL_DISCLAIMER 5곳 verbatim · DISPUTED 동일 톤 · 48dp · 상태 = 도트+텍스트.
6. 문서: ADR 0019 · DESIGN.md · DEVELOPMENT_STATUS · CLAUDE.md/AGENTS.md 동기화 · `docs/plans` 삭제 · 핸드오프 1개.

## 7. 다음 단계

계획 승인 후 S1(P0→P1→P2)부터 시작. 첫 실행 확인 항목: `design_handoff_develop` 삭제 커밋 여부, zip 삭제 여부.
