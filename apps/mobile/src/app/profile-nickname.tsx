import { codepointLength, normalizeInput } from '@littlefinger/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAppBar } from '../components/LfAppBar';
import { LfButton } from '../components/LfButton';
import { LfCard } from '../components/LfCard';
import { LfField } from '../components/LfField';
import { LfInput } from '../components/LfInput';
import { LfMascotFace } from '../components/LfMascot';
import { LfOval } from '../components/LfOval';
import { LfStack } from '../components/LfStack';
import { LfText } from '../components/LfText';
import { updateProfileNicknameNative } from '../lib/account-safety-native.ts';
import { useLabels } from '../lib/locale-native';
import { PROFILE_NICKNAME_LABEL } from '../screens/profile-nickname-labels.ts';
import { colors, gutter, space } from '../theme/tokens';

/** README 지원 화면 본문 상단 22 — 토큰 없음, ADR 0020 예외 */
const BODY_TOP = 22;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: {
    flexGrow: 1,
    paddingTop: BODY_TOP,
    paddingRight: space[8],
    paddingBottom: space[8],
    paddingLeft: gutter.app,
    gap: space[6],
  },
  // 옐로 안내 카드 — 종이 타원 속 마스코트 + 한 줄 (`.lf-info-row`)
  tip: { flexDirection: 'row', alignItems: 'center', gap: space[5] },
  tipText: { flex: 1, minWidth: 0 },
  actions: {
    paddingHorizontal: space[8],
    paddingTop: space[5],
    paddingBottom: space[7],
    backgroundColor: colors.background,
  },
});

export default function ProfileNicknameScreen(): React.JSX.Element {
  const LABEL = useLabels(PROFILE_NICKNAME_LABEL);
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  async function save(): Promise<void> {
    const nickname = normalizeInput(value);
    if (nickname.length === 0) {
      setError(LABEL.empty);
      return;
    }
    if (nickname.includes('@')) {
      setError(LABEL.email);
      return;
    }
    if (codepointLength(nickname) > 40) {
      setError(LABEL.tooLong);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await updateProfileNicknameNative(nickname);
      router.back();
    } catch {
      setSaving(false);
      setError(LABEL.saveError);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        title={LABEL.title}
        leading="back"
        leadingAccessibilityLabel={LABEL.back}
        onLeadingPress={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <LfCard>
          <LfStack gap={5}>
            <LfField label={LABEL.field} required {...(error === undefined ? {} : { error })}>
              <LfInput
                accessibilityLabel={LABEL.field}
                value={value}
                placeholder={LABEL.placeholder}
                editable={!saving}
                autoCapitalize="none"
                onChangeText={setValue}
              />
              <LfText variant="disclaimer">{LABEL.hint}</LfText>
            </LfField>
            <LfCard tone="yellow">
              <View style={styles.tip}>
                <LfOval variant="hint" tone="paper"><LfMascotFace size="lg" /></LfOval>
                <View style={styles.tipText}><LfText variant="bodyStrong">{LABEL.tip}</LfText></View>
              </View>
            </LfCard>
          </LfStack>
        </LfCard>
      </ScrollView>
      <View style={styles.actions}>
        <LfButton
          label={LABEL.save}
          size="cta"
          block
          trailing="check"
          disabled={saving}
          onPress={() => void save()}
        />
      </View>
    </SafeAreaView>
  );
}
