import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, size, space } from '../theme/tokens';
import { LfPinky } from './LfPinky';
import { LfStack } from './LfStack';
import { LfText } from './LfText';

export interface LfEmptyProps extends Omit<ViewProps, 'style' | 'children'> {
  title: string;
  description: string;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[9],
  },
  badge: {
    width: size.fabHeight + space[9] + space[3],
    height: size.fabHeight + space[9] + space[3],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryContainer,
  },
});

export function LfEmpty({
  title,
  description,
  ...rest
}: LfEmptyProps): React.JSX.Element {
  return (
    <View {...rest} style={styles.container}>
      <LfStack gap={5} center>
        <View style={styles.badge}>
          <LfPinky size="xl" />
        </View>
        <LfStack gap={2} center>
          <LfText variant="subtitle" align="center">
            {title}
          </LfText>
          <LfText secondary align="center">
            {description}
          </LfText>
        </LfStack>
      </LfStack>
    </View>
  );
}
