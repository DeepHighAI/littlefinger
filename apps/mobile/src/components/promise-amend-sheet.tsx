import {
  KEEPER_LABEL,
  PROMISE_CATEGORY_LABEL,
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
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MOD_01_LABEL } from '../screens/scr-a05-labels.ts';
import { colors, elevation, gutter, radius, size, space } from '../theme/tokens.ts';
import { LfButton } from './LfButton.tsx';
import { LfChoice } from './LfChoice.tsx';
import { LfField } from './LfField.tsx';
import { LfIcon } from './LfIcon.tsx';
import { LfInput } from './LfInput.tsx';
import { LfPicker } from './LfPicker.tsx';
import { LfRow } from './LfRow.tsx';
import { LfStack } from './LfStack.tsx';
import { LfText } from './LfText.tsx';
import { LfTextarea } from './LfTextarea.tsx';

export interface PromiseAmendSheetProps {
  visible: boolean;
  detail: PromiseDetailResponse;
  now: Date;
  onClose(): void;
  onSubmit(input: PromiseAmendCreateRequest): Promise<void>;
  pickEndDate(value: string, onSelect: (value: string) => void): void;
  confirmCancel(): Promise<boolean>;
}

type Mode = 'AMEND' | 'CANCEL';

const CATEGORIES = Object.keys(PROMISE_CATEGORY_LABEL) as PromiseCategory[];
const KEEPERS = Object.keys(KEEPER_LABEL) as Keeper[];
const SHEET_MAX_HEIGHT = '92%';

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  dismissArea: { flex: 1 },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT,
    paddingHorizontal: gutter.app,
    paddingTop: space[5],
    paddingBottom: space[9],
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    backgroundColor: colors.surface,
    ...elevation.sheet,
  },
  handle: {
    alignSelf: 'center',
    width: size.iconButton,
    height: space[1],
    marginBottom: space[7],
    borderRadius: radius.pill,
    backgroundColor: colors.outlineStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  close: {
    width: size.touchMin,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
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
  onClose,
  onSubmit,
  pickEndDate,
  confirmCancel,
}: PromiseAmendSheetProps): React.JSX.Element {
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
    title: validateTitle(proposal.title),
    body: validateBody(proposal.body),
    category: validateCategory(proposal.category),
    endDate: validateEndDate(proposal.end_date, now),
    keeper: validateKeeper(proposal.keeper),
    reward: validateReward(proposal.reward ?? ''),
    penalty: validatePenalty(proposal.penalty ?? ''),
    reason: validateAmendReason(reason),
  }), [now, proposal, reason]);
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable
          style={styles.dismissArea}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.header}>
            <LfText variant="title">{MOD_01_LABEL.title}</LfText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={MOD_01_LABEL.close}
              onPress={onClose}
              style={styles.close}
            >
              <LfIcon name="close" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <LfRow>
              <LfButton
                label={MOD_01_LABEL.amendTab}
                variant={mode === 'AMEND' ? 'tonal' : 'text'}
                accessibilityState={{ selected: mode === 'AMEND' }}
                grow
                onPress={() => setMode('AMEND')}
              />
              <LfButton
                label={MOD_01_LABEL.cancelTab}
                variant={mode === 'CANCEL' ? 'danger' : 'text'}
                accessibilityState={{ selected: mode === 'CANCEL' }}
                grow
                onPress={() => setMode('CANCEL')}
              />
            </LfRow>

            <View style={styles.notice}>
              <LfText>{MOD_01_LABEL.commonNotice}</LfText>
            </View>

            {mode === 'AMEND' ? (
              <>
                <LfField label={MOD_01_LABEL.titleField} required error={validation.title.message ?? undefined}>
                  <LfInput
                    accessibilityLabel={MOD_01_LABEL.titleField}
                    value={proposal.title}
                    onChangeText={(value) => update('title', value)}
                  />
                </LfField>
                <LfField label={MOD_01_LABEL.bodyField} required error={validation.body.message ?? undefined}>
                  <LfTextarea
                    accessibilityLabel={MOD_01_LABEL.bodyField}
                    value={proposal.body}
                    onChangeText={(value) => update('body', value)}
                  />
                </LfField>
                <LfField label={MOD_01_LABEL.categoryField} required>
                  <View style={styles.choices}>
                    {CATEGORIES.map((category) => (
                      <LfChoice
                        key={category}
                        label={PROMISE_CATEGORY_LABEL[category]}
                        selected={proposal.category === category}
                        onPress={() => update('category', category)}
                      />
                    ))}
                  </View>
                </LfField>
                <LfField label={MOD_01_LABEL.endDateField} required error={validation.endDate.message ?? undefined}>
                  <LfPicker
                    accessibilityLabel={MOD_01_LABEL.endDateSelect}
                    value={proposal.end_date}
                    placeholder={MOD_01_LABEL.endDateSelect}
                    onPress={() => pickEndDate(proposal.end_date, (value) => update('end_date', value))}
                  />
                </LfField>
                <LfField label={MOD_01_LABEL.keeperField} required>
                  <View style={styles.choices}>
                    {KEEPERS.map((keeper) => (
                      <LfChoice
                        key={keeper}
                        label={KEEPER_LABEL[keeper]}
                        selected={proposal.keeper === keeper}
                        onPress={() => update('keeper', keeper)}
                      />
                    ))}
                  </View>
                </LfField>
                <LfField label={MOD_01_LABEL.rewardField} optional>
                  <LfInput
                    accessibilityLabel={MOD_01_LABEL.rewardField}
                    value={proposal.reward ?? ''}
                    onChangeText={(value) => update('reward', value === '' ? null : value)}
                  />
                </LfField>
                <LfField label={MOD_01_LABEL.penaltyField} optional>
                  <LfInput
                    accessibilityLabel={MOD_01_LABEL.penaltyField}
                    value={proposal.penalty ?? ''}
                    onChangeText={(value) => update('penalty', value === '' ? null : value)}
                  />
                </LfField>
                {!changed ? <LfText variant="caption">{MOD_01_LABEL.noChanges}</LfText> : null}
              </>
            ) : (
              <View style={styles.notice}>
                <LfText>{MOD_01_LABEL.cancelNotice}</LfText>
              </View>
            )}

            <LfField label={MOD_01_LABEL.reasonField} optional>
              <LfTextarea
                accessibilityLabel={MOD_01_LABEL.reasonField}
                placeholder={MOD_01_LABEL.reasonPlaceholder}
                value={reason}
                onChangeText={setReason}
              />
            </LfField>
            {actionError ? <LfText variant="caption" align="center">{MOD_01_LABEL.submitError}</LfText> : null}
            <LfButton
              label={MOD_01_LABEL.submit}
              size="cta"
              block
              disabled={!submitEnabled}
              onPress={() => void submit()}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
