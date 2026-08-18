import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfButton } from '../components/LfButton';
import { LfIcon } from '../components/LfIcon';
import { LfPinky } from '../components/LfPinky';
import { completeOnboardingNative } from '../lib/onboarding-native.ts';
import { brandFontFamily } from '../theme/fonts';
import { colors, line, radius, size, space, type, weight } from '../theme/tokens';

const BODY_GUTTER = 28;
const BADGE_SIZE = 128;
const BADGE_RADIUS = 44;
const STEP_WIDTH = 76;
const DOT_SIZE = 8;
const ACTIVE_DOT_WIDTH = 22;

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
  dots: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: radius.pill, backgroundColor: colors.outlineStrong },
  activeDot: { width: ACTIVE_DOT_WIDTH, backgroundColor: colors.primary },
  actions: { paddingHorizontal: space[8], paddingBottom: space[8] },
});

export default function OnboardingScreen(): React.JSX.Element {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function finish(): Promise<void> {
    if (saving) return;
    setSaving(true);
    try {
      await completeOnboardingNative();
      router.replace('/');
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    { icon: 'edit' as const, label: '작성' },
    { icon: 'forum' as const, label: '카톡 초대' },
    { icon: null, label: '걸고 지키기' },
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.skipRow}>
        <Pressable accessibilityRole="button" style={styles.skip} disabled={saving} onPress={() => void finish()}>
          <Text style={styles.skipText}>건너뛰기</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        <View style={styles.badge} accessible accessibilityRole="image" accessibilityLabel="새끼손가락 걸기">
          <LfPinky size="xl" tone="onContainer" />
        </View>
        <View>
          <Text style={styles.headline}>약속하고, 걸고,{`\n`}지키는 재미</Text>
          <Text style={styles.subcopy}>둘이 정한 약속을 기록하고{`\n`}잊지 않게 챙겨드려요</Text>
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
        <View accessible accessibilityRole="image" accessibilityLabel="1/3 단계" style={styles.dots}>
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </View>
      <View style={styles.actions}>
        <LfButton label="시작하기" size="cta" block disabled={saving} onPress={() => void finish()} />
      </View>
    </SafeAreaView>
  );
}
