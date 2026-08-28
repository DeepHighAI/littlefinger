# 셋로그 리스타일 패키지 — "잉크 & 스티커" (시안 1a, PO 컨펌 2026-08-27)

design-reference 위에 그대로 덮어쓸 수 있는 폴더 구조입니다. 컨펌된 6개 화면
(A00·A01·A02·A03·A05 ACTIVE·A08)과 토큰 전면 교체가 들어 있습니다.

## 적용 방법

1. `styles/tokens.css` → `design-reference/styles/tokens.css` 덮어쓰기 (토큰 이름·개수 동일, 값만 교체)
2. `styles/setlog-restyle.css` → `design-reference/styles/`에 추가
3. `screens/app/*.html` 6개 → 같은 경로에 덮어쓰기 (변경: setlog-restyle.css 링크 추가, 마스코트/두들 svg, A03 타자기 인트로 한 줄. 클래스·역할·라벨·구조는 그대로)
4. 나머지 21개 화면 + 수락 웹(W01~06)은 **토큰만으로도 새 팔레트·서체를 자동 상속**합니다.
   잉크 테두리·스티커 룩까지 받으려면 각 화면 head에 setlog-restyle.css 링크 한 줄만 추가하면 됩니다
   (setlog-restyle.css는 화면 전용 클래스가 아니라 공용 lf-* 클래스만 다루므로 전 화면 공용).
5. 미리보기: `npm run preview` 후 갤러리에서 육안 대조.

## 미러링 (기존 규칙대로)

- `apps/mobile/src/theme/tokens.ts` — px=dp 1:1, 섀도는 객체로. 토큰 개수 불변이므로
  `tokens.test.ts`는 값 스냅샷·대비 검증만 의도적으로 함께 이동.
- `apps/web/src/styles/tokens.css` — byte-equal 복사.
- setlog-restyle.css 규칙은 본 적용 시 components.css에 병합 권장 (오버라이드 레이어는 프리뷰 편의용).

## 팔레트 매핑 요약

| 역할 | 기존 (Pine A안) | 신규 (잉크 & 스티커) |
|---|---|---|
| primary / 강조 | Pine `#0B6B4B` | 잉크 `#221C13` |
| action-fill CTA | `#78CEA5` | 검정 필 `#221C13` / on `#FFFDF4` |
| primary-container | Mint `#E7F4ED` | 버터 스티커 `#F6E7A3` |
| record / 보상 | Blue `#466FA8` / `#EAF1FB` | 라벤더 `#6B58A8` / `#E7DFF6` |
| attention / 벌칙 | `#B86A24` / `#FFF1E6` | `#B05F2C` / 살구 `#F8DDBE` |
| background / surface | `#F7F8F6` / `#FFFFFF` | 크림 `#F3ECDC` / `#FFFDF4` |
| success | Pine 재사용 | 잉크 + 버터 (상태는 텍스트가 구분 — §8 유지) |
| error | `#C4433B` 유지 | 유지 (BROKEN·파기 전용) |
| 카카오/구글 버튼 색 | 공식 가이드 | 변경 없음 (형태만 필 + 잉크 테두리) |

## 서체

- `--lf-font-brand`: **Gaegu** (400/700, Google Fonts, OFL) → Pretendard 폴백.
- RN에서는 `@expo-google-fonts/gaegu` 사용. weight 800은 700으로 수렴(`--lf-weight-heavy: 700`).
- 가독을 위해 타입 스케일을 한 단계씩 상향 (body 14→15 등). 폰트 스케일 1.5 리플로우 규칙 동일.

## 유지된 불변 조건

상태 텍스트 병기(색 단독 금지) · 48dp 터치 타깃 · DISPUTED 양측 동등(잉크 모노가 오히려 유리) ·
디스클레이머 문구 불변 · 광고 슬롯 위치·비활성 표기 · 계약서 메타포 금지(스탬프는 손그림 스티커로 표현).

## 남은 작업 (별도 컨펌 항목)

- A05 나머지 8개 상태 변형·모달 4종·수락 웹의 화면별 두들/스티커 디테일
- 아이콘: Material Symbols 유지 중 — 손그림 스트로크 아이콘 세트로 교체 여부
- Promise Seam 등 모션의 스티커 스타일 재해석
