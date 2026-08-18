import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfButton } from '../components/LfButton';
import { LfPinky } from '../components/LfPinky';
import { openAndroidStore } from '../lib/minimum-app-version-native.ts';
import { brandFontFamily } from '../theme/fonts';
import { colors, line, space, type, weight } from '../theme/tokens';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: space[8] },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[8] },
  title: { color: colors.text, fontSize: type.title, lineHeight: line.title, fontFamily: brandFontFamily(weight.heavy), textAlign: 'center' },
  copy: { color: colors.textSecondary, fontSize: type.body, lineHeight: line.body, fontFamily: brandFontFamily(weight.regular), textAlign: 'center' },
});

export default function UpdateRequiredScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <LfPinky size="xl" accessibilityLabel="새끼손가락 걸기" />
        <View>
          <Text style={styles.title}>업데이트 후 이용해 주세요.</Text>
          <Text style={styles.copy}>안전하게 약속을 이어가려면 최신 버전이 필요해요.</Text>
        </View>
      </View>
      <LfButton label="스토어로 이동" size="cta" block onPress={() => void openAndroidStore()} />
    </SafeAreaView>
  );
}
