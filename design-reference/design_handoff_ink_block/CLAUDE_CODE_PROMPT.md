# Claude Code 시작 프롬프트

아래를 그대로 붙여 넣는다. 번들 폴더는 레포 루트에 `design_handoff_ink_block/`으로 두었다고 가정한다.

---

littlefinger 모노레포에 "잉크 & 블록" 리스타일을 적용해. 근거 문서는 `design_handoff_ink_block/README.md`이고, 시각 기준은 `design_handoff_ink_block/design/*.dc.html`(브라우저로 열어 확인)이다. 이 파일들은 디자인 참조이며 코드로 복사하지 않는다.

먼저 읽을 것: `AGENTS.md`(또는 `CLAUDE.md`), `DESIGN.md`, `docs/ui-restyle-brief.md`, `design_handoff_ink_block/README.md`.

규칙:
- 기능·라우팅·서버 계약·라벨 카탈로그·접근성 롤/testID는 바꾸지 않는다. 시각만 바꾼다. 프리즈 목록(`packages/shared`, `supabase`, `apps/mobile/src/lib`, `*-state.ts`, `_layout.tsx`, 앱 설정)은 건드리지 않는다.
- 디자인 리터럴 금지. 값은 토큰으로만. 토큰은 `design-reference/styles/tokens.css` → `apps/mobile/src/theme/tokens.ts` → `apps/web/src/styles/tokens.css` 3곳에 같은 변경 세트로 반영한다.
- SCR-A00 온보딩, SCR-A01 로그인은 화면 구조를 유지한다(토큰 변경만 반영, 블롭 틸트 -2° 유지).
- 광고 슬롯은 비활성이면 렌더하지 않는다. DISPUTED는 판정을 암시하지 않는다. 디스클레이머 문구는 불변.

작업 순서:
1. `design_handoff_ink_block/tokens.css`로 `design-reference/styles/tokens.css`를 교체하고, RN 토큰(`tokens.ts`)과 웹 토큰에 동일 반영. 신설 토큰 `--lf-elevation-sm`, `--lf-type-appbar-size` 포함. `apps/mobile/src/theme/tokens.test.ts`의 카운트·바이트 동일성·대비 검사를 의도적으로 갱신(완화 아님).
2. README "컴포넌트 변경표"대로 `design-reference/styles/components.css`와 `apps/mobile/src/components/Lf*.tsx`, `apps/web`의 공유 클래스를 수정. 새 컴포넌트: `LfStatusTile`(상태 도트 대체), 홈 메뉴 시트.
3. README "화면별 변경"대로 SCR-A02 → A09, MOD-01~05, SCR-I, W01~W06 화면을 수정. `design-reference/screens/**` 갤러리 HTML도 같은 변경으로 갱신해 새 기준선을 만든다.
4. `npm run preview`로 갤러리를 띄우고 각 화면을 `design/리디자인 0N….dc.html`과 나란히 비교해 차이를 잡는다.
5. `npm run typecheck`, `npx vitest run`, `cd apps/mobile && npx jest` 모두 그린 확인. 결과 출력을 그대로 보고한다.
6. `docs/adr/0020-ink-and-block-restyle.md` 작성(결정·근거·예외·PO 컨펌 항목), `DESIGN.md`의 색·형태·그림자 절 갱신.

PO 컨펌이 필요한 6개 항목(README 참조)은 구현 전에 프리뷰 스크린샷과 함께 먼저 제시하고 컨펌을 받은 뒤 진행한다. 커밋은 영어 명령형 `type: description`(≤72자), 코드 주석은 한국어, 푸시·배포·릴리스 빌드는 하지 않는다.
