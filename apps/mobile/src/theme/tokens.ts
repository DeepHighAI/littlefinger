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
  // 잉크 브랜드 — 잉크&스티커 (시안 1a, PO 2026-08-27). 브랜드·강조·선택.
  primary: '#221C13',
  primaryHover: '#16120C',
  primaryPressed: '#0B0906',
  onPrimary: '#FFFDF4',
  primaryContainer: '#F6E7A3', // 버터 스티커
  onPrimaryContainer: '#221C13',
  primarySoft: '#FBF6E4',
  primaryPale: '#CDBCEC', // 라벤더 — 핑키 보조 획
  primaryInk: '#221C13',

  // 핵심 행동 — 검정 필 CTA, 텍스트는 크림.
  actionFill: '#221C13',
  actionFillPressed: '#000000',
  onAction: '#FFFDF4',
  // PO 승인 브랜드 심볼 전용 단색. UI primary와 독립적으로 유지한다.
  brandSymbol: '#221C13',
  brandSymbolOnAction: '#F6E7A3',

  // 확정 기록·정보 — 라벤더 계열.
  record: '#6B58A8',
  onRecord: '#FFFDF4',
  recordContainer: '#E7DFF6',

  // 마감·응답 필요 — 살구 계열.
  attention: '#B05F2C',
  attentionContainer: '#F8DDBE',

  // 표면 — 크림 바탕 + 오프화이트 스티커 면.
  background: '#F3ECDC',
  surface: '#FFFDF4',
  surfaceChrome: '#FFFDF4',
  surfaceMuted: '#EAE1CB',

  // 외곽선 — 굵은 잉크 테두리는 컴포넌트 레이어에서 colors.text 로 긋는다.
  outline: '#E0D5BA',
  outlineStrong: '#B8AB92',
  outlineIcon: '#8A7E66',
  focusRing: '#6B58A8',

  // 텍스트 — 따뜻한 잉크 위계.
  text: '#221C13',
  textSecondary: '#6F6552',
  textMuted: '#706652',
  textFaint: '#716653',

  // 보상 / 벌칙 (§9 용어: Reward=보상, Penalty=벌칙) — 보상=라벤더, 벌칙=살구
  rewardContainer: '#E7DFF6',
  onRewardContainer: '#3E3372',
  rewardLabel: '#6B58A8',
  penaltyContainer: '#F8DDBE',
  onPenaltyContainer: '#6B3B14',
  penaltyLabel: '#A85B1E',

  // 오류 · 불이행 — 실제 위험에만 쓴다.
  error: '#C4433B',
  errorContainer: '#F8DFDB',

  // 성공 · 완료 — 잉크 + 버터 스티커 (모노 팔레트 원칙, 상태는 텍스트가 구분)
  success: '#221C13',
  successContainer: '#F6E7A3',

  // 카카오 로그인 공식 버튼 가이드 색
  kakao: '#FEE500',
  onKakao: '#191919',

  // Google 로그인 공식 버튼 가이드 색 (light)
  google: '#FFFFFF',
  onGoogle: '#1F1F1F',
  googleBorder: '#747775',

  scrim: 'rgba(20, 15, 8, 0.42)',
} as const;

/**
 * RN 은 CSS 처럼 폰트 스택을 못 받고 패밀리 하나만 받는다.
 * 실제 굵기별 파일 선택은 `LfText` 가 한다. Pretendard 400/600/700/800 정적 파일은
 * `fonts.ts` 의 매핑을 거친다(04 §5-4 의 정적 파일 원칙 유지).
 *
 * **여기 값은 tokens.css 와의 이름 패리티용이지 등록된 RN 패밀리가 아니다.**
 * 네이티브에 등록된 이름은 `Pretendard-Regular` 등 굵기별 이름뿐이라,
 * `fontFamily.brand` 를 style 에 직접 넣으면 조용히 시스템 폰트로 떨어진다 —
 * 반드시 `textFontFamily(weight)` 를 거친다.
 */
export const fontFamily = {
  brand: 'Pretendard',
  mono: 'Pretendard',
} as const;

export const type = {
  display: 30, // D-Day 대형 숫자
  listDday: 16, // 홈 일반 행 D-Day
  heroDday: 46, // 히어로 D-Day
  title: 22, // 화면 타이틀 · 상세 제목
  heading: 20, // 앱바 타이틀 · 섹션 헤드
  subtitle: 18,
  bodyLg: 17, // 카드 제목 · 주 CTA 라벨
  body: 15,
  label: 14,
  caption: 12.5,
  micro: 11.5,
} as const;

export const line = {
  title: 30,
  heroDday: 50,
  body: 22,
  caption: 18,
  micro: 16,
} as const;

/** RN `fontWeight` 는 문자열을 받는다. 실제 Pretendard 정적 파일 네 종과 1:1이다. */
export const weight = {
  regular: '400',
  medium: '600',
  bold: '700',
  heavy: '800',
} as const;

/** 셋로그식 오버라운드 + 필 (ADR 0012). */
export const radius = {
  xs: 8,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 16,
  '2xl': 24,
  hero: 28,
  heroTail: 12,
  record: 18,
  pill: 9999,
} as const;

/** 굵은 잉크 테두리 굵기 (ADR 0012). 색은 colors.text 로 긋는다. */
export const border = {
  /** 바텀시트 상단·측면 테두리 — .lf-sheet 의 2.5px 그대로. */
  sheet: 2.5,
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
  ctaHeight: 54,
  actionHeight: 48,
  fabHeight: 54,
  tabHeight: 38,
  bottomNavContentHeight: 64,
  centerFab: 54,
  navIcon: 26,
  appbarIcon: 26,
  /** SCR-A06 승인 레퍼런스의 정사각형 증빙 타일. */
  evidenceThumb: 84,
} as const;

/**
 * CSS `box-shadow` 는 RN 에 없다. iOS 용 shadow* 속성과 안드로이드용 `elevation` 을 함께 준다.
 * MVP 는 안드로이드만이므로 실제로 그려지는 건 `elevation` 쪽이다.
 * 스티커식 오프셋 섀도(블러 0)는 안드로이드에서 elevation 근사로 그려진다 (ADR 0012).
 */
export const elevation = {
  // 3px 4px 0 rgba(34, 28, 19, 0.14) — 잉크 테두리 카드의 오프셋 스티커 섀도
  card: {
    shadowColor: '#221C13',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 0,
    elevation: 1,
  },
  // 3px 4px 0 rgba(34, 28, 19, 0.22) — CTA·FAB 는 같은 오프셋에 더 진하게
  fab: {
    shadowColor: '#221C13',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 0,
    elevation: 8,
  },
  // 0 -6px 24px rgba(34, 28, 19, 0.12) — 시트는 위로 그림자를 던진다 (블러 유지)
  sheet: {
    shadowColor: '#221C13',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
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
