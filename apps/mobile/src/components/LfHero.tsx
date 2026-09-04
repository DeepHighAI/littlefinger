import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { colors, border, elevation, gutter, radius, size, space, tilt } from '../theme/tokens';
import { LfBlob } from './LfBlob';
import { LfIcon } from './LfIcon';
import { LfEyes } from './LfMascot';
import { LfStack } from './LfStack';
import { LfText } from './LfText';

export interface LfHeroProps extends Omit<PressableProps, 'children' | 'style'> {
  eyebrow: string;
  title: string;
  description?: string;
  dday?: string;
  meta?: string;
}

export function LfHero({
  eyebrow,
  title,
  description,
  dday,
  meta,
  accessibilityLabel,
  ...rest
}: LfHeroProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      {...rest}
      style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
    >
      <View pointerEvents="none" style={styles.decoration}>
        <LfBlob variant="cornerYellow" tilt="blob"><LfEyes size="card" /></LfBlob>
      </View>
      <LfStack grow gap={2}>
        <LfText variant="eyebrow">{eyebrow}</LfText>
        <LfText variant="cardTitle">{title}</LfText>
        {description === undefined ? null : <LfText variant="bodySm">{description}</LfText>}
        {meta === undefined ? null : <LfText variant="meta">{meta}</LfText>}
        {dday === undefined ? null : <LfText variant="chip">{dday}</LfText>}
      </LfStack>
      <View style={styles.arrow}>
        <LfIcon name="east" size={typeIconSize} color="primaryContainer" />
      </View>
    </Pressable>
  );
}

const typeIconSize = size.appbarIcon - border.chip;

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: gutter.app,
    padding: size.cardPadding,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: border.card,
    borderColor: colors.text,
    transform: [{ rotate: tilt.hero }],
    ...elevation.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[5],
    overflow: 'hidden',
  },
  pressed: { backgroundColor: colors.primarySoft },
  decoration: {
    position: 'absolute',
    top: -space[7],
    right: space[8],
  },
  arrow: {
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
