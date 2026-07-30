import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, gutter, size, space } from '../theme/tokens';
import { LfPinky } from './LfPinky';
import { LfText } from './LfText';

export interface LfAppBarProps extends Omit<ViewProps, 'style' | 'children'> {
  title: string;
  brand?: boolean;
  action?: React.ReactNode;
}

const styles = StyleSheet.create({
  container: {
    height: size.appbarHeight,
    paddingHorizontal: gutter.app,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    backgroundColor: colors.surfaceChrome,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  title: { flex: 1 },
});

export function LfAppBar({
  title,
  brand = false,
  action,
  ...rest
}: LfAppBarProps): React.JSX.Element {
  return (
    <View {...rest} style={styles.container}>
      {brand && <LfPinky size="sm" />}
      <View style={styles.title}>
        <LfText variant="subtitle">{title}</LfText>
      </View>
      {action}
    </View>
  );
}
