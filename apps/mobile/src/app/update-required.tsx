import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfButton } from '../components/LfButton';
import { LfPinky } from '../components/LfPinky';
import { useLabels } from '../lib/locale-native';
import { openAndroidStore } from '../lib/minimum-app-version-native.ts';
import { UPDATE_REQUIRED_LABEL } from '../screens/update-required-labels.ts';
import { brandFontFamily } from '../theme/fonts';
import { colors, line, space, type, weight } from '../theme/tokens';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: space[8] },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[8] },
  title: { color: colors.text, fontSize: type.title, lineHeight: line.title, fontFamily: brandFontFamily(weight.heavy), textAlign: 'center' },
  copy: { color: colors.textSecondary, fontSize: type.body, lineHeight: line.body, fontFamily: brandFontFamily(weight.regular), textAlign: 'center' },
});

export default function UpdateRequiredScreen(): React.JSX.Element {
  const LABEL = useLabels(UPDATE_REQUIRED_LABEL);
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <LfPinky size="xl" accessibilityLabel={LABEL.badge} />
        <View>
          <Text style={styles.title}>{LABEL.title}</Text>
          <Text style={styles.copy}>{LABEL.copy}</Text>
        </View>
      </View>
      <LfButton label={LABEL.store} size="cta" block onPress={() => void openAndroidStore()} />
    </SafeAreaView>
  );
}
