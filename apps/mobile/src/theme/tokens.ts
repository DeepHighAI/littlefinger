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

import type { TextFontWeight } from './fonts';

export const colors = {
  // 잉크 브랜드 — 잉크 & 블록 (PO 2026-09-06). 브랜드·강조·선택.
  primary: '#221C13',
  primaryHover: '#16120C',
  primaryPressed: '#0B0906',
  onPrimary: '#FFFDF4',
  primaryContainer: '#FFD43B', // 옐로 스티커 — 브랜드·선택·읽지 않음
  onPrimaryContainer: '#221C13',
  primarySoft: '#FFF6CC',
  primaryPale: '#6CB4FF', // 스카이 — 보조 획·진행바
  primaryInk: '#221C13',

  // 핵심 행동 — 검정 필 CTA, 텍스트는 크림.
  actionFill: '#221C13',
  actionFillPressed: '#000000',
  onAction: '#FFFDF4',
  // 브랜드 심볼 전용 단색. CTA 안 옐로 원은 brandSymbolOnAction.
  brandSymbol: '#221C13',
  brandSymbolOnAction: '#FFD43B',

  // 확정 기록·정보·변경 협의 — 스카이 스티커. 파스텔 위 글자는 언제나 잉크(색 글자 폐지).
  record: '#221C13',
  onRecord: '#FFFDF4',
  recordContainer: '#6CB4FF',

  // 마감·응답 필요·이행 확인 — 핑크 스티커.
  attention: '#221C13',
  attentionContainer: '#FF6F91',

  // 표면 — 크림 바탕 + 오프화이트 스티커 면. 앱바는 투명이라 크림이 비친다.
  background: '#FBF8F1',
  surface: '#FFFDF4',
  surfaceChrome: '#FBF8F1',
  surfaceMuted: '#EFE9DC',

  // 외곽선 — 굵은 잉크 테두리는 컴포넌트 레이어에서 colors.text 로 긋는다.
  outline: '#EFE9DC',
  outlineStrong: '#6F6552',
  outlineIcon: '#221C13',
  // 스카이의 잉크 톤. 확정안에 없는 파생값 — 크림·종이·파스텔 4면 위 3:1 이상이면서 잉크와 다르다.
  focusRing: '#2F6FB3',

  // 텍스트 — 따뜻한 잉크 위계.
  text: '#221C13',
  textSecondary: '#6F6552',
  textMuted: '#6F6552',
  textFaint: '#6F6552',

  // 보상 / 벌칙 (§9 용어: Reward=보상, Penalty=벌칙) — 보상=스카이, 벌칙=핑크, 글자는 잉크
  rewardContainer: '#6CB4FF',
  onRewardContainer: '#221C13',
  rewardLabel: '#221C13',
  penaltyContainer: '#FF6F91',
  onPenaltyContainer: '#221C13',
  penaltyLabel: '#221C13',

  // 오류 — 실제 위험에만 쓴다. 불이행은 빨강이 아니라 핑크(벌칙) 스티커다 (D7).
  error: '#C4433B',
  errorContainer: '#F8DFDB',

  // 성공 · 진행 · 완료 — 민트 스티커 (상태는 텍스트가 구분)
  success: '#221C13',
  successContainer: '#5FD3A5',

  // 카카오 로그인 공식 버튼 가이드 색
  kakao: '#FEE500',
  onKakao: '#191919',

  // Google 로그인 공식 버튼 가이드 색 (light)
  google: '#FFFFFF',
  onGoogle: '#1F1F1F',
  googleBorder: '#747775',

  scrim: 'rgba(34, 28, 19, 0.42)',
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
  wordmark: 40, // A01 워드마크
  display: 36, // A00 헤드라인
  headline: 30, // A02 인사
  title: 24, // 화면 h2 · A06 질문 · MOD-03
  sheetTitle: 20, // 시트 제목 · 카운트다운
  heading: 20, // 섹션 헤드
  appbar: 16, // 앱바 제목 (신설 2026-09-06)
  cardTitle: 22, // 임박 카드
  subtitle: 18,
  stamp: 17, // 스탬프 헤드라인 · 선택 카드
  bodyLg: 17, // 카드 제목 · 주 CTA 라벨
  body: 15,
  label: 14,
  chip: 13, // 칩
  caption: 12.5,
  meta: 12, // 메타 · 시각
  micro: 11.5,
  eyebrow: 11, // 섹션 라벨 `TITLE · 제목`
} as const;

export const line = {
  wordmark: 46,
  display: 42,
  headline: 36,
  title: 30,
  cardTitle: 28,
  bodyStrong: 20,
  body: 22,
  caption: 18,
  micro: 16,
} as const;

/** RN `fontWeight` 는 문자열을 받는다. 실제 Pretendard 정적 파일 네 종과 1:1이다 — `satisfies` 가 타입으로 묶는다. */
export const weight = {
  regular: '500',
  medium: '600',
  bold: '800',
  heavy: '900',
} as const satisfies Record<'regular' | 'medium' | 'bold' | 'heavy', TextFontWeight>;

/**
 * 자간 — CSS 의 em 값. RN `letterSpacing` 은 px 라서 소비자가 `fontSize × em` 으로 환산한다.
 * 환산은 `LfText` 한 곳에서만 한다.
 */
export const letterSpacing = {
  tight: -0.03, // 큰 제목
  wide: 0.12, // 섹션 라벨
  wider: 0.16, // 헤더 eyebrow
  wordmark: -0.04,
} as const;

/** 카드·CTA 14 · 탭·입력·타일 10 · 상태 칩 8 · 아이콘 타일 12 · 시트 20 · 필은 헤더·아바타·마스코트 원만. */
export const radius = {
  xs: 8,
  sm: 10, // 입력
  md: 14, // 썸네일 · 점선 타일
  lg: 14, // 리스트 카드 · 보상/벌칙 스티커
  xl: 14, // 스티커 카드
  '2xl': 12, // 아이콘 타일
  hero: 20, // 시트 상단
  pill: 9999,
} as const;

/** 굵은 잉크 테두리 굵기 (ADR 0012). 색은 colors.text 로 긋는다. */
export const border = {
  /** 칩 · 입력 · 아이콘 버튼 · 아바타 */
  chip: 2,
  /** 스티커 카드 */
  card: 2.5,
  /** 아웃라인 버튼 */
  outline: 2.5,
  /** 바텀시트 · 카카오 버튼 · 블롭 스트로크 */
  sheet: 2.5,
  /** 점선 구분선 · 사진 추가 타일 */
  dashed: 2,
  /** 승인 대기 아바타 점선 */
  pending: 2,
} as const;

/**
 * 기울기 — RN `transform: [{ rotate }]` 가 문자열을 받으므로 deg 문자열 그대로 둔다.
 * 잉크 & 블록(2026-09-06)은 기울기를 폐지했다 — 이름 계약만 남기고 값은 전부 0 이다.
 */
export const tilt = {
  sticker: '0deg', // 스탬프 · 선택됨 · 슬롯 제안 · 신뢰 카드
  hero: '0deg', // 임박 카드 · 필 배지
  blob: '0deg', // 히어로 블롭
  empty: '0deg', // 히스토리 빈 블롭
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
  /** 사각 아이콘 버튼 36 r10 — hitSlop 으로 48 을 채운다 */
  iconButton: 36,
  appbarHeight: 52,
  /** 블록 CTA */
  ctaHeight: 56,
  /** CTA 안 옐로 사각 40 r10 */
  iconCircle: 40,
  /** 카카오 버튼 (공식 가이드) */
  kakaoHeight: 54,
  /** 아웃라인 · 하단 쌍 버튼 */
  actionHeight: 50,
  /** 좌우 16 풀폭 하단 CTA */
  fabHeight: 56,
  /** 필터 칩 */
  tabHeight: 34,
  chipSelectHeight: 36,
  chipMetaHeight: 28,
  chipStatusHeight: 28,
  inputHeight: 48,
  textareaMinHeight: 84,
  cardPadding: 16,
  /** 36 사각 안 글리프 */
  appbarIcon: 20,
  switchWidth: 52,
  switchHeight: 32,
  switchKnob: 20,
  trustRing: 88,
  trustRingStroke: 12,
  ddayCircle: 56,
  avatarSm: 34,
  avatarLg: 48,
  avatarXl: 56,
  thumb: 84,
  thumbLg: 84,
  statusDot: 10,
  /** 리스트 행 상태 타일 40 r10 (상태 도트 10 은 칩 점·배지용으로 남는다) */
  statusTile: 40,
  progressHeight: 10,
  sheetHandleWidth: 40,
  sheetHandleHeight: 5,
  /** 홈 하단 페이드 */
  fadeHeight: 130,
  fadeHeightSm: 110,
  // E-1 마스코트 · C-1 손 (손 폭은 size × 804/763)
  mascotSm: 28,
  mascotMd: 34,
  mascotLg: 46,
  pinkySm: 28,
  pinkyMd: 40,
  pinkyLg: 72,
  pinkyEyes: 44,
  eyesRow: 26,
  eyesHeader: 44,
  eyesCard: 56,
  eyesBlob: 68,
  heroBlobHeight: 290,
  loginBlobHeight: 200,
  stampPillWidth: 100,
  stampPillHeight: 60,
  /** SCR-A06 승인 레퍼런스의 정사각형 증빙 타일 (= thumbLg). */
  evidenceThumb: 84,
} as const;

/**
 * 잉크 & 블록의 하드 섀도(blur 0 · 잉크 100%)는 RN New Architecture 의 `boxShadow` 로 그린다 —
 * 안드로이드 `elevation` 은 흐린 회색 그림자라 45° 잉크 블록을 못 그린다.
 * 눌림(translate 3 + 그림자 5→2 · 3→0)은 번들 tokens.css 에 토큰이 없어 소비자가 리터럴로 쓴다 — ADR 0020 예외.
 */
const inkShadow = (offset: number) =>
  ({
    boxShadow: [
      { offsetX: offset, offsetY: offset, blurRadius: 0, spreadDistance: 0, color: colors.text },
    ],
  }) as const;

export const elevation = {
  /** 5px 5px 0 잉크 — 카드 · 헤더 필 · 히어로 · 스탬프 */
  card: inkShadow(5),
  /** 5px 5px 0 잉크 — 주 CTA · 풀폭 하단 버튼 */
  fab: inkShadow(5),
  /** 3px 3px 0 잉크 — 선택 탭 · outlined · kakao · 피커 · 포커스 */
  sm: inkShadow(3),
  /** none — 시트는 테두리만 */
  sheet: { boxShadow: [] as const },
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
  pinky: [0.32, 0.72, 0, 1], // C-1 손 루프 (확정안 캔버스 키프레임)
} as const;

/** ms */
export const duration = {
  short: 120,
  medium: 240,
  long: 400,
  pinky: 2600, // C-1 손 루프 한 주기
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
