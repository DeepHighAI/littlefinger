import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, border, elevation } from '../theme/tokens';

/**
 * 불규칙 타원 마스코트 아트 (README §마스코트). RN 은 타원 모서리를 못 그리므로 CSS
 * `border-radius: 62% 38% 55% 45% / 42% 60% 40% 58%` 를 SVG 호 4개로 옮긴다.
 * 하드 섀도는 같은 경로를 5 만큼 밀어 잉크로 채운 것이라 `overflow: hidden` 에 잘리지 않는다.
 */
export type LfOvalVariant = 'tile' | 'hint' | 'history' | 'celebrate' | 'web' | 'login';
export type LfOvalTone = 'yellow' | 'paper' | 'muted';

export interface LfOvalProps extends Omit<ViewProps, 'style'> {
  variant: LfOvalVariant;
  tone?: LfOvalTone;
}

/** 모서리 반지름 % — CSS 순서 TL·TR·BR·BL, 가로/세로 */
type Radii = { readonly x: readonly [number, number, number, number]; readonly y: readonly [number, number, number, number] };

const OUTER: Radii = { x: [62, 38, 55, 45], y: [42, 60, 40, 58] };
const INNER: Radii = { x: [40, 60, 48, 52], y: [58, 42, 62, 38] };

/** 아트 치수와 안쪽 흰 타원 inset(top right bottom left) — README 값, 토큰 없음(ADR 0020 예외) */
const ART: Record<LfOvalVariant, {
  width: number;
  height: number;
  border: number;
  shadow: number;
  inner: readonly [number, number, number, number] | null;
}> = {
  tile: { width: 36, height: 34, border: border.chip, shadow: 0, inner: null },
  hint: { width: 60, height: 56, border: border.chip, shadow: 0, inner: null },
  history: { width: 130, height: 104, border: border.card, shadow: elevation.card.boxShadow[0].offsetX, inner: [16, 22, 16, 18] },
  celebrate: { width: 170, height: 136, border: border.card, shadow: elevation.card.boxShadow[0].offsetX, inner: [20, 30, 22, 24] },
  web: { width: 190, height: 152, border: border.card, shadow: elevation.card.boxShadow[0].offsetX, inner: [22, 32, 24, 26] },
  login: { width: 220, height: 200, border: border.card, shadow: elevation.card.boxShadow[0].offsetX, inner: [30, 40, 34, 32] },
};

/** A00·A01 은 옛 연한 옐로와 -2° 기울기를 유지한다 (PO E11, ADR 0020 예외) */
const LOGIN_YELLOW = '#FFE59A';
const LOGIN_TILT = '-2deg';

const toneFill: Record<LfOvalTone, string> = {
  yellow: colors.primaryContainer,
  paper: colors.surface,
  muted: colors.surfaceMuted,
};

/** CSS 규칙대로 인접 반지름 합이 변 길이를 넘으면 전부 같은 비율로 줄인다. */
function ovalPath(x: number, y: number, w: number, h: number, radii: Radii): string {
  const rx = radii.x.map((p) => (p / 100) * w);
  const ry = radii.y.map((p) => (p / 100) * h);
  const f = Math.min(
    1,
    w / ((rx[0] ?? 0) + (rx[1] ?? 0)),
    w / ((rx[2] ?? 0) + (rx[3] ?? 0)),
    h / ((ry[1] ?? 0) + (ry[2] ?? 0)),
    h / ((ry[0] ?? 0) + (ry[3] ?? 0)),
  );
  const [xTL = 0, xTR = 0, xBR = 0, xBL = 0] = rx.map((v) => v * f);
  const [yTL = 0, yTR = 0, yBR = 0, yBL = 0] = ry.map((v) => v * f);
  return [
    `M${x + xTL} ${y}`,
    `L${x + w - xTR} ${y}`,
    `A${xTR} ${yTR} 0 0 1 ${x + w} ${y + yTR}`,
    `L${x + w} ${y + h - yBR}`,
    `A${xBR} ${yBR} 0 0 1 ${x + w - xBR} ${y + h}`,
    `L${x + xBL} ${y + h}`,
    `A${xBL} ${yBL} 0 0 1 ${x} ${y + h - yBL}`,
    `L${x} ${y + yTL}`,
    `A${xTL} ${yTL} 0 0 1 ${x + xTL} ${y}`,
    'Z',
  ].join(' ');
}

export function LfOval({
  variant,
  tone = 'yellow',
  children,
  ...rest
}: LfOvalProps): React.JSX.Element {
  const art = ART[variant];
  const half = art.border / 2;
  const fill = variant === 'login' ? LOGIN_YELLOW : toneFill[tone];
  const [top, right, bottom, left] = art.inner ?? [0, 0, 0, 0];

  return (
    <View
      {...rest}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width: art.width + art.shadow, height: art.height + art.shadow },
        variant === 'login' && { transform: [{ rotate: LOGIN_TILT }] },
      ]}
    >
      <Svg width={art.width + art.shadow} height={art.height + art.shadow}>
        {art.shadow > 0 ? (
          <Path d={ovalPath(art.shadow, art.shadow, art.width, art.height, OUTER)} fill={colors.text} />
        ) : null}
        <Path
          d={ovalPath(half, half, art.width - art.border, art.height - art.border, OUTER)}
          fill={fill}
          stroke={colors.text}
          strokeWidth={art.border}
        />
        {art.inner === null ? null : (
          <Path
            d={ovalPath(left, top, art.width - left - right, art.height - top - bottom, INNER)}
            fill={colors.surface}
          />
        )}
      </Svg>
      <View pointerEvents="none" style={[styles.overlay, { width: art.width, height: art.height }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
