import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfButton } from '../components/LfButton';
import { LfPinky } from '../components/LfPinky';
import { brandFontFamily } from '../theme/fonts';
import { colors, line, space, type, weight } from '../theme/tokens';

// 딥링크가 어긋났을 때의 첫인상이다. expo-router 기본 화면은 영어·시스템 폰트라
// 브랜드 화면으로 대체한다. 루트로 보내면 _layout 의 세션 규칙이 로그인/홈을 가른다.
const LABEL = {
  title: '화면을 찾을 수 없어요',
  copy: '주소가 바뀌었거나 만료된 링크일 수 있어요.',
  action: '처음으로',
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: space[8] },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[8] },
  title: { color: colors.text, fontSize: type.title, lineHeight: line.title, fontFamily: brandFontFamily(weight.bold), textAlign: 'center' },
  copy: { color: colors.textSecondary, fontSize: type.body, lineHeight: line.body, fontFamily: brandFontFamily(weight.regular), textAlign: 'center' },
});

export default function NotFoundScreen(): React.JSX.Element {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <LfPinky size="xl" accessibilityLabel="새끼손가락 걸기" />
        <View>
          <Text style={styles.title}>{LABEL.title}</Text>
          <Text style={styles.copy}>{LABEL.copy}</Text>
        </View>
      </View>
      <LfButton label={LABEL.action} size="cta" block onPress={() => router.replace('/')} />
    </SafeAreaView>
  );
}
