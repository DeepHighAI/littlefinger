import { Pressable, type PressableProps, StyleSheet, Text } from 'react-native';

import { brandFontFamily, type PretendardWeight } from '../theme/fonts';
import { colors, radius, size, space, type, weight } from '../theme/tokens';

/**
 * 버튼 — 원본 `.lf-btn` 과 변형 10종을 props 로 접은 것 (04 §5-2).
 *
 * **터치 타깃 48dp 는 어떤 변형에서도 내려가지 않는다**(04 §12-7).
 * 원본 CSS 의 `.lf-btn--compact` 는 height 44px 이지만 `.lf-btn` 의 min-height 48px 가
 * 이긴다. 여기서도 `minHeight` 를 항상 걸어 같은 결과를 만든다.
 */

export type LfButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'kakao' | 'danger';
export type LfButtonSize = 'default' | 'cta' | 'compact';

export interface LfButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: LfButtonVariant;
  size?: LfButtonSize;
  block?: boolean;
  grow?: boolean;
}

const DISABLED_OPACITY = 0.38;
const PRESSED_OPACITY = 0.94;
const OUTLINE_WIDTH = 1.5;

const container = StyleSheet.create({
  base: {
    height: size.actionHeight,
    // 접근성 하한. 줄이지 않는다.
    minHeight: size.touchMin,
    paddingHorizontal: space[8],
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
  },
  filled: { backgroundColor: colors.primary },
  tonal: { backgroundColor: colors.primaryContainer },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: OUTLINE_WIDTH,
    borderColor: colors.primary,
  },
  text: { backgroundColor: 'transparent' },
  kakao: { backgroundColor: colors.kakao },
  danger: { backgroundColor: 'transparent', borderWidth: OUTLINE_WIDTH, borderColor: colors.error },
});

const labelColor: Record<LfButtonVariant, string> = {
  filled: colors.onPrimary,
  tonal: colors.onPrimaryContainer,
  outlined: colors.primary,
  text: colors.textMuted,
  kakao: colors.onKakao,
  danger: colors.error,
};

/** 변형별 라벨 굵기. 스타일 객체에서 캐내지 않고 여기서 한 번에 선언한다. */
const labelWeight: Record<LfButtonVariant, PretendardWeight> = {
  filled: weight.heavy,
  tonal: weight.heavy,
  outlined: weight.bold,
  text: weight.medium,
  kakao: weight.medium,
  danger: weight.bold,
};

const labelSize: Record<LfButtonSize, number> = {
  default: type.body,
  cta: type.bodyLg,
  compact: type.label,
};

export function LfButton({
  label,
  variant = 'filled',
  size: buttonSize = 'default',
  block = false,
  grow = false,
  disabled,
  ...rest
}: LfButtonProps): React.JSX.Element {
  // PressableProps 의 disabled 는 null 도 허용해서 그대로는 accessibilityState 에 못 넣는다.
  const isDisabled = disabled ?? false;
  // kakao 만 기본 크기에서도 한 단계 큰 글자를 쓴다 (원본 .lf-btn--kakao).
  const fontSize =
    buttonSize === 'default' && variant === 'kakao' ? type.bodyLg : labelSize[buttonSize];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        container.base,
        container[variant],
        buttonSize === 'cta' && { height: size.ctaHeight },
        buttonSize === 'compact' && { paddingHorizontal: space[7] },
        block && { width: '100%' },
        grow && { flex: 1 },
        pressed &&
          (variant === 'filled'
            ? { backgroundColor: colors.primaryPressed }
            : { opacity: PRESSED_OPACITY }),
        isDisabled && { opacity: DISABLED_OPACITY },
      ]}
    >
      <Text
        style={{
          fontSize,
          fontWeight: labelWeight[variant],
          color: labelColor[variant],
          textAlign: 'center',
          fontFamily: brandFontFamily(labelWeight[variant]),
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
