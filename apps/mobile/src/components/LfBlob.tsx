import { Image, StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, size, space } from '../theme/tokens';

export type LfBlobVariant = 'login' | 'empty' | 'cornerMint' | 'cornerYellow' | 'cornerSky' | 'cornerPink';

export interface LfBlobProps extends Omit<ViewProps, 'style'> {
  variant: LfBlobVariant;
}

const LOGIN_WIDTH = size.loginBlobHeight + space[8];
/** 아트 교체에도 기존 A02 레이아웃 치수를 보존한다 (ADR 0020·0028). */
const EMPTY_WIDTH = 240;
const EMPTY_HEIGHT = 211;
const CORNER_WIDTH = size.stampPillWidth - space[4];
const CORNER_HEIGHT = size.stampPillHeight + space[4];
/** A00 의 기존 -2° 기울기는 레이아웃 변경 승인 전까지 유지한다. */
const LOGIN_TILT = '-2deg';

const dimensions: Record<LfBlobVariant, { width: number; height: number }> = {
  login: { width: LOGIN_WIDTH, height: size.loginBlobHeight },
  empty: { width: EMPTY_WIDTH, height: EMPTY_HEIGHT },
  cornerMint: { width: CORNER_WIDTH, height: CORNER_HEIGHT },
  cornerYellow: { width: CORNER_WIDTH, height: CORNER_HEIGHT },
  cornerSky: { width: CORNER_WIDTH, height: CORNER_HEIGHT },
  cornerPink: { width: CORNER_WIDTH, height: CORNER_HEIGHT },
};

// 스탬프 모서리 블롭 색 — 진행 민트 · 대기 옐로 · 무기한 스카이 · 불이행 핑크 (A05 아트보드)
const cornerFill: Record<Exclude<LfBlobVariant, 'login' | 'empty'>, string> = {
  cornerMint: colors.successContainer,
  cornerYellow: colors.primaryContainer,
  cornerSky: colors.recordContainer,
  cornerPink: colors.attentionContainer,
};

function BlobArtwork({ variant }: { variant: Exclude<LfBlobVariant, 'login' | 'empty'> }): React.JSX.Element {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 90 70">
      <Path fill={cornerFill[variant]} d="M40 6c22-10 50 6 46 30S60 68 36 66 4 50 8 32 22 14 40 6Z" />
    </Svg>
  );
}

/** 큰 얼굴과 상태색 모서리 장식을 분리해 마스코트 교체가 상태 표현에 영향을 주지 않게 한다. */
export function LfBlob({
  variant,
  children,
  testID,
  ...rest
}: LfBlobProps): React.JSX.Element {
  const character = variant === 'login' || variant === 'empty';
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
        {character ? (
          <Image source={require('../../assets/images/mascot-face-e1.png') as number} resizeMode="contain" style={styles.character} />
        ) : <BlobArtwork variant={variant} />}
      </View>
      {character ? null : <View pointerEvents="none" style={styles.overlay}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative' },
  character: { width: '100%', height: '100%' },
  overlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
