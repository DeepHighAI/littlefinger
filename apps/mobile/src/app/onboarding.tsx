import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfButton } from '../components/LfButton';
import { LfIcon } from '../components/LfIcon';
import { LfPinky } from '../components/LfPinky';
import { useLabels } from '../lib/locale-native';
import { useMobileAuthGate } from '../lib/mobile-auth-gate.ts';
import { completeOnboardingNative } from '../lib/onboarding-native.ts';
import { ONBOARDING_LABEL } from '../screens/onboarding-labels.ts';
import { brandFontFamily } from '../theme/fonts';
import { colors, line, radius, size, space, type, weight } from '../theme/tokens';

const BODY_GUTTER = 28;
const BADGE_SIZE = 128;
const BADGE_RADIUS = 44;
const STEP_WIDTH = 76;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  skipRow: { alignItems: 'flex-end', paddingTop: space[6], paddingHorizontal: space[8] },
  skip: { minHeight: size.touchMin, paddingHorizontal: space[3], justifyContent: 'center' },
  skipText: { color: colors.textMuted, fontSize: type.body, fontFamily: brandFontFamily(weight.medium) },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[8], paddingHorizontal: BODY_GUTTER },
  badge: { width: BADGE_SIZE, height: BADGE_SIZE, borderRadius: BADGE_RADIUS, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  headline: { color: colors.text, fontSize: type.title, lineHeight: line.title, fontFamily: brandFontFamily(weight.heavy), textAlign: 'center' },
  subcopy: { marginTop: space[4], color: colors.textSecondary, fontSize: type.body, lineHeight: line.body, fontFamily: brandFontFamily(weight.regular), textAlign: 'center' },
  steps: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  step: { width: STEP_WIDTH, alignItems: 'center', gap: space[1] },
  stepIcon: { width: size.iconButton, height: size.iconButton, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { color: colors.textSecondary, fontSize: type.micro, fontFamily: brandFontFamily(weight.bold) },
  arrow: { marginBottom: space[7] },
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

  const steps = [
    { icon: 'edit' as const, label: LABEL.stepWrite },
    { icon: 'forum' as const, label: LABEL.stepInvite },
    { icon: null, label: LABEL.stepKeep },
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.skipRow}>
        <Pressable accessibilityRole="button" style={styles.skip} disabled={saving} onPress={() => void finish()}>
          <Text style={styles.skipText}>{LABEL.skip}</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        <View style={styles.badge} accessible accessibilityRole="image" accessibilityLabel={LABEL.badge}>
          <LfPinky size="xl" tone="onContainer" />
        </View>
        <View>
          <Text style={styles.headline}>{LABEL.headline}</Text>
          <Text style={styles.subcopy}>{LABEL.subcopy}</Text>
        </View>
        <View style={styles.steps}>
          {steps.map((step, index) => (
            <View key={step.label} style={styles.steps}>
              {index > 0 && <LfIcon name="east" size={type.body} color="outlineIcon" />}
              <View style={styles.step}>
                <View style={styles.stepIcon}>
                  {step.icon === null ? <LfPinky size="xs" /> : <LfIcon name={step.icon} size={type.title} color="primary" />}
                </View>
                <Text style={styles.stepLabel}>{step.label}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.actions}>
        <LfButton label={LABEL.start} size="cta" block disabled={saving} onPress={() => void finish()} />
      </View>
    </SafeAreaView>
  );
}
