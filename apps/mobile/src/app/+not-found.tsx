import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfBlob } from '../components/LfBlob';
import { LfButton } from '../components/LfButton';
import { LfEyes } from '../components/LfMascot';
import { LfText } from '../components/LfText';
import { useLabels } from '../lib/locale-native';
import { NOT_FOUND_LABEL } from '../screens/not-found-labels.ts';
import { colors, space } from '../theme/tokens';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: space[8] },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[8] },
  copy: { alignItems: 'center', gap: space[2] },
});

// 딥링크가 어긋났을 때의 첫인상이다. expo-router 기본 화면은 영어·시스템 폰트라
// 브랜드 화면으로 대체한다. 루트로 보내면 _layout 의 세션 규칙이 로그인/홈을 가른다.
export default function NotFoundScreen(): React.JSX.Element {
  const LABEL = useLabels(NOT_FOUND_LABEL);
  const router = useRouter();
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
      <LfButton label={LABEL.action} size="cta" block onPress={() => router.replace('/')} />
    </SafeAreaView>
  );
}
