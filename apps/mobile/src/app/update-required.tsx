import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfBlob } from '../components/LfBlob';
import { LfButton } from '../components/LfButton';
import { LfEyes } from '../components/LfMascot';
import { LfText } from '../components/LfText';
import { useLabels } from '../lib/locale-native';
import { openAndroidStore } from '../lib/minimum-app-version-native.ts';
import { UPDATE_REQUIRED_LABEL } from '../screens/update-required-labels.ts';
import { colors, space } from '../theme/tokens';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: space[8] },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[8] },
  copy: { alignItems: 'center', gap: space[2] },
});

export default function UpdateRequiredScreen(): React.JSX.Element {
  const LABEL = useLabels(UPDATE_REQUIRED_LABEL);
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <View accessible accessibilityRole="image" accessibilityLabel={LABEL.badge}>
          <LfBlob variant="empty" tilt="empty">
            <LfEyes size="blob" />
          </LfBlob>
        </View>
        <View style={styles.copy}>
          <LfText variant="title" align="center">{LABEL.title}</LfText>
          <LfText secondary align="center">{LABEL.copy}</LfText>
        </View>
      </View>
      <LfButton label={LABEL.store} size="cta" block onPress={() => void openAndroidStore()} />
    </SafeAreaView>
  );
}
