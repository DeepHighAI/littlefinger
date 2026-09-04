import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { textFontFamily, type TextFontWeight } from '../theme/fonts';
import { colors, border, elevation, radius, size, space, type, weight } from '../theme/tokens';
import { LfIcon, type LfIconName } from './LfIcon';
import { LfMascotFace } from './LfMascot';

export type LfButtonVariant =
  | 'filled' | 'tonal' | 'outlined' | 'text' | 'kakao' | 'google' | 'danger';
export type LfButtonSize = 'default' | 'cta' | 'compact';

export interface LfButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: LfButtonVariant;
  size?: LfButtonSize;
  block?: boolean;
  grow?: boolean;
  leading?: React.JSX.Element;
  trailing?: LfIconName | 'mascot';
  trailingBorder?: boolean;
}

const DISABLED_OPACITY = 0.3;
const PRESSED_OPACITY = 0.94;

const container = StyleSheet.create({
  base: {
    minHeight: size.actionHeight,
    paddingHorizontal: space[9],
    paddingVertical: space[2],
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
  },
  filled: { backgroundColor: colors.actionFill, ...elevation.fab },
  tonal: {
    minHeight: size.touchMin,
    backgroundColor: colors.primaryContainer,
    borderWidth: border.chip,
    borderColor: colors.text,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: border.outline,
    borderColor: colors.text,
  },
  text: { backgroundColor: 'transparent' },
  kakao: {
    minHeight: size.kakaoHeight,
    backgroundColor: colors.kakao,
    borderWidth: border.sheet,
    borderColor: colors.text,
  },
  google: {
    minHeight: size.kakaoHeight,
    backgroundColor: colors.google,
    borderWidth: border.chip / 2,
    borderColor: colors.googleBorder,
  },
  danger: {
    backgroundColor: 'transparent',
    borderWidth: border.card,
    borderColor: colors.error,
  },
  trailingLayout: {
    paddingTop: space[2],
    paddingRight: space[2],
    paddingBottom: space[2],
    paddingLeft: space[8] + border.chip,
    gap: space[6],
  },
  trailing: {
    width: size.iconCircle,
    height: size.iconCircle,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSymbolOnAction,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailingBorder: { borderWidth: border.chip, borderColor: colors.text },
});

const labelColor: Record<LfButtonVariant, string> = {
  filled: colors.onAction,
  tonal: colors.text,
  outlined: colors.text,
  text: colors.textMuted,
  kakao: colors.onKakao,
  google: colors.onGoogle,
  danger: colors.error,
};

const labelWeight: Record<LfButtonVariant, TextFontWeight> = {
  filled: weight.bold,
  tonal: weight.bold,
  outlined: weight.bold,
  text: weight.medium,
  kakao: weight.bold,
  google: weight.medium,
  danger: weight.bold,
};

const labelSize: Record<LfButtonSize, number> = {
  default: type.label,
  cta: type.body,
  compact: type.label,
};

export function LfButton({
  label,
  variant = 'filled',
  size: buttonSize = 'default',
  block = false,
  grow = false,
  leading,
  trailing,
  trailingBorder = true,
  disabled,
  accessibilityState,
  ...rest
}: LfButtonProps): React.JSX.Element {
  const isDisabled = disabled ?? false;
  const fontSize =
    buttonSize === 'default' && (variant === 'kakao' || variant === 'google')
      ? type.bodyLg
      : labelSize[buttonSize];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        container.base,
        container[variant],
        buttonSize === 'cta' && { minHeight: size.ctaHeight },
        buttonSize === 'compact' && { minHeight: size.touchMin, paddingHorizontal: space[7] },
        leading !== undefined && { paddingHorizontal: space[7] },
        trailing !== undefined && container.trailingLayout,
        block && { width: '100%' },
        grow && { flex: 1 },
        pressed && (
          variant === 'filled'
            ? { backgroundColor: colors.actionFillPressed }
            : { opacity: PRESSED_OPACITY }
        ),
        isDisabled && { opacity: DISABLED_OPACITY },
      ]}
    >
      {leading}
      {/*
       * flexShrink 는 Text 가 아니라 이 View 가 받는다. Text 에 직접 걸면 안드로이드가
       * 줄바꿈 대신 남는 폭에서 그냥 잘라내, 글꼴 배율이 커진 기기에서 'Google로' 처럼
       * 말줄임표도 없이 끊긴다. 폭 제약은 상자가 지고 줄바꿈은 Text 가 하게 나눈다.
       * 버튼은 minHeight 만 가지므로 두 줄이 되면 높이가 따라 늘어난다.
       */}
      <View style={{ flexShrink: 1 }}>
        <Text
          style={{
            fontSize,
            // fontWeight 는 주지 않는다. textFontFamily 가 굵기별 정적 파일을 이미 고르므로
            // (04 §5-4) 여기서 축을 또 걸면 안드로이드가 다른 얼굴로 재고 다른 얼굴로 그린다.
            color: labelColor[variant],
            textAlign: 'center',
            fontFamily: textFontFamily(labelWeight[variant]),
            textDecorationLine: variant === 'text' ? 'underline' : 'none',
          }}
        >
          {label}
        </Text>
      </View>
      {trailing !== undefined ? (
        <View
          testID={rest.testID === undefined ? undefined : `${rest.testID}-trailing`}
          style={[container.trailing, trailingBorder && container.trailingBorder]}
        >
          {trailing === 'mascot'
            ? <LfMascotFace size="md" />
            : <LfIcon name={trailing} size={type.subtitle} />}
        </View>
      ) : null}
    </Pressable>
  );
}
