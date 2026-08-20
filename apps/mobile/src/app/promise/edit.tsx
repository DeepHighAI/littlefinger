import {
  KEEPER_LABEL,
  KEEPER_LABEL_BY_LOCALE,
  PROMISE_CATEGORY_LABEL,
  PROMISE_CATEGORY_LABEL_BY_LOCALE,
  WITNESS_MAX,
  type Keeper,
  type PromiseCategory,
} from '@littlefinger/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  ToastAndroid,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAppBar } from '../../components/LfAppBar';
import { LfButton } from '../../components/LfButton';
import { LfCard } from '../../components/LfCard';
import { LfChip } from '../../components/LfChip';
import { LfChoice } from '../../components/LfChoice';
import { LfField } from '../../components/LfField';
import { LfIcon } from '../../components/LfIcon';
import { LfInput } from '../../components/LfInput';
import { LfPicker } from '../../components/LfPicker';
import { LfRow } from '../../components/LfRow';
import { LfStack } from '../../components/LfStack';
import { LfSwitch } from '../../components/LfSwitch';
import { LfText } from '../../components/LfText';
import { LfTextarea } from '../../components/LfTextarea';
import { DraftAutosave } from '../../lib/draft-autosave.ts';
import { useLabels, useLocale } from '../../lib/locale-native';
import { localizedApiMessage, MobileApiError } from '../../lib/mobile-api.ts';
import {
  clearEditorLocalDraft,
  loadAmendSuggestComment,
  loadEditorDraft,
  openEndDatePicker,
  saveEditorLocalDraft,
  submitEditorDraft,
} from '../../lib/promise-editor-native.ts';
import {
  EMPTY_PROMISE_DRAFT,
  containsSensitiveNumber,
  penaltyPresets,
  rewardPresets,
  validatePromiseDraft,
  type PromiseDraftField,
  type PromiseDraftFields,
} from '../../lib/promise-draft.ts';
import { PROMISE_EDIT_LABEL } from '../../screens/promise-edit-labels.ts';
import { colors, gutter, size, space } from '../../theme/tokens';

const CATEGORIES = Object.keys(PROMISE_CATEGORY_LABEL) as PromiseCategory[];
const KEEPERS = Object.keys(KEEPER_LABEL) as Keeper[];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  close: {
    minWidth: size.touchMin,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: gutter.app,
    paddingBottom: space[9],
    gap: space[6],
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  cardText: { flex: 1 },
  actions: {
    paddingHorizontal: gutter.app,
    paddingTop: space[4],
    paddingBottom: space[6],
    gap: space[3],
    backgroundColor: colors.surfaceChrome,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

function routePromiseId(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

export default function PromiseEditorScreen(): React.JSX.Element {
  const LABEL = useLabels(PROMISE_EDIT_LABEL);
  const { locale } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ promise_id?: string | string[] }>();
  const promiseId = routePromiseId(params.promise_id);
  const [draft, setDraft] = useState<PromiseDraftFields>(EMPTY_PROMISE_DRAFT);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<PromiseDraftField, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<
    Partial<Record<PromiseDraftField, string>>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [amendComment, setAmendComment] = useState<string | null>(null);

  const autosave = useMemo(
    () =>
      new DraftAutosave(async (nextDraft) => {
        await saveEditorLocalDraft(promiseId, nextDraft);
      }),
    [promiseId],
  );

  useEffect(() => {
    let active = true;
    void loadEditorDraft(promiseId)
      .then((value) => {
        if (active) {
          setDraft(value);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) {
          setLoadFailed(true);
          setLoaded(true);
        }
      });
    if (promiseId !== null) {
      // 배너는 보조 정보라 실패해도 편집(오프라인 로컬 초안 포함)을 막지 않는다 —
      // 조회 실패는 배너 미표시로 수렴시킨다.
      void loadAmendSuggestComment(promiseId)
        .then((value) => {
          if (active) setAmendComment(value);
        })
        .catch(() => {
          if (active) setAmendComment(null);
        });
    }
    return () => {
      active = false;
      void autosave.flush();
    };
  }, [autosave, promiseId]);

  const validation = validatePromiseDraft(draft, new Date(), locale);

  function updateDraft<K extends PromiseDraftField>(
    field: K,
    value: PromiseDraftFields[K],
  ): void {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      autosave.schedule(next);
      return next;
    });
    setServerErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function errorFor(field: PromiseDraftField): string | undefined {
    return serverErrors[field] ?? (touched[field] === true ? validation.fields[field] : undefined);
  }

  function touch(field: PromiseDraftField): void {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  async function closeEditor(): Promise<void> {
    await autosave.flush();
    ToastAndroid.show(LABEL.saved, ToastAndroid.SHORT);
    router.back();
  }

  async function performSubmit(send: boolean): Promise<void> {
    if (!validation.valid || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // 대기 저장을 먼저 끝내야 성공 후 삭제한 로컬 초안을 cleanup이 되살리지 않는다.
      await autosave.flush();
      const response = await submitEditorDraft(draft, promiseId, send);
      await clearEditorLocalDraft(promiseId);
      if (response.status === 'PENDING') {
        router.push({
          pathname: '/invite',
          params: {
            promise_id: response.promise_id,
            witness_enabled: draft.witness_enabled ? 'true' : 'false',
          },
        });
      } else {
        router.push('/home');
      }
    } catch (error) {
      if (error instanceof MobileApiError && error.field !== undefined) {
        // 필드 오류는 서버가 만든 필드 맞춤 문구라 코드 사전으로 갈아끼우지 않는다.
        const field = error.field as PromiseDraftField;
        setServerErrors((current) => ({ ...current, [field]: error.message }));
      } else if (error instanceof MobileApiError) {
        setSubmitError(localizedApiMessage(error, locale));
      } else {
        setSubmitError(error instanceof Error ? error.message : LABEL.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function submit(send: boolean): void {
    if (containsSensitiveNumber(draft.body) && !privacyConfirmed) {
      Alert.alert(LABEL.privacyTitle, LABEL.privacyBody, [
        { text: LABEL.cancel, style: 'cancel' },
        {
          text: LABEL.privacyContinue,
          onPress: async () => {
            setPrivacyConfirmed(true);
            await performSubmit(send);
          },
        },
      ]);
      return;
    }
    void performSubmit(send);
  }

  if (!loaded) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loading}>
          <LfText secondary>{LABEL.loading}</LfText>
        </View>
      </SafeAreaView>
    );
  }

  if (loadFailed) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loading}>
          <LfText secondary align="center">
            {LABEL.loadError}
          </LfText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        title={LABEL.title}
        leading={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={LABEL.close}
            onPress={() => void closeEditor()}
            style={styles.close}
          >
            <LfIcon name="close" />
          </Pressable>
        }
        action={<LfChip label={LABEL.editing} tone="neutral" />}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >
        {amendComment !== null && (
          <LfCard variant="container" testID="amend-comment-banner">
            <LfStack gap={2}>
              <LfText variant="caption" secondary>{LABEL.amendComment}</LfText>
              <LfText>{amendComment}</LfText>
            </LfStack>
          </LfCard>
        )}

        <LfField
          label={LABEL.titleField}
          required
          error={errorFor('title')}
        >
          <LfInput
            accessibilityLabel={LABEL.titleField}
            value={draft.title}
            maxLength={40}
            onBlur={() => touch('title')}
            onChangeText={(value) => updateDraft('title', value)}
          />
        </LfField>

        <LfField
          label={LABEL.bodyField}
          required
          error={errorFor('body')}
        >
          <LfTextarea
            accessibilityLabel={LABEL.bodyField}
            value={draft.body}
            maxLength={1000}
            onBlur={() => touch('body')}
            onChangeText={(value) => updateDraft('body', value)}
          />
        </LfField>

        <LfField label={LABEL.category} required>
          <View style={styles.choices}>
            {CATEGORIES.map((category) => (
              <LfChoice
                key={category}
                label={PROMISE_CATEGORY_LABEL_BY_LOCALE[locale][category]}
                selected={draft.category === category}
                onPress={() => updateDraft('category', category)}
              />
            ))}
          </View>
          {draft.category === 'MONEY' && (
            <LfText variant="caption">{LABEL.moneyNotice}</LfText>
          )}
        </LfField>

        <LfField
          label={LABEL.endDate}
          required
          error={errorFor('end_date')}
        >
          <LfPicker
            accessibilityLabel={LABEL.endDatePicker}
            value={draft.end_date === '' ? undefined : draft.end_date}
            placeholder={LABEL.endDatePicker}
            onPress={() => {
              touch('end_date');
              openEndDatePicker(draft.end_date, (value) =>
                updateDraft('end_date', value),
              );
            }}
          />
        </LfField>

        <LfField label={LABEL.keeper} required>
          <View style={styles.choices}>
            {KEEPERS.map((keeper) => (
              <LfChoice
                key={keeper}
                label={KEEPER_LABEL_BY_LOCALE[locale][keeper]}
                selected={draft.keeper === keeper}
                onPress={() => updateDraft('keeper', keeper)}
              />
            ))}
          </View>
        </LfField>

        <LfField label={LABEL.reward} optional error={errorFor('reward')}>
          <View style={styles.choices}>
            {rewardPresets(locale).map((preset) => (
              <LfChoice
                key={preset}
                label={preset}
                selected={draft.reward === preset}
                onPress={() => updateDraft('reward', preset)}
              />
            ))}
          </View>
          <LfInput
            accessibilityLabel={LABEL.reward}
            value={draft.reward}
            maxLength={100}
            onBlur={() => touch('reward')}
            onChangeText={(value) => updateDraft('reward', value)}
          />
        </LfField>

        <LfField label={LABEL.penalty} optional error={errorFor('penalty')}>
          <View style={styles.choices}>
            {penaltyPresets(locale).map((preset) => (
              <LfChoice
                key={preset}
                label={preset}
                selected={draft.penalty === preset}
                onPress={() => updateDraft('penalty', preset)}
              />
            ))}
          </View>
          <LfInput
            accessibilityLabel={LABEL.penalty}
            value={draft.penalty}
            maxLength={100}
            onBlur={() => touch('penalty')}
            onChangeText={(value) => updateDraft('penalty', value)}
          />
        </LfField>

        <LfCard>
          <LfRow gap={5}>
            <View style={styles.cardText}>
              <LfStack gap={2}>
                <LfText variant="subtitle">{LABEL.witness}</LfText>
                {draft.witness_enabled && (
                  <LfText variant="caption">{LABEL.witnessDescription(WITNESS_MAX)}</LfText>
                )}
              </LfStack>
            </View>
            <LfSwitch
              accessibilityLabel={LABEL.witness}
              value={draft.witness_enabled}
              onValueChange={(value) => updateDraft('witness_enabled', value)}
            />
          </LfRow>
        </LfCard>
      </ScrollView>

      <View style={styles.actions}>
        {submitError !== null && (
          <LfText variant="caption" align="center">
            {submitError}
          </LfText>
        )}
        <LfButton
          label={LABEL.save}
          variant="text"
          block
          disabled={!validation.valid || submitting}
          onPress={() => submit(false)}
        />
        <LfButton
          label={LABEL.send}
          size="cta"
          block
          disabled={!validation.valid || submitting}
          onPress={() => submit(true)}
        />
      </View>
    </SafeAreaView>
  );
}
