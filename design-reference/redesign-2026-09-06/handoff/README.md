# 리틀핑거 리디자인 핸드오프 — 잉크 & 블록 (시안 1a, 2026-09-06)

## 구성

| 경로 | 내용 |
|---|---|
| `리틀핑거 리디자인 · 인덱스.dc.html` | 시작점. 모든 화면·가이드 링크 |
| `리틀핑거 스타일 가이드.dc.html` | 원칙 · 색 · 타이포 · 선/모서리/그림자 · 컴포넌트 · 상태 매핑 · 모션 · **tokens.css 값 교체표** · `lf-*`/`Lf*` 변경 요점 |
| `리디자인 01 · 진입·홈·작성·초대.dc.html` | SCR-A00·A01(기존 유지) · A02 홈/빈 상태 · A03 · A04 · SCR-I |
| `리디자인 02 · 약속 상세.dc.html` | SCR-A05 7상태 · SCR-A06 |
| `리디자인 03 · 알림·마이·모달.dc.html` | SCR-A07 · A08 · A09 · 메뉴 시트(신규) · MOD-01~05 |
| `리디자인 04 · 수락 웹.dc.html` | SCR-W01 · W02 · W03 · W05 · W06 |
| `리틀핑거 홈 리디자인.dc.html` | 시안 비교 보드 (현재 · 1a · 1b) — 아카이브 |
| `handoff/tokens.css` | **개발 반영용 토큰 파일.** `design-reference/styles/tokens.css`를 이 파일로 교체 → `apps/mobile/src/theme/tokens.ts`, `apps/web/src/styles/tokens.css`에 동일 반영 |
| `assets/` | `PretendardVariable.woff2` · `mascot-face-e1.png` · `eyes-e1.png` · `hand-solid.png` · `hand-color.png` · `brand-symbol.png` (레포와 동일 파일) |
| `support.js` | `.dc.html` 미리보기 런타임 (디자인 내용 아님) |

`.dc.html`은 같은 폴더의 `support.js`와 `assets/`가 있어야 브라우저에서 열린다. 폴더 구조를 유지한 채 열면 된다.

## 핵심 규격 (요약)

- **잉크** `#221C13` · 종이 `#FFFDF4` · 캔버스 `#FBF8F1` · 뮤트 `#EFE9DC` · 보조 텍스트 `#6F6552`
- **4색** 옐로 `#FFD43B`(브랜드·선택) · 민트 `#5FD3A5`(진행·완료) · 핑크 `#FF6F91`(마감·응답·벌칙) · 스카이 `#6CB4FF`(기록·보상·변경). 글자는 항상 잉크
- **테두리** 2px(칩·입력·타일) / 2.5px(카드·버튼·시트)
- **그림자** `5px 5px 0 #221C13`(카드·CTA·헤더) / `3px 3px 0`(탭 선택·outlined·kakao·피커) / 없음(flat·시트·입력). 눌림 = translate(3,3) + 그림자 2
- **모서리** 8(상태 칩) · 10(탭·입력·타일·사각 버튼) · 14(카드·CTA) · 20(시트) · 999(헤더 필·아바타)
- **헤더** 흰 필 52h, margin 8 16 0. 홈: 옐로 원 마스코트 34 + 워드마크 22/900/-0.04em + "메뉴 ☰". 하위: 사각 뒤로 36 + 제목 16/800 + 액션
- **타이포** Pretendard 500/600/800/900. headline 30/36 · title 24/30 · body 15/22/600 · label 14/800 · meta 12/600 · eyebrow 11/800/.12em
- **마스코트** 기존 E-1(동그란 얼굴 + 맞닿는 새끼손가락 C-1 루프) 유지. 정원(999) + 2.5 잉크 + 5px 그림자

## 불변 규칙 (DESIGN.md §8)

48dp 터치 타깃 · 상태는 색+텍스트 병기 · DISPUTED 양측 동일 무게, 판정 암시 금지 · 디스클레이머 문구 불변 · 광고 슬롯 비활성 시 공간 없음 · 카카오/Google 공식 버튼 색 유지 · 빨강은 오류 전용

## PO 컨펌 필요 항목

1. 홈 앱바 종·아바타 → "메뉴" 시트 통합 (라우팅 동일, 진입점만 이동)
2. 리스트 행 상태 도트 → 40px 상태 타일 (`LfStatusDot` → `LfStatusTile`)
3. 스티커 틸트 폐지 (`--lf-tilt-*` = 0)
4. 파스텔 4색 채도 상향 (역할 동일)
5. 필 버튼 → r14 블록 버튼 (`.lf-fab` 풀폭)

## 미포함 화면

A05 no-end · declined · finish-pending · unresolved, blocked-users, profile-nickname, not-found, update-required, W04 — 스타일 가이드 §5 컴포넌트로 조합 가능.

## 검증 체크리스트

① `tokens.test.ts` 카운트 +2(`--lf-elevation-sm`, `--lf-type-appbar-size`), 바이트 동일성 재고정 ② 4색 위 잉크 대비 ≥ 4.5 ③ jest 롤·라벨 스냅샷 변경 없음 ④ 48dp 터치 ⑤ DISPUTED 양측 동일 톤 ⑥ 광고 비활성 시 공간 0 ⑦ 디스클레이머 diff 없음
