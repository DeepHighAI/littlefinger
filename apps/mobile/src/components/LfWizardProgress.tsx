import { StyleSheet, View } from 'react-native';

import { colors, border, space } from '../theme/tokens';
import { LfText } from './LfText';

export type LfWizardStep = 1 | 2 | 3;

export interface LfWizardProgressProps {
  step: LfWizardStep;
  labels: readonly [string, string, string];
}

/** README 마법사 막대 8h r4 — 토큰 없음, ADR 0020 예외 */
const BAR_HEIGHT = 8;
const STEP_COUNT = 3;

/** 3단계 진행 — 막대 3개(지난 단계까지 잉크 채움) + "1/3 · 내용" 라벨 */
const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  bar: {
    flex: 1,
    height: BAR_HEIGHT,
    borderRadius: space[1],
    borderWidth: border.chip,
    borderColor: colors.text,
    backgroundColor: colors.surface,
  },
  active: { backgroundColor: colors.text },
  label: { marginLeft: space[1] },
});

export function LfWizardProgress({ step, labels }: LfWizardProgressProps): React.JSX.Element {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: 3, now: step, text: labels[step - 1] }}
      style={styles.root}
    >
      {labels.map((label, index) => (
        <View key={label} style={[styles.bar, index + 1 <= step && styles.active]} />
      ))}
      <View style={styles.label}>
        <LfText variant="chip">{`${step}/${STEP_COUNT} · ${labels[step - 1]}`}</LfText>
      </View>
    </View>
  );
}
