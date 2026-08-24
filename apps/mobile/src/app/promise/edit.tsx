import {
  KEEPER_LABEL,
  KEEPER_LABEL_BY_LOCALE,
  PROMISE_CATEGORY_LABEL,
  PROMISE_CATEGORY_LABEL_BY_LOCALE,
  WITNESS_MAX,
  formatKstDate,
  type Keeper,
  type PromiseCategory,
} from '@littlefinger/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, ToastAndroid, View } from 'react-native';
import Animated, { FadeInLeft, FadeInRight, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAppBar } from '../../components/LfAppBar';
import { LfButton } from '../../components/LfButton';
import { LfCard } from '../../components/LfCard';
import { LfChip } from '../../components/LfChip';
import { LfChoice } from '../../components/LfChoice';
import { LfField } from '../../components/LfField';
import { LfHelper } from '../../components/LfHelper';
import { LfIcon } from '../../components/LfIcon';
import { LfInput } from '../../components/LfInput';
import { LfPicker } from '../../components/LfPicker';
import { LfRow } from '../../components/LfRow';
import { LfStack } from '../../components/LfStack';
import { LfSwitch } from '../../components/LfSwitch';
import { LfText } from '../../components/LfText';
import { LfTextarea } from '../../components/LfTextarea';
import { LfWizardProgress, type LfWizardStep } from '../../components/LfWizardProgress';
import { SlotPaywallSheet } from '../../components/slot-paywall-sheet.tsx';
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
import { colors, duration, gutter, size, space } from '../../theme/tokens';

const CATEGORIES = Object.keys(PROMISE_CATEGORY_LABEL) as PromiseCategory[];
const KEEPERS = Object.keys(KEEPER_LABEL) as Keeper[];

export const EDITOR_STEP_FIELDS: Record<1 | 2, readonly PromiseDraftField[]> = {
  1: ['title', 'body', 'category'],
  2: ['end_date', 'keeper', 'reward', 'penalty'],
};

export function editorStepForField(field: PromiseDraftField): 1 | 2 | 3 {
  if (EDITOR_STEP_FIELDS[1].includes(field)) return 1;
  if (EDITOR_STEP_FIELDS[2].includes(field)) return 2;
  return 3;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  close: {
    minWidth: size.touchMin,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: {
    paddingHorizontal: gutter.app,
    paddingTop: space[7],
    paddingBottom: space[5],
  },
  intro: { paddingHorizontal: gutter.app, paddingBottom: space[5], gap: space[2] },
  scroll: { flex: 1 },
  body: { paddingHorizontal: gutter.app, paddingBottom: space[9], gap: space[6] },
  stepCard: { gap: space[7] },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
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
  reviewHeader: { flex: 1 },
  reviewRow: {
    paddingVertical: space[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
    gap: space[2],
  },
});

function routePromiseId(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function ReviewValue({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.reviewRow}>
      <LfText variant="sectionTitle">{label}</LfText>
      <LfText>{value}</LfText>
    </View>
  );
}

export default function PromiseEditorScreen(): React.JSX.Element {
  const LABEL = useLabels(PROMISE_EDIT_LABEL);
  const { locale } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ promise_id?: string | string[] }>();
  const promiseId = routePromiseId(params.promise_id);
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<LfWizardStep>(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [draft, setDraft] = useState<PromiseDraftFields>(EMPTY_PROMISE_DRAFT);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<PromiseDraftField, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<Partial<Record<PromiseDraftField, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [amendComment, setAmendComment] = useState<string | null>(null);
  const [slotSheetOpen, setSlotSheetOpen] = useState(false);

  const autosave = useMemo(
    () => new DraftAutosave(async (nextDraft) => await saveEditorLocalDraft(promiseId, nextDraft)),
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
      // 배너는 보조 정보라 실패해도 편집을 막지 않는다.
      void loadAmendSuggestComment(promiseId)
        .then((value) => { if (active) setAmendComment(value); })
        .catch(() => { if (active) setAmendComment(null); });
    }
    return () => {
      active = false;
      void autosave.flush();
    };
  }, [autosave, promiseId]);

  const validation = validatePromiseDraft(draft, new Date(), locale);
  const steps = [LABEL.stepContent, LABEL.stepConditions, LABEL.stepReview] as const;

  function updateDraft<K extends PromiseDraftField>(field: K, value: PromiseDraftFields[K]): void {
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

  const closeEditor = useCallback(async (): Promise<void> => {
    await autosave.flush();
    ToastAndroid.show(LABEL.saved, ToastAndroid.SHORT);
    router.back();
  }, [LABEL.saved, autosave, router]);

  const previousStep = useCallback((): void => {
    if (step === 1) {
      void closeEditor();
      return;
    }
    setDirection(-1);
    setStep((current) => (current - 1) as LfWizardStep);
  }, [closeEditor, step]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      previousStep();
      return true;
    });
    return () => subscription.remove();
  }, [previousStep]);

  function nextStep(): void {
    if (step === 3) return;
    const fields = EDITOR_STEP_FIELDS[step];
    setTouched((current) => ({
      ...current,
      ...Object.fromEntries(fields.map((field) => [field, true])),
    }));
    if (fields.some((field) => validation.fields[field] !== undefined)) return;
    setDirection(1);
    setStep((step + 1) as LfWizardStep);
    setSubmitError(null);
  }

  async function performSubmit(send: boolean): Promise<void> {
    if (!validation.valid || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
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
      if (error instanceof MobileApiError && error.code === 'E_SLOT_LIMIT') {
        // 서버 트랜잭션은 통째로 롤백됐지만 내용은 로컬 자동저장에 그대로 있다 —
        // 오류 줄 대신 결제 시트가 출구를 안내하고, 구매 후 [보내기]를 다시 누르면 된다.
        setSlotSheetOpen(true);
      } else if (error instanceof MobileApiError && error.field !== undefined) {
        const field = error.field as PromiseDraftField;
        setServerErrors((current) => ({ ...current, [field]: error.message }));
        setDirection(-1);
        setStep(editorStepForField(field));
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
        <View style={styles.loading}><LfText secondary>{LABEL.loading}</LfText></View>
      </SafeAreaView>
    );
  }

  if (loadFailed) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loading}><LfText secondary align="center">{LABEL.loadError}</LfText></View>
      </SafeAreaView>
    );
  }

  const stepTitle = steps[step - 1];
  const stepDescription = step === 1
    ? LABEL.stepContentDescription
    : step === 2
      ? LABEL.stepConditionsDescription
      : LABEL.stepReviewDescription;
  const entering = reduceMotion
    ? undefined
    : (direction === 1 ? FadeInRight : FadeInLeft).duration(duration.medium);

  const stepOne = (
    <LfCard><LfStack gap={7}>
      <LfField label={LABEL.titleField} required error={errorFor('title')}>
        <LfInput
          accessibilityLabel={LABEL.titleField}
          value={draft.title}
          maxLength={40}
          onBlur={() => touch('title')}
          onChangeText={(value) => updateDraft('title', value)}
        />
      </LfField>
      <LfField label={LABEL.bodyField} required error={errorFor('body')}>
        <LfTextarea
          accessibilityLabel={LABEL.bodyField}
          value={draft.body}
          maxLength={1000}
          onBlur={() => touch('body')}
          onChangeText={(value) => updateDraft('body', value)}
        />
      </LfField>
      <LfField label={LABEL.category} required error={errorFor('category')}>
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
        {draft.category === 'MONEY' && <LfText variant="caption">{LABEL.moneyNotice}</LfText>}
      </LfField>
    </LfStack></LfCard>
  );

  const stepTwo = (
    <LfCard><LfStack gap={7}>
      <LfField label={LABEL.endDate} required error={errorFor('end_date')}>
        <LfPicker
          accessibilityLabel={LABEL.endDatePicker}
          value={draft.end_date === '' ? undefined : draft.end_date}
          placeholder={LABEL.endDatePicker}
          onPress={() => {
            touch('end_date');
            openEndDatePicker(draft.end_date, (value) => updateDraft('end_date', value));
          }}
        />
      </LfField>
      <LfField label={LABEL.keeper} required error={errorFor('keeper')}>
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
    </LfStack></LfCard>
  );

  const stepThree = (
    <LfStack gap={6}>
      <LfHelper text={LABEL.reviewNotice} />
      <LfCard variant="record"><LfStack gap={4}>
        <LfRow gap={4}>
          <View style={styles.reviewHeader}><LfText variant="subtitle">{LABEL.reviewContent}</LfText></View>
          <LfButton
            accessibilityLabel={LABEL.editSection(LABEL.reviewContent)}
            label={LABEL.editSection(LABEL.stepContent)}
            variant="text"
            onPress={() => { setDirection(-1); setStep(1); }}
          />
        </LfRow>
        <ReviewValue label={LABEL.titleField} value={draft.title} />
        <ReviewValue label={LABEL.bodyField} value={draft.body} />
        <ReviewValue
          label={LABEL.category}
          value={draft.category === '' ? LABEL.none : PROMISE_CATEGORY_LABEL_BY_LOCALE[locale][draft.category]}
        />
      </LfStack></LfCard>
      <LfCard variant="record"><LfStack gap={4}>
        <LfRow gap={4}>
          <View style={styles.reviewHeader}><LfText variant="subtitle">{LABEL.reviewConditions}</LfText></View>
          <LfButton
            accessibilityLabel={LABEL.editSection(LABEL.reviewConditions)}
            label={LABEL.editSection(LABEL.stepConditions)}
            variant="text"
            onPress={() => { setDirection(-1); setStep(2); }}
          />
        </LfRow>
        <ReviewValue label={LABEL.endDate} value={formatKstDate(draft.end_date)} />
        <ReviewValue label={LABEL.keeper} value={KEEPER_LABEL_BY_LOCALE[locale][draft.keeper]} />
        <ReviewValue label={LABEL.reward} value={draft.reward === '' ? LABEL.none : draft.reward} />
        <ReviewValue label={LABEL.penalty} value={draft.penalty === '' ? LABEL.none : draft.penalty} />
      </LfStack></LfCard>
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
    </LfStack>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        title={LABEL.title}
        leading={(
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={step === 1 ? LABEL.close : LABEL.previous}
            onPress={previousStep}
            style={styles.close}
          >
            <LfIcon name={step === 1 ? 'close' : 'arrow-back'} />
          </Pressable>
        )}
        action={<LfChip label={LABEL.stepCount(step)} tone="neutral" />}
      />
      <View style={styles.progress}><LfWizardProgress step={step} labels={steps} /></View>
      <View style={styles.intro}>
        <LfText variant="title">{stepTitle}</LfText>
        <LfText secondary>{stepDescription}</LfText>
      </View>
      <ScrollView
        style={styles.scroll}
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
        <Animated.View key={step} {...(entering === undefined ? {} : { entering })}>
          {step === 1 ? stepOne : step === 2 ? stepTwo : stepThree}
        </Animated.View>
      </ScrollView>
      <View style={styles.actions}>
        {submitError !== null && <LfText variant="caption" align="center">{submitError}</LfText>}
        <LfButton
          label={LABEL.save}
          variant="text"
          block
          disabled={!validation.valid || submitting}
          onPress={() => submit(false)}
        />
        {step < 3 ? (
          <LfButton
            label={step === 1 ? LABEL.nextConditions : LABEL.nextReview}
            size="cta"
            block
            disabled={submitting}
            onPress={nextStep}
          />
        ) : (
          <LfButton
            label={LABEL.send}
            size="cta"
            block
            disabled={!validation.valid || submitting}
            onPress={() => submit(true)}
          />
        )}
      </View>
      <SlotPaywallSheet
        visible={slotSheetOpen}
        reason="limit"
        onClose={() => setSlotSheetOpen(false)}
      />
    </SafeAreaView>
  );
}
