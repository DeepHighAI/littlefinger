import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfButton } from '../components/LfButton';
import { LfDoodle, LfDoodleLayer } from '../components/LfDoodle';
import { LfIcon } from '../components/LfIcon';
import { LfMascot } from '../components/LfMascot';
import { LfPinky } from '../components/LfPinky';
import { useLabels } from '../lib/locale-native';
import { useMobileAuthGate } from '../lib/mobile-auth-gate.ts';
import { completeOnboardingNative } from '../lib/onboarding-native.ts';
import { ONBOARDING_LABEL } from '../screens/onboarding-labels.ts';
import { textFontFamily } from '../theme/fonts';
import { colors, line, radius, size, space, type, weight } from '../theme/tokens';

const BODY_GUTTER = 28;
const STEP_WIDTH = 76;
// 잉크&스티커 단계 아이콘 — 54px 필 + 2.4px 잉크 테두리 (.lf-onboarding__step-icon)
const STEP_ICON_SIZE = 54;
const STEP_ICON_BORDER_WIDTH = 2.4;

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
  steps: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  step: { width: STEP_WIDTH, alignItems: 'center', gap: space[1] },
  stepIcon: {
    width: STEP_ICON_SIZE,
    height: STEP_ICON_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: STEP_ICON_BORDER_WIDTH,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 2번째 단계 = 버터, 3번째 단계 = 라벤더 스티커 톤
  stepIconButter: { backgroundColor: colors.primaryContainer },
  stepIconLavender: { backgroundColor: colors.rewardContainer },
  stepLabel: { color: colors.textSecondary, fontSize: type.micro, fontFamily: textFontFamily(weight.bold) },
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
      <LfDoodleLayer>
        <LfDoodle placement="sparkle-tl" />
        <LfDoodle placement="star-tr" />
        <LfDoodle placement="moon-r" />
      </LfDoodleLayer>
      <View style={styles.skipRow}>
        <Pressable accessibilityRole="button" style={styles.skip} disabled={saving} onPress={() => void finish()}>
          <Text style={styles.skipText}>{LABEL.skip}</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        <View style={styles.badge} accessible accessibilityRole="image" accessibilityLabel={LABEL.badge}>
          <LfMascot size="onboarding" />
        </View>
        <View>
          <Text style={styles.headline}>{LABEL.headline}</Text>
          <Text style={styles.subcopy}>{LABEL.subcopy}</Text>
        </View>
        <View style={styles.steps}>
          {steps.map((step, index) => (
            <View key={step.label} style={styles.steps}>
              {index > 0 && <LfIcon name="east" size={type.body} color="text" />}
              <View style={styles.step}>
                <View
                  style={[
                    styles.stepIcon,
                    index === 1 && styles.stepIconButter,
                    index === 2 && styles.stepIconLavender,
                  ]}
                >
                  {step.icon === null ? <LfPinky size="xs" /> : <LfIcon name={step.icon} size={type.title} color="text" />}
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
