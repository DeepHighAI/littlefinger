# design-reference/ — 확정 UI의 시각 기준

기본적으로 이 디렉터리는 구현 이식 중 **읽기 전용**이다. 단 PO가 비교 시안을 승인하고 그
변경을 `DESIGN.md`와 ADR에 기록한 전역 리스타일은 새로운 기준선을 만드는 명시적 예외다.
현재 기준선은 A — **Pine Anchor · Warm Promise · Blue Record**다. 임의 수정은 여전히 금지한다.

| 경로 | 내용 |
|---|---|
| `screens/app/` | 안드로이드 앱 화면 21개 — React Native 이식의 시각 기준 |
| `screens/web/` | 수락 웹 화면 6개 — Vite JSX 변환의 원본 |
| `styles/` | `tokens.css`(디자인 토큰 115종) · `base.css` · `components.css`(`lf-*` 110개) · `screens/` |
| `assets/fonts/` | `PretendardVariable.woff2` — **웹 전용.** 앱은 정적 `.ttf` 4종이 따로 필요하다(§5-4) |
| `concept-4.html` | Claude Design 원본 캔버스 |
| `serve.js`, `index.html`, `docs/flows.html` | 미리보기 서버·갤러리·플로우 연결도 |

```bash
node design-reference/serve.js
```

이식 중에는 `http://localhost:4173/`의 갤러리가 **정답지**다. 색상 역할과 화면별 적용 규칙은
루트 `DESIGN.md`를 함께 따른다.

---

## `concept-4.html` — Claude Design 원본

Claude Design 프로젝트 *리틀핑거 모바일 UI 컨셉안*에서 내보낸
`리틀핑거 UI 컨셉 4안.dc.html` 원본이다.

### 이 파일 하나로는 브라우저에서 렌더되지 않는다

원본은 Claude Design 캔버스 런타임에 의존한다. 함께 있어야 하는 파일들:

| 파일 | 역할 | 여기 없는 이유 |
|---|---|---|
| `support.js` | `<x-dc>` · `<x-import>` · `<sc-if>` · props를 해석하는 캔버스 런타임 (React 기반, 생성 파일) | 뷰어 도구일 뿐 디자인 내용이 아니다. `screens/frame.js`가 그 역할을 대체한다 |
| `colors_and_type.css` | Material 3 기본(퍼플) 토큰 | `styles/tokens.css`로 옮긴 뒤, 현재는 승인된 A 역할 팔레트로 재정의했다 |
| `android-frame.jsx` | 안드로이드 디바이스 프레임 컴포넌트 | `styles/base.css`의 `.lf-device` + `frame.js`로 재구현했다 |
| `fonts/PretendardVariable.woff2` | 브랜드 서체 | `assets/fonts/`에 있다 |

원본을 그대로 보려면 Claude Design 프로젝트에서 연다.
구현본을 보려면 `node design-reference/serve.js` 후 `http://localhost:4173/`.

### 문서 안에 두 개의 라운드가 들어 있다

- **Turn 1** (파일 아래쪽, `id="t1"`) — 컨셉 4안 비교: `1a` 도구처럼 / `1b` 빨간 실 / `1c` 약속 금고 / `1d` 핑키
- **Turn 2** (파일 위쪽, `id="t2"`) — **`1d` 핑키 확정** 후 요청서 §5 전체 화면으로 전개한 결과

구현은 **Turn 2**를 따랐다. 단 `SCR-A01 로그인`만은 Turn 2에서 다시 그리지 않아
Turn 1의 `1d` 버전(원본 1572–1591행)을 기준으로 삼았다.
