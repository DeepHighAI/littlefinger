import { StyleSheet, View } from 'react-native';

import { colors, radius, space } from '../theme/tokens';
import { LfPinky } from './LfPinky';
import { LfText } from './LfText';

export interface LfHelperProps {
  text: string;
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingVertical: space[5],
    paddingHorizontal: space[7],
    borderRadius: radius.lg,
    backgroundColor: colors.recordContainer,
  },
  copy: { flex: 1 },
});

export function LfHelper({ text }: LfHelperProps): React.JSX.Element {
  return (
    <View style={styles.root}>
      <LfPinky size="xs" tone="record" />
      <View style={styles.copy}><LfText secondary>{text}</LfText></View>
    </View>
  );
}
