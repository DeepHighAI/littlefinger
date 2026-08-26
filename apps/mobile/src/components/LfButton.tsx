import { Pressable, type PressableProps, StyleSheet, Text } from 'react-native';

import { brandFontFamily, type BrandFontWeight } from '../theme/fonts';
import { colors, elevation, radius, size, space, type, weight } from '../theme/tokens';

/**
 * 버튼 — 원본 `.lf-btn` 과 변형 10종을 props 로 접은 것 (04 §5-2).
 *
 * **터치 타깃 48dp 는 어떤 변형에서도 내려가지 않는다**(04 §12-7).
 * 원본 CSS 의 `.lf-btn--compact` 는 height 44px 이지만 `.lf-btn` 의 min-height 48px 가
 * 이긴다. 여기서도 `minHeight` 를 항상 걸어 같은 결과를 만든다.
 */

export type LfButtonVariant =
  | 'filled' | 'tonal' | 'outlined' | 'text' | 'kakao' | 'google' | 'danger';
export type LfButtonSize = 'default' | 'cta' | 'compact';

export interface LfButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: LfButtonVariant;
  size?: LfButtonSize;
  block?: boolean;
  grow?: boolean;
  /** 라벨 앞 브랜드 마크 자리 (Google G 등). 장식이라 접근성 라벨에는 들어가지 않는다. */
  leading?: React.JSX.Element;
}

const DISABLED_OPACITY = 0.38;
const PRESSED_OPACITY = 0.94;
// 잉크&스티커 굵은 잉크 테두리 (ADR 0012) — CSS 원본의 2.2~2.5px 그대로.
const STICKER_OUTLINE_WIDTH = 2.4;
const KAKAO_OUTLINE_WIDTH = 2.5;
const DANGER_OUTLINE_WIDTH = 2.2;
// Google 버튼 가이드는 1px 고정 테두리다 — 잉크 테두리를 얹지 않는다.
const GOOGLE_OUTLINE_WIDTH = 1;

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
  filled: { backgroundColor: colors.actionFill, ...elevation.fab },
  tonal: {
    backgroundColor: colors.primaryContainer,
    borderWidth: STICKER_OUTLINE_WIDTH,
    borderColor: colors.text,
  },
  outlined: {
    backgroundColor: colors.surface,
    borderWidth: STICKER_OUTLINE_WIDTH,
    borderColor: colors.text,
  },
  text: { backgroundColor: 'transparent' },
  kakao: {
    backgroundColor: colors.kakao,
    borderWidth: KAKAO_OUTLINE_WIDTH,
    borderColor: colors.text,
  },
  google: {
    backgroundColor: colors.google,
    borderWidth: GOOGLE_OUTLINE_WIDTH,
    borderColor: colors.googleBorder,
  },
  danger: {
    backgroundColor: colors.surface,
    borderWidth: DANGER_OUTLINE_WIDTH,
    borderColor: colors.error,
  },
});

const labelColor: Record<LfButtonVariant, string> = {
  filled: colors.onAction,
  tonal: colors.onPrimaryContainer,
  outlined: colors.text,
  text: colors.textMuted,
  kakao: colors.onKakao,
  google: colors.onGoogle,
  danger: colors.error,
};

/** 변형별 라벨 굵기. 스타일 객체에서 캐내지 않고 여기서 한 번에 선언한다. */
const labelWeight: Record<LfButtonVariant, BrandFontWeight> = {
  filled: weight.heavy,
  tonal: weight.heavy,
  outlined: weight.bold,
  text: weight.medium,
  kakao: weight.bold,
  google: weight.medium,
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
  leading,
  disabled,
  ...rest
}: LfButtonProps): React.JSX.Element {
  // PressableProps 의 disabled 는 null 도 허용해서 그대로는 accessibilityState 에 못 넣는다.
  const isDisabled = disabled ?? false;
  // 로그인 버튼 두 종만 기본 크기에서도 한 단계 큰 글자를 쓴다 (원본 .lf-btn--kakao).
  const fontSize =
    buttonSize === 'default' && (variant === 'kakao' || variant === 'google')
      ? type.bodyLg
      : labelSize[buttonSize];

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
            ? { backgroundColor: colors.actionFillPressed }
            : { opacity: PRESSED_OPACITY }),
        isDisabled && { opacity: DISABLED_OPACITY },
      ]}
    >
      {leading}
      <Text
        style={{
          fontSize,
          fontWeight: labelWeight[variant],
          color: labelColor[variant],
          textAlign: 'center',
          fontFamily: brandFontFamily(labelWeight[variant]),
          // 링크형 보조 액션은 CSS 원본처럼 밑줄로 구분한다 (underline-offset 은 RN 미지원)
          textDecorationLine: variant === 'text' ? 'underline' : 'none',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
