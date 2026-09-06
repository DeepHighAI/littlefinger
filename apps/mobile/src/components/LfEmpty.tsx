import { StyleSheet, View, type ViewProps } from 'react-native';

import { space } from '../theme/tokens';
import { LfBlob } from './LfBlob';
import { LfEyes } from './LfMascot';
import { LfOval } from './LfOval';
import { LfPinkyLoop } from './LfPinkyLoop';
import { LfStack } from './LfStack';
import { LfText } from './LfText';

export type LfEmptyArt = 'blob' | 'history';

export interface LfEmptyProps extends Omit<ViewProps, 'style' | 'children'> {
  title: string;
  description: string;
  highlight?: string;
  /** 홈 = A00 블롭 + 손 루프(scale .5) · 지난 약속 = 타원 130×104 + 눈 60 (README §마스코트) */
  art?: LfEmptyArt;
}

/** README 빈 상태 손 루프 scale .5 — 토큰 없음, ADR 0020 예외 */
const LOOP_SCALE = 0.5;

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
          <LfOval variant="history"><LfEyes size="history" /></LfOval>
        ) : (
          <LfBlob variant="empty">
            <View style={styles.loop}><LfPinkyLoop size="eyes" variant="solid" spark /></View>
          </LfBlob>
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
  loop: { transform: [{ scale: LOOP_SCALE }] },
});
