import {
  END_DATE_FREE_DAYS,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
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
import { PromiseEntitlementSheet } from '../../components/promise-entitlement-sheet.tsx';
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
import { textFontFamily } from '../../theme/fonts';
import { colors, duration, gutter, size, space, weight } from '../../theme/tokens';

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

// CSS 원본 .sl-typeline 의 고정 13px — 토큰에 없는 장식 전용 수치
const TYPELINE_FONT_SIZE = 13;

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
  // 장식 문구도 사용자 텍스트와 같은 Pretendard를 써서 화면 간 서체를 통일한다.
  typeline: {
    fontFamily: textFontFamily(weight.medium),
    fontSize: TYPELINE_FONT_SIZE,
    fontWeight: weight.medium,
    color: colors.textSecondary,
  },
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

export function conditionInputScrollY(
  currentScrollY: number,
  inputY: number,
  inputHeight: number,
  keyboardScreenY: number,
): number | null {
  const overlap = inputY + inputHeight + space[6] - keyboardScreenY;
  return overlap > 0 ? currentScrollY + overlap : null;
}

export default function PromiseEditorScreen(): React.JSX.Element {
  const LABEL = useLabels(PROMISE_EDIT_LABEL);
  const { locale } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ promise_id?: string | string[] }>();
  const promiseId = routePromiseId(params.promise_id);
  const [serverPromiseId, setServerPromiseId] = useState(promiseId);
  const autosavePromiseId = useRef(promiseId);
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
  // 미입력 안내 한 줄(PO 2026-08-26). CTA 를 비활성으로 두는 대신, 누르면 이유를 말하고 데려간다.
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [amendComment, setAmendComment] = useState<string | null>(null);
  const [slotSheetOpen, setSlotSheetOpen] = useState(false);
  const [durationSheetOpen, setDurationSheetOpen] = useState(false);
  const [keyboardScrollInset, setKeyboardScrollInset] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const rewardInputAnchorRef = useRef<View>(null);
  const penaltyInputAnchorRef = useRef<View>(null);
  const scrollOffsetY = useRef(0);
  const focusedConditionInput = useRef<'reward' | 'penalty' | null>(null);
  const conditionRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealFocusedConditionInput = useCallback((keyboardScreenY?: number): void => {
    const focusedInput = focusedConditionInput.current;
    const keyboardY = keyboardScreenY ?? Keyboard.metrics()?.screenY;
    if (focusedInput === null || keyboardY === undefined) return;

    const anchor = focusedInput === 'reward' ? rewardInputAnchorRef.current : penaltyInputAnchorRef.current;
    anchor?.measureInWindow((_x, y, _width, height) => {
      const nextY = conditionInputScrollY(scrollOffsetY.current, y, height, keyboardY);
      if (nextY === null) return;
      // 연속 포커스는 첫 애니메이션의 onScroll보다 먼저 올 수 있어 요청 위치도 즉시 보관한다.
      scrollOffsetY.current = nextY;
      scrollRef.current?.scrollTo({ y: nextY, animated: true });
    });
  }, []);

  const focusConditionInput = useCallback((input: 'reward' | 'penalty'): void => {
    focusedConditionInput.current = input;
    // 키보드가 이미 열린 채 보상↔벌칙을 옮길 때도 즉시 새 입력란을 보여준다.
    revealFocusedConditionInput();
    if (conditionRevealTimer.current !== null) clearTimeout(conditionRevealTimer.current);
    // 일부 Android 키보드는 빠른 재표시에서 didShow를 생략하므로 애니메이션 뒤 좌표를 다시 확인한다.
    conditionRevealTimer.current = setTimeout(revealFocusedConditionInput, duration.long);
  }, [revealFocusedConditionInput]);

  const autosave = useMemo(
    () => new DraftAutosave(async (nextDraft) => await saveEditorLocalDraft(autosavePromiseId.current, nextDraft)),
    [],
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

  useEffect(() => {
    // 기기마다 키보드가 화면을 차지하는 시점이 달라 실제 높이가 정해진 뒤 한 번 더 맞춘다.
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      // 마지막 입력란도 키보드 위까지 올라갈 수 있도록 실제 키보드 높이만큼 스크롤 여유를 만든다.
      setKeyboardScrollInset(event.endCoordinates.height);
      revealFocusedConditionInput(event.endCoordinates.screenY);
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardScrollInset(0);
    });
    return () => {
      shown.remove();
      hidden.remove();
      if (conditionRevealTimer.current !== null) clearTimeout(conditionRevealTimer.current);
    };
  }, [revealFocusedConditionInput]);

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
    setFormNotice(null);
  }

  const FIELD_LABELS: Record<PromiseDraftField, string> = {
    title: LABEL.titleField,
    body: LABEL.bodyField,
    category: LABEL.category,
    end_date: LABEL.endDate,
    keeper: LABEL.keeper,
    reward: LABEL.reward,
    penalty: LABEL.penalty,
    witness_enabled: LABEL.witness,
  };

  /**
   * 조용한 차단 금지(PO 2026-08-26): 실패 필드를 전부 touched 로 만들어 인라인 문구를 깨우고,
   * 첫 실패 필드가 있는 단계로 이동한 뒤 요약 한 줄을 띄운다. §5 문구가 없는 규칙(문구를
   * 지어내지 않는 §2-3 원칙)은 공통 안내 문구로 대신한다.
   */
  function guideToFirstInvalid(scope: readonly PromiseDraftField[]): void {
    const first = scope.find((field) => validation.invalidFields.includes(field));
    if (first === undefined) return;
    setTouched((current) => ({
      ...current,
      ...Object.fromEntries(scope.map((field) => [field, true])),
    }));
    const targetStep = editorStepForField(first);
    if (targetStep !== step && targetStep !== 3) {
      setDirection(targetStep > step ? 1 : -1);
      setStep(targetStep);
    }
    setFormNotice(
      LABEL.formNotice(FIELD_LABELS[first], validation.fields[first] ?? LABEL.checkField),
    );
  }

  const ALL_FIELDS: readonly PromiseDraftField[] = [
    ...EDITOR_STEP_FIELDS[1],
    ...EDITOR_STEP_FIELDS[2],
  ];

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
    // 문구 없는 실패(§5 미정의 규칙)도 여기서 걸린다 — 조용히 막지 않고 안내한다.
    if (fields.some((field) => validation.invalidFields.includes(field))) {
      guideToFirstInvalid(fields);
      return;
    }
    setDirection(1);
    setStep((step + 1) as LfWizardStep);
    setSubmitError(null);
    setFormNotice(null);
  }

  async function performSubmit(send: boolean): Promise<void> {
    if (!validation.valid || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await autosave.flush();
      const response = await submitEditorDraft(draft, serverPromiseId, send);
      await clearEditorLocalDraft(promiseId);
      if (serverPromiseId !== null && serverPromiseId !== promiseId) {
        await clearEditorLocalDraft(serverPromiseId);
      }
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
      } else if (error instanceof MobileApiError && error.code === 'E_END_DATE_RANGE') {
        try {
          let entitlementPromiseId = serverPromiseId;
          if (entitlementPromiseId === null) {
            const saved = await submitEditorDraft(draft, null, false);
            entitlementPromiseId = saved.promise_id;
            autosavePromiseId.current = entitlementPromiseId;
            setServerPromiseId(entitlementPromiseId);
          }
          setDurationSheetOpen(true);
        } catch (saveError) {
          setSubmitError(saveError instanceof MobileApiError
            ? localizedApiMessage(saveError, locale)
            : LABEL.genericError);
        }
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
    if (!validation.valid) {
      guideToFirstInvalid(ALL_FIELDS);
      return;
    }
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
        <View style={styles.loading}><LfText variant="error" align="center">{LABEL.loadError}</LfText></View>
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
    <LfCard variant="flat"><LfStack gap={7}>
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
      <LfField label={LABEL.category} optional error={errorFor('category')}>
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
    <LfCard variant="flat"><LfStack gap={7}>
      <LfField label={LABEL.endDate} required error={errorFor('end_date')}>
        <LfPicker
          accessibilityLabel={LABEL.endDatePicker}
          value={draft.end_date === '' ? undefined : draft.end_date === null ? LABEL.noEndDate : draft.end_date}
          placeholder={LABEL.endDatePicker}
          onPress={() => {
            touch('end_date');
            openEndDatePicker(draft.end_date, (value) => updateDraft('end_date', value));
          }}
        />
        <LfText variant="caption">{LABEL.durationNotice(END_DATE_FREE_DAYS)}</LfText>
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
        <View ref={rewardInputAnchorRef} collapsable={false} testID="reward-input-anchor">
          <LfInput
            accessibilityLabel={LABEL.reward}
            value={draft.reward}
            maxLength={100}
            onFocus={() => focusConditionInput('reward')}
            onBlur={() => touch('reward')}
            onChangeText={(value) => updateDraft('reward', value)}
          />
        </View>
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
        <View ref={penaltyInputAnchorRef} collapsable={false} testID="penalty-input-anchor">
          <LfInput
            accessibilityLabel={LABEL.penalty}
            value={draft.penalty}
            maxLength={100}
            onFocus={() => focusConditionInput('penalty')}
            onBlur={() => touch('penalty')}
            onChangeText={(value) => updateDraft('penalty', value)}
          />
        </View>
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
          // 미선택은 '기타'로 저장되므로 검토 단계도 저장될 값을 그대로 보여준다(PO 2026-08-26).
          value={PROMISE_CATEGORY_LABEL_BY_LOCALE[locale][draft.category === '' ? 'ETC' : draft.category]}
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
        <ReviewValue
          label={LABEL.endDate}
          value={draft.end_date === null ? LABEL.noEndDate : formatKstDate(draft.end_date, locale)}
        />
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
            <LfIcon name={step === 1 ? 'close' : 'arrow_back'} />
          </Pressable>
        )}
        action={<LfChip label={LABEL.stepCount(step)} tone="neutral" />}
      />
      <View style={styles.progress}><LfWizardProgress step={step} labels={steps} /></View>
      <View style={styles.intro}>
        {step === 1 && (
          <Text style={styles.typeline} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {LABEL.typeline}
          </Text>
        )}
        <LfText variant="title">{stepTitle}</LfText>
        <LfText secondary>{stepDescription}</LfText>
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          scrollOffsetY.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.body,
          keyboardScrollInset > 0 && { paddingBottom: space[9] + keyboardScrollInset },
        ]}
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
        {formNotice !== null && <LfText variant="error" align="center">{formNotice}</LfText>}
        {submitError !== null && <LfText variant="error" align="center">{submitError}</LfText>}
        <LfButton
          label={LABEL.save}
          variant="text"
          block
          disabled={submitting}
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
            disabled={submitting}
            onPress={() => submit(true)}
          />
        )}
      </View>
      <SlotPaywallSheet
        visible={slotSheetOpen}
        reason="limit"
        onClose={() => setSlotSheetOpen(false)}
        // 결제 완료 = 막혔던 발송의 즉시 재개(PO 2026-08-26). 시트가 열린 채 남으면
        // 결제가 안 된 것으로 오해한다. 미소모 구매 복구(reconcile)로 와도 같은 재개다.
        onPurchased={() => {
          setSlotSheetOpen(false);
          void performSubmit(true);
        }}
      />
      {serverPromiseId !== null ? (
        <PromiseEntitlementSheet
          visible={durationSheetOpen}
          promiseId={serverPromiseId}
          mode="DURATION"
          reason="END_DATE_RANGE"
          onClose={() => setDurationSheetOpen(false)}
          onChanged={() => {
            setDurationSheetOpen(false);
            setTimeout(() => void performSubmit(true), 0);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
