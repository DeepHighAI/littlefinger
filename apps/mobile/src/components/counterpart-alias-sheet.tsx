import { COUNTERPART_ALIAS_MAX_LENGTH, codepointLength, normalizeInput, type CounterpartAliasResponse } from '@littlefinger/shared';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { createCounterpartAliasKey, loadCounterpartAliasNative, updateCounterpartAliasNative } from '../lib/counterpart-alias-native.ts';
import { useLabels } from '../lib/locale-native.tsx';
import { useKeyboardScroll } from '../lib/use-keyboard-scroll.ts';
import { COUNTERPART_ALIAS_LABEL } from '../screens/counterpart-alias-labels.ts';
import { space } from '../theme/tokens.ts';
import { LfButton } from './LfButton.tsx';
import { LfField } from './LfField.tsx';
import { LfInput } from './LfInput.tsx';
import { LfSheet } from './LfSheet.tsx';
import { LfText } from './LfText.tsx';

interface CounterpartAliasSheetProps {
  promiseId: string;
  onClose(): void;
  onSaved(): void;
}

const styles = StyleSheet.create({ content: { gap: space[5], paddingBottom: space[8] } });

export function CounterpartAliasSheet({ promiseId, onClose, onSaved }: CounterpartAliasSheetProps): React.JSX.Element {
  const LABEL = useLabels(COUNTERPART_ALIAS_LABEL);
  const keyboard = useKeyboardScroll(true);
  const [record, setRecord] = useState<CounterpartAliasResponse | null>(null);
  const [alias, setAlias] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const intent = useRef<{ alias: string | null; key: string } | null>(null);
  const normalized = normalizeInput(alias);
  const invalid = codepointLength(normalized) > COUNTERPART_ALIAS_MAX_LENGTH;

  useEffect(() => {
    let active = true;
    setLoadFailed(false);
    void loadCounterpartAliasNative(promiseId).then((value) => {
      if (!active) return;
      setRecord(value);
      setAlias(value.alias ?? '');
    }).catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [attempt, promiseId]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function save(value: string | null): Promise<void> {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setSaveFailed(false);
    if (intent.current === null || intent.current.alias !== value) {
      intent.current = { alias: value, key: createCounterpartAliasKey() };
    }
    try {
      await updateCounterpartAliasNative(promiseId, value, intent.current.key);
      if (mounted.current) onSaved();
    } catch {
      if (mounted.current) setSaveFailed(true);
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <LfSheet visible title={LABEL.title} closeLabel={LABEL.close} onClose={() => { if (!pending.current) onClose(); }}>
      <ScrollView
        ref={keyboard.scrollRef}
        keyboardShouldPersistTaps="handled"
        onScroll={keyboard.onScroll}
        scrollEventThrottle={16}
        onLayout={() => keyboard.reveal()}
        onContentSizeChange={() => keyboard.reveal()}
        contentContainerStyle={[styles.content, { paddingBottom: space[8] + keyboard.inset }]}
      >
        {record === null ? <>
          <LfText>{loadFailed ? LABEL.loadError : LABEL.loading}</LfText>
          {loadFailed && <LfButton label={LABEL.retry} variant="outlined" onPress={() => setAttempt((value) => value + 1)} />}
        </> : <>
          <LfText variant="meta">{LABEL.original}</LfText>
          <LfText variant="bodyStrong">{record.nickname}</LfText>
          <LfText variant="meta">{LABEL.explanation}</LfText>
          <LfField label={LABEL.field} error={invalid ? LABEL.limit(COUNTERPART_ALIAS_MAX_LENGTH) : undefined}>
            <LfInput accessibilityLabel={LABEL.field} placeholder={LABEL.placeholder} value={alias} editable={!saving} onFocus={keyboard.onFocus} onChangeText={setAlias} />
          </LfField>
          <LfText variant="meta">{LABEL.resetHelp}</LfText>
          {saveFailed && <LfText variant="error">{LABEL.saveError}</LfText>}
          <LfButton label={saving ? LABEL.saving : LABEL.save} disabled={saving || invalid} onPress={() => void save(normalized === '' ? null : normalized)} />
          {record.alias !== null && <LfButton label={LABEL.reset} variant="text" disabled={saving} onPress={() => void save(null)} />}
        </>}
      </ScrollView>
    </LfSheet>
  );
}
