# 리틀핑거 (Little Finger)

두 사람이 합의한 약속을 기록하고, 잊지 않게 하고, 지켜지도록 돕는 상호 약속 관리 서비스.
일정 조율 앱이 아니라 **합의 내용 그 자체**를 기록하는 앱이다. 브랜드 모티프는 새끼손가락 걸기.

## 현재 단계: 로컬 MVP 완성 검증

승인된 **Soft Promise → Quiet Record**와 A 역할 팔레트를 기준으로 Android Expo 앱, Vite 수락 웹, Supabase DB·Edge Function을
구현했다. 핵심 흐름(로그인 → 작성 → 초대 → 웹 승인 → 이행 확인), 증인·변경·파기·알림·
지킴율·증빙·완료 축하·광고 플래그에 더해 온보딩, 최소 버전 차단, 계정 탈퇴, 숨기기·차단·
신고, J-04/J-06까지 로컬 코드와 자동 테스트가 있다.

| 항목 | 확정 |
|---|---|
| 앱 (SCR-A*, MOD-*) | **React Native + Expo SDK 57** (RN 0.86) · TypeScript · Expo Router |
| 수락 웹 (SCR-W*) | **Vite + React + React Router** — 지금의 CSS를 그대로 재사용 |
| 백엔드 | **Supabase Free** (Postgres · Auth · Storage · Edge Functions · pg_cron) |
| 웹 호스팅 | **Firebase Hosting Spark** (`littlefinger-app.web.app`) |

전부 무료 플랜으로 운영 가능하고, 광고 수익 모델에서도 약관 위반이 없는 조합이다.
결정 근거는 [03_기술스택_비교분석](docs/기획/03_기술스택_비교분석.md),
이식 규칙은 [04_AI-Agent_코딩가이드](docs/기획/04_AI-Agent_코딩가이드.md),
배경은 [ADR 0002](docs/adr/0002-react-native-expo-and-port-strategy.md).

현재 디자인 원칙과 색상 역할은 [DESIGN.md](DESIGN.md), 결정 배경은
[ADR 0008](docs/adr/0008-karrot-style-visual-system.md)에 있다. `design-reference/`는 구현 중
**읽기 전용 시각 기준**이며, PO가 비교 시안을 승인하고 두 문서에 기록한 전역 리스타일만
새 기준선을 만드는 예외다. 구현·배포·수동 E2E의 실제 상태와
남은 외부 게이트는 [개발 현황](docs/DEVELOPMENT_STATUS.md)에 기록한다. 현재 다음 단계는
Firebase 호스트가 포함된 EAS development build와 배포 웹을 두 카카오 테스트 계정으로
완주하는 것이다.

## 로컬 실행과 검증

```bash
npm install
npm test
npm run typecheck
npm run build:web
```

수락 웹 개발 서버:

```bash
npm run dev --workspace=@littlefinger/web
```

수락 웹 운영 배포(기존 Firebase 프로젝트만 사용):

```bash
npm run build:web
npx firebase-tools deploy --only hosting --project littlefinger-app-philwoo
```

Android는 Expo Go가 아니라 `apps/mobile/eas.json`의 development build를 사용한다. Supabase
환경값은 루트 `.env`와 각 앱의 공개 환경변수에 둔다. 비밀값은 저장소가 아니라 Supabase Edge
Secrets에만 둔다.

Build local APKs for Galaxy physical devices as ARM64 and verify the ABI before distribution. Use
Android Studio's JDK 21; an `x86_64` APK is emulator-only.

```powershell
npx expo prebuild --platform android --no-install
Set-Location apps/mobile/android
.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a "-Dorg.gradle.java.home=C:\Program Files\Android\Android Studio\jbr" --no-daemon
Set-Location ../../..
npm run verify:android-apk -- apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

57개 EC 추적은 [EC traceability](docs/qa/EC_TRACEABILITY.md), 두 계정 수동 시나리오는
[manual E2E runbook](docs/qa/MANUAL_E2E.md)을 따른다.

환경이 이상하게 굴 때는 먼저 [환경 함정 모음](docs/notes/environment-gotchas.md)을 본다 —
Metro 포트, PGlite, 클라이언트 IP, Supabase CLI 403, Vite 환경변수처럼 원인이 증상과
전혀 달라 보이는 것들을 모아 뒀다.

승인 디자인 미리보기:

```bash
npm run preview
```

| 주소 | 내용 |
|---|---|
| `http://localhost:4173/` | 전체 화면 갤러리 (27개 화면) |
| `http://localhost:4173/docs/flows.html` | 화면 간 플로우 연결도 |

**이식 중에는 이 갤러리가 정답지다** — 옮긴 화면과 원본을 나란히 놓고 눈으로 대조한다.

## 구조

```
littlefinger/                      # npm workspaces
├── packages/shared/src/           # 앱·웹이 공유하는 유일한 코드 (플랫폼 API import 금지)
│   ├── promise.ts                 # 도메인 계약 — 상태 11종·역할·라벨·엔티티
│   ├── config.ts                  # 정책 수치 전부 (02 §11-3)
│   ├── errors.ts                  # 에러 코드 14종 (02 §2-3)
│   ├── text.ts                    # 입력 정규화·코드포인트 길이
│   ├── datetime.ts                # KST D-Day·임박·이행확인 창·조용시간
│   ├── keep-rate.ts               # 약속 지킴율 (02 §4-9-1)
│   ├── transitions.ts             # 상태 전이표 T-01~T-18 (02 §7-1)
│   ├── api.ts                     # 앱·웹·Edge Function 공개 HTTP 계약
│   └── notification.ts            # NT-01~NT-21 및 예약 알림 계약
├── apps/mobile/                   # Expo Android — SCR-A*, MOD-*, App Links
├── apps/web/                      # Vite 수락 웹 — SCR-W01~W06
├── supabase/                      # migrations, Edge Functions, DB 통합 테스트
├── design-reference/              # ★ 승인된 확정 UI의 시각 기준
│   ├── screens/{app,web}/         # 27개 화면
│   ├── styles/                    # tokens.css(115종) · base · components(lf-* 110개)
│   ├── assets/fonts/              # Pretendard woff2 (웹 전용)
│   ├── concept-4.html             # Claude Design 원본
│   └── serve.js, index.html       # 미리보기 서버 + 갤러리
├── docs/
│   ├── 기획/                      # 01 상위기획서 · 02 세부기능명세서 · 03 기술스택 · 04 코딩가이드
│   ├── 디자인/                    # 01 와이어프레임 디자인요청서
│   ├── adr/                       # 구현 결정 기록
│   ├── notes/                     # 환경 함정 등 오래 남는 메모
│   ├── setup/                     # 운영자 런북 (OAuth · 딥링크 QA · assetlinks)
│   ├── qa/                        # 수동 E2E 체크리스트 · EC 추적표
│   └── handoff/                   # 세션 인수인계 (최신 1개만 유지)
├── tools/sync-agent-docs.js       # CLAUDE.md → AGENTS.md 동기화
├── CLAUDE.md                      # AI 에이전트 지침 (원본)
└── AGENTS.md                      # 위와 동일 내용 — Codex Agent 용, 자동 생성
```

`CLAUDE.md`와 `AGENTS.md`는 헤더만 다르고 나머지는 완전히 같다. **`CLAUDE.md`만 고치고**
`npm run sync:agents`로 재생성한다. `npm run check:agents`는 어긋나 있으면 실패한다.

## 남은 출시 게이트

- 두 카카오 계정으로 Android development build ↔ 수락 웹 수동 E2E (실 OAuth 검증 포함)
- Play App Signing 지문을 `assetlinks.json`에 추가하고(런북) 스토어 설치본에서 App Links 재확인
- 실제 AdMob 설정(EAS env), Play 비공개 테스트(계정 유형별 요건 확인), 상표·스토어명 확인
- 물리 기기 전체 TalkBack·운영 푸시 도달 확인

J-07 자동 집계·운영자 경보는 PO 결정으로 현재 범위에서 제외했다. ACTIVE 전환 시
`daily_metrics.activated_count` 실시간 기록과 `ads_enabled=false` 기본값은 유지한다.

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

상태 정의와 상태별 정책은 `packages/shared/src/promise.ts`에 있다.
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

구버전 스펙은 파일로 보관하지 않는다. 개정 이력이 필요하면 git 히스토리에서 읽는다.

## 기여할 때

`CLAUDE.md`를 먼저 읽는다. 특히 용어표(한 개념에 한 단어), 디자인 토큰 규칙,
그리고 절대 어기면 안 되는 제약(광고 금지 구간 · 디스클레이머 문구 고정 ·
계약서 메타포 금지 · DISPUTED에서 판정 금지 · 확정 후 불변)을 지킨다.
