import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, border, elevation, radius, space } from '../theme/tokens';
import { LfInkContext, LfText } from './LfText';

export interface LfOutcome {
  label: string;
  value: string;
}

export interface LfOutcomesProps extends Omit<ViewProps, 'style' | 'children'> {
  reward: LfOutcome | null;
  penalty: LfOutcome | null;
}

/** 보상 · 벌칙 스티커 두 칸 — 보상=스카이 · 벌칙=핑크, 글자는 잉크 (`.lf-outcomes`, 14 16 · r14 2.5 + 5px) */
export function LfOutcomes({ reward, penalty, ...rest }: LfOutcomesProps): React.JSX.Element {
  return (
    <LfInkContext.Provider value>
      <View {...rest} style={styles.grid}>
        {reward === null ? null : (
          <View style={[styles.tile, styles.reward]}>
            <LfText variant="eyebrow">{reward.label}</LfText>
            <View style={styles.value}><LfText variant="label">{reward.value}</LfText></View>
          </View>
        )}
        {penalty === null ? null : (
          <View style={[styles.tile, styles.penalty]}>
            <LfText variant="eyebrow">{penalty.label}</LfText>
            <View style={styles.value}><LfText variant="label">{penalty.value}</LfText></View>
          </View>
        )}
      </View>
    </LfInkContext.Provider>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: space[7] },
  tile: {
    flex: 1,
    paddingVertical: space[6],
    paddingHorizontal: space[7],
    borderRadius: radius.lg,
    borderWidth: border.card,
    borderColor: colors.text,
    ...elevation.card,
  },
  reward: { backgroundColor: colors.rewardContainer },
  penalty: { backgroundColor: colors.penaltyContainer },
  value: { marginTop: space[2] },
});
