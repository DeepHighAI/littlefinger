# Handoff: 셋로그 "잉크 & 스티커" 리스타일 → littlefinger 코드 반영 (Claude Code용)

## Overview
littlefinger(상호 약속 기록 앱)의 승인 리스타일. PO가 컨펌한 방향은 **잉크 & 스티커**
(크림 배경 #F3ECDC · 잉크 #221C13 · 버터/라벤더/살구 스티커 · 검정 필 CTA · Gaegu 손글씨 ·
잉크 테두리 스티커 카드). 컨펌 범위: SCR-A00·A01·A02·A03·A05(ACTIVE)·A08 + 토큰 전면 교체.

## About the Design Files
이 번들의 HTML/CSS는 **디자인 레퍼런스**다 — 프로덕션 코드가 아니다. 작업은 이 레퍼런스를
littlefinger 저장소의 기존 환경(React Native + Expo 앱, Vite 수락 웹)에 **기존 패턴 그대로**
재구현하는 것이다. 저장소 규칙이 이 문서보다 우선한다: 루트 `CLAUDE.md`(작업 규칙),
`DESIGN.md`(디자인 계약), `docs/ui-restyle-brief.md`(리스타일 절차·freeze list)를 먼저 읽을 것.

## Fidelity
**High-fidelity.** 색·서체·테두리 두께·라운드·섀도 값은 최종값이다. 픽셀 대조 기준은
`design-reference` 갤러리(`npm run preview` → http://localhost:4173).

## 반영 절차 (저장소 워크플로 기준)

1. **브랜치**: `feature/paid-slots-and-ads`에서 분기.
2. **레퍼런스 교체**: 이 번들의 `styles/tokens.css` → `design-reference/styles/tokens.css` 덮어쓰기.
   `styles/setlog-restyle.css` 추가 후 규칙을 `design-reference/styles/components.css`에 **병합**
   (오버라이드 파일은 프리뷰 편의용 — 정본은 components.css 하나). `screens/app/` 6개 HTML 덮어쓰기.
3. **토큰 미러 (3-target 규칙)**:
   - `apps/mobile/src/theme/tokens.ts` — px=dp 1:1, 섀도는 RN shadow 객체
     (오프셋 스티커 섀도: `{shadowOffset:{width:3,height:4}, shadowRadius:0, shadowOpacity:0.14, shadowColor:'#221C13'}` + Android `elevation` 대응), easing은 bezier 배열.
   - `apps/web/src/styles/tokens.css` — byte-equal 복사.
   - `tokens.test.ts`는 토큰 개수·이름 불변이므로 값 스냅샷·WCAG 검증만 **의도적으로 함께 이동**
     (완화 금지). 대비 주의점: 새 팔레트에서 본문 텍스트는 항상 잉크(#221C13)/secondary — AA 여유 큼.
     muted(#9A8E75) on 크림은 대형/보조 텍스트 전용으로 유지할 것.
4. **서체**: `@expo-google-fonts/gaegu` (400·700) 로드, `--lf-font-brand` 매핑. weight 800 사용처는
   700으로 수렴(`--lf-weight-heavy: 700`). 웹은 tokens.css의 Google Fonts @import가 처리.
   폰트 스케일 1.5 리플로우 검증 필수 (Gaegu는 자간이 넓어 D-day 뱃지·칩에서 잘림 주의).
5. **컴포넌트 (Lf\*) 프리젠테이션 업데이트** — variant 시스템은 그대로, 스타일 값만:
   - LfButton: filled=잉크 필+스티커 섀도, outlined/tonal/kakao=2.2~2.5 잉크 테두리, 필 형태 유지.
   - LfChip: 2px 잉크 테두리 + 톤별 스티커 배경 (status/done=버터, info=라벤더, urgent=살구).
   - LfSwitch: 잉크 테두리, on=버터 트랙+잉크 노브.
   - 카드/스탬프/임박 배너: 2.2~2.5px 잉크 테두리, radius 16~18, 스티커 섀도,
     스탬프 -0.8deg·배너 -1.2deg 회전(`transform: rotate`).
   - 홈 행(SCR-A02): 헤어라인 풀폭 행 → 스티커 카드 행(마진 16, 테두리, D-day 라벤더 원형 뱃지).
   - FAB: 하단 중앙 정렬로 변경 (기존 우하단).
6. **마스코트·두들**: `screens/app/scr-a01-login.html`·`scr-a00-onboarding.html`의
   `.sl-mascot`/`.sl-doodles` SVG를 `react-native-svg` 컴포넌트로 이식. 색은 하드코딩 금지 —
   토큰 참조(본체=primary-container, 선=text, 라벤더=reward-container). 장식은
   `accessibilityElementsHidden`/`importantForAccessibility='no-hide-descendants'` 처리.
7. **A03 타자기 인트로**: `→ 새로운 약속을 적어볼까요?` 한 줄 (mono 토큰, 장식 텍스트).
   카피 추가이므로 `Localized<T>` 카탈로그(`src/screens/*-labels.ts` + labels-registry) 경유 — 하드코딩 금지.
8. **검증 루프**: `npm run typecheck` · `npx vitest run` · `cd apps/mobile && npx jest` 모두 그린.
   시맨틱 컬러를 고정한 jest assert(예: D-day=success 토큰)는 새 토큰값으로 갱신.
   `npm run preview`로 레퍼런스와 육안 대조. 완료 시 ADR 기록 + `DESIGN.md` 팔레트 절 갱신.

## Freeze list (건드리지 않는다)
`packages/shared/**` · `supabase/**` · `apps/mobile/src/lib/**` · `src/screens/*-state.ts` ·
내비게이션 라우트/`_layout.tsx` · 접근성 role/label·testID·핸들러·조건부 렌더링 로직.
불변 조건: 상태는 항상 텍스트 병기 · 48dp 터치 타깃 · DISPUTED 양측 시각 동등 ·
`LfDisclaimer` 문구 불변 · 광고 슬롯은 A02/A07/A08만, 비활성 시 공간 미예약 · 계약서 메타포 금지.

## Design Tokens
정본은 이 번들 `styles/tokens.css` (토큰 이름·개수는 기존과 동일, 값만 교체).
매핑 요약과 근거는 `README.md`의 팔레트 매핑표 참조.

## 미컨펌 항목 (구현하지 말 것 — 별도 PO 컨펌 필요)
- A05 나머지 8개 상태 변형·MOD-01~04·수락 웹(W01~06)의 화면별 두들/스티커 디테일
  (토큰 상속으로 팔레트·서체는 자동 반영됨 — 그 상태까지가 현재 승인 범위)
- Material Symbols → 손그림 스트로크 아이콘 교체
- Promise Seam 모션 재해석

## Files
- `styles/tokens.css` — 교체용 토큰 정본
- `styles/setlog-restyle.css` — 컴포넌트 오버라이드 (components.css 병합 대상)
- `screens/app/*.html` — 컨펌 6화면 레퍼런스
- `index.html` — 6화면 미리보기 갤러리
- `README.md` — 적용 절차·팔레트 매핑표·서체 노트
- `screenshots/*.png` — 컨펌 6화면 렌더 스크린샷 (픽셀 대조용)
- 그 외 styles/·assets/·screens/frame.js — 원본과 동일(자급자족 프리뷰용)

## Claude Code에 붙여넣을 프롬프트 (예시)

```
docs/디자인/에 setlog-restyle 번들을 풀어뒀어. HANDOFF-CLAUDE-CODE.md를 읽고
그 절차대로 "잉크 & 스티커" 리스타일을 반영해줘. 순서: (1) design-reference에
번들 반영 + setlog-restyle.css를 components.css에 병합, (2) tokens.ts / 웹 tokens.css
미러 + tokens.test.ts 이동, (3) Gaegu 폰트 로드, (4) Lf* 컴포넌트와 컨펌 6화면
(A00·A01·A02·A03·A05 ACTIVE·A08) 프리젠테이션 업데이트. freeze list와 미컨펌 항목은
절대 건드리지 마. 매 단계 typecheck·vitest·jest 그린 확인하고 출력 인용해서 보고해.
```
