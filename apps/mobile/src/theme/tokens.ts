/**
 * 디자인 토큰 — `design-reference/styles/tokens.css` 이식본 (04 §5-1).
 *
 * **CSS 의 px 값이 곧 RN 의 dp 다.** 원본이 360×800dp 뷰포트 기준으로 작성됐기 때문에
 * 숫자를 그대로 옮긴다. 환산하지 않는다.
 *
 * 원본은 `tokens.css` 이고 여기는 사본이다. 둘이 어긋나면 고칠 쪽은 **항상 이 파일**이다.
 * `tokens.test.ts` 가 CSS 를 파싱해 기계적으로 대조하므로 조용히 어긋날 수는 없다.
 *
 * 화면·컴포넌트 코드에 색·크기·여백·둥글기를 직접 쓰지 않는다. 값이 없으면
 * **토큰을 먼저 추가**하고 `design-reference/styles/tokens.css` 에도 같은 값을 반영한다.
 */

export const colors = {
  // 브랜드 로즈 — 새끼손가락 걸기 모티프
  primary: '#C74B64',
  onPrimary: '#FFFFFF',
  primaryContainer: '#FFD9DE',
  onPrimaryContainer: '#400A18',
  primarySoft: '#FEF0F2',
  primaryPale: '#F49BA6',
  primaryInk: '#7A4A52',

  // 표면
  background: '#FFF8F8',
  surface: '#FFFFFF',
  surfaceChrome: '#FFFDFD',
  surfaceMuted: '#F4E4E7',

  // 외곽선
  outline: '#F6E0E3',
  outlineStrong: '#DFC3C7',
  outlineIcon: '#B99CA1',

  // 텍스트
  text: '#22191A',
  textSecondary: '#574144',
  textMuted: '#9B8286',
  textFaint: '#AD9296',

  // 보상 / 벌칙 (§9 용어: Reward=보상, Penalty=벌칙)
  rewardContainer: '#FFDBC8',
  onRewardContainer: '#331200',
  rewardLabel: '#7A3E12',
  penaltyContainer: '#F4E4E7',
  onPenaltyContainer: '#3A2A2D',
  penaltyLabel: '#7A4A52',

  // 오류 · 불이행
  error: '#8C1D18',
  errorContainer: '#F9DEDC',

  // 성공 · 완료
  success: '#1B6B4A',
  successContainer: '#CFEDDD',

  // 카카오 로그인 공식 버튼 가이드 색
  kakao: '#FEE500',
  onKakao: '#191919',

  scrim: 'rgba(34, 25, 26, 0.42)',
} as const;

/**
 * RN 은 CSS 처럼 폰트 스택을 못 받고 패밀리 하나만 받는다.
 * 실제 굵기별 파일 선택은 `LfText` 가 한다 — RN 안드로이드는 가변 폰트의 웨이트 축이
 * 불안정해서 정적 `.ttf` 4종(400/600/700/800)을 쓰기 때문이다(04 §5-4).
 */
export const fontFamily = {
  brand: 'Pretendard',
  mono: 'Roboto Mono',
} as const;

export const type = {
  display: 28, // D-Day 대형 숫자
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

/** 핑키는 M3 기본보다 한 단계 더 둥글다. */
export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 28,
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
  fabHeight: 56,
  tabHeight: 38,
  /** SCR-A06 승인 레퍼런스의 정사각형 증빙 타일. */
  evidenceThumb: 84,
} as const;

/**
 * CSS `box-shadow` 는 RN 에 없다. iOS 용 shadow* 속성과 안드로이드용 `elevation` 을 함께 준다.
 * MVP 는 안드로이드만이므로 실제로 그려지는 건 `elevation` 쪽이다.
 */
export const elevation = {
  // 0 1px 3px rgba(34, 25, 26, 0.06)
  card: {
    shadowColor: '#22191A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  // 0 8px 20px rgba(199, 75, 100, 0.4)
  fab: {
    shadowColor: '#C74B64',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  // 0 -8px 28px rgba(34, 25, 26, 0.16) — 시트는 위로 그림자를 던진다
  sheet: {
    shadowColor: '#22191A',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
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
  standard: [0.2, 0, 0, 1],
  emphasizedDecelerate: [0.05, 0.7, 0.1, 1],
} as const;

/** ms */
export const duration = {
  short: 200,
  medium: 350,
  long: 500,
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
