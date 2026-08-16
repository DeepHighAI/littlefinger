import {
  KEEPER_LABEL,
  PROMISE_CATEGORY_LABEL,
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
import { MobileApiError } from '../../lib/mobile-api.ts';
import {
  clearEditorLocalDraft,
  loadEditorDraft,
  openEndDatePicker,
  saveEditorLocalDraft,
  submitEditorDraft,
} from '../../lib/promise-editor-native.ts';
import {
  EMPTY_PROMISE_DRAFT,
  PENALTY_PRESETS,
  REWARD_PRESETS,
  containsSensitiveNumber,
  validatePromiseDraft,
  type PromiseDraftField,
  type PromiseDraftFields,
} from '../../lib/promise-draft.ts';
import { colors, gutter, size, space } from '../../theme/tokens';

const EDITOR_LABEL = {
  title: '약속 만들기',
  editing: '작성 중',
  close: '닫기',
  titleField: '제목',
  bodyField: '약속 내용',
  category: '카테고리',
  endDate: '종료일',
  endDatePicker: '종료일 선택',
  keeper: '지킬 사람',
  reward: '보상',
  penalty: '벌칙',
  witness: '증인 초대하기',
  witnessDescription: `확정 후 증인을 초대할 수 있어요(최대 ${WITNESS_MAX}명)`,
  moneyNotice:
    '금전 약속도 기록할 수 있지만, 리틀핑거는 차용증·공증 서비스가 아니에요.',
  save: '임시저장',
  send: '상대에게 보내기',
  saved: '임시저장했어요',
  loading: '초안을 불러오는 중이에요',
  loadError: '초안을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  privacyTitle: '개인정보가 포함돼 있어요',
  privacyBody: '그대로 기록할까요?',
  privacyContinue: '그대로 기록',
  cancel: '취소',
  genericError: '문제가 발생했어요. 잠시 후 다시 시도해 주세요.',
} as const;

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
    return () => {
      active = false;
      void autosave.flush();
    };
  }, [autosave, promiseId]);

  const validation = validatePromiseDraft(draft, new Date());

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
    ToastAndroid.show(EDITOR_LABEL.saved, ToastAndroid.SHORT);
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
        const field = error.field as PromiseDraftField;
        setServerErrors((current) => ({ ...current, [field]: error.message }));
      } else {
        setSubmitError(error instanceof Error ? error.message : EDITOR_LABEL.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function submit(send: boolean): void {
    if (containsSensitiveNumber(draft.body) && !privacyConfirmed) {
      Alert.alert(EDITOR_LABEL.privacyTitle, EDITOR_LABEL.privacyBody, [
        { text: EDITOR_LABEL.cancel, style: 'cancel' },
        {
          text: EDITOR_LABEL.privacyContinue,
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
          <LfText secondary>{EDITOR_LABEL.loading}</LfText>
        </View>
      </SafeAreaView>
    );
  }

  if (loadFailed) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loading}>
          <LfText secondary align="center">
            {EDITOR_LABEL.loadError}
          </LfText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        title={EDITOR_LABEL.title}
        leading={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={EDITOR_LABEL.close}
            onPress={() => void closeEditor()}
            style={styles.close}
          >
            <LfIcon name="close" />
          </Pressable>
        }
        action={<LfChip label={EDITOR_LABEL.editing} tone="neutral" />}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >
        <LfField
          label={EDITOR_LABEL.titleField}
          required
          error={errorFor('title')}
        >
          <LfInput
            accessibilityLabel={EDITOR_LABEL.titleField}
            value={draft.title}
            maxLength={40}
            onBlur={() => touch('title')}
            onChangeText={(value) => updateDraft('title', value)}
          />
        </LfField>

        <LfField
          label={EDITOR_LABEL.bodyField}
          required
          error={errorFor('body')}
        >
          <LfTextarea
            accessibilityLabel={EDITOR_LABEL.bodyField}
            value={draft.body}
            maxLength={1000}
            onBlur={() => touch('body')}
            onChangeText={(value) => updateDraft('body', value)}
          />
        </LfField>

        <LfField label={EDITOR_LABEL.category} required>
          <View style={styles.choices}>
            {CATEGORIES.map((category) => (
              <LfChoice
                key={category}
                label={PROMISE_CATEGORY_LABEL[category]}
                selected={draft.category === category}
                onPress={() => updateDraft('category', category)}
              />
            ))}
          </View>
          {draft.category === 'MONEY' && (
            <LfText variant="caption">{EDITOR_LABEL.moneyNotice}</LfText>
          )}
        </LfField>

        <LfField
          label={EDITOR_LABEL.endDate}
          required
          error={errorFor('end_date')}
        >
          <LfPicker
            accessibilityLabel={EDITOR_LABEL.endDatePicker}
            value={draft.end_date === '' ? undefined : draft.end_date}
            placeholder={EDITOR_LABEL.endDatePicker}
            onPress={() => {
              touch('end_date');
              openEndDatePicker(draft.end_date, (value) =>
                updateDraft('end_date', value),
              );
            }}
          />
        </LfField>

        <LfField label={EDITOR_LABEL.keeper} required>
          <View style={styles.choices}>
            {KEEPERS.map((keeper) => (
              <LfChoice
                key={keeper}
                label={KEEPER_LABEL[keeper]}
                selected={draft.keeper === keeper}
                onPress={() => updateDraft('keeper', keeper)}
              />
            ))}
          </View>
        </LfField>

        <LfField label={EDITOR_LABEL.reward} optional error={errorFor('reward')}>
          <View style={styles.choices}>
            {REWARD_PRESETS.map((preset) => (
              <LfChoice
                key={preset}
                label={preset}
                selected={draft.reward === preset}
                onPress={() => updateDraft('reward', preset)}
              />
            ))}
          </View>
          <LfInput
            accessibilityLabel={EDITOR_LABEL.reward}
            value={draft.reward}
            maxLength={100}
            onBlur={() => touch('reward')}
            onChangeText={(value) => updateDraft('reward', value)}
          />
        </LfField>

        <LfField label={EDITOR_LABEL.penalty} optional error={errorFor('penalty')}>
          <View style={styles.choices}>
            {PENALTY_PRESETS.map((preset) => (
              <LfChoice
                key={preset}
                label={preset}
                selected={draft.penalty === preset}
                onPress={() => updateDraft('penalty', preset)}
              />
            ))}
          </View>
          <LfInput
            accessibilityLabel={EDITOR_LABEL.penalty}
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
                <LfText variant="subtitle">{EDITOR_LABEL.witness}</LfText>
                {draft.witness_enabled && (
                  <LfText variant="caption">{EDITOR_LABEL.witnessDescription}</LfText>
                )}
              </LfStack>
            </View>
            <LfSwitch
              accessibilityLabel={EDITOR_LABEL.witness}
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
          label={EDITOR_LABEL.save}
          variant="text"
          block
          disabled={!validation.valid || submitting}
          onPress={() => submit(false)}
        />
        <LfButton
          label={EDITOR_LABEL.send}
          size="cta"
          block
          disabled={!validation.valid || submitting}
          onPress={() => submit(true)}
        />
      </View>
    </SafeAreaView>
  );
}
