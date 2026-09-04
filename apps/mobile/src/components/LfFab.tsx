import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, border, elevation, gutter, radius, size, space, type, weight } from '../theme/tokens';
import { LfMascotFace } from './LfMascot';

export interface LfFabProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
}

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
        pressed && { backgroundColor: colors.actionFillPressed },
        isDisabled && styles.disabled,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
      <View testID={rest.testID === undefined ? undefined : `${rest.testID}-trailing`} style={styles.trailing}>
        <LfMascotFace
          testID={rest.testID === undefined ? undefined : `${rest.testID}-mascot`}
          size="md"
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: gutter.app,
    height: size.fabHeight,
    minHeight: size.touchMin,
    paddingTop: space[2],
    paddingRight: space[2],
    paddingBottom: space[2],
    paddingLeft: space[8] + border.chip,
    borderRadius: radius.pill,
    backgroundColor: colors.actionFill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[6],
    ...elevation.fab,
  },
  label: {
    color: colors.onAction,
    fontSize: type.body,
    fontWeight: weight.bold,
    fontFamily: textFontFamily(weight.bold),
  },
  trailing: {
    width: size.iconCircle,
    height: size.iconCircle,
    borderRadius: radius.pill,
    borderWidth: border.chip,
    borderColor: colors.text,
    backgroundColor: colors.brandSymbolOnAction,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.3 },
});
