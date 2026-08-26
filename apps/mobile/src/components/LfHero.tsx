import { StyleSheet, View } from 'react-native';

import { colors, elevation, gutter, radius, space } from '../theme/tokens';
import { LfButton } from './LfButton';
import { LfPinky } from './LfPinky';
import { LfStack } from './LfStack';
import { LfText } from './LfText';

export interface LfHeroProps {
  eyebrow: string;
  title: string;
  description?: string;
  dday?: string;
  meta?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

// 임박 배너 = 살짝 기울인 잉크 테두리 스티커 카드 (.lf-home__pinned, ADR 0012)
const HERO_BORDER_WIDTH = 2.5;
const HERO_TILT = '-1.2deg';

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: gutter.app,
    paddingVertical: space[6],
    paddingHorizontal: space[7],
    borderRadius: radius.record,
    backgroundColor: colors.surface,
    borderWidth: HERO_BORDER_WIDTH,
    borderColor: colors.text,
    transform: [{ rotate: HERO_TILT }],
    ...elevation.card,
    gap: space[7],
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space[5] },
  // 플래그는 배경 없는 살구 텍스트 (.lf-home__pinned-flag)
  eyebrow: {
    alignSelf: 'flex-start',
  },
});

export function LfHero({
  eyebrow,
  title,
  description,
  dday,
  meta,
  actionLabel,
  onAction,
  testID,
}: LfHeroProps): React.JSX.Element {
  return (
    <View testID={testID} style={styles.hero}>
      <View style={styles.top}>
        <LfStack grow gap={3}>
          <View style={styles.eyebrow}>
            <LfText variant="containerFlag">{eyebrow}</LfText>
          </View>
          <LfText variant="title">{title}</LfText>
          {description !== undefined && <LfText>{description}</LfText>}
          {meta !== undefined && <LfText variant="caption">{meta}</LfText>}
        </LfStack>
        {dday === undefined ? <LfPinky size="sm" /> : <LfText variant="heroDday">{dday}</LfText>}
      </View>
      {actionLabel !== undefined && onAction !== undefined && (
        <LfButton label={actionLabel} variant="tonal" onPress={onAction} block />
      )}
    </View>
  );
}
