import { StyleSheet, View, type ViewProps } from 'react-native';

import { space } from '../theme/tokens';
import { LfBlob } from './LfBlob';
import { LfOval } from './LfOval';
import { LfStack } from './LfStack';
import { LfText } from './LfText';

export type LfEmptyArt = 'blob' | 'history';

export interface LfEmptyProps extends Omit<ViewProps, 'style' | 'children'> {
  title: string;
  description: string;
  highlight?: string;
  /** 홈과 지난 약속은 기존 아트 영역 크기를 각각 유지한다. */
  art?: LfEmptyArt;
}

export function LfEmpty({
  title,
  description,
  highlight,
  art = 'blob',
  ...rest
}: LfEmptyProps): React.JSX.Element {
  return (
    <View {...rest} style={styles.container}>
      <LfStack gap={8} center>
        {art === 'history' ? (
          <LfOval variant="history" />
        ) : (
          <LfBlob variant="empty" />
        )}
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
