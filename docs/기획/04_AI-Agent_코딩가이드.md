# 리틀핑거 — AI Agent 코딩가이드

**문서 목적**: AI 코딩 에이전트가 리틀핑거를 구현하기 위한 **기술 스택·구조·이식 규칙**의 최종 근거
**전제**: 오픈 이슈 **N-3 확정 — React Native + Expo** (PO 결정, 2026-07-25)
**작성일**: 2026-07-25 | **최종 수정**: 2026-08-29 | **버전**: v1.2

---

## 1. AI 코딩 에이전트를 위한 최상위 지침

**이 문서를 읽는 에이전트는 아래 7개를 먼저 지킨다.**

1. **문서 우선순위** (충돌 시 위쪽이 이김)
   1. `기획/01_상위기획서.md` — 제품 정의·상태 머신·정책
   2. `기획/02_세부기능명세서.md` — 화면·필드·데이터 모델·엣지 케이스
   3. **이 문서(04)** — 기술 스택·구조·이식 규칙
   4. `디자인/01_와이어프레임_디자인요청서.md` — 화면 인벤토리·용어
   5. `design-reference/` — 확정 UI의 **시각 기준**(코드 기준 아님)

2. **계약 우선(contracts-first)**: 기능 구현 전 `packages/shared/src/`의 타입을 먼저 본다. 필요한 타입이 없으면 **타입을 먼저 만들고** 그에 맞춰 구현한 뒤 `npm run typecheck`로 검증한다.

3. **숫자를 코드에 박지 않는다**: 정책 수치는 전부 `packages/shared/src/config.ts`(클라이언트 상수) 또는 Supabase `app_configs` 테이블(원격 변경 가능 값)에서 읽는다. 근거는 세부기능명세서 §11-3.

4. **디자인 값을 코드에 박지 않는다**: 색·크기·여백·둥글기는 전부 `theme` 토큰을 거친다. 리터럴 금지(§5-1).

5. **용어를 새로 만들지 않는다**: 세부기능명세서 §2 및 디자인요청서 §9의 용어표에 없는 단어를 쓰지 않는다. 화면 라벨은 항상 `PROMISE_STATUS_LABEL` 등 라벨 상수를 거친다.

6. **절대 제약 4가지를 어기지 않는다**(§12). 특히 신뢰 순간 광고 금지, 디스클레이머 문구 고정, 계약서 메타포 금지, DISPUTED에서 판정 금지.

7. **막히면 추측하지 말고 멈춘다**: 명세에 없는 정책 판단이 필요하면 구현을 멈추고 **PO 확인 요청 항목으로 보고**한다. 특히 상태 전이·지킴율 계산·법적 문구는 임의 판단 금지.

---

## 2. 확정 기술 스택

전부 **무료 사용 가능**하며, 광고 수익 모델에서도 약관 위반이 없는 조합이다.

| 영역 | 확정 | 버전 | 무료 근거 |
|---|---|---|---|
| 앱 (SCR-A*, MOD-*) | **React Native + Expo** | **Expo SDK 57.0.0** / RN 0.86 / React 19.2.3 | 오픈소스 |
| 언어 | **TypeScript** | 5.9+ | 오픈소스 |
| 앱 라우팅 | **Expo Router** (파일 기반) | SDK 57 내장 | 오픈소스 |
| 수락 웹 (SCR-W01~W06) | **Vite + React + React Router** | Vite 6+ | 오픈소스 |
| DB · 인증 · 파일 · 서버로직 · 배치 | **Supabase Free** | — | DB 500MB / 파일 1GB / MAU 5만 / Edge Function 50만회 / 전송 5GB |
| 수락 웹 호스팅 | **Firebase Hosting Spark** | — | 기존 `littlefinger-app-philwoo` 프로젝트, 무료 기본 HTTPS 도메인 |
| 푸시 알림 | **expo-notifications + Expo Push Service (FCM 경유)** | SDK 57 | 무료 |
| 광고 | `react-native-google-mobile-ads` 16.3.3 (AdMob) | — | 무료 SDK |
| 저장소 | GitHub (+ Actions) | — | 공개 저장소 무료 |
| 앱 빌드 | **로컬 빌드**(기본안) / EAS Build 무료 대안 | — | 로컬 무제한 / EAS는 안드로이드 월 15회 |

### 쓰지 않는 것 (명시적 금지)

| 금지 | 이유 |
|---|---|
| **Vercel** | 무료(Hobby) 플랜이 **광고 수익 서비스를 약관상 금지**. 수락 웹은 Firebase Hosting Spark에 올린다 |
| **Firebase Blaze(유료)** | 사용량 과금. 정적 수락 웹은 결제 수단 없는 Spark 한도 안에서 운영한다 |
| **Next.js** | 수락 웹에 SSR이 필요 없고 번들이 무겁다. 3초 목표(상위기획서 §13)에 Vite가 유리 |
| **react-native-web / Expo Web으로 수락 웹 구현** | 화면 크기별 대응·상단 고정·hover 미지원 + 번들 증가. 이미 완성된 수락 웹 CSS를 버리게 된다 |
| `@react-native-kakao/*` (비공식 SDK) | **§8 참조 — Supabase Auth의 카카오 공식 연동으로 대체.** 필요해지면 그때 재검토 |
| Render / Railway / Fly.io | 무료 DB 30일 만료 / 월 $1 / 무료 플랜 없음 |

> **비교분석서(03) 대비 개선점**: 03에서 "RN의 최대 리스크 = 카카오 로그인 비공식 SDK 의존"으로 보고했으나, 조사 결과 **Supabase Auth가 카카오를 공식 OAuth 제공자로 지원**한다. 따라서 비공식 SDK를 **쓰지 않고** 카카오 공식 OAuth 엔드포인트만 사용하는 경로가 확보되었다. 03의 1순위 리스크는 실질적으로 해소되었다.

---

## 3. 저장소 구조

npm workspaces(내장 기능, 추가 도구 없음)로 3개 패키지를 묶는다.

```
littlefinger/
├── package.json                  # workspaces 루트
├── tsconfig.base.json            # 공통 컴파일러 옵션 (기존 tsconfig.json 계승)
├── AGENTS.md                     # AI 에이전트 지침 (§11)
├── CLAUDE.md                     # 위와 동일 내용 참조 (§11)
│
├── packages/shared/              # ★ 앱·웹이 공유하는 유일한 코드
│   └── src/
│       ├── promise.ts            # 기존 src/types/promise.ts 를 그대로 이동
│       ├── config.ts             # 세부기능명세서 §11-3 정책 상수
│       ├── errors.ts             # §2 에러 코드표
│       ├── validation.ts         # 필드 검증 규칙 (§5)
│       └── api.ts                # Supabase 호출 래퍼 + 응답 타입
│
├── apps/mobile/                  # Expo 앱 — SCR-A*, MOD-*
│   ├── app/                      # Expo Router 화면
│   ├── src/theme/tokens.ts       # ★ tokens.css 이식 결과 (§5-1)
│   ├── src/components/           # ★ lf-* 컴포넌트 이식 결과 (§5-2)
│   └── assets/fonts/             # Pretendard .ttf (§5-4)
│
├── apps/web/                     # Vite 수락 웹 — SCR-W01~W06
│   ├── src/pages/                # 6개 화면
│   └── src/styles/               # ★ 기존 CSS 를 그대로 재사용 (§5-3)
│
├── supabase/
│   ├── migrations/               # 스키마 (세부기능명세서 §6)
│   └── functions/                # Edge Functions (§7-3)
│
├── design-reference/             # ★ 승인 기준선 — 구현 중 읽기 전용인 HTML/CSS 27화면
│   ├── screens/{app,web}/
│   ├── styles/
│   └── concept-4.html
│
└── docs/
    ├── 기획/ 디자인/             # 01~04 문서
    └── adr/                      # ADR 0001 + 신규 ADR
```

### 이동 규칙 (기존 저장소 → 새 구조)

| 기존 경로 | 이동 후 | 처리 |
|---|---|---|
| `src/types/promise.ts` | `packages/shared/src/promise.ts` | **그대로 이동.** 내용 변경 금지 |
| `src/styles/tokens.css` | `design-reference/styles/tokens.css` + `apps/mobile/src/theme/tokens.ts` + `apps/web/src/styles/tokens.css` | 원본 보존 + 앱용 TS 변환 + 웹용 복사 |
| `src/styles/{base,components}.css`, `src/styles/screens/*` | `design-reference/styles/` + `apps/web/src/styles/` | 원본 보존 + **웹은 그대로 재사용** |
| `src/screens/app/*.html` (21개) | `design-reference/screens/app/` | **승인된 시각 기준.** 구현 중에는 읽기 전용으로 대조 |
| `src/screens/web/*.html` (6개) | `design-reference/screens/web/` | 시각 기준 + JSX 변환 원본 |
| `index.html`, `docs/flows.html`, `tools/serve.js` | `design-reference/` | 미리보기 유지 (`node design-reference/serve.js`) |
| `design/concept-4.html` | `design-reference/concept-4.html` | 읽기 전용 유지 |

> `design-reference/`는 구현 이식 중 수정하지 않는다. 단 PO가 비교 시안을 명시적으로 승인하고
> `DESIGN.md`와 ADR에 기록한 전역 리스타일은 새 기준선을 만드는 유일한 예외다.

---

## 4. 초기 세팅 절차

에이전트는 아래 순서를 그대로 실행한다. `<>`는 실제 값으로 치환.

```bash
# 4-1. 루트 workspaces 설정 — 루트 package.json에 아래 필드 추가
#   "workspaces": ["packages/*", "apps/*"]
#   "private": true

# 4-2. Expo 앱 생성
npx create-expo-app@latest apps/mobile --template default
# create-expo-app 은 AGENTS.md / CLAUDE.md 를 자동 생성한다.
# 자동 생성된 내용은 §11 의 리틀핑거 지침으로 "덮어쓴다".

# 4-3. 수락 웹 생성
npm create vite@latest apps/web -- --template react-ts

# 4-4. 공유 패키지 생성 (수동)
#   packages/shared/package.json  →  "name": "@lf/shared", "main": "src/index.ts"

# 4-5. Expo 모노레포 대응 — apps/mobile/metro.config.js
#   watchFolders 에 저장소 루트를 추가하고
#   nodeModulesPaths 에 루트 node_modules 를 추가한다 (Expo 공식 모노레포 가이드)

# 4-6. 앱 의존성
cd apps/mobile
npx expo install expo-router expo-font expo-notifications expo-image-picker \
  expo-auth-session expo-web-browser expo-secure-store expo-clipboard \
  @supabase/supabase-js @react-native-async-storage/async-storage
npx expo install react-native-google-mobile-ads   # 광고 (비활성 상태로 시작)

# 4-7. 웹 의존성
cd ../web
npm i @supabase/supabase-js react-router-dom

# 4-8. 타입 검증 (루트에서)
npm run typecheck
```

**`npm run typecheck`은 모든 커밋 전에 통과해야 한다.** 루트 `package.json`에 정의:
`"typecheck": "tsc --noEmit -p packages/shared && tsc --noEmit -p apps/mobile && tsc --noEmit -p apps/web"`

기존 `tsconfig.json`의 엄격 옵션(`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` 등)을 `tsconfig.base.json`으로 올려 3개 패키지가 상속한다. **엄격 옵션을 끄지 않는다.**

---

## 5. 디자인 이식 규칙

확정 UI는 이미 HTML/CSS로 구현되어 있다(27화면 · 디자인 토큰 115종 · `lf-*` 컴포넌트 110개 클래스). **새로 디자인하지 않고 이식한다.**

2026-08-23 PO 승인 예외: 현재 시각 기준은 루트 `DESIGN.md`의 **Soft Promise → Quiet Record,
A — Pine Anchor · Warm Promise · Blue Record**다. Pine은 브랜드·진행·승인, Action은 주 CTA,
Blue는 확정 기록·정보, Apricot은 마감·응답 주의, red는 위험·오류에만 쓴다. 이 역할 팔레트는
모바일·수락 웹·디자인 레퍼런스에 공통 적용하며 상태 정책이나 화면 구조를 바꾸지 않는다.
향후 `design-reference/` 변경은 PO가 비교 시안을 명시적으로 승인하고 `DESIGN.md`와 ADR에
기록한 경우에만 새 기준선으로 허용한다.

### 5-1. tokens.css → `apps/mobile/src/theme/tokens.ts`

**핵심 원칙: `tokens.css`의 px 값은 React Native의 dp와 1:1로 같다. 숫자를 그대로 옮긴다.**
(CSS가 기준 뷰포트 360×800dp로 작성되어 있고, RN은 dp 단위를 쓴다.)

변환 규칙:

| CSS 토큰 종류 | RN 변환 | 비고 |
|---|---|---|
| `--lf-color-*` | 문자열 그대로 | `rgba(...)`도 RN에서 유효 |
| `--lf-type-*-size`, `--lf-line-*` | **단위 제거한 숫자** (`14px` → `14`) | `fontSize`, `lineHeight` |
| `--lf-weight-*` | 문자열 (`'400'`, `'600'`, `'700'`, `'800'`) | RN `fontWeight`는 문자열 |
| `--lf-radius-*` | 숫자. `pill`은 `9999` | `borderRadius` |
| `--lf-space-*`, `--lf-gutter-*` | 숫자 | |
| `--lf-touch-min`, `--lf-*-height` | 숫자 | **`touchMin: 48` 은 접근성 하한. 줄이지 않는다** |
| `--lf-elevation-*` | **객체로 변환** (아래) | CSS `box-shadow` 미지원 |
| `--lf-easing-*` | `Easing.bezier(a,b,c,d)` | react-native-reanimated |
| `--lf-duration-*` | 숫자(ms) | |
| `--lf-viewport-*`, `--lf-statusbar-height`, `--lf-navbar-height` | **이식하지 않음** | 실제 기기값·`SafeAreaView`가 대체 |
| `--lf-color-frame-border` | **이식하지 않음** | 미리보기용 기기 프레임 전용 |

그림자 변환 예:

```ts
// --lf-elevation-card: 0 1px 3px rgba(25, 28, 27, 0.06);
export const elevation = {
  card: {
    shadowColor: '#191C1B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,          // Android
  },
  fab: {
    shadowColor: '#191C1B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  sheet: {
    shadowColor: '#191C1B',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 12,
  },
} as const;
```

**금지**: 컴포넌트·화면 코드에 색상 코드, 폰트 크기, 여백 숫자, 둥글기 숫자를 **직접 쓰지 않는다.** 항상 `theme`에서 가져온다. 토큰에 없는 값이 필요하면 **토큰을 먼저 추가**하고 `design-reference/styles/tokens.css`에도 같은 값을 반영한다.

### 5-2. `lf-*` 클래스 → RN 컴포넌트

**변형(`--filled`, `--web` 등)은 별도 컴포넌트로 만들지 않고 `props`로 받는다.** 110개 클래스가 약 33개 컴포넌트로 정리된다. 전부 `apps/mobile/src/components/` 아래 파일 하나당 컴포넌트 하나.

| 원본 CSS 클래스 | RN 컴포넌트 | 변형 처리 |
|---|---|---|
| `lf-stack`, `lf-row`, `lf-wrap`, `lf-gap-1~7`, `lf-grow`, `lf-center` | `LfStack` / `LfRow` | `gap={1..7}`, `grow`, `center` |
| `lf-divider` | `LfDivider` | — |
| `lf-headline`, `lf-title`, `lf-subtitle`, `lf-section-title`, `lf-body`, `lf-caption`, `lf-meta` | `LfText` | `variant="headline\|title\|subtitle\|sectionTitle\|body\|caption\|meta"`, `secondary`, `align` |
| `lf-btn` + `--filled/outlined/text/tonal/danger/kakao/cta/block/compact/grow` | `LfButton` | `variant`, `size="cta\|compact"`, `block`, `grow` |
| `lf-btn-link`, `lf-row-link` | `LfLink` / `LfRowLink` | — |
| `lf-icon-button`, `--strong` | `LfIconButton` | `strong` |
| `lf-fab` | `LfFab` | — |
| `lf-card` + `--container/emphasis/flat/web` | `LfCard` | `variant` |
| `lf-sheet`, `--celebrate`, `lf-scrim` | `LfSheet` | `celebrate`. 스크림은 내부 처리 |
| `lf-notice` | `LfNotice` | — |
| `lf-empty` | `LfEmpty` | — |
| `lf-chip` + `--status/done/broken/urgent/neutral` | `LfChip` | `tone` |
| `lf-status-icon` | `LfStatusIcon` | `status: PromiseStatus` |
| `lf-stamp`, `--compact`, `lf-fingerprint` | `LfStamp` / `LfFingerprint` | `compact` |
| `lf-outcome` + `--reward/penalty/enforced`, `lf-outcomes` | `LfOutcome` / `LfOutcomes` | `kind="reward\|penalty"`, `enforced` |
| `lf-dday`, `--lg`, `--xl` | `LfDday` | `size` |
| `lf-pinky` + 8개 변형, `lf-pinky-badge` | `LfPinky` / `LfPinkyBadge` | `size="xs\|sm\|md\|lg\|xl"`, `hooked`, `tapped`, `on="primary\|container"` |
| `lf-approval` | `LfApproval` | — |
| `lf-claim`, `lf-claims`, `lf-compare` | `LfClaim` / `LfClaims` | **DISPUTED 전용 — 우열 표시 금지**(§12) |
| `lf-proof` | `LfProof` | — |
| `lf-progress` | `LfProgress` | — |
| `lf-stat`, `lf-stats`, `lf-stat-hero` | `LfStat` / `LfStats` | `hero` |
| `lf-disclaimer` | `LfDisclaimer` | **내부에서 `LEGAL_DISCLAIMER` 상수만 렌더. 문구를 props로 받지 않는다**(§12) |
| `lf-ad-slot` | `LfAdSlot` | SCR-A02에서만 사용. `ads_enabled=false`면 **렌더 자체를 하지 않는다** |
| `lf-field`, `lf-input`, `lf-textarea` | `LfField` / `LfInput` / `LfTextarea` | — |
| `lf-picker`, `--placeholder` | `LfPicker` | `placeholder` |
| `lf-choice`, `lf-choices` | `LfChoice` / `LfChoices` | — |
| `lf-switch` | `LfSwitch` | — |
| `lf-dashed`, `--field` | `LfDashed` | `field` |
| `lf-appbar`, `--brand` | `LfAppBar` | `brand` |
| `lf-tabs`, `lf-tab` | `LfTabs` | — |
| `lf-list`, `lf-list-item`, `--unread` | `LfList` / `LfListItem` | `unread` |
| `lf-avatar`, `--lg` | `LfAvatar` | `size` |
| `lf-preview` | `LfPreview` | — |
| `lf-browserbar*` | **이식하지 않음** | 수락 웹(브라우저)에만 있는 크롬. 앱에는 `LfAppBar` |

CSS → RN 스타일 주의사항:

| CSS | RN 대응 |
|---|---|
| `display: flex` | 기본값이므로 생략 (`flexDirection` 기본값은 `column`) |
| `gap` | RN 0.71+ 지원 ✓ 그대로 사용 |
| `position: fixed` | 미지원 → `position:'absolute'` + 부모 레이아웃 |
| `:hover`, `:focus-visible` | 미지원 → `Pressable`의 `pressed` 상태로 대체 |
| `hr` | `<View style={styles.divider} />` |
| `aria-label` | `accessibilityLabel` |
| `aria-hidden` | `accessibilityElementsHidden` / `importantForAccessibility="no"` |
| `lf-sr-only` | `accessibilityLabel`로 흡수, 별도 요소 만들지 않음 |
| 텍스트는 반드시 `<Text>` 안에 | RN 필수 규칙. `<View>`에 직접 문자열 금지 |

### 5-3. 수락 웹은 CSS를 그대로 재사용한다

`apps/web`은 **기존 CSS를 수정 없이 가져다 쓴다.** `tokens.css` / `base.css` / `components.css` / `screens/web.css`를 `apps/web/src/styles/`에 복사하고 `main.tsx`에서 import한다.

HTML → JSX 변환은 기계적이며, 아래만 바꾼다.

| HTML | JSX |
|---|---|
| `class=` | `className=` |
| `<input>`, `<hr>`, `<br>` | 자기닫힘 (`<hr />`) |
| `for=` (label) | `htmlFor=` |
| 인라인 주석 `<!-- -->` | `{/* */}` |
| `data-screen-id` | 그대로 유지 (화면 식별에 사용) |

**제거할 것**: `lf-device`, `lf-device__viewport` 래퍼와 `frame.js` 스크립트(미리보기용 기기 프레임), `screen-page.css`, 그리고 `lf-browserbar` 블록 — 실제 카톡 인앱 브라우저가 그 역할을 한다.

**유지할 것**: `lf-screen`, `lf-screen__body--web`, `lf-screen__actions--web` 구조와 모든 `lf-*` 클래스.

성능 목표(상위기획서 §13, 3초 이내)를 위해:
- 라우팅은 6화면 전부 **단일 번들**로 두고 코드 분할하지 않는다(왕복 추가가 더 비싸다).
- `tokens.css`의 Google Fonts `@import`를 **제거**하고, Material Symbols와 Pretendard를 **자체 호스팅**한다(외부 요청 2건 제거).
- Pretendard는 웹에서 `woff2`를 그대로 쓴다(이미 저장소에 있음).
- 이미지는 증빙 사진 외에 쓰지 않는다.

### 5-4. 폰트와 아이콘 — 앱에서 반드시 걸리는 두 가지

**① Pretendard: `woff2`는 React Native에서 쓸 수 없다.**
저장소의 `assets/fonts/PretendardVariable.woff2`는 웹 전용이다. 앱용으로 **`.ttf` 정적 웨이트 4종**을 별도로 받아 `apps/mobile/assets/fonts/`에 둔다. 토큰이 쓰는 웨이트는 400/600/700/800이므로:

```
Pretendard-Regular.ttf     → fontWeight 400
Pretendard-SemiBold.ttf    → fontWeight 600
Pretendard-Bold.ttf        → fontWeight 700
Pretendard-ExtraBold.ttf   → fontWeight 800
```

`expo-font`로 로드하고, `LfText`가 `fontWeight`에 따라 `fontFamily`를 선택하게 한다. (RN 안드로이드는 가변 폰트의 웨이트 축 선택이 불안정하므로 **가변 폰트 대신 정적 웨이트**를 쓴다.)

**② Material Symbols Rounded는 앱에 기본 포함되어 있지 않다.**
MVP 기본안: `@expo/vector-icons`의 `MaterialIcons`를 쓴다(Expo에 내장, 추가 다운로드 없음). 원본은 Rounded 변형이라 **아이콘 모서리 곡률이 미세하게 다르다** — 기능 영향 없음, 시각 차이만 있음.
고충실도가 필요하면 `MaterialSymbolsRounded.ttf`를 받아 `expo-font`로 로드하고 코드포인트 기반 `LfIcon`을 만든다(선택, 오픈 이슈 C-2).

아이콘은 반드시 `LfIcon` 컴포넌트를 거친다. 화면에서 `MaterialIcons`를 직접 import하지 않는다(교체 지점을 한 곳으로 유지).

---

## 6. 공유 패키지 규칙 (`packages/shared`)

**여기에 들어가는 것**: 도메인 타입, 상태·역할·라벨 상수, 정책 수치, 에러 코드, 필드 검증 규칙, Supabase 호출 래퍼와 요청/응답 타입.

**여기에 들어가지 않는 것**: 화면, 스타일, RN 전용 코드, 브라우저 전용 코드. `packages/shared`는 **플랫폼 API를 import하지 않는다**(`react-native`, `window`, `document` 금지). 이 규칙을 지키면 앱·웹 양쪽에서 안전하게 쓰인다.

`promise.ts`는 **기존 파일을 그대로 이동**한다. 이미 상태 11종, 라벨, 지킴율 포함/제외 상태, 정책 상수(`MAX_WITNESS_COUNT`, `INVITE_EXPIRY_HOURS`, `FULFILLMENT_RESPONSE_DEADLINE_DAYS`, `REMINDER_OFFSET_DAYS`, `IMMINENT_THRESHOLD_DAYS`), `LEGAL_DISCLAIMER`가 정의되어 있다.

`config.ts`에는 세부기능명세서 §11-3의 **나머지** 설정값을 추가한다(`QUIET_HOURS_KST`, `ACCESS_TOKEN_TTL_MIN`, `REFRESH_TOKEN_TTL_DAYS`, `TRUST_MIN_SAMPLE`, `EVIDENCE_MAX_COUNT`, `EVIDENCE_MAX_MB`, `DRAFT_MAX_CONCURRENT`, `PROMISE_MAX_PER_DAY`, `INVITE_RESEND_MAX`, `DEVICE_TOKEN_MAX`, `END_DATE_MAX_DAYS`, `DRAFT_TTL_DAYS`, `REMINDER_SEND_HOUR_KST`, `ADS_ACTIVATION_DAILY_CONFIRMS`).

**시각 규칙**: 저장은 UTC(`timestamptz`), 표시·계산은 **Asia/Seoul**. 클라이언트에서 기기 시간대를 신뢰하지 않고 KST로 고정 변환한다. 날짜 경계 판단(D-Day, 기한 만료)은 **서버(Edge Function/배치)가 기준**이고 클라이언트 계산은 표시용이다.

---

## 7. 백엔드 구현 규칙 (Supabase)

### 7-1. 스키마

세부기능명세서 **§6의 테이블 정의를 그대로** `supabase/migrations/`의 SQL로 옮긴다. 이 문서에서 스키마를 다시 정의하지 않는다. 마이그레이션은 **순번 파일로 추가만** 하고 기존 파일을 수정하지 않는다.

### 7-2. RLS(행 수준 보안) — 필수

**모든 테이블에 RLS를 켠다.** 정책의 기준은 세부기능명세서 §9 권한 매트릭스다.

핵심 원칙 3가지:
1. **비참여자에게는 약속의 존재 자체를 알리지 않는다.** 권한 없는 조회는 "권한 없음"이 아니라 **빈 결과**로 만들고, 애플리케이션 계층에서 `E_NOT_FOUND`로 응답한다.
2. **확정 후 불변**: `ACTIVE` 이후 `promises`의 내용 필드(제목·내용·종료일·보상·벌칙)는 `UPDATE`가 정책으로 거부된다. 변경은 `promise_versions` 추가로만 표현한다.
3. **append-only 테이블**(`approvals`, `promise_versions`, `fulfillment_checks`, `notifications`)은 `UPDATE`/`DELETE` 정책을 아예 만들지 않는다. `fulfillment_checks`의 1회 수정 예외는 **새 행 추가 + 이전 행 무효 표시**로 구현한다(§6-2).

`service_role` 키는 **Edge Function 안에서만** 쓴다. 앱·웹에는 `anon` 키만 넣는다.

### 7-3. Edge Functions — 서버가 반드시 해야 하는 일

클라이언트를 신뢰할 수 없는 로직은 전부 Edge Function으로 넣는다.

| 함수 | 역할 | 이유 |
|---|---|---|
| `invite-resolve` | 초대 토큰 검증 → 약속 요약 반환 | 토큰은 **해시로만 저장**. 원본 대조는 서버에서 |
| `promise-approve` | 상호 승인 처리 → ACTIVE 전환 → `content_hash` 생성 | 해시 생성과 상태 전이는 클라이언트가 못 하게 한다 |
| `promise-create` / `promise-draft-update` / `promise-invite` | T-01·T-02와 DRAFT 수정 — 슬롯 한도·기간 상한·`content_hash`는 서버만 안다 | 2026-07-27 이동(CLAUDE.md §5-6) |
| `invite-preview` | SCR-W02의 읽기 경로 — 승인 가드와 같은 순서, `stable` | ADR 0004 |
| `promise-decline` / `promise-amend` / `promise-amend-request` / `promise-amend-respond` / `promise-amend-withdraw` | 상태 전이 (T-06~T-12, T-19~T-21 마무리 포함) | 전이 규칙 단일 지점 |
| `slot-status` / `purchase-verify` / `purchase-reconcile` | 슬롯 현황, Play 구매 검증(슬롯·영구 보관 두 상품), 환불 회수 | ADR 0009·0015 |
| `promise-entitlements` | 약속별 혜택 계산 결과(증인 용량·기간 상한·개인 보관) 조회 | 지급 원장은 서버 전용 |
| `reward-intent-create` / `reward-status` | 보상형 광고 의도 발급·조회 | 클라이언트 `EARNED_REWARD`는 아무것도 부여하지 않는다 |
| `reward-callback` | AdMob SSV 콜백(공개, `verify_jwt=false`) — Google P-256 서명 검증 뒤에만 지급 | 서명 없이는 지급 경로가 없다 |
| `retention-maintenance` | 비밀 헤더 워커 — purge queue lease → 스토리지 삭제 → finalize | J-11의 Edge 반쪽 |
| `fulfillment-submit` | 이행 확인 응답 기록 → 종결 상태 판정 (J-01) | 양측 응답 비교 후 COMPLETED/BROKEN/DISPUTED 결정 |
| `evidence-sign-url` | 증빙 사진 서명 URL 발급(10분) | 비공개 버킷 유지 |
| `push-send` | Expo Push 발송 | 조용시간(21:00–08:00 KST) 규칙 적용 |
| `account-withdraw` | 탈퇴 트랜잭션 + 계정 식별자 비식별화 + Auth 계정 삭제 시도 | 실패해도 `WITHDRAWN` 경계가 즉시 접근 차단 |
| `profile-nickname-update` | 임시 닉네임 교체 | 정규화·길이 규칙을 서버에서 재검증 |
| `promise-hide` / `user-block` / `safety-report` | 종결 약속 숨김·공유 관계 차단·사용자/증빙 신고 | 참여 권한과 증빙 블라인드를 DB 트랜잭션으로 강제 |

**`content_hash` 생성 규칙**(세부기능명세서 §6): SHA-256, **키 순서 고정**, 문자열 **NFC 정규화**. 이 함수는 `packages/shared`에 두지 않고 **Edge Function 안에만** 둔다(클라이언트가 위조 해시를 만들 수 없게).

### 7-4. 배치 작업 (J-01~J-11)

Supabase의 `pg_cron`으로 스케줄한다(Free 플랜 사용 가능). 각 배치는 **멱등**해야 한다 — 같은 날 두 번 돌아도 알림이 중복 발송되지 않도록 발송 이력을 확인하고 삽입한다.

| 배치 | 시각(KST) | 내용 |
|---|---|---|
| J-01 예약 알림 발송 | 매 10분 | due schedule 발송, 21:00–08:00 KST 이연 |
| J-02 종료일 도래 → CHECKING | 매일 00:10 | 상태 전이 |
| J-03 이행 확인 기한 초과 → UNRESOLVED | 매일 00:20 | 기한 종결 |
| J-04 초대 링크 만료 | 매 30분 | 72시간, 약속은 PENDING 유지 |
| J-05 변경 요청 자동 철회 | 매일 00:30 | 7일 |
| J-06 DRAFT 알림·정리 | 매일 04:00 | NT-20/21 예약, 예고 발송 후 90일 삭제 |
| J-07 일 지표 집계 | **현재 범위 보류** | ACTIVE 전환 시 `activated_count` 실시간 기록은 유지 |
| J-08 증빙 정리 | 매주 일 05:00 | 첨부자가 제거한 증빙 객체만 삭제(365일 자동 삭제는 2026-08-29 폐기) |
| J-09 해시 검증 | 매주 일 05:30 | 사용자 화면 비노출 |
| J-10 지킴율 재계산 | 매일 03:00 | 실시간 캐시 정합성 보정 |
| J-11 보관 관리 | 매시 17분 | 개인 보관 만료 D-7/D-1 알림 멱등 생성, 마지막 열람권 종료 약속을 purge queue에 적재 → `retention-maintenance` 워커 |

### 7-5. Supabase 무료 플랜의 함정 — 반드시 처리

**무료 프로젝트는 1주일간 활동이 없으면 일시정지되고, 정지 상태로 90일이 지나면 삭제된다.**
→ GitHub Actions 워크플로로 **매일 1회 가벼운 쿼리를 호출**해 활동 상태를 유지한다. 이 워크플로는 개발 초기부터 켜 둔다(개발이 며칠 멈춰도 프로젝트가 죽지 않게).
→ 추가로 `supabase db dump`를 **주 1회 GitHub Actions로 백업**한다. 무료 플랜에는 자동 백업이 없다.

---

## 8. 카카오 로그인 구현

**Supabase Auth의 카카오 공식 제공자를 쓴다. 비공식 RN SDK를 쓰지 않는다.**

### 앱 (SCR-A01)

`expo-auth-session` + `expo-web-browser`로 시스템 브라우저를 띄우고, Supabase의 OAuth 흐름을 통과시킨 뒤 앱으로 돌아온다.

```
[카카오로 시작하기] 탭
 → supabase.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: <앱 딥링크>, skipBrowserRedirect: true } })
 → expo-web-browser.openAuthSessionAsync(url, <앱 딥링크>)
 → 카카오 공식 로그인 페이지 (기기에 카카오톡이 있으면 앱으로 전환되어 간편 로그인)
 → 앱 딥링크로 복귀 → 세션 저장
```

세션은 AES-256 키만 `expo-secure-store`에 두고 암호문을 AsyncStorage에 저장하는 `LargeSecureStore` 어댑터로 보관한다. SecureStore 단일 값 한도 때문에 Supabase 세션 JSON을 직접 넣지 않는다. 토큰 수명은 §11-3 기본안(access 30분 / refresh 30일)을 Supabase 프로젝트 설정에 반영한다.

### 수락 웹 (SCR-W01)

`supabase.auth.signInWithOAuth({ provider: 'kakao' })` — **리다이렉트 방식만** 쓴다. 카카오 JavaScript SDK v2는 팝업 로그인이 제거되었고 iframe도 차단되므로, 팝업·iframe을 시도하지 않는다.

카톡 인앱 브라우저에서는 이미 카카오에 로그인된 상태이므로 대체로 클릭 한 번에 통과한다. `prompt=none`으로 자동 로그인을 시도하고 실패 시 일반 로그인으로 넘기는 처리를 넣는다(**T-1 확정: 반영**).

### 반드시 알아야 할 제약

| 제약 | 영향 | 대응 |
|---|---|---|
| **비즈 앱은 로그인 자체에 필수** | Supabase Auth가 `account_email` scope도 요청하므로 미등록 시 KOE205 | 카카오 콘솔에는 선택 동의로 등록하되 제품은 이메일을 저장·읽지 않는다. 이메일 수집·발송은 MVP 제외(C-1 종료, 2026-07-29) |
| 카카오 JS SDK 1.43.6 이하 지원 종료(2026-12-31) | 해당 없음 | 처음부터 v2/Supabase 경로 사용 |
| 카카오 개발자 콘솔에 **Redirect URI를 정확히 등록**해야 함 | 등록 누락 시 로그인 전면 실패 | Supabase 콜백 URL + 앱 딥링크 + 웹 도메인 3종 등록 |

### 카톡 초대 공유 (F-03)

MVP는 **OS 기본 공유 시트**(RN `Share` API)로 초대 링크를 보낸다. 카카오 공유 SDK(예쁜 카드형)는 비공식 SDK가 필요하므로 **MVP 범위에서 제외**한다. 링크만 보내도 흐름은 완결된다.

---

## 9. 환경변수

**클라이언트에 넣어도 되는 값** (번들에 포함됨 — 비밀이 아님)

| 키 | 위치 | 값 |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `apps/mobile/.env` | Supabase 프로젝트 URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile/.env` | anon 키 |
| `EXPO_PUBLIC_WEB_BASE_URL` | `apps/mobile/.env` | 초대 링크 도메인 |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | `apps/web/.env` | 동일 |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` · `EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID` · `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID` · `EXPO_PUBLIC_ADMOB_REWARDED_{WITNESS,DURATION,RETENTION}_UNIT_ID` | EAS production env | 프로덕션 프로필에서만 필수, 그 외는 Google 테스트 유닛 |

**절대 클라이언트에 넣지 않는 값** (Supabase Secrets / GitHub Secrets에만)

`SUPABASE_SERVICE_ROLE_KEY`, `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `INVITE_TOKEN_PEPPER`(초대 토큰 해시용), `PII_HASH_SALT`(IP·User-Agent 해시용), `ACCOUNT_ID_PEPPER`(탈퇴 계정 식별자 비식별화용), `GOOGLE_PLAY_SERVICE_ACCOUNT`(구매 검증), `PURCHASE_RECONCILE_SECRET` · `ACCOUNT_DELETE_RETRY_SECRET` · `RETENTION_WORKER_SECRET` · `PUSH_SEND_SECRET` · `EVIDENCE_PURGE_SECRET`(cron→워커 비밀 헤더, 같은 값이 Vault에도 있다), `ADMOB_REWARDED_{WITNESS,DURATION,RETENTION}_UNIT_ID`(SSV 콜백 허용 유닛). 세 pepper/salt는 서로 다른 값을 쓴다.

`.env*`는 `.gitignore`에 포함한다. `.env.example`만 커밋한다. **키를 커밋했다면 즉시 회전(regenerate)한다.**

---

## 10. 개발 순서

각 마일스톤 끝에 `npm run typecheck` 통과 + 해당 화면을 `design-reference`와 눈으로 비교한다.

### M0 — 기반 (프레임워크 이식)
1. 저장소 재구성(§3) + workspaces + typecheck 통과
2. `tokens.ts` 이식(§5-1) + 폰트 4종 로드(§5-4)
3. `LfText` / `LfStack` / `LfRow` / `LfButton` / `LfCard` / `LfIcon` 6개 먼저 만들고 **SCR-A01 로그인 화면 1개를 완성해 눈으로 대조**한다 → 이식 규칙이 맞는지 여기서 검증
4. 나머지 컴포넌트 이식(§5-2)
5. Supabase 프로젝트 생성 + 스키마 마이그레이션 + RLS + keep-alive 워크플로

### M1 — 핵심 루프 (여기까지가 서비스의 최소 완결)
6. **F-01 로그인**(§8) — 앱 + 웹 양쪽
7. **F-02 약속 작성** (SCR-A03) — DRAFT
8. **F-03 초대 전송** (SCR-A04) — 1회용 토큰 72시간
9. **F-04 수락 웹 전체** (SCR-W01~W06) — 검토·승인·거절·수정제안
10. **확정 전환** — `promise-approve` Edge Function + `content_hash` + 기록 지문 + 디스클레이머 노출
11. **F-07 이행 확인** (SCR-A06, SCR-W04) + 종결 판정(J-01)

### M2 — 잊지 않게 하는 기능
12. F-05 리마인드 배치 + F-06 푸시 알림 + 조용시간
13. F-10 알림함 (SCR-A07)
14. SCR-A02 홈 목록 + 상태별 상세 9종 (SCR-A05)

### M3 — 나머지
15. F-08 증인 초대(작성자 무료 1+보상 1, 상대방 보상 1; 최대 3명) + SCR-W05
16. F-09 약속 지킴율 (SCR-A08) — **"내가 지킬 사람인 약속"만 분모**(S-1·S-2 확정), 최소 표본 3건
17. F-11 변경·파기 합의 (MOD-01) + F-12 설정
18. MOD-03 완료 축하

### M4 — 출하
19. 노출형 광고 배치(A02·A07·A08 하단 네이티브 + A02 6건 이상 인피드 배너, `ads_enabled=false`로 **렌더 안 함**)와 사용자 시작 보상형 광고(ADR 0015)
20. 접근성 점검: 터치 타깃 48dp, 상태를 색상만으로 구분하지 않았는지, 스크린리더 라벨
21. 세부기능명세서 §13 수락 기준 체크리스트 전수 확인
22. **구글 플레이: 비공개 테스트 12명 / 14일 연속** — 착수 시점에 테스터 모집을 병행 시작

---

## 11. `AGENTS.md` / `CLAUDE.md` 초안

`create-expo-app`이 만든 파일을 아래 내용으로 **덮어쓴다**. (`CLAUDE.md`는 같은 내용을 쓰거나 `AGENTS.md`를 참조하게 한다.)

```markdown
# 리틀핑거 — AI 에이전트 지침

두 사람이 합의한 약속을 기록·리마인드·이행 확인하는 상호 약속 관리 서비스.
일정 조율 앱이 아니라 "합의 내용 그 자체"를 기록한다. 모티프는 새끼손가락 걸기.

## 작업 전 반드시 읽을 문서 (충돌 시 위쪽 우선)
1. docs/기획/01_상위기획서.md
2. docs/기획/02_세부기능명세서.md
3. docs/기획/04_AI-Agent_코딩가이드.md   ← 스택·구조·이식 규칙
4. docs/디자인/01_와이어프레임_디자인요청서.md
5. design-reference/  ← 확정 UI 기준선 (구현 중 읽기 전용; PO 승인 리스타일만 예외)

## 스택
Expo SDK 57 (RN 0.86) · TypeScript · Expo Router | 수락 웹: Vite + React
백엔드: Supabase (DB/Auth/Storage/Edge Functions/pg_cron) | 웹 호스팅: Firebase Hosting Spark
공유 코드: packages/shared (플랫폼 API import 금지)

## 절대 규칙
- 디자인 값(색·크기·여백·둥글기) 리터럴 금지 → 항상 theme 토큰
- 정책 수치 하드코딩 금지 → packages/shared/src/config.ts 또는 app_configs
- 화면 라벨 하드코딩 금지 → PROMISE_STATUS_LABEL 등 라벨 상수 경유
- 용어표에 없는 새 용어 만들기 금지 (약속=promise, 벌칙=penalty, 지킴율=keepRate,
  기록 지문=fingerprint, 엔티티 타입명은 PromiseRecord)
- 신뢰 순간 노출형 광고 금지: 작성·검토·승인·확정·이행확인 화면과 수락 웹 전체.
  노출형 광고는 A02·A07·A08 하단과 A02 인피드뿐이고 ads_enabled=false면 렌더하지 않는다.
  사용자가 직접 시작하는 보상형 광고는 앱의 증인·기간·개인보관 혜택에서만 허용한다.
- LEGAL_DISCLAIMER 문구 변경 금지. 상수만 렌더한다.
- 계약서·도장·법원 메타포 금지. 단 확정 스탬프는 신뢰감을 준다.
- DISPUTED 화면에서 어느 쪽이 옳은지 절대 표시하지 않는다 (기록자이지 심판이 아니다).
- 터치 타깃 최소 48dp. 상태를 색상만으로 구분하지 말고 텍스트 라벨 병기.
- design-reference/ 수정 금지.
- service_role 키는 Edge Function 안에서만. 앱·웹에는 anon 키만.

## 검증
npm run typecheck   # 커밋 전 필수. 엄격 옵션을 끄지 않는다.
node design-reference/serve.js   # 원본 화면과 눈으로 대조

## 막혔을 때
명세에 없는 정책 판단(상태 전이·지킴율 계산·법적 문구)이 필요하면
추측하지 말고 멈추고 "PO 확인 필요" 항목으로 보고한다.
```

---

## 12. 절대 어기면 안 되는 제약 (재확인)

세부기능명세서 §1·§11 및 디자인요청서 §8에서 옮겨온 것으로, **이 문서가 무효화할 수 없다.**

1. **신뢰 순간 노출형 광고 없음**(원칙 P4) — 작성·검토·승인·확정·이행 확인 화면과 **수락 웹 전체**에 배너·네이티브 광고 금지. 노출형 광고는 A02·A07·A08 하단과 A02 인피드만 허용하며, `ads_enabled=false`일 때 **컴포넌트를 렌더하지 않는다**(빈 자리도 만들지 않는다). 사용자 시작 보상형 광고는 앱의 증인·기간·개인보관 혜택으로 제한한다.
2. **디스클레이머 문구 고정**(원칙 P5) — `LEGAL_DISCLAIMER` 상수를 그대로 렌더. SCR-W02 / SCR-A05·SCR-W03 확정 영역 4곳에 노출.
3. **계약서처럼 보이지 않게** — 도장·서류·법원 메타포 금지. 단 확정 스탬프 영역은 "제대로 기록됐다"는 신뢰감을 줄 것.
4. **DISPUTED에서 판정 금지**(원칙 P1) — 양측 주장을 나란히 기록만 한다. 어느 쪽이 옳은지 암시하는 색·순서·아이콘도 금지.
5. **확정 후 불변**(원칙 P3) — ACTIVE 이후 내용 필드는 DB 정책으로 UPDATE를 거부한다. 변경은 버전 추가로만.
6. **금전 예치·자동 벌금 정산 금지** — 영구 제외. 벌칙은 **텍스트 기록**일 뿐이다.
7. **접근성** — 터치 타깃 48dp 이상, 상태를 색상만으로 구분하지 않고 텍스트 라벨 병기.
8. **개인정보** — 초대 토큰·IP·User-Agent는 **해시만 저장**(원본 미보관), 증빙 사진은 **EXIF 위치정보 제거** 후 비공개 버킷 저장, 서명 URL 10분.

---

## 13. PO 확인 요청 사항

| # | 확인 요청 | 기본안(무응답 시 이대로 진행) | 영향 |
|---|---|---|---|
| ~~C-1~~ | ~~카카오 이메일 수집 여부~~ | **종료(2026-07-29): 이메일 미수집·미발송.** 비즈 앱은 로그인 자체를 위해 등록하고 `account_email`은 선택 동의로만 둔다 | EC-G03은 비적용 결정 검증 |
| C-2 | 아이콘을 원본과 100% 같게 맞출까요? | **맞추지 않음** — Expo 내장 MaterialIcons 사용(모서리 곡률 미세 차이) | 시각 충실도만 |
| C-3 | 수락 웹 도메인을 구입할까요? | **종결: `https://littlefinger-app.web.app` 사용** (PO, 2026-08-18; ADR 0005) | 초대 링크 주소 모양 |
| C-4 | 초대 링크 공유를 카카오 공유 카드로 예쁘게 만들까요? | **MVP 제외** — OS 기본 공유 시트로 링크만 전송 | F-03 체감 품질 |

**이미 확정된 사항** (03 보고 시 컨펌): T-1 카톡 인앱 자동 로그인 **반영** · T-2 **로컬 빌드** · T-3 N-2(iOS 시점) **v2에서 결정**.

---

## 14. 상위 문서에 반영해야 할 수정 (백프로파게이션)

이 문서 확정으로 상위 문서에서 고쳐야 할 항목이다. **PO 확인 후 일괄 반영**한다.

| 문서 | 위치 | 수정 내용 |
|---|---|---|
| 01_상위기획서 | 오픈 이슈 N-3 | "Flutter 우선 검토, 03에서 확정" → **"확정: React Native + Expo (2026-07-25). 근거는 03_기술스택_비교분석"** |
| 01_상위기획서 | §14 다음 문서 | 코딩가이드 번호 `03_` → **`04_`** (03은 기술스택 비교분석서) |
| 저장소 `CLAUDE.md` | 아직 열려 있는 결정 N-3 | "미확정. 그래서 현재 UI는 프레임워크 없는 HTML/CSS" → **"확정(RN+Expo). HTML/CSS 구현은 `design-reference/`의 시각 기준으로 전환됨"** |
| 저장소 `README.md` | "현재 UI 구현 단계" 문단 | 이식 단계로 갱신 + 새 저장소 구조 반영 |
| `docs/adr/` | 신규 | **ADR 0002 — N-3 프레임워크 결정 및 이식 전략** 추가 (ADR 0001의 "N-3 stays open"을 대체) |
| 02_세부기능명세서 | F-01 | 카카오 로그인 구현 경로를 **Supabase Auth 카카오 제공자**로 명시 + `prompt=none` 자동 로그인 추가 |
| 02_세부기능명세서 | F-03 | 초대 공유를 **OS 공유 시트**로 명시(카카오 공유 SDK 제외) |

기존에 파악된 6건(상위기획서 상태도에 `DISPUTED → CHECKING` 추가, UNRESOLVED 라벨 "무응답 종결"→"미확정 종결", F-09 분모에 지킬 사람 한정·최소 표본 3건, 디자인요청서 "이행률(%)"→"약속 지킴율(%)", "패널티"→"벌칙" 6곳, 디스클레이머 노출 위치 3→4곳)도 함께 반영한다.

---

**변경 이력**

| 버전 | 일자 | 내용 |
|---|---|---|
| v1.0 | 2026-07-25 | 최초 작성 — N-3 확정(RN+Expo) 반영, 기존 HTML/CSS 구현 이식 규칙 포함 |
| v1.1 | 2026-08-29 | ADR 0015 반영 — §10 빌드 순서(증인 수·광고 배치), §12-1 P4 문구(노출형/보상형 구분) |
| v1.2 | 2026-08-29 | 구현 검토 후 정합 — §7-3 Edge Function 표 전면 갱신(누락 10개·유령 promise-cancel 제거), §7-4 J-11, §8 클라이언트 env·서버 시크릿 목록 현행화, EVIDENCE_RETENTION_DAYS 폐기 |
