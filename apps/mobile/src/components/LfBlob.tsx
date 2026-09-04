import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, border, size, space, tilt as tiltToken } from '../theme/tokens';

export type LfBlobVariant = 'hero' | 'login' | 'empty' | 'cornerMint' | 'cornerYellow';
export type LfBlobTilt = 'none' | 'blob' | 'empty';

export interface LfBlobProps extends Omit<ViewProps, 'style'> {
  variant: LfBlobVariant;
  tilt?: LfBlobTilt;
}

const LOGIN_WIDTH = size.loginBlobHeight + space[8];
const EMPTY_WIDTH = size.loginBlobHeight;
const EMPTY_HEIGHT = size.loginBlobHeight - size.appbarIcon - space[4];
const CORNER_WIDTH = size.stampPillWidth - space[4];
const CORNER_HEIGHT = size.stampPillHeight + space[4];

const dimensions: Record<LfBlobVariant, { width: number | `${number}%`; height: number }> = {
  hero: { width: '100%', height: size.heroBlobHeight },
  login: { width: LOGIN_WIDTH, height: size.loginBlobHeight },
  empty: { width: EMPTY_WIDTH, height: EMPTY_HEIGHT },
  cornerMint: { width: CORNER_WIDTH, height: CORNER_HEIGHT },
  cornerYellow: { width: CORNER_WIDTH, height: CORNER_HEIGHT },
};

function BlobArtwork({ variant }: { variant: LfBlobVariant }): React.JSX.Element {
  if (variant === 'hero') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 330 290">
        <Path fill={colors.surface} stroke={colors.text} strokeWidth={border.sheet} strokeLinejoin="round" d="M120 40c60-30 130 10 140 70s-20 120-90 120S30 210 30 150 60 70 120 40Z" />
        <Path fill={colors.primaryContainer} stroke={colors.text} strokeWidth={border.sheet} strokeLinejoin="round" d="M200 160c40-20 100 0 110 40s-10 80-60 80-70-20-90-50 0-50 40-70Z" />
      </Svg>
    );
  }
  if (variant === 'login') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 220 200">
        <Path fill={colors.surface} stroke={colors.text} strokeWidth={border.sheet} strokeLinejoin="round" d="M110 12c70-10 106 40 100 90s-50 92-104 88S6 150 10 100 50 20 110 12Z" />
        <Path fill={colors.primaryContainer} stroke={colors.text} strokeWidth={border.sheet} strokeLinejoin="round" d="M150 120c34-14 66 8 62 40s-30 44-62 38-40-26-34-48 14-24 34-30Z" />
      </Svg>
    );
  }
  if (variant === 'empty') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 200 170">
        <Path fill={colors.surface} stroke={colors.text} strokeWidth={border.sheet} strokeLinejoin="round" d="M100 8c62-8 96 34 92 80s-42 78-94 74S4 130 8 84 48 16 100 8Z" />
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

/** 화면마다 SVG를 다시 만들지 않도록 승인된 다섯 블롭을 고정한다. */
export function LfBlob({
  variant,
  tilt = 'none',
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
        tilt !== 'none' && { transform: [{ rotate: tiltToken[tilt] }] },
      ]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <BlobArtwork variant={variant} />
      </View>
      <View pointerEvents="none" style={styles.overlay}>{children}</View>
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
});
