import { Image, type ImageProps } from 'react-native';

import { size as sizeToken } from '../theme/tokens';

export type LfMascotFaceSize = 'sm' | 'md' | 'lg';
export type LfEyesSize = 'row' | 'header' | 'card' | 'blob';

export interface LfMascotImageProps extends Omit<ImageProps, 'source' | 'style'> {
  accessibilityLabel?: string;
}

const MASCOT_FACE = require('../../assets/images/mascot-face-e1.png') as number;
const EYES = require('../../assets/images/eyes-e1.png') as number;

const MASCOT_SIZE: Record<LfMascotFaceSize, number> = {
  sm: sizeToken.mascotSm,
  md: sizeToken.mascotMd,
  lg: sizeToken.mascotLg,
};

const EYES_WIDTH: Record<LfEyesSize, number> = {
  row: sizeToken.eyesRow,
  header: sizeToken.eyesHeader,
  card: sizeToken.eyesCard,
  blob: sizeToken.eyesBlob,
};

function accessibilityProps(accessibilityLabel: string | undefined): Pick<
  ImageProps,
  'accessible' | 'accessibilityElementsHidden' | 'accessibilityLabel' | 'accessibilityRole' | 'importantForAccessibility'
> {
  const decorative = accessibilityLabel === undefined;
  return {
    accessible: !decorative,
    accessibilityElementsHidden: decorative,
    accessibilityLabel,
    accessibilityRole: 'image',
    importantForAccessibility: decorative ? 'no-hide-descendants' : 'yes',
  };
}

/** 승인된 E-1 얼굴 PNG. 크기만 바꾸고 색상 가공은 하지 않는다. */
export function LfMascotFace({
  size = 'md',
  accessibilityLabel,
  ...rest
}: LfMascotImageProps & { size?: LfMascotFaceSize }): React.JSX.Element {
  const edge = MASCOT_SIZE[size];
  return (
    <Image
      {...rest}
      {...accessibilityProps(accessibilityLabel)}
      source={MASCOT_FACE}
      resizeMode="contain"
      style={{ width: edge, height: edge }}
    />
  );
}

/** 승인된 E-1 눈 PNG. 원본 5:2 비율을 유지한다. */
export function LfEyes({
  size = 'row',
  accessibilityLabel,
  ...rest
}: LfMascotImageProps & { size?: LfEyesSize }): React.JSX.Element {
  const width = EYES_WIDTH[size];
  return (
    <Image
      {...rest}
      {...accessibilityProps(accessibilityLabel)}
      source={EYES}
      resizeMode="contain"
      style={{ width, height: width * 2 / 5 }}
    />
  );
}
