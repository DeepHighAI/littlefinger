import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, border, elevation, radius, size, space, tilt } from '../theme/tokens';
import { LfBlob } from './LfBlob';
import { LfChip } from './LfChip';
import { LfPinkyLoop } from './LfPinkyLoop';
import { LfText } from './LfText';

export type LfStampVariant = 'active' | 'completed' | 'pending';

export interface LfStampProps extends Omit<ViewProps, 'style' | 'children'> {
  variant: LfStampVariant;
  headline: string;
  time?: string;
  participants?: readonly string[];
  fingerprint?: string;
}

export function LfStamp({
  variant,
  headline,
  time,
  participants = [],
  fingerprint,
  ...rest
}: LfStampProps): React.JSX.Element {
  return (
    <View
      {...rest}
      style={[styles.stamp, variant === 'completed' && styles.completed]}
    >
      <View pointerEvents="none" style={styles.corner}>
        <LfBlob variant={variant === 'pending' ? 'cornerYellow' : 'cornerMint'} />
      </View>
      <View style={[styles.pill, variant === 'completed' && styles.completedPill]}>
        <LfPinkyLoop size="sm" spark />
      </View>
      <LfText variant="stamp" align="center">{headline}</LfText>
      {time === undefined ? null : <LfText variant="meta" align="center">{time}</LfText>}
      {participants.length === 0 ? null : (
        <View style={styles.participants}>
          {participants.map((participant) => (
            <LfChip key={participant} label={participant} tone="cream" kind="meta" dot />
          ))}
        </View>
      )}
      {fingerprint === undefined ? null : (
        <LfText variant="meta" align="center">{fingerprint}</LfText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    position: 'relative',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[8],
    paddingHorizontal: size.cardPadding,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: border.card,
    borderColor: colors.text,
    borderRadius: radius.xl,
    transform: [{ rotate: tilt.sticker }],
    ...elevation.card,
  },
  completed: { backgroundColor: colors.successContainer },
  corner: { position: 'absolute', top: -space[4], left: -space[6] },
  pill: {
    width: size.stampPillWidth,
    height: size.stampPillHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: border.chip,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedPill: { backgroundColor: colors.surface },
  participants: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space[2],
  },
});
