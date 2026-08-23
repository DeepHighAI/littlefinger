# Historical migration guide — Fresh Green (superseded)

This folder preserves the earlier "Fresh Green" migration artifact. It is not the current design
guide. The PO-approved full-product baseline is A — **Pine Anchor · Warm Promise · Blue Record** —
in repository `DESIGN.md` and ADR 0008.

## 적용 상태

Fresh Green was once applied to canonical tokens, then superseded on 2026-08-23. This directory
remains a historical proposal artifact and is not a runtime or regression-test input.

Current core roles: Pine `#0B6B4B`, Action `#78CEA5`, Record Blue `#466FA8`, Apricot `#FFF1E6`,
Canvas `#F7F8F6`, and Danger `#C4433B`. Do not copy the values below into current code.

반영 내용:

1. `tokens.css`의 역할 값을 canonical 토큰으로 승격.
   - 변수명(역할)은 기존과 동일 — 27개 화면 HTML과 RN 포팅 표(04 §4) 그대로 호환.
   - 색만 핑키 로즈 → Wanted 그린/뉴트럴로 재정의. 타이포·스페이싱·사이즈 불변.
   - radius(md/xl/2xl)와 elevation, motion 값이 Wanted 기준으로 소폭 조정됨.
2. `contrast-patch.css` 내용을 canonical `components.css`에 병합.
   - 그린 틴트 배경 위 그린 텍스트(알림 pill · 임박 D-Day · 안읽음 헤드라인)의
     가독성 보정 3건.

## Historical token-change summary

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

호버/프레스 관례: primary hover #00A435 · pressed #009933. 세 상태 모두 어두운
전경색과 WCAG AA 4.5:1 이상을 유지한다.
