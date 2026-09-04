import { StyleSheet, View, type ViewProps } from 'react-native';

import { space } from '../theme/tokens';
import { LfBlob } from './LfBlob';
import { LfPinkyLoop } from './LfPinkyLoop';
import { LfStack } from './LfStack';
import { LfText } from './LfText';

export interface LfEmptyProps extends Omit<ViewProps, 'style' | 'children'> {
  title: string;
  description: string;
  highlight?: string;
  tilt?: 'blob' | 'empty';
}

export function LfEmpty({
  title,
  description,
  highlight,
  tilt = 'blob',
  ...rest
}: LfEmptyProps): React.JSX.Element {
  return (
    <View {...rest} style={styles.container}>
      <LfStack gap={8} center>
        <LfBlob variant="empty" tilt={tilt}>
          <LfPinkyLoop size="eyes" variant="solid" spark />
        </LfBlob>
        <LfStack gap={2} center>
          <LfText variant="subtitle" align="center">{title}</LfText>
          <LfText variant="meta" align="center">{description}</LfText>
          {highlight === undefined ? null : (
            <LfText variant="bodyStrong" align="center">{highlight}</LfText>
          )}
        </LfStack>
      </LfStack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[9],
  },
});
