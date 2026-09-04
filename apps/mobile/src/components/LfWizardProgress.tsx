import { StyleSheet, View } from 'react-native';

import { colors, radius, size, space } from '../theme/tokens';
import { LfText } from './LfText';

export type LfWizardStep = 1 | 2 | 3;

export interface LfWizardProgressProps {
  step: LfWizardStep;
  labels: readonly [string, string, string];
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'flex-start' },
  item: { flex: 1, alignItems: 'center', gap: space[2] },
  rail: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineStrong },
  lineComplete: { backgroundColor: colors.primaryInk },
  dot: {
    width: size.switchKnob,
    height: space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.outlineStrong,
  },
  dotActive: { backgroundColor: colors.primaryInk },
});

export function LfWizardProgress({ step, labels }: LfWizardProgressProps): React.JSX.Element {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: 3, now: step, text: labels[step - 1] }}
      style={styles.root}
    >
      {labels.map((label, index) => {
        const current = index + 1;
        const complete = current <= step;
        return (
          <View key={label} style={styles.item}>
            <View style={styles.rail}>
              <View style={[styles.line, index > 0 && current <= step && styles.lineComplete]} />
              <View style={[styles.dot, complete && styles.dotActive]} />
              <View style={[styles.line, index < 2 && current < step && styles.lineComplete]} />
            </View>
            <LfText variant={current === step ? 'chip' : 'caption'}>{label}</LfText>
          </View>
        );
      })}
    </View>
  );
}
