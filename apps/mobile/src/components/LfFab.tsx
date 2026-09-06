import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, border, elevation, gutter, radius, size, space, type, weight } from '../theme/tokens';
import { LfIcon } from './LfIcon';

export interface LfFabProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
}

/** README 눌림 — translate 3 · 그림자 5→2. 번들 토큰 없음, ADR 0020 예외 */
const PRESS_OFFSET = 3;
const PRESSED_SHADOW = { boxShadow: [{ offsetX: 2, offsetY: 2, blurRadius: 0, spreadDistance: 0, color: colors.text }] };
/** README 풀폭 CTA 의 add 아이콘 26 — 토큰 없음, ADR 0020 예외 */
const ADD_ICON = 26;

/** 홈 하단 좌우 16 풀폭 CTA — 옐로 면 + 잉크 글자 + 종이 사각 40 */
export function LfFab({ label, disabled, ...rest }: LfFabProps): React.JSX.Element {
  const isDisabled = disabled ?? false;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        styles.button,
        pressed && { transform: [{ translateX: PRESS_OFFSET }, { translateY: PRESS_OFFSET }], ...PRESSED_SHADOW },
        isDisabled && styles.disabled,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
      <View testID={rest.testID === undefined ? undefined : `${rest.testID}-trailing`} style={styles.trailing}>
        <LfIcon
          {...(rest.testID === undefined ? {} : { testID: `${rest.testID}-icon` })}
          name="add"
          size={ADD_ICON}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: gutter.app,
    right: gutter.app,
    bottom: space[8],
    minHeight: size.fabHeight,
    paddingRight: space[3],
    paddingLeft: space[8] + border.chip,
    borderRadius: radius.md,
    backgroundColor: colors.primaryContainer,
    borderWidth: border.card,
    borderColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[6],
    ...elevation.fab,
  },
  label: {
    color: colors.text,
    fontSize: type.appbar,
    fontFamily: textFontFamily(weight.bold),
  },
  trailing: {
    width: size.iconCircle,
    height: size.iconCircle,
    borderRadius: radius.sm,
    borderWidth: border.chip,
    borderColor: colors.text,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.3, boxShadow: [] },
});
