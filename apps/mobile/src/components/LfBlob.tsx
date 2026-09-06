import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { colors, border, elevation, size, space } from '../theme/tokens';

export type LfBlobVariant = 'login' | 'empty' | 'cornerMint' | 'cornerYellow';
/** 기울기는 폐지됐다(README). 라우트 파일이 넘기던 값은 P6 에서 걷어내며, 그때까지 무시된다. */
export type LfBlobTilt = 'none' | 'blob' | 'empty';

export interface LfBlobProps extends Omit<ViewProps, 'style'> {
  variant: LfBlobVariant;
  tilt?: LfBlobTilt;
}

const LOGIN_WIDTH = size.loginBlobHeight + space[8];
/** README A02 빈 상태 블롭 240×211 · 손 scale .5 — 토큰 없음, ADR 0020 예외 */
const EMPTY_WIDTH = 240;
const EMPTY_HEIGHT = 211;
const CORNER_WIDTH = size.stampPillWidth - space[4];
const CORNER_HEIGHT = size.stampPillHeight + space[4];
/** A00 는 옛 연한 옐로와 -2° 기울기를 유지한다 (PO E11, ADR 0020 예외) */
const LOGIN_YELLOW = '#FFE59A';
const LOGIN_TILT = '-2deg';
const SHADOW = elevation.card.boxShadow[0].offsetX;

const dimensions: Record<LfBlobVariant, { width: number; height: number }> = {
  login: { width: LOGIN_WIDTH, height: size.loginBlobHeight },
  empty: { width: EMPTY_WIDTH, height: EMPTY_HEIGHT },
  cornerMint: { width: CORNER_WIDTH, height: CORNER_HEIGHT },
  cornerYellow: { width: CORNER_WIDTH, height: CORNER_HEIGHT },
};

const EMPTY_WHITE = 'M120 40c60-30 130 10 140 70s-20 120-90 120S30 210 30 150 60 70 120 40Z';
const EMPTY_YELLOW = 'M200 160c40-20 100 0 110 40s-10 80-60 80-70-20-90-50 0-50 40-70Z';

function BlobArtwork({ variant }: { variant: LfBlobVariant }): React.JSX.Element {
  if (variant === 'login') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 220 200">
        <Path fill={colors.surface} stroke={colors.text} strokeWidth={border.sheet} strokeLinejoin="round" d="M110 12c70-10 106 40 100 90s-50 92-104 88S6 150 10 100 50 20 110 12Z" />
        <Path fill={LOGIN_YELLOW} stroke={colors.text} strokeWidth={border.sheet} strokeLinejoin="round" d="M150 120c34-14 66 8 62 40s-30 44-62 38-40-26-34-48 14-24 34-30Z" />
      </Svg>
    );
  }
  if (variant === 'empty') {
    // A00 블롭을 240×211 로 줄이고 같은 경로를 5 만큼 밀어 잉크로 채운 하드 섀도를 깐다 (drop-shadow 5px 5px 0)
    const scale = EMPTY_WIDTH / 330;
    return (
      <Svg width="100%" height="100%" viewBox={`0 0 ${330 + SHADOW / scale} ${290 + SHADOW / scale}`}>
        <G transform={`translate(${SHADOW / scale} ${SHADOW / scale})`}>
          <Path fill={colors.text} d={EMPTY_WHITE} />
          <Path fill={colors.text} d={EMPTY_YELLOW} />
        </G>
        <Path fill={colors.surface} stroke={colors.text} strokeWidth={border.sheet} strokeLinejoin="round" d={EMPTY_WHITE} />
        <Path fill={colors.primaryContainer} stroke={colors.text} strokeWidth={border.sheet} strokeLinejoin="round" d={EMPTY_YELLOW} />
      </Svg>
    );
  }
  return (
    <Svg width="100%" height="100%" viewBox="0 0 90 70">
      <Path
        fill={variant === 'cornerMint' ? colors.successContainer : colors.primaryContainer}
        d="M40 6c22-10 50 6 46 30S60 68 36 66 4 50 8 32 22 14 40 6Z"
      />
    </Svg>
  );
}

/** 화면마다 SVG를 다시 만들지 않도록 승인된 블롭을 고정한다. A01 의 타원은 LfOval 이 맡는다. */
export function LfBlob({
  variant,
  tilt: _tilt,
  children,
  testID,
  ...rest
}: LfBlobProps): React.JSX.Element {
  return (
    <View
      {...rest}
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.root,
        dimensions[variant],
        variant === 'login' && { transform: [{ rotate: LOGIN_TILT }] },
      ]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <BlobArtwork variant={variant} />
      </View>
      <View pointerEvents="none" style={[styles.overlay, variant === 'empty' && styles.emptyOverlay]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative' },
  overlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 흰 블롭이 왼쪽에 치우쳐 있어 눈·손을 그 위에 맞춘다 (갤러리 padding-right 30)
  emptyOverlay: { right: space[8] + space[4] },
});
