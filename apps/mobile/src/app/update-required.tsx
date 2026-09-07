import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfOval } from '../components/LfOval';
import { LfButton } from '../components/LfButton';
import { LfEyes } from '../components/LfMascot';
import { LfText } from '../components/LfText';
import { useLabels } from '../lib/locale-native';
import { openAndroidStore } from '../lib/minimum-app-version-native.ts';
import { UPDATE_REQUIRED_LABEL } from '../screens/update-required-labels.ts';
import { colors, space } from '../theme/tokens';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  // `.lf-empty` — 세로 가운데, 간격 20, 좌우 24. CTA 도 같은 열에 선다
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
    paddingHorizontal: space[9],
  },
  copy: { alignItems: 'center', gap: space[2] },
});

export default function UpdateRequiredScreen(): React.JSX.Element {
  const LABEL = useLabels(UPDATE_REQUIRED_LABEL);
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <View accessible accessibilityRole="image" accessibilityLabel={LABEL.badge}>
          <LfOval variant="web">
            <LfEyes size="web" />
          </LfOval>
        </View>
        <View style={styles.copy}>
          <LfText variant="subtitle" align="center">{LABEL.title}</LfText>
          <LfText variant="hint" align="center">{LABEL.copy}</LfText>
        </View>
        <LfButton
          label={LABEL.store}
          size="cta"
          trailing="arrow_forward"
          onPress={() => void openAndroidStore()}
        />
      </View>
    </SafeAreaView>
  );
}
