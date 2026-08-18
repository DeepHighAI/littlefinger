import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfButton } from '../../components/LfButton';
import { LfPinky } from '../../components/LfPinky';
import { openInviteInBrowserNative } from '../../lib/invite-link-native.ts';
import { brandFontFamily } from '../../theme/fonts';
import { colors, line, space, type, weight } from '../../theme/tokens';

const LABEL = {
  title: '초대 확인은 웹에서 이어져요',
  body: '카카오 로그인과 승인은 기본 브라우저에서 안전하게 진행합니다.',
  action: '기본 브라우저에서 열기',
  invalid: '초대 링크를 확인할 수 없어요.',
  failure: '기본 브라우저를 열지 못했어요. 다시 시도해 주세요.',
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: space[8] },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[8] },
  title: { color: colors.text, fontSize: type.title, lineHeight: line.title, fontFamily: brandFontFamily(weight.heavy), textAlign: 'center' },
  copy: { color: colors.textSecondary, fontSize: type.body, lineHeight: line.body, fontFamily: brandFontFamily(weight.regular), textAlign: 'center' },
  error: { color: colors.error, fontSize: type.caption, lineHeight: line.micro, fontFamily: brandFontFamily(weight.medium), textAlign: 'center' },
});

export default function InviteAppLinkScreen(): React.JSX.Element {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const value = typeof token === 'string' ? token : '';
  const [error, setError] = useState(false);

  async function open(): Promise<void> {
    setError(false);
    try {
      await openInviteInBrowserNative(value);
    } catch {
      setError(true);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <LfPinky size="xl" accessibilityLabel="새끼손가락 걸기" />
        {value.length === 0 ? (
          <Text accessibilityRole="alert" style={styles.copy}>{LABEL.invalid}</Text>
        ) : (
          <>
            <View>
              <Text style={styles.title}>{LABEL.title}</Text>
              <Text style={styles.copy}>{LABEL.body}</Text>
            </View>
            {error && <Text accessibilityRole="alert" style={styles.error}>{LABEL.failure}</Text>}
          </>
        )}
      </View>
      {value.length > 0 && (
        <LfButton label={LABEL.action} size="cta" block onPress={() => void open()} />
      )}
    </SafeAreaView>
  );
}
