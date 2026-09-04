import {
  END_DATE_EXTENSION_DAYS,
  KEEPER_LABEL,
  KEEPER_LABEL_BY_LOCALE,
  PROMISE_CATEGORY_LABEL,
  PROMISE_CATEGORY_LABEL_BY_LOCALE,
  changedPromiseFields,
  normalizeInput,
  validateAmendReason,
  validateBody,
  validateCategory,
  validateEndDate,
  validateKeeper,
  validatePenalty,
  validateReward,
  validateTitle,
  type Keeper,
  type PromiseAmendCreateRequest,
  type PromiseAmendProposal,
  type PromiseCategory,
  type PromiseDetailResponse,
} from '@littlefinger/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useLabels, useLocale } from '../lib/locale-native';
import { MOD_01_LABEL } from '../screens/scr-a05-labels.ts';
import { colors, radius, space } from '../theme/tokens.ts';
import { LfButton } from './LfButton.tsx';
import { LfChoice } from './LfChoice.tsx';
import { LfField } from './LfField.tsx';
import { LfInput } from './LfInput.tsx';
import { LfPicker } from './LfPicker.tsx';
import { LfRow } from './LfRow.tsx';
import { LfSheet } from './LfSheet.tsx';
import { LfText } from './LfText.tsx';
import { LfTextarea } from './LfTextarea.tsx';

export interface PromiseAmendSheetProps {
  visible: boolean;
  detail: PromiseDetailResponse;
  now: Date;
  /** 작성자의 영구 보관 구매로 무기한이 열린 약속만 '종료일 없음'을 제안할 수 있다. */
  durationUnlimited: boolean;
  onClose(): void;
  onSubmit(input: PromiseAmendCreateRequest): Promise<void | 'DURATION_ENTITLEMENT_REQUIRED'>;
  pickEndDate(value: string, onSelect: (value: string) => void): void;
  confirmCancel(): Promise<boolean>;
}

type Mode = 'AMEND' | 'CANCEL';

const CATEGORIES = Object.keys(PROMISE_CATEGORY_LABEL) as PromiseCategory[];
const KEEPERS = Object.keys(KEEPER_LABEL) as Keeper[];

const styles = StyleSheet.create({
  content: { gap: space[6], paddingBottom: space[5] },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  notice: {
    padding: space[6],
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
});

function proposalOf(detail: PromiseDetailResponse): PromiseAmendProposal {
  const version = detail.current_version;
  return {
    title: version.title,
    body: version.body,
    category: version.category,
    end_date: version.end_date,
    keeper: version.keeper,
    reward: version.reward,
    penalty: version.penalty,
  };
}

export function PromiseAmendSheet({
  visible,
  detail,
  now,
  durationUnlimited,
  onClose,
  onSubmit,
  pickEndDate,
  confirmCancel,
}: PromiseAmendSheetProps): React.JSX.Element {
  const LABEL = useLabels(MOD_01_LABEL);
  const { locale } = useLocale();
  const [mode, setMode] = useState<Mode>('AMEND');
  const [proposal, setProposal] = useState<PromiseAmendProposal>(() => proposalOf(detail));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const actionPending = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setMode('AMEND');
    setProposal(proposalOf(detail));
    setReason('');
    setBusy(false);
    setActionError(false);
    actionPending.current = false;
  }, [detail, visible]);

  const validation = useMemo(() => ({
    title: validateTitle(proposal.title, locale),
    body: validateBody(proposal.body, locale),
    category: validateCategory(proposal.category),
    endDate: validateEndDate(proposal.end_date, now, locale),
    keeper: validateKeeper(proposal.keeper),
    reward: validateReward(proposal.reward ?? ''),
    penalty: validatePenalty(proposal.penalty ?? ''),
    reason: validateAmendReason(reason),
  }), [locale, now, proposal, reason]);
  const changed = changedPromiseFields(detail.current_version, proposal).length > 0;
  const proposalValid = Object.values(validation).every((result) => result.valid);
  const submitEnabled = !busy && validation.reason.valid && (mode === 'CANCEL' || (changed && proposalValid));

  function update<K extends keyof PromiseAmendProposal>(
    field: K,
    value: PromiseAmendProposal[K],
  ): void {
    setProposal((current) => ({ ...current, [field]: value }));
  }

  async function submit(): Promise<void> {
    if (!submitEnabled || actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setActionError(false);
    try {
      if (mode === 'CANCEL' && !(await confirmCancel())) return;
      const normalizedReason = normalizeInput(reason);
      const input: PromiseAmendCreateRequest = mode === 'AMEND'
        ? {
            promise_id: detail.promise_id,
            type: 'AMEND',
            proposed: {
              title: normalizeInput(proposal.title),
              body: normalizeInput(proposal.body),
              category: proposal.category,
              end_date: proposal.end_date,
              keeper: proposal.keeper,
              reward: proposal.reward === null ? null : normalizeInput(proposal.reward),
              penalty: proposal.penalty === null ? null : normalizeInput(proposal.penalty),
            },
            ...(normalizedReason === '' ? {} : { reason: normalizedReason }),
          }
        : {
            promise_id: detail.promise_id,
            type: 'CANCEL',
            ...(normalizedReason === '' ? {} : { reason: normalizedReason }),
          };
      await onSubmit(input);
    } catch {
      setActionError(true);
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }

  return (
    <LfSheet
      visible={visible}
      title={LABEL.title}
      closeLabel={LABEL.close}
      onClose={onClose}
    >
      <ScrollView contentContainerStyle={styles.content}>
            <LfRow>
              <LfButton
                label={LABEL.amendTab}
                variant={mode === 'AMEND' ? 'tonal' : 'text'}
                accessibilityState={{ selected: mode === 'AMEND' }}
                grow
                onPress={() => setMode('AMEND')}
              />
              <LfButton
                label={LABEL.cancelTab}
                variant={mode === 'CANCEL' ? 'danger' : 'text'}
                accessibilityState={{ selected: mode === 'CANCEL' }}
                grow
                onPress={() => setMode('CANCEL')}
              />
            </LfRow>

            <View style={styles.notice}>
              <LfText>{LABEL.commonNotice}</LfText>
            </View>

            {mode === 'AMEND' ? (
              <>
                <LfField label={LABEL.titleField} required error={validation.title.message ?? undefined}>
                  <LfInput
                    accessibilityLabel={LABEL.titleField}
                    value={proposal.title}
                    onChangeText={(value) => update('title', value)}
                  />
                </LfField>
                <LfField label={LABEL.bodyField} required error={validation.body.message ?? undefined}>
                  <LfTextarea
                    accessibilityLabel={LABEL.bodyField}
                    value={proposal.body}
                    onChangeText={(value) => update('body', value)}
                  />
                </LfField>
                <LfField label={LABEL.categoryField} required>
                  <View style={styles.choices}>
                    {CATEGORIES.map((category) => (
                      <LfChoice
                        key={category}
                        label={PROMISE_CATEGORY_LABEL_BY_LOCALE[locale][category]}
                        selected={proposal.category === category}
                        onPress={() => update('category', category)}
                      />
                    ))}
                  </View>
                </LfField>
                <LfField label={LABEL.endDateField} required error={validation.endDate.message ?? undefined}>
                  <LfPicker
                    accessibilityLabel={LABEL.endDateSelect}
                    value={proposal.end_date ?? LABEL.noEndDate}
                    placeholder={LABEL.endDateSelect}
                    onPress={() => pickEndDate(proposal.end_date ?? '', (value) => update('end_date', value))}
                  />
                  {durationUnlimited ? (
                    <LfChoice
                      label={LABEL.noEndDate}
                      selected={proposal.end_date === null}
                      onPress={() => update('end_date', null)}
                    />
                  ) : null}
                  <LfText variant="caption">{LABEL.durationEntitlementNotice(END_DATE_EXTENSION_DAYS)}</LfText>
                </LfField>
                <LfField label={LABEL.keeperField} required>
                  <View style={styles.choices}>
                    {KEEPERS.map((keeper) => (
                      <LfChoice
                        key={keeper}
                        label={KEEPER_LABEL_BY_LOCALE[locale][keeper]}
                        selected={proposal.keeper === keeper}
                        onPress={() => update('keeper', keeper)}
                      />
                    ))}
                  </View>
                </LfField>
                <LfField label={LABEL.rewardField} optional>
                  <LfInput
                    accessibilityLabel={LABEL.rewardField}
                    value={proposal.reward ?? ''}
                    onChangeText={(value) => update('reward', value === '' ? null : value)}
                  />
                </LfField>
                <LfField label={LABEL.penaltyField} optional>
                  <LfInput
                    accessibilityLabel={LABEL.penaltyField}
                    value={proposal.penalty ?? ''}
                    onChangeText={(value) => update('penalty', value === '' ? null : value)}
                  />
                </LfField>
                {!changed ? <LfText variant="caption">{LABEL.noChanges}</LfText> : null}
              </>
            ) : (
              <View style={styles.notice}>
                <LfText>{LABEL.cancelNotice}</LfText>
              </View>
            )}

            <LfField label={LABEL.reasonField} optional>
              <LfTextarea
                accessibilityLabel={LABEL.reasonField}
                placeholder={LABEL.reasonPlaceholder}
                value={reason}
                onChangeText={setReason}
              />
            </LfField>
            {actionError ? <LfText variant="error" align="center">{LABEL.submitError}</LfText> : null}
            <LfButton
              label={LABEL.submit}
              size="cta"
              block
              disabled={!submitEnabled}
              onPress={() => void submit()}
            />
      </ScrollView>
    </LfSheet>
  );
}
