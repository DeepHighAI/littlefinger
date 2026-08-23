import { StyleSheet, View } from 'react-native';

import { colors, gutter, radius, space } from '../theme/tokens';
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

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: gutter.app,
    padding: space[8],
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    borderBottomRightRadius: radius.hero,
    borderBottomLeftRadius: radius.heroTail,
    backgroundColor: colors.primaryContainer,
    gap: space[7],
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space[5] },
  eyebrow: {
    alignSelf: 'flex-start',
    paddingVertical: space[1],
    paddingHorizontal: space[5],
    borderRadius: radius.pill,
    backgroundColor: colors.attentionContainer,
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
