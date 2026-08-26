import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../theme/tokens';

/**
 * 잉크&스티커 마스코트 — 버터 블롭 + 얼굴 (.sl-mascot, ADR 0012).
 *
 * 로그인·온보딩 배지 안에서만 쓴다. 색은 하드코딩하지 않고 전부 토큰이다:
 * 몸통=primary-container(버터), 선·눈=text(잉크). 장식이므로 기본은 접근성 트리에서
 * 숨기고, 배지처럼 이미지 역할이 필요한 자리는 부모가 role/label 을 단다.
 */

// CSS 원본 크기: 로그인 132px · 온보딩 배지 안 124px (.sl-mascot)
export type LfMascotSize = 'login' | 'onboarding';

const SIZES: Record<LfMascotSize, number> = {
  login: 132,
  onboarding: 124,
};

// 스트로크 굵기는 viewBox(120) 기준 — CSS 원본과 동일
const BODY_STROKE = 3.2;
const SMILE_STROKE = 3;
const EYE_RADIUS = 4.6;

export function LfMascot({ size = 'login' }: { size?: LfMascotSize }): React.JSX.Element {
  const px = SIZES[size];
  return (
    <Svg width={px} height={px} viewBox="0 0 120 120" testID="lf-mascot">
      <Path
        fill={colors.primaryContainer}
        stroke={colors.text}
        strokeWidth={BODY_STROKE}
        strokeLinejoin="round"
        d="M60 12q22-5 34 12 14 10 8 30 6 24-15 33-18 12-38 4-24 0-30-21-9-20 5-36 7-20 36-22Z"
      />
      <Circle fill={colors.text} cx={45} cy={47} r={EYE_RADIUS} />
      <Circle fill={colors.text} cx={76} cy={47} r={EYE_RADIUS} />
      <Path
        fill="none"
        stroke={colors.text}
        strokeWidth={SMILE_STROKE}
        strokeLinecap="round"
        d="M48 61q12 10 24 0"
      />
    </Svg>
  );
}
