# 리틀핑거 (Little Finger)

두 사람이 합의한 약속을 기록하고, 잊지 않게 하고, 지켜지도록 돕는 상호 약속 관리 서비스.
일정 조율 앱이 아니라 **합의 내용 그 자체**를 기록하는 앱이다. 브랜드 모티프는 새끼손가락 걸기.

## 현재 단계: 이식 대기

Claude Design에서 확정된 "핑키" 컨셉을 프레임워크 없는 HTML/CSS 화면 라이브러리로 구현해 두었고
(27개 화면), 앱 프레임워크(오픈 포인트 N-3)가 **확정됐다.**

| 항목 | 확정 |
|---|---|
| 앱 (SCR-A*, MOD-*) | **React Native + Expo SDK 57** (RN 0.86) · TypeScript · Expo Router |
| 수락 웹 (SCR-W*) | **Vite + React + React Router** — 지금의 CSS를 그대로 재사용 |
| 백엔드 | **Supabase Free** (Postgres · Auth · Storage · Edge Functions · pg_cron) |
| 웹 호스팅 | **Cloudflare Pages** |

전부 무료 플랜으로 운영 가능하고, 광고 수익 모델에서도 약관 위반이 없는 조합이다.
결정 근거는 [03_기술스택_비교분석](docs/기획/03_기술스택_비교분석.md),
이식 규칙은 [04_AI-Agent_코딩가이드](docs/기획/04_AI-Agent_코딩가이드.md),
배경은 [ADR 0002](docs/adr/0002-react-native-expo-and-port-strategy.md).

**다음 작업은 이식이다.** 앱은 이 HTML/CSS를 React Native로 옮기고, 수락 웹은 CSS를 그대로
Vite 프로젝트로 옮긴다. 이 저장소의 화면 라이브러리는 이식이 끝나면 `design-reference/`로
이동해 **읽기 전용 시각 기준**이 된다. 이식 규칙(토큰 변환 표, 컴포넌트 매핑, 폰트·아이콘
주의점)은 04 문서 §3~§5에 전부 있다. 추측하지 말고 그 문서를 따른다.

## 미리보기

```bash
node tools/serve.js
```

| 주소 | 내용 |
|---|---|
| `http://localhost:4173/` | 전체 화면 갤러리 (27개 화면) |
| `http://localhost:4173/docs/flows.html` | 화면 간 플로우 연결도 |

의존성이 없다. Node만 있으면 된다. **이식 중에는 이 갤러리가 정답지다** — 옮긴 화면과
원본을 나란히 놓고 눈으로 대조한다.

## 구조 (현재)

```
littlefinger/
├── index.html                 # 화면 갤러리
├── src/
│   ├── types/promise.ts       # 도메인 계약 — 상태·역할·라벨·정책 상수
│   ├── styles/
│   │   ├── tokens.css         # 핑키 디자인 토큰 (색·타입·형태·여백·모션)
│   │   ├── base.css           # 리셋 + 디바이스 프레임 + 화면 레이아웃
│   │   ├── components.css     # 공용 lf-* 컴포넌트 (111개 클래스)
│   │   └── screens/           # 화면군별 보조 스타일
│   └── screens/
│       ├── app/               # 안드로이드 앱 화면 (SCR-A*, MOD-*) → RN 이식 대상
│       ├── web/               # 수락용 웹 화면 (SCR-W*) → Vite로 이동, CSS 그대로
│       └── frame.js           # 상태 표시줄·제스처 바 주입 (미리보기 전용, 이식 시 제거)
├── docs/
│   ├── 기획/                  # 01 상위기획서 · 02 세부기능명세서 · 03 기술스택 · 04 코딩가이드
│   ├── 디자인/                # 01 와이어프레임 디자인요청서
│   ├── adr/                   # 구현 결정 기록
│   ├── flows.html             # 플로우 연결도
│   └── _archive/              # 구버전 문서 (읽지 않는다)
├── design/concept-4.html      # Claude Design 원본 (읽기 전용)
├── tools/
│   ├── serve.js               # 정적 미리보기 서버
│   └── sync-agent-docs.js     # CLAUDE.md → AGENTS.md 동기화
├── CLAUDE.md                  # AI 에이전트 지침 (원본)
└── AGENTS.md                  # 위와 동일 내용 — Codex Agent 용, 자동 생성
```

`CLAUDE.md`와 `AGENTS.md`는 헤더 3줄만 다르고 나머지는 완전히 같다. **`CLAUDE.md`만 고치고**
`npm run sync:agents`로 재생성한다. `npm run check:agents`는 어긋나 있으면 실패한다.

## 구조 (이식 후 목표)

```
littlefinger/                  # npm workspaces
├── packages/shared/           # 앱·웹이 공유하는 유일한 코드 (플랫폼 API import 금지)
├── apps/mobile/               # Expo — 앱 화면
├── apps/web/                  # Vite — 수락 웹 (지금의 CSS 그대로)
├── supabase/                  # migrations + Edge Functions
└── design-reference/          # 지금의 HTML/CSS (읽기 전용)
```

## 화면 인벤토리

기준 뷰포트 360×800dp. **CSS의 px 값은 React Native의 dp와 1:1로 같다** — 이식 시 숫자를
그대로 옮긴다. SCR-ID는 디자인요청서 §5와 1:1로 대응한다.

**수락용 웹 (SCR-W)** — 카톡 인앱 브라우저, 광고 전면 금지, 3분 완주 목표
W01 초대 랜딩 · W02 약속 검토 · W03 승인 완료 · W04 참여 약속 열람·응답 · W05 증인 확인 · W06 링크 무효·만료

**안드로이드 앱 (SCR-A)**
A00 온보딩 · A01 로그인 · A02 홈(+빈 상태) · A03 약속 작성 · A04 초대 전송·대기 ·
A05 약속 상세 **9개 상태 변형** · A06 이행 확인 입력 · A07 알림함 · A08 마이·약속 지킴율

**모달 (MOD)**
MOD-01 변경·파기 요청 · MOD-02 증인 초대 · MOD-03 완료 축하

## 약속 생애주기

```
DRAFT → PENDING → ACTIVE → CHECKING → COMPLETED | BROKEN | DISPUTED | UNRESOLVED
                     ↕                      ↑          
              AMEND_PENDING → CANCELED      └── DISPUTED (재협의로 CHECKING 재진입)
        PENDING → DECLINED
```

상태 정의와 상태별 정책은 `src/types/promise.ts`에 있다.
COMPLETED·BROKEN만 약속 지킴율에 반영되고, DISPUTED·UNRESOLVED·DECLINED·CANCELED는
비율에서 빠진 채 건수만 따로 표기된다. 지킴율 분모는 **"내가 지킬 사람인 약속"만** 포함하며
최소 표본 3건 미만이면 "집계 중"으로 표시한다.

## 문서

기획·설계 문서는 전부 `docs/` 아래에 있고, 충돌하면 위쪽이 우선한다.

| 경로 | 버전 | 역할 |
|---|---|---|
| [docs/기획/01_상위기획서.md](docs/기획/01_상위기획서.md) | v1.2 | 제품 정의 · 상태 머신 · 정책의 최종 근거 |
| [docs/기획/02_세부기능명세서.md](docs/기획/02_세부기능명세서.md) | v1.1 | 기능별 화면 · 필드 · 데이터 모델 · 엣지 케이스 |
| [docs/기획/03_기술스택_비교분석.md](docs/기획/03_기술스택_비교분석.md) | v1.0 | N-3 결정 근거 (Flutter vs RN vs Kotlin) |
| [docs/기획/04_AI-Agent_코딩가이드.md](docs/기획/04_AI-Agent_코딩가이드.md) | v1.0 | 확정 스택 · 저장소 구조 · **이식 규칙** · 스키마 · 보안 |
| [docs/디자인/01_와이어프레임_디자인요청서.md](docs/디자인/01_와이어프레임_디자인요청서.md) | v1.1 | 화면 인벤토리(SCR-ID) · 용어 사전 · 디자인 제약 |

`docs/_archive/`는 구버전 보관용이다. **읽지 않는다.**

## 기여할 때

`CLAUDE.md`를 먼저 읽는다. 특히 용어표(한 개념에 한 단어), 디자인 토큰 규칙,
그리고 절대 어기면 안 되는 제약(광고 금지 구간 · 디스클레이머 문구 고정 ·
계약서 메타포 금지 · DISPUTED에서 판정 금지 · 확정 후 불변)을 지킨다.
