# littlefinger 반영 가이드 — Fresh Green (#00BF40)

Claude Design 확정안 "개선안 A-G1 프레시 그린" (Wanted Design System 기반)을
littlefinger 저장소에 반영하는 파일 2개.

## 적용 방법

1. `tokens.css` → `design-reference/styles/tokens.css` 를 통째로 교체.
   - 변수명(역할)은 기존과 동일 — 27개 화면 HTML과 RN 포팅 표(04 §4) 그대로 호환.
   - 색만 핑키 로즈 → Wanted 그린/뉴트럴로 재정의. 타이포·스페이싱·사이즈 불변.
   - radius(md/xl/2xl)와 elevation, motion 값이 Wanted 기준으로 소폭 조정됨.
2. `contrast-patch.css` → `design-reference/styles/` 에 추가하고,
   각 화면 HTML의 `components.css` link 다음 줄에 로드
   (또는 내용을 `components.css` 맨 끝에 붙여넣기).
   - 그린 틴트 배경 위 그린 텍스트(알림 pill · 임박 D-Day · 안읽음 헤드라인)의
     가독성 보정 3건.

## 주요 토큰 변경 요약

| 역할 | 기존 (핑키) | 변경 (프레시 그린) |
|---|---|---|
| primary | #C74B64 | #00BF40 (green-50) |
| primary-container | #FFD9DE | #DBFBE5 (green-95) |
| on-primary-container | #400A18 | #02220C (green-0) |
| primary-ink | #7A4A52 | #006420 (green-20) |
| background | #FFF8F8 | #FFFFFF |
| surface-muted | #F4E4E7 | #F7F7F8 |
| outline | #F6E0E3 | rgba(112,115,124,.22) |
| text | #22191A | #171719 |
| reward | 오렌지 컨테이너 | 블루(informative) — 그린과 분리 |
| error | #8C1D18 | #C81616 |

호버/프레스 관례: primary hover #00A435 · pressed #008629 (Wanted "darken" 규칙).
