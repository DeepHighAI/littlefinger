import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfBlob } from '../components/LfBlob';
import { LfButton } from '../components/LfButton';
import { LfPinkyLoop } from '../components/LfPinkyLoop';
import { useLabels } from '../lib/locale-native';
import { useMobileAuthGate } from '../lib/mobile-auth-gate.ts';
import { completeOnboardingNative } from '../lib/onboarding-native.ts';
import { ONBOARDING_LABEL } from '../screens/onboarding-labels.ts';
import { textFontFamily } from '../theme/fonts';
import { colors, line, size, space, type, weight } from '../theme/tokens';

const BODY_GUTTER = 28;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  skipRow: { alignItems: 'flex-end', paddingTop: space[6], paddingHorizontal: space[8] },
  skip: { minHeight: size.touchMin, paddingHorizontal: space[3], justifyContent: 'center' },
  skipText: {
    color: colors.textMuted,
    fontSize: type.body,
    fontFamily: textFontFamily(weight.medium),
    textDecorationLine: 'underline',
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[8], paddingHorizontal: BODY_GUTTER },
  // 배지 상자는 걷어내고 마스코트가 그대로 앉는다 (.lf-onboarding__badge 리셋)
  badge: { alignItems: 'center', justifyContent: 'center' },
  headline: { color: colors.text, fontSize: type.title, lineHeight: line.title, fontFamily: textFontFamily(weight.heavy), textAlign: 'center' },
  subcopy: { marginTop: space[4], color: colors.textSecondary, fontSize: type.body, lineHeight: line.body, fontFamily: textFontFamily(weight.regular), textAlign: 'center' },
  actions: { paddingHorizontal: space[8], paddingBottom: space[8] },
});

export default function OnboardingScreen(): React.JSX.Element {
  const LABEL = useLabels(ONBOARDING_LABEL);
  const router = useRouter();
  const { onOnboardingCompleted } = useMobileAuthGate();
  const [saving, setSaving] = useState(false);

  async function finish(): Promise<void> {
    if (saving) return;
    setSaving(true);
    try {
      await completeOnboardingNative();
      onOnboardingCompleted?.();
      router.replace('/');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.skipRow}>
        <Pressable accessibilityRole="button" style={styles.skip} disabled={saving} onPress={() => void finish()}>
          <Text style={styles.skipText}>{LABEL.skip}</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        <View style={styles.badge} accessible accessibilityRole="image" accessibilityLabel={LABEL.badge}>
          <LfBlob variant="login" tilt="blob">
            <LfPinkyLoop size="eyes" variant="solid" spark />
          </LfBlob>
        </View>
        <View>
          <Text style={styles.headline}>{LABEL.headline}</Text>
          <Text style={styles.subcopy}>{LABEL.subcopy}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <LfButton label={LABEL.start} size="cta" block disabled={saving} onPress={() => void finish()} />
      </View>
    </SafeAreaView>
  );
}
