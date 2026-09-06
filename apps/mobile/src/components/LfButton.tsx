import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { textFontFamily, type TextFontWeight } from '../theme/fonts';
import { colors, border, elevation, radius, size, space, type, weight } from '../theme/tokens';
import { LfIcon, type LfIconName } from './LfIcon';
import { LfMascotFace } from './LfMascot';

export type LfButtonVariant =
  | 'filled' | 'tonal' | 'outlined' | 'text' | 'kakao' | 'kakaoLogin' | 'google' | 'danger';
export type LfButtonSize = 'default' | 'cta' | 'compact';

export interface LfButtonProps extends Omit<PressableProps, 'style' | 'children' | 'hitSlop'> {
  label: string;
  variant?: LfButtonVariant;
  size?: LfButtonSize;
  block?: boolean;
  grow?: boolean;
  leading?: React.JSX.Element;
  trailing?: LfIconName | 'mascot';
}

const DISABLED_OPACITY = 0.3;
/** README 눌림 — translate 3 · 그림자 5→2, 3→없음. 번들 토큰 없음, ADR 0020 예외 */
const PRESS_OFFSET = 3;
const PRESSED_SHADOW = { boxShadow: [{ offsetX: 2, offsetY: 2, blurRadius: 0, spreadDistance: 0, color: colors.text }] };
const NO_SHADOW = { boxShadow: [] };
/** README Google 52h · compact 44h · 트레일링 아이콘 22 — 토큰 없음, ADR 0020 예외 */
const GOOGLE_HEIGHT = 52;
const COMPACT_HEIGHT = 44;
const TRAILING_ICON = 22;

const container = StyleSheet.create({
  base: {
    minHeight: size.actionHeight,
    paddingHorizontal: space[9],
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
  },
  filled: {
    backgroundColor: colors.primaryContainer,
    borderWidth: border.card,
    borderColor: colors.text,
    ...elevation.card,
  },
  tonal: {
    minHeight: size.chipSelectHeight,
    paddingHorizontal: space[6],
    borderRadius: radius.sm,
    backgroundColor: colors.primaryContainer,
    borderWidth: border.chip,
    borderColor: colors.text,
    ...elevation.sm,
  },
  outlined: {
    backgroundColor: colors.surface,
    borderWidth: border.outline,
    borderColor: colors.text,
    ...elevation.sm,
  },
  text: { minHeight: size.touchMin, paddingHorizontal: 0, backgroundColor: 'transparent' },
  // 카카오 54h `#FEE500` r14 + 3px (A04 공유) · 로그인 A01 은 주 CTA 라 5px (`.lf-btn--kakao-login`)
  kakao: {
    minHeight: size.kakaoHeight,
    backgroundColor: colors.kakao,
    borderWidth: border.sheet,
    borderColor: colors.text,
    ...elevation.sm,
  },
  kakaoLogin: {
    minHeight: size.kakaoHeight,
    backgroundColor: colors.kakao,
    borderWidth: border.sheet,
    borderColor: colors.text,
    ...elevation.card,
  },
  google: {
    minHeight: GOOGLE_HEIGHT,
    backgroundColor: colors.google,
    borderWidth: border.card,
    borderColor: colors.text,
    ...elevation.sm,
  },
  danger: {
    backgroundColor: 'transparent',
    borderWidth: border.card,
    borderColor: colors.error,
  },
  trailingLayout: {
    paddingRight: space[3],
    paddingLeft: space[8] + border.chip,
    gap: space[6],
  },
  trailing: {
    width: size.iconCircle,
    height: size.iconCircle,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: border.chip,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const minHeightOf: Record<LfButtonVariant, number> = {
  filled: size.actionHeight,
  tonal: size.chipSelectHeight,
  outlined: size.actionHeight,
  text: size.touchMin,
  kakao: size.kakaoHeight,
  kakaoLogin: size.kakaoHeight,
  google: GOOGLE_HEIGHT,
  danger: size.actionHeight,
};

/** 눌림 뒤 남는 그림자 — 5px 면은 2px, 3px 면은 없음 */
const pressedShadow: Record<LfButtonVariant, typeof PRESSED_SHADOW | typeof NO_SHADOW> = {
  filled: PRESSED_SHADOW,
  tonal: NO_SHADOW,
  outlined: NO_SHADOW,
  text: NO_SHADOW,
  kakao: NO_SHADOW,
  kakaoLogin: PRESSED_SHADOW,
  google: NO_SHADOW,
  danger: NO_SHADOW,
};

const labelColor: Record<LfButtonVariant, string> = {
  filled: colors.text,
  tonal: colors.text,
  outlined: colors.text,
  text: colors.text,
  kakao: colors.onKakao,
  kakaoLogin: colors.onKakao,
  google: colors.onGoogle,
  danger: colors.error,
};

const labelWeight: Record<LfButtonVariant, TextFontWeight> = {
  filled: weight.bold,
  tonal: weight.bold,
  outlined: weight.bold,
  text: weight.bold,
  kakao: weight.bold,
  kakaoLogin: weight.bold,
  google: weight.medium,
  danger: weight.bold,
};

const labelSize: Record<LfButtonVariant, number> = {
  filled: type.appbar,
  tonal: type.chip,
  outlined: type.label,
  text: type.label,
  kakao: type.appbar,
  kakaoLogin: type.appbar,
  google: type.bodyLg,
  danger: type.label,
};

export function LfButton({
  label,
  variant = 'filled',
  size: buttonSize = 'default',
  block = false,
  grow = false,
  leading,
  trailing,
  disabled,
  accessibilityState,
  ...rest
}: LfButtonProps): React.JSX.Element {
  const isDisabled = disabled ?? false;
  const minHeight = buttonSize === 'cta'
    ? size.ctaHeight
    : buttonSize === 'compact' ? COMPACT_HEIGHT : minHeightOf[variant];
  // 36h tonal · 44h compact 는 갤러리의 ::after 처럼 hitSlop 으로 48 을 채운다 (§8-7)
  const hitSlop = Math.max(0, (size.touchMin - minHeight) / 2);
  const fontSize = buttonSize === 'compact' ? type.chip : labelSize[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
      disabled={isDisabled}
      hitSlop={hitSlop}
      {...rest}
      style={({ pressed }) => [
        container.base,
        container[variant],
        { minHeight },
        buttonSize === 'compact' && { paddingHorizontal: space[7] },
        leading !== undefined && { paddingHorizontal: space[7] },
        trailing !== undefined && container.trailingLayout,
        block && { width: '100%' },
        grow && { flex: 1 },
        pressed && {
          transform: [{ translateX: PRESS_OFFSET }, { translateY: PRESS_OFFSET }],
          ...pressedShadow[variant],
        },
        isDisabled && { opacity: DISABLED_OPACITY, ...NO_SHADOW },
      ]}
    >
      {leading}
      {/*
       * 전체 폭 버튼은 글자의 측정 폭 대신 아이콘을 제외한 실제 가용 폭을 배정한다.
       * 상자가 줄바꿈 폭을 정하고 minHeight 버튼은 늘어난 줄 수만큼 높아진다.
       */}
      <View style={[{ flexShrink: 1 }, block && { flex: 1, minWidth: 0 }]}>
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
          style={container.trailing}
        >
          {trailing === 'mascot'
            ? <LfMascotFace size="md" />
            : <LfIcon name={trailing} size={TRAILING_ICON} />}
        </View>
      ) : null}
    </Pressable>
  );
}
