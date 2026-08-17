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
  // 브랜드 그린 — 새끼손가락 걸기 모티프
  primary: '#00BF40',
  primaryHover: '#00A435',
  primaryPressed: '#008629',
  onPrimary: '#FFFFFF',
  primaryContainer: '#DBFBE5',
  onPrimaryContainer: '#02220C',
  primarySoft: '#F0FDF4',
  primaryPale: '#6FE69C',
  primaryInk: '#006420',

  // 표면
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceChrome: '#FFFFFF',
  surfaceMuted: '#F7F7F8',

  // 외곽선
  outline: 'rgba(112, 115, 124, 0.22)',
  outlineStrong: 'rgba(112, 115, 124, 0.40)',
  outlineIcon: '#AEB0B6',

  // 텍스트
  text: '#171719',
  textSecondary: '#46474C',
  textMuted: '#70737C',
  textFaint: '#989BA2',

  // 보상 / 벌칙 (§9 용어: Reward=보상, Penalty=벌칙)
  rewardContainer: '#EAF2FE',
  onRewardContainer: '#002566',
  rewardLabel: '#003A91',
  penaltyContainer: '#FFD9C2',
  onPenaltyContainer: '#3D0505',
  penaltyLabel: '#7D2E00',

  // 오류 · 불이행
  error: '#C81616',
  errorContainer: '#FFE9E9',

  // 성공 · 완료
  success: '#008629',
  successContainer: '#DBFBE5',

  // 카카오 로그인 공식 버튼 가이드 색
  kakao: '#FEE500',
  onKakao: '#191919',

  scrim: 'rgba(0, 0, 0, 0.40)',
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

/** Fresh Green은 Wanted 12dp 입력·버튼 기준의 절제된 곡률을 쓴다. */
export const radius = {
  xs: 8,
  sm: 12,
  md: 12,
  lg: 16,
  xl: 16,
  '2xl': 20,
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
  /** SCR-A06 승인 레퍼런스의 정사각형 증빙 타일. */
  evidenceThumb: 84,
} as const;

/**
 * CSS `box-shadow` 는 RN 에 없다. iOS 용 shadow* 속성과 안드로이드용 `elevation` 을 함께 준다.
 * MVP 는 안드로이드만이므로 실제로 그려지는 건 `elevation` 쪽이다.
 */
export const elevation = {
  // CSS의 두 겹 카드 그림자 중 더 강한 층을 RN 단일 그림자로 보존한다.
  card: {
    shadowColor: '#171717',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  // 0 8px 24px rgba(0, 0, 0, 0.08)
  fab: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  // 0 -8px 28px rgba(0, 0, 0, 0.12) — 시트는 위로 그림자를 던진다
  sheet: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
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
