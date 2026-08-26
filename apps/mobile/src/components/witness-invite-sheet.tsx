import type {
  WitnessInviteListResponse,
  WitnessSlotView,
} from '@littlefinger/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { useLabels } from '../lib/locale-native';
import {
  issueWitnessInvite,
  listWitnesses,
  shareWitnessInvite,
  type WitnessInviteWithToken,
} from '../lib/witness-native.ts';
import { MOD_02_LABEL } from '../screens/mod-02-labels.ts';
import { colors, elevation, gutter, radius, size, space } from '../theme/tokens.ts';
import { LfAvatar } from './LfAvatar.tsx';
import { LfButton } from './LfButton.tsx';
import { LfChip } from './LfChip.tsx';
import { LfIcon } from './LfIcon.tsx';
import { LfRow } from './LfRow.tsx';
import { LfStack } from './LfStack.tsx';
import { LfText } from './LfText.tsx';

export interface WitnessInviteSheetProps {
  visible: boolean;
  promiseId: string;
  onClose(): void;
}

type LoadState =
  | { phase: 'LOADING' }
  | { phase: 'ERROR' }
  | { phase: 'READY'; value: WitnessInviteListResponse };

interface PendingShare {
  participantId: string | null;
  invite: WitnessInviteWithToken;
}

const SHEET_MAX_HEIGHT = '88%';

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT,
    paddingHorizontal: gutter.app,
    paddingTop: space[5],
    paddingBottom: space[9],
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    backgroundColor: colors.surface,
    ...elevation.sheet,
    // 잉크&스티커: 시트는 상단+측면 잉크 테두리, 하단은 없음 (.lf-sheet, ADR 0012)
    borderWidth: 2.5,
    borderBottomWidth: 0,
    borderColor: colors.text,
  },
  handle: {
    alignSelf: 'center',
    width: size.iconButton,
    height: space[1],
    marginBottom: space[7],
    borderRadius: radius.pill,
    backgroundColor: colors.outlineStrong,
  },
  scrollContent: {
    gap: space[5],
    paddingBottom: space[5],
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
  witness: {
    paddingHorizontal: space[6],
    paddingVertical: space[5],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  witnessCopy: {
    flex: 1,
  },
  emptySlot: {
    minHeight: size.ctaHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderColor: colors.outlineStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceChrome,
  },
  centered: {
    paddingVertical: space[9],
  },
});

function WitnessRow({
  slot,
  busy,
  onReshare,
}: {
  slot: WitnessSlotView;
  busy: boolean;
  onReshare(participantId: string): void;
}): React.JSX.Element {
  const LABEL = useLabels(MOD_02_LABEL);
  if (slot.status === 'INVITED') {
    return (
      <View style={styles.witness}>
        <LfRow gap={5}>
          <LfAvatar
            nickname={LABEL.anonymous}
            profileImageUrl={null}
            accessibilityLabel={LABEL.anonymous}
          />
          <View style={styles.witnessCopy}>
            <LfStack gap={2}>
              <LfText>{LABEL.anonymous}</LfText>
              <LfChip label={LABEL.invited} tone="neutral" />
            </LfStack>
          </View>
        </LfRow>
        <LfButton
          label={LABEL.reshare}
          variant="outlined"
          size="compact"
          block
          disabled={busy}
          onPress={() => onReshare(slot.participant_id)}
        />
      </View>
    );
  }

  const signedAt = slot.signed_at;
  const nickname = slot.nickname ?? LABEL.anonymous;
  return (
    <View style={styles.witness}>
      <LfRow gap={5}>
        <LfAvatar
          nickname={nickname}
          profileImageUrl={slot.profile_image_url}
          accessibilityLabel={nickname}
        />
        <View style={styles.witnessCopy}>
          <LfStack gap={2}>
            <LfText>{nickname}</LfText>
            {signedAt !== null ? (
              <LfText variant="caption">{LABEL.signedAt(signedAt)}</LfText>
            ) : null}
          </LfStack>
        </View>
        <LfChip
          label={signedAt !== null ? LABEL.signed : LABEL.unsigned}
          tone={signedAt !== null ? 'done' : 'neutral'}
        />
      </LfRow>
    </View>
  );
}

export function WitnessInviteSheet({
  visible,
  promiseId,
  onClose,
}: WitnessInviteSheetProps): React.JSX.Element {
  const LABEL = useLabels(MOD_02_LABEL);
  const [loadState, setLoadState] = useState<LoadState>({ phase: 'LOADING' });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const activeLoad = useRef(0);
  const actionPending = useRef(false);
  const pendingShare = useRef<PendingShare | null>(null);

  const load = useCallback(async () => {
    const loadId = ++activeLoad.current;
    setLoadState({ phase: 'LOADING' });
    try {
      const value = await listWitnesses(promiseId);
      if (loadId === activeLoad.current) setLoadState({ phase: 'READY', value });
    } catch {
      if (loadId === activeLoad.current) setLoadState({ phase: 'ERROR' });
    }
  }, [promiseId]);

  useEffect(() => {
    if (!visible) {
      activeLoad.current += 1;
      return;
    }
    void load();
  }, [load, visible]);

  useEffect(() => {
    pendingShare.current = null;
    setActionError(false);
  }, [promiseId]);

  const share = useCallback(async (participantId: string | null) => {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setActionError(false);
    try {
      const retry = pendingShare.current;
      const invite = retry !== null && retry.participantId === participantId
        ? retry.invite
        : await issueWitnessInvite(promiseId, participantId);
      pendingShare.current = { participantId, invite };
      await shareWitnessInvite(invite);
      pendingShare.current = null;
      await load();
    } catch {
      setActionError(true);
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }, [load, promiseId]);

  const ready = loadState.phase === 'READY' ? loadState.value : null;
  const atCapacity = ready !== null && ready.occupied_count >= ready.capacity;
  const remainingLabel = ready?.occupied_count === 0
    ? LABEL.twoRemaining
    : LABEL.oneRemaining;

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
            <LfRow gap={3} grow>
              <LfText variant="title">{LABEL.title}</LfText>
              {ready !== null ? (
                <LfChip label={LABEL.count(ready.occupied_count, ready.capacity)} />
              ) : null}
            </LfRow>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={LABEL.close}
              style={styles.close}
              onPress={onClose}
            >
              <LfIcon name="close" />
            </Pressable>
          </View>
          <LfText variant="caption">{LABEL.description}</LfText>

          {loadState.phase === 'LOADING' ? (
            <View style={styles.centered}>
              <LfText align="center">{LABEL.loading}</LfText>
            </View>
          ) : null}
          {loadState.phase === 'ERROR' ? (
            <View style={styles.centered}>
              <LfStack gap={5} center>
                <LfText variant="error" align="center">{LABEL.loadError}</LfText>
                <LfButton label={LABEL.retry} variant="outlined" onPress={() => void load()} />
              </LfStack>
            </View>
          ) : null}
          {ready !== null ? (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {ready.witnesses.map((slot) => (
                <WitnessRow
                  key={slot.participant_id}
                  slot={slot}
                  busy={busy}
                  onReshare={(participantId) => void share(participantId)}
                />
              ))}
              {!atCapacity ? (
                <View style={styles.emptySlot}>
                  <LfText variant="caption">{remainingLabel}</LfText>
                </View>
              ) : (
                <LfText variant="caption" align="center">{LABEL.atCapacity}</LfText>
              )}
              <LfText variant="caption" align="center">{LABEL.hint}</LfText>
              {actionError ? (
                <LfText variant="error" align="center">{LABEL.shareError}</LfText>
              ) : null}
              <LfButton
                testID="witness-invite-button"
                label={LABEL.invite}
                variant="kakao"
                block
                disabled={busy || atCapacity}
                onPress={() => void share(null)}
              />
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
