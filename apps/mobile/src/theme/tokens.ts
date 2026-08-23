/**
 * 디자인 토큰 — `design-reference/styles/tokens.css` 이식본 (04 §5-1).
 *
 * **CSS 의 px 값이 곧 RN 의 dp 다.** 원본이 360×800dp 뷰포트 기준으로 작성됐기 때문에
 * 숫자를 그대로 옮긴다. 환산하지 않는다.
 *
 * 원본은 `tokens.css` 이고 여기는 사본이다. 둘이 어긋나면 canonical CSS를 먼저 고치고
 * 그 값을 이 파일에 기계적으로 미러링한다.
 * `tokens.test.ts` 가 CSS 를 파싱해 기계적으로 대조하므로 조용히 어긋날 수는 없다.
 *
 * 화면·컴포넌트 코드에 색·크기·여백·둥글기를 직접 쓰지 않는다. 값이 없으면
 * **토큰을 먼저 추가**하고 `design-reference/styles/tokens.css` 에도 같은 값을 반영한다.
 */

export const colors = {
  // Pine 브랜드 — 브랜드·승인·진행에만 쓴다 (A안, PO 2026-08-23).
  primary: '#0B6B4B',
  primaryHover: '#095D41',
  primaryPressed: '#084E37',
  onPrimary: '#FFFFFF',
  primaryContainer: '#E7F4ED',
  onPrimaryContainer: '#0B6B4B',
  primarySoft: '#F3FAF6',
  primaryPale: '#78CEA5',
  primaryInk: '#0B6B4B',

  // 핵심 행동 — 브랜드보다 밝게, 텍스트는 짙은 녹색으로 읽힌다.
  actionFill: '#78CEA5',
  actionFillPressed: '#62BF92',
  onAction: '#12382B',
  // PO 승인 브랜드 심볼 전용 단색. UI primary와 독립적으로 유지한다.
  brandSymbol: '#0B6B4B',
  brandSymbolOnAction: '#FFF8E7',

  // Quiet Record — 확정 기록과 일반 정보에만 쓴다.
  record: '#466FA8',
  onRecord: '#FFFFFF',
  recordContainer: '#EAF1FB',

  // Promise Apricot — 마감 임박·응답 필요처럼 주의가 필요한 약속에 쓴다.
  attention: '#B86A24',
  attentionContainer: '#FFF1E6',

  // 표면 — 전체 면의 대부분은 저채도 중립색이 맡는다.
  background: '#F7F8F6',
  surface: '#FFFFFF',
  surfaceChrome: '#FFFFFF',
  surfaceMuted: '#F1F3F2',

  // 외곽선 — 그림자보다 헤어라인으로 면을 가른다.
  outline: '#E2E6E3',
  outlineStrong: '#CFD6D2',
  outlineIcon: '#9AA39E',

  // 텍스트 — 따뜻한 중립 위계.
  text: '#191C1B',
  textSecondary: '#5F6864',
  textMuted: '#7B837F',
  textFaint: '#9AA39E',

  // 보상 / 벌칙 (§9 용어: Reward=보상, Penalty=벌칙)
  rewardContainer: '#EAF1FB',
  onRewardContainer: '#29466F',
  rewardLabel: '#466FA8',
  penaltyContainer: '#FFF1E6',
  onPenaltyContainer: '#6B3B14',
  penaltyLabel: '#B86A24',

  // 오류 · 불이행 — 실제 위험에만 쓴다.
  error: '#C4433B',
  errorContainer: '#FCECEA',

  // 성공 · 완료
  success: '#0B6B4B',
  successContainer: '#E7F4ED',

  // 카카오 로그인 공식 버튼 가이드 색
  kakao: '#FEE500',
  onKakao: '#191919',

  // Google 로그인 공식 버튼 가이드 색 (light)
  google: '#FFFFFF',
  onGoogle: '#1F1F1F',
  googleBorder: '#747775',

  scrim: 'rgba(0, 0, 0, 0.40)',
} as const;

/**
 * RN 은 CSS 처럼 폰트 스택을 못 받고 패밀리 하나만 받는다.
 * 실제 굵기별 파일 선택은 `LfText` 가 한다 — RN 안드로이드는 가변 폰트의 웨이트 축이
 * 불안정해서 정적 `.ttf` 4종(400/600/700/800)을 쓰기 때문이다(04 §5-4).
 *
 * **여기 값은 tokens.css 와의 이름 패리티용이지 등록된 RN 패밀리가 아니다.**
 * 네이티브에 등록된 이름은 `Pretendard-Regular` 등 굵기별 이름뿐이라,
 * `fontFamily.brand` 를 style 에 직접 넣으면 조용히 시스템 폰트로 떨어진다 —
 * 반드시 `brandFontFamily(weight)` 를 거친다.
 */
export const fontFamily = {
  brand: 'Pretendard',
  mono: 'Roboto Mono',
} as const;

export const type = {
  display: 28, // D-Day 대형 숫자
  listDday: 15, // 홈 일반 행 D-Day
  heroDday: 46, // Soft Promise 히어로 D-Day
  title: 21, // 화면 타이틀 · 상세 제목
  heading: 19, // 앱바 타이틀 · 섹션 헤드
  subtitle: 17,
  bodyLg: 16, // 카드 제목 · 주 CTA 라벨
  body: 14,
  label: 13,
  caption: 12,
  micro: 11,
} as const;

export const line = {
  title: 28,
  heroDday: 50,
  body: 21,
  caption: 18,
  micro: 16,
} as const;

/** RN `fontWeight` 는 문자열을 받는다. */
export const weight = {
  regular: '400',
  medium: '600',
  bold: '700',
  heavy: '800',
} as const;

/** 당근 seed에서 가져온 반듯한 곡률 위계 (ADR 0008). */
export const radius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 12,
  '2xl': 20,
  hero: 28,
  heroTail: 12,
  record: 16,
  pill: 9999,
} as const;

export const space = {
  1: 4,
  2: 6,
  3: 8,
  4: 10,
  5: 12,
  6: 14,
  7: 16,
  8: 20,
  9: 24,
} as const;

/** 화면 좌우 기본 여백 — 앱 16dp, 수락 웹 20dp */
export const gutter = {
  app: 16,
  web: 20,
} as const;

export const size = {
  /** 접근성 하한. **줄이지 않는다**(디자인요청서 §8). */
  touchMin: 48,
  iconButton: 44,
  appbarHeight: 56,
  ctaHeight: 52,
  actionHeight: 48,
  fabHeight: 52,
  tabHeight: 38,
  bottomNavContentHeight: 64,
  centerFab: 52,
  navIcon: 26,
  appbarIcon: 26,
  /** SCR-A06 승인 레퍼런스의 정사각형 증빙 타일. */
  evidenceThumb: 84,
} as const;

/**
 * CSS `box-shadow` 는 RN 에 없다. iOS 용 shadow* 속성과 안드로이드용 `elevation` 을 함께 준다.
 * MVP 는 안드로이드만이므로 실제로 그려지는 건 `elevation` 쪽이다.
 */
export const elevation = {
  // 0 1px 2px rgba(25, 28, 27, 0.04) — 당근식 최소 그림자, 면 구분은 헤어라인이 맡는다
  card: {
    shadowColor: '#191C1B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  // CSS의 두 겹 FAB 그림자 중 더 강한 층을 RN 단일 그림자로 보존한다.
  // 0 6px 16px rgba(25, 28, 27, 0.14)
  fab: {
    shadowColor: '#191C1B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  // 0 -6px 24px rgba(25, 28, 27, 0.10) — 시트는 위로 그림자를 던진다
  sheet: {
    shadowColor: '#191C1B',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

/**
 * cubic-bezier 인자를 그대로 둔다.
 *
 * 04 §5-1 은 `Easing.bezier(...)` 로 만들라고 하지만, 그러면 이 파일이
 * react-native-reanimated 를 import 하게 되고 토큰이 플랫폼에 묶인다.
 * 계수만 들고 있다가 애니메이션 쪽에서 `Easing.bezier(...easing.standard)` 로 만든다.
 */
export const easing = {
  standard: [0, 0, 0, 1],
  emphasizedDecelerate: [0.05, 0.7, 0.1, 1],
} as const;

/** ms */
export const duration = {
  short: 120,
  medium: 240,
  long: 400,
  hook: 3400, // 새끼손가락 걸기 루프 (Q-3)
} as const;

/**
 * 일부러 이식하지 않은 토큰. 파리티 테스트가 이 목록을 근거로 "누락이 아니라 제외"임을 확인한다.
 * 사유 없이 여기 추가하지 않는다.
 */
export const NOT_PORTED_TOKENS: readonly { token: string; reason: string }[] = [
  {
    token: 'color-frame-border',
    reason: '미리보기용 기기 프레임 테두리 색. 실제 앱에는 프레임이 없다.',
  },
  {
    token: 'browserbar-height',
    reason: '수락 웹의 브라우저 크롬 높이. 앱에는 LfAppBar 가 그 자리를 대신한다.',
  },
  {
    token: 'viewport-width',
    reason: '기준 뷰포트 폭. 실제 기기 화면 크기가 대신하므로 값으로 들고 있으면 안 된다.',
  },
  {
    token: 'viewport-height',
    reason: '기준 뷰포트 높이. 위와 같은 이유로 이식하지 않는다.',
  },
  {
    token: 'statusbar-height',
    reason: '미리보기가 그리던 상태 표시줄 높이. RN 에서는 SafeAreaView 가 실제 값을 준다.',
  },
  {
    token: 'navbar-height',
    reason: '미리보기가 그리던 제스처 바 높이. RN 에서는 SafeAreaView 가 실제 값을 준다.',
  },
];
