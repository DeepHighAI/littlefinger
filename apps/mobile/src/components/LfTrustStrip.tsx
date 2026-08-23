import { Pressable, StyleSheet, View } from 'react-native';

import { useLabels } from '../lib/locale-native';
import { MOBILE_CHROME_LABEL } from '../screens/mobile-chrome-labels.ts';
import { colors, radius, size, space } from '../theme/tokens';
import { LfIcon } from './LfIcon';
import { LfPinky } from './LfPinky';
import { LfText } from './LfText';

export interface LfTrustStripProps {
  rate: number | null;
  onPress: () => void;
}

const styles = StyleSheet.create({
  root: {
    minHeight: size.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingVertical: space[5],
    paddingHorizontal: space[7],
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  copy: { flex: 1 },
});

export function LfTrustStrip({ rate, onPress }: LfTrustStripProps): React.JSX.Element {
  const LABEL = useLabels(MOBILE_CHROME_LABEL);
  const summary = rate === null ? LABEL.trustPendingSummary : LABEL.trustSummary(rate);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={summary}
      style={styles.root}
      onPress={onPress}
    >
      <LfPinky size="xs" />
      <View style={styles.copy}>
        <LfText variant="listStatus">{LABEL.trustRate}</LfText>
        <LfText variant="caption">{summary}</LfText>
      </View>
      <LfIcon name="chevron-right" color="textMuted" />
    </Pressable>
  );
}
