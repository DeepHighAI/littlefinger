import { codepointLength, normalizeInput } from '@littlefinger/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAppBar } from '../components/LfAppBar';
import { LfButton } from '../components/LfButton';
import { LfField } from '../components/LfField';
import { LfIcon } from '../components/LfIcon';
import { LfInput } from '../components/LfInput';
import { updateProfileNicknameNative } from '../lib/account-safety-native.ts';
import { useLabels } from '../lib/locale-native';
import { PROFILE_NICKNAME_LABEL } from '../screens/profile-nickname-labels.ts';
import { colors, gutter, size, space } from '../theme/tokens';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: gutter.app, gap: space[7] },
  iconButton: {
    minWidth: size.touchMin,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { flex: 1 },
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
      <View style={styles.body}>
        <LfField label={LABEL.field} required {...(error === undefined ? {} : { error })}>
          <LfInput
            accessibilityLabel={LABEL.field}
            value={value}
            placeholder={LABEL.placeholder}
            editable={!saving}
            autoCapitalize="none"
            onChangeText={setValue}
          />
        </LfField>
        <View style={styles.spacer} />
        <LfButton label={LABEL.save} block size="cta" disabled={saving} onPress={() => void save()} />
      </View>
    </SafeAreaView>
  );
}
