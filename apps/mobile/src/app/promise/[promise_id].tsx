import {
  KEEPER_LABEL,
  PARTICIPANT_ROLE_LABEL,
  PROMISE_CATEGORY_LABEL,
  PROMISE_STATUS_LABEL,
  type CompletionCelebrationView,
  type EvidenceView,
  type FulfillmentCheckView,
  type PromiseDetailPerson,
  type PromiseDetailResponse,
  type PromiseDetailVersion,
  type PromiseAmendCreateRequest,
  type PromiseAmendDecision,
  type PromiseVersionListResponse,
} from '@littlefinger/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAppBar } from '../../components/LfAppBar';
import { LfAvatar } from '../../components/LfAvatar';
import { LfButton } from '../../components/LfButton';
import { LfCard } from '../../components/LfCard';
import { LfChip } from '../../components/LfChip';
import { LfDisclaimer } from '../../components/LfDisclaimer';
import { LfIcon } from '../../components/LfIcon';
import { LfRow } from '../../components/LfRow';
import { LfStack } from '../../components/LfStack';
import { LfText } from '../../components/LfText';
import { CompletionCelebrationSheet } from '../../components/completion-celebration-sheet.tsx';
import { PromiseAmendSheet } from '../../components/promise-amend-sheet.tsx';
import { WitnessInviteSheet } from '../../components/witness-invite-sheet.tsx';
import {
  blockUserNative,
  hidePromiseNative,
  reportSafetyIssueNative,
} from '../../lib/account-safety-native.ts';
import {
  claimCompletionCelebration,
  markCompletionCelebrationShown,
} from '../../lib/completion-celebration-native.ts';
import {
  createFulfillmentIdempotencyKey,
  reopenFulfillment,
  signFulfillmentEvidence,
} from '../../lib/fulfillment-native.ts';
import { MobileApiError } from '../../lib/mobile-api.ts';
import {
  createPromiseAmendIdempotencyKey,
  listPromiseVersions,
  requestPromiseAmend,
  respondPromiseAmend,
  withdrawPromiseAmend,
} from '../../lib/promise-amend-native.ts';
import { getPromiseDetail } from '../../lib/promise-detail-native.ts';
import { buildParticipantPromisesWebUrl } from '../../lib/invite-link.ts';
import { openEndDatePicker } from '../../lib/promise-editor-native.ts';
import {
  changedVersionRows,
  claimPresentation,
  detailStatusOf,
  evidenceAvailabilityText,
  fingerprintText,
  formatDetailDate,
  formatDetailDday,
  formatDetailInstant,
  responseFact,
} from '../../screens/scr-a05-detail-state.ts';
import { MOD_01_LABEL, SCR_A05_LABEL } from '../../screens/scr-a05-labels.ts';
import { colors, elevation, gutter, radius, size, space } from '../../theme/tokens';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const WITNESS_INVITE_STATUSES = new Set(['PENDING', 'ACTIVE', 'AMEND_PENDING', 'CHECKING']);
const HISTORY_SHEET_MAX_HEIGHT = '88%';

type ScreenPhase = 'loading' | 'ready' | 'not-found' | 'error';
interface IntentKey {
  signature: string;
  key: string;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  back: {
    minWidth: size.touchMin,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: gutter.app,
    gap: space[6],
  },
  body: {
    padding: gutter.app,
    paddingBottom: space[9],
    gap: space[6],
  },
  status: { alignItems: 'center', gap: space[3] },
  detailText: { gap: space[3] },
  info: { gap: space[4] },
  value: { flex: 1, alignItems: 'flex-end' },
  people: { gap: space[5] },
  personText: { flex: 1 },
  evidenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  evidence: {
    width: size.evidenceThumb,
    minHeight: size.evidenceThumb,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[3],
  },
  evidenceGroup: { width: size.evidenceThumb, gap: space[2] },
  claims: { gap: space[5] },
  claim: { flex: 1, gap: space[3], alignItems: 'center' },
  actions: { gap: space[4] },
  compare: { gap: space[5] },
  changePair: { gap: space[3] },
  historyScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  historySheet: {
    maxHeight: HISTORY_SHEET_MAX_HEIGHT,
    paddingHorizontal: gutter.app,
    paddingTop: space[7],
    paddingBottom: space[9],
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    backgroundColor: colors.surface,
    ...elevation.sheet,
  },
  historyContent: { gap: space[5], paddingBottom: space[5] },
});

function promiseIdOf(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : null;
}

function BackButton({ onPress }: { onPress(): void }): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={SCR_A05_LABEL.back}
      onPress={onPress}
      style={styles.back}
    >
      <LfIcon name="arrow-back" />
    </Pressable>
  );
}

function ScreenFrame({
  onBack,
  children,
}: {
  onBack(): void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar title={SCR_A05_LABEL.title} leading={<BackButton onPress={onBack} />} />
      {children}
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <LfRow>
      <LfText variant="caption">{label}</LfText>
      <View style={styles.value}>
        <LfText>{value}</LfText>
      </View>
    </LfRow>
  );
}

function PersonRow({ person }: { person: PromiseDetailPerson }): React.JSX.Element {
  return (
    <LfRow>
      <LfAvatar
        nickname={person.nickname}
        profileImageUrl={person.profile_image_url}
        accessibilityLabel={SCR_A05_LABEL.profileImage(person.nickname)}
      />
      <View style={styles.personText}>
        <LfText variant="subtitle">{person.nickname}</LfText>
        <LfText variant="caption">{PARTICIPANT_ROLE_LABEL[person.role]}</LfText>
      </View>
    </LfRow>
  );
}

function EvidenceTile({
  evidence,
  onReport,
}: {
  evidence: EvidenceView;
  onReport(evidenceId: string): void;
}): React.JSX.Element {
  const placeholder = evidenceAvailabilityText(evidence.availability);
  if (placeholder !== null) {
    return (
      <View style={styles.evidence}>
        <LfText variant="disclaimer" align="center">{placeholder}</LfText>
      </View>
    );
  }
  return (
    <View style={styles.evidenceGroup}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={SCR_A05_LABEL.evidenceOpen}
        style={styles.evidence}
        onPress={async () => {
          try {
            const signed = await signFulfillmentEvidence(evidence.evidence_id, 'FULL');
            await Linking.openURL(signed.signed_url);
          } catch {
            // 열람 실패는 화면의 기록 자체를 숨기지 않는다.
          }
        }}
      >
        <LfIcon name="image" color="textMuted" />
        <LfText variant="caption">{SCR_A05_LABEL.evidenceOpen}</LfText>
      </Pressable>
      <LfButton
        label={SCR_A05_LABEL.evidenceReport}
        variant="text"
        size="compact"
        onPress={() => onReport(evidence.evidence_id)}
      />
    </View>
  );
}

function ClaimCard({
  check,
  nickname,
  onReportEvidence,
}: {
  check: FulfillmentCheckView;
  nickname: string;
  onReportEvidence(evidenceId: string): void;
}): React.JSX.Element {
  const claim = claimPresentation(check, nickname);
  return (
    <LfCard testID={`detail-claim-${check.role}`}>
      <View style={styles.claim}>
        <LfText variant="subtitle">{claim.nickname}</LfText>
        <LfChip label={claim.answer} tone="neutral" />
        <LfText align="center">
          {check.comment === null || check.comment.length === 0
            ? SCR_A05_LABEL.noComment
            : check.comment}
        </LfText>
        <LfText variant="caption">{claim.submittedAt}</LfText>
        <LfText variant="caption">{claim.evidenceCount}</LfText>
        {check.evidences.length > 0 && (
          <View style={styles.evidenceRow}>
            {check.evidences.map((evidence) => (
              <EvidenceTile
                key={evidence.evidence_id}
                evidence={evidence}
                onReport={onReportEvidence}
              />
            ))}
          </View>
        )}
      </View>
    </LfCard>
  );
}

function ChangedVersionSection({
  before,
  after,
}: {
  before: PromiseDetailVersion;
  after: PromiseDetailVersion;
}): React.JSX.Element {
  const rows = changedVersionRows(before, after);
  return (
    <View style={styles.compare}>
      {rows.map((row) => (
        <LfCard key={row.field}>
          <View style={styles.changePair}>
            <LfText variant="caption">{SCR_A05_LABEL.changedBefore(row.label)}</LfText>
            <LfText>{row.before}</LfText>
            <LfText variant="caption">{SCR_A05_LABEL.changedAfter(row.label)}</LfText>
            <LfText>{row.after}</LfText>
          </View>
        </LfCard>
      ))}
    </View>
  );
}

function VersionHistorySheet({
  visible,
  state,
  onClose,
}: {
  visible: boolean;
  state: { phase: 'idle' | 'loading' | 'error' } | {
    phase: 'ready';
    value: PromiseVersionListResponse;
  };
  onClose(): void;
}): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.historyScrim}>
        <View style={styles.historySheet} accessibilityViewIsModal>
          <LfStack gap={5}>
            <LfText variant="title">{SCR_A05_LABEL.versionHistoryTitle}</LfText>
            {state.phase === 'loading' || state.phase === 'idle' ? (
              <LfText>{SCR_A05_LABEL.versionHistoryLoading}</LfText>
            ) : null}
            {state.phase === 'error' ? <LfText>{SCR_A05_LABEL.loadError}</LfText> : null}
            {state.phase === 'ready' ? (
              <ScrollView contentContainerStyle={styles.historyContent}>
                {state.value.versions.length === 0 ? (
                  <LfText>{SCR_A05_LABEL.versionHistoryEmpty}</LfText>
                ) : state.value.versions.map((item) => (
                  <LfCard key={item.version.version_no}>
                    <LfStack gap={3}>
                      <LfText variant="sectionTitle">{SCR_A05_LABEL.version(item.version.version_no)}</LfText>
                      <LfText variant="subtitle">{item.version.title}</LfText>
                      <LfText>{item.version.body}</LfText>
                      <InfoRow label={SCR_A05_LABEL.category} value={PROMISE_CATEGORY_LABEL[item.version.category]} />
                      <InfoRow label={SCR_A05_LABEL.endDate} value={formatDetailDate(item.version.end_date)} />
                      <InfoRow label={SCR_A05_LABEL.keeper} value={KEEPER_LABEL[item.version.keeper]} />
                      <InfoRow label={SCR_A05_LABEL.reward} value={item.version.reward ?? SCR_A05_LABEL.noReward} />
                      <InfoRow label={SCR_A05_LABEL.penalty} value={item.version.penalty ?? SCR_A05_LABEL.noPenalty} />
                      <LfText variant="caption">{SCR_A05_LABEL.contentHash}</LfText>
                      <LfText>{item.version.content_hash.slice(0, 8)}</LfText>
                      {item.version.activated_at !== null ? (
                        <InfoRow label={SCR_A05_LABEL.versionActivated} value={formatDetailInstant(item.version.activated_at)} />
                      ) : null}
                      {item.version.superseded_at !== null ? (
                        <InfoRow label={SCR_A05_LABEL.versionSuperseded} value={formatDetailInstant(item.version.superseded_at)} />
                      ) : null}
                      {item.change_requester !== null ? (
                        <InfoRow label={SCR_A05_LABEL.versionRequester} value={item.change_requester.nickname} />
                      ) : null}
                      {item.approved_by !== null ? (
                        <InfoRow label={SCR_A05_LABEL.versionApprover} value={item.approved_by.nickname} />
                      ) : null}
                      {item.approved_at !== null ? (
                        <InfoRow label={SCR_A05_LABEL.versionApproved} value={formatDetailInstant(item.approved_at)} />
                      ) : null}
                      {item.change_reason !== null ? (
                        <InfoRow label={SCR_A05_LABEL.versionReason} value={item.change_reason} />
                      ) : null}
                    </LfStack>
                  </LfCard>
                ))}
              </ScrollView>
            ) : null}
            <LfButton
              label={SCR_A05_LABEL.versionHistoryClose}
              variant="outlined"
              block
              onPress={onClose}
            />
          </LfStack>
        </View>
      </View>
    </Modal>
  );
}

function FulfillmentSection({
  detail,
  onReportEvidence,
}: {
  detail: PromiseDetailResponse;
  onReportEvidence(evidenceId: string): void;
}): React.JSX.Element | null {
  const fulfillment = detail.fulfillment;
  if (fulfillment === null) return null;
  const checks = [fulfillment.creator_check, fulfillment.partner_check].filter(
    (check): check is FulfillmentCheckView => check !== null,
  );
  return (
    <LfStack gap={5}>
      <LfText variant="sectionTitle">{SCR_A05_LABEL.fulfillment}</LfText>
      <LfCard variant="container">
        <LfStack gap={3}>
          <LfText>{responseFact(detail.creator.nickname, fulfillment.creator_has_submitted)}</LfText>
          <LfText>
            {responseFact(detail.partner?.nickname ?? PARTICIPANT_ROLE_LABEL.PARTNER, fulfillment.partner_has_submitted)}
          </LfText>
          {detail.check_deadline_at !== null && (
            <InfoRow
              label={SCR_A05_LABEL.checkDeadline}
              value={formatDetailInstant(detail.check_deadline_at)}
            />
          )}
        </LfStack>
      </LfCard>
      {checks.length > 0 && (
        <View style={styles.claims}>
          {checks.map((check) => (
            <ClaimCard
              key={`${check.round_no}.${check.role}`}
              check={check}
              nickname={
                check.role === 'CREATOR'
                  ? detail.creator.nickname
                  : (detail.partner?.nickname ?? PARTICIPANT_ROLE_LABEL.PARTNER)
              }
              onReportEvidence={onReportEvidence}
            />
          ))}
        </View>
      )}
      {fulfillment.history.length > 0 && (
        <LfStack gap={4}>
          <LfText variant="sectionTitle">{SCR_A05_LABEL.history}</LfText>
          {fulfillment.history.map((round) => (
            <LfStack key={round.round_no} gap={3}>
              <LfText variant="caption">{SCR_A05_LABEL.round(round.round_no)}</LfText>
              {[round.creator_check, round.partner_check]
                .filter((check): check is FulfillmentCheckView => check !== null)
                .map((check) => (
                  <ClaimCard
                    key={`${round.round_no}.${check.role}`}
                    check={check}
                    nickname={
                      check.role === 'CREATOR'
                        ? detail.creator.nickname
                        : (detail.partner?.nickname ?? PARTICIPANT_ROLE_LABEL.PARTNER)
                    }
                    onReportEvidence={onReportEvidence}
                  />
                ))}
            </LfStack>
          ))}
        </LfStack>
      )}
    </LfStack>
  );
}

export default function PromiseDetailScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ promise_id?: string | string[] }>();
  const promiseId = promiseIdOf(params.promise_id);
  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [detail, setDetail] = useState<PromiseDetailResponse | null>(null);
  const [actionError, setActionError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [witnessSheetOpen, setWitnessSheetOpen] = useState(false);
  const [amendSheetOpen, setAmendSheetOpen] = useState(false);
  const [versionSheetOpen, setVersionSheetOpen] = useState(false);
  const [celebration, setCelebration] = useState<CompletionCelebrationView | null>(null);
  const [versionState, setVersionState] = useState<
    { phase: 'idle' | 'loading' | 'error' } | {
      phase: 'ready';
      value: PromiseVersionListResponse;
    }
  >({ phase: 'idle' });
  const reopenKey = useRef<string | null>(null);
  const amendRequestKey = useRef<IntentKey | null>(null);
  const amendRespondKey = useRef<IntentKey | null>(null);
  const amendWithdrawKey = useRef<string | null>(null);
  const actionPending = useRef(false);
  const claimAttemptedFor = useRef<string | null>(null);
  const shownAttemptedFor = useRef<string | null>(null);
  const activePromiseId = useRef<string | null>(promiseId);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (promiseId === null) {
      setPhase('not-found');
      return false;
    }
    setPhase('loading');
    try {
      const nextDetail = await getPromiseDetail(promiseId);
      setDetail(nextDetail);
      setPhase('ready');
      if (
        nextDetail.status === 'COMPLETED' &&
        (nextDetail.my_role === 'CREATOR' || nextDetail.my_role === 'PARTNER') &&
        claimAttemptedFor.current !== nextDetail.promise_id
      ) {
        claimAttemptedFor.current = nextDetail.promise_id;
        void claimCompletionCelebration(nextDetail.promise_id)
          .then((nextCelebration) => {
            if (activePromiseId.current === nextDetail.promise_id) {
              setCelebration(nextCelebration);
            }
          })
          .catch(() => undefined);
      }
      return true;
    } catch (error) {
      setPhase(
        error instanceof MobileApiError && error.code === 'E_NOT_FOUND' ? 'not-found' : 'error',
      );
      return false;
    }
  }, [promiseId]);

  useEffect(() => {
    activePromiseId.current = promiseId;
    claimAttemptedFor.current = null;
    shownAttemptedFor.current = null;
    setCelebration(null);
    reopenKey.current = null;
    amendRequestKey.current = null;
    amendRespondKey.current = null;
    amendWithdrawKey.current = null;
    actionPending.current = false;
    setAmendSheetOpen(false);
    setVersionSheetOpen(false);
    setVersionState({ phase: 'idle' });
    void refresh();
    return () => {
      if (activePromiseId.current === promiseId) activePromiseId.current = null;
    };
  }, [promiseId, refresh]);

  if (phase !== 'ready' || detail === null) {
    const label =
      phase === 'loading'
        ? SCR_A05_LABEL.loading
        : phase === 'not-found'
          ? SCR_A05_LABEL.notFound
          : SCR_A05_LABEL.loadError;
    return (
      <ScreenFrame onBack={() => router.back()}>
        <View style={styles.centered}>
          <LfText align="center">{label}</LfText>
          {phase === 'error' && (
            <LfButton label={SCR_A05_LABEL.retry} variant="outlined" onPress={() => void refresh()} />
          )}
        </View>
      </ScreenFrame>
    );
  }

  const status = detailStatusOf(detail.status);
  const terminalReason =
    detail.status === 'DECLINED'
      ? (detail.approvals.find((approval) => approval.action === 'DECLINE')?.comment ?? null)
      : detail.status === 'CANCELED'
        ? detail.amend_request?.reason ?? null
        : null;
  const canInviteWitness =
    WITNESS_INVITE_STATUSES.has(detail.status)
    && (detail.my_role === 'CREATOR' || detail.my_role === 'PARTNER');
  const myUserId = detail.my_role === 'CREATOR'
    ? detail.creator.user_id
    : detail.my_role === 'PARTNER'
      ? detail.partner?.user_id ?? null
      : detail.witnesses.find((witness) => witness.role === 'WITNESS')?.user_id ?? null;
  const pendingAmend = detail.status === 'AMEND_PENDING' ? detail.amend_request : null;
  const isAmendRequester = pendingAmend !== null && pendingAmend.requester.user_id === myUserId;
  const isAmendResponder = pendingAmend !== null
    && !isAmendRequester
    && (detail.my_role === 'CREATOR' || detail.my_role === 'PARTNER');
  const canRequestAmend = detail.status === 'ACTIVE'
    && (detail.my_role === 'CREATOR' || detail.my_role === 'PARTNER');
  const canShowVersionHistory = !['DECLINED', 'CANCELED'].includes(detail.status)
    && detail.current_version.activated_at !== null;
  const terminal = ['COMPLETED', 'BROKEN', 'DISPUTED', 'UNRESOLVED', 'DECLINED', 'CANCELED']
    .includes(detail.status);
  const counterpart = detail.my_role === 'CREATOR' ? detail.partner : detail.creator;
  const canNotifyPartner = detail.my_role === 'CREATOR'
    && detail.partner !== null
    && !detail.counterpart_push_available
    && !terminal;

  async function reopen(): Promise<void> {
    if (promiseId === null || busy) return;
    setBusy(true);
    setActionError(false);
    reopenKey.current ??= createFulfillmentIdempotencyKey();
    try {
      await reopenFulfillment(promiseId, reopenKey.current);
      router.push({ pathname: '/fulfillment/[promise_id]', params: { promise_id: promiseId } });
    } catch {
      setActionError(true);
    } finally {
      setBusy(false);
    }
  }

  function shouldRefreshAfterAmendError(error: unknown): boolean {
    return error instanceof MobileApiError
      && (error.code === 'E_VALIDATION' || error.code === 'E_STATE_CONFLICT');
  }

  async function submitAmend(input: PromiseAmendCreateRequest): Promise<void> {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setActionError(false);
    const signature = JSON.stringify(input);
    if (amendRequestKey.current?.signature !== signature) {
      amendRequestKey.current = { signature, key: createPromiseAmendIdempotencyKey() };
    }
    try {
      await requestPromiseAmend(input, amendRequestKey.current.key);
      if (await refresh()) {
        amendRequestKey.current = null;
        setAmendSheetOpen(false);
      }
    } catch (error) {
      setActionError(true);
      if (shouldRefreshAfterAmendError(error)) await refresh();
      throw error;
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }

  async function respondAmend(decision: PromiseAmendDecision): Promise<void> {
    const currentDetail = detail;
    const request = currentDetail?.amend_request;
    if (currentDetail === null || request === null || request === undefined || actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setActionError(false);
    if (amendRespondKey.current?.signature !== decision) {
      amendRespondKey.current = { signature: decision, key: createPromiseAmendIdempotencyKey() };
    }
    try {
      await respondPromiseAmend({
        promise_id: currentDetail.promise_id,
        request_id: request.request_id,
        decision,
      }, amendRespondKey.current.key);
      if (await refresh()) amendRespondKey.current = null;
    } catch (error) {
      setActionError(true);
      if (shouldRefreshAfterAmendError(error)) await refresh();
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }

  async function withdrawAmend(): Promise<void> {
    const currentDetail = detail;
    const request = currentDetail?.amend_request;
    if (currentDetail === null || request === null || request === undefined || actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setActionError(false);
    amendWithdrawKey.current ??= createPromiseAmendIdempotencyKey();
    try {
      await withdrawPromiseAmend(
        currentDetail.promise_id,
        request.request_id,
        amendWithdrawKey.current,
      );
      if (await refresh()) amendWithdrawKey.current = null;
    } catch (error) {
      setActionError(true);
      if (shouldRefreshAfterAmendError(error)) await refresh();
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }

  async function openVersionHistory(): Promise<void> {
    if (promiseId === null) return;
    setVersionSheetOpen(true);
    setVersionState({ phase: 'loading' });
    try {
      setVersionState({ phase: 'ready', value: await listPromiseVersions(promiseId) });
    } catch {
      setVersionState({ phase: 'error' });
    }
  }

  function confirmCancel(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(MOD_01_LABEL.cancelConfirmTitle, MOD_01_LABEL.cancelConfirmBody, [
        { text: MOD_01_LABEL.cancelConfirmDismiss, style: 'cancel', onPress: () => resolve(false) },
        { text: MOD_01_LABEL.cancelConfirmAction, style: 'destructive', onPress: () => resolve(true) },
      ], { cancelable: false });
    });
  }

  async function hideFromList(): Promise<void> {
    const detailId = detail?.promise_id;
    if (busy || detailId === undefined) return;
    setBusy(true);
    setActionError(false);
    try {
      await hidePromiseNative(detailId, true);
      router.back();
    } catch {
      setActionError(true);
    } finally {
      setBusy(false);
    }
  }

  function confirmBlock(): void {
    const target = counterpart;
    if (target === null || busy) return;
    Alert.alert(SCR_A05_LABEL.userBlockTitle, SCR_A05_LABEL.userBlockBody, [
      { text: SCR_A05_LABEL.cancel, style: 'cancel' },
      {
        text: SCR_A05_LABEL.blockAction,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setActionError(false);
          try {
            await blockUserNative(target.user_id);
          } catch {
            setActionError(true);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  function confirmUserReport(): void {
    const target = counterpart;
    const detailId = detail?.promise_id;
    if (target === null || detailId === undefined || busy) return;
    Alert.alert(SCR_A05_LABEL.userReportTitle, SCR_A05_LABEL.userReportBody, [
      { text: SCR_A05_LABEL.cancel, style: 'cancel' },
      {
        text: SCR_A05_LABEL.reportAction,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setActionError(false);
          try {
            await reportSafetyIssueNative({
              promise_id: detailId,
              target_user_id: target.user_id,
              evidence_id: null,
              reason: 'ABUSE',
              detail: null,
            });
          } catch {
            setActionError(true);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  function confirmEvidenceReport(evidenceId: string): void {
    const detailId = detail?.promise_id;
    if (busy || detailId === undefined) return;
    Alert.alert(SCR_A05_LABEL.evidenceReportTitle, SCR_A05_LABEL.evidenceReportBody, [
      { text: SCR_A05_LABEL.cancel, style: 'cancel' },
      {
        text: SCR_A05_LABEL.reportAction,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setActionError(false);
          try {
            await reportSafetyIssueNative({
              promise_id: detailId,
              target_user_id: null,
              evidence_id: evidenceId,
              reason: 'ABUSE',
              detail: null,
            });
            await refresh();
          } catch {
            setActionError(true);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  function acknowledgeCelebrationShown(): void {
    if (celebration === null || shownAttemptedFor.current === celebration.claim_id) return;
    shownAttemptedFor.current = celebration.claim_id;
    void markCompletionCelebrationShown(
      celebration.promise_id,
      celebration.claim_id,
    ).catch(() => undefined);
  }

  function closeCelebration(): void {
    setCelebration(null);
  }

  function createAfterCelebration(): void {
    setCelebration(null);
    router.push('/promise/edit');
  }

  function shareCelebration(): void {
    if (detail === null) return;
    void Share.share({
      message: SCR_A05_LABEL.shareMessage(
        detail.title,
        PROMISE_STATUS_LABEL.COMPLETED,
      ),
    });
  }

  return (
    <ScreenFrame onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.status}>
          <LfChip label={status.label} tone={status.tone} />
          <LfText variant="headline" align="center">{status.headline}</LfText>
          <LfText variant="caption" align="center">
            {SCR_A05_LABEL.statusSubtitle[detail.status]}
          </LfText>
        </View>

        <LfCard>
          <View style={styles.detailText}>
            <LfText variant="title">{detail.title}</LfText>
            <LfText>{detail.body}</LfText>
            <LfRow>
              <LfChip label={`${SCR_A05_LABEL.category} · ${PROMISE_CATEGORY_LABEL[detail.category]}`} />
              <LfChip label={`${SCR_A05_LABEL.keeper} · ${KEEPER_LABEL[detail.keeper]}`} />
            </LfRow>
            <InfoRow label={SCR_A05_LABEL.endDate} value={formatDetailDate(detail.end_date)} />
            <InfoRow label={SCR_A05_LABEL.dday} value={formatDetailDday(detail.end_date, new Date())} />
          </View>
        </LfCard>

        <LfStack gap={4}>
          <LfText variant="sectionTitle">{SCR_A05_LABEL.people}</LfText>
          <LfCard>
            <View style={styles.people}>
              <PersonRow person={detail.creator} />
              {detail.partner === null ? (
                <LfText>{SCR_A05_LABEL.partnerPending}</LfText>
              ) : (
                <PersonRow person={detail.partner} />
              )}
              {detail.witnesses.map((witness) => <PersonRow key={witness.user_id} person={witness} />)}
            </View>
          </LfCard>
        </LfStack>

        <LfStack gap={4}>
          <LfText variant="sectionTitle">{SCR_A05_LABEL.reward}</LfText>
          <LfCard variant="container"><LfText>{detail.reward ?? SCR_A05_LABEL.noReward}</LfText></LfCard>
          <LfText variant="sectionTitle">{SCR_A05_LABEL.penalty}</LfText>
          <LfCard><LfText>{detail.penalty ?? SCR_A05_LABEL.noPenalty}</LfText></LfCard>
        </LfStack>

        {detail.status === 'PENDING' && detail.invitation !== null && (
          <LfCard variant="container">
            <View style={styles.info}>
              <InfoRow
                label={SCR_A05_LABEL.invitation}
                value={SCR_A05_LABEL.invitationStatus[detail.invitation.status]}
              />
              <InfoRow
                label={SCR_A05_LABEL.invitationExpires}
                value={formatDetailInstant(detail.invitation.expires_at)}
              />
            </View>
          </LfCard>
        )}

        {pendingAmend !== null && (
          <LfStack gap={4}>
            <LfText variant="sectionTitle">{SCR_A05_LABEL.amend}</LfText>
            {pendingAmend.type === 'AMEND' && pendingAmend.proposed_version !== null ? (
              <ChangedVersionSection
                before={detail.current_version}
                after={pendingAmend.proposed_version}
              />
            ) : (
              <LfCard variant="container">
                <LfText>{SCR_A05_LABEL.cancelRequested(pendingAmend.requester.nickname)}</LfText>
              </LfCard>
            )}
            <InfoRow label={SCR_A05_LABEL.amendRequester} value={pendingAmend.requester.nickname} />
            <InfoRow label={SCR_A05_LABEL.amendRequestedAt} value={formatDetailInstant(pendingAmend.created_at)} />
            {pendingAmend.reason !== null ? (
              <InfoRow label={SCR_A05_LABEL.amendReason} value={pendingAmend.reason} />
            ) : null}
            {isAmendRequester ? (
              <LfButton
                label={SCR_A05_LABEL.amendWithdrawAction}
                variant="outlined"
                block
                disabled={busy}
                onPress={() => void withdrawAmend()}
              />
            ) : null}
            {isAmendResponder ? (
              <LfRow>
                <LfButton
                  label={pendingAmend.type === 'AMEND'
                    ? SCR_A05_LABEL.amendApproveAction
                    : SCR_A05_LABEL.cancelApproveAction}
                  grow
                  disabled={busy}
                  onPress={() => void respondAmend('APPROVE')}
                />
                <LfButton
                  label={SCR_A05_LABEL.amendDeclineAction}
                  variant="outlined"
                  grow
                  disabled={busy}
                  onPress={() => void respondAmend('DECLINE')}
                />
              </LfRow>
            ) : null}
          </LfStack>
        )}

        <FulfillmentSection detail={detail} onReportEvidence={confirmEvidenceReport} />

        <LfStack gap={4}>
          <LfText variant="sectionTitle">{SCR_A05_LABEL.record}</LfText>
          <LfCard variant="container">
            <View style={styles.info}>
              <LfText variant="caption">{fingerprintText(detail.current_version.fingerprint)}</LfText>
              {/* 지문이 현재 버전 것이므로 시각도 같은 버전의 승인 시각이어야 짝이 맞는다
                  (PO 2026-08-20). 최초 확정 시각은 승인 이력에 그대로 남는다. */}
              {detail.current_version.activated_at !== null && (
                <LfText variant="caption">{formatDetailInstant(detail.current_version.activated_at)}</LfText>
              )}
            </View>
          </LfCard>
          {detail.approvals.length > 0 && (
            <LfStack gap={3}>
              <LfText variant="sectionTitle">{SCR_A05_LABEL.approvals}</LfText>
              {detail.approvals.map((approval, index) => (
                <LfCard key={`${approval.acted_at}.${approval.role}.${index}`}>
                  <InfoRow
                    label={`${approval.actor.nickname} · ${PARTICIPANT_ROLE_LABEL[approval.role]}`}
                    value={SCR_A05_LABEL.approvalAction[approval.action]}
                  />
                  <LfText variant="caption">{formatDetailInstant(approval.acted_at)}</LfText>
                  {approval.comment !== null && <LfText>{approval.comment}</LfText>}
                </LfCard>
              ))}
            </LfStack>
          )}
          {detail.status === 'ACTIVE' && <LfDisclaimer />}
          {canShowVersionHistory ? (
            <LfButton
              label={SCR_A05_LABEL.versionHistoryAction}
              variant="outlined"
              block
              onPress={() => void openVersionHistory()}
            />
          ) : null}
        </LfStack>

        {terminalReason !== null && <LfCard><LfText>{terminalReason}</LfText></LfCard>}

        <View style={styles.actions}>
          {canRequestAmend ? (
            <LfButton
              label={SCR_A05_LABEL.amendRequestAction}
              variant="outlined"
              block
              disabled={busy}
              onPress={() => setAmendSheetOpen(true)}
            />
          ) : null}
          {canNotifyPartner ? (
            <LfCard variant="container">
              <LfStack gap={3}>
                <LfText variant="caption">{SCR_A05_LABEL.notifyPartnerHint}</LfText>
                <LfButton
                  label={SCR_A05_LABEL.notifyPartnerAction}
                  variant="outlined"
                  block
                  onPress={() => void Share.share({
                    message: SCR_A05_LABEL.notifyPartnerMessage(
                      detail.title,
                      buildParticipantPromisesWebUrl(
                        process.env['EXPO_PUBLIC_WEB_BASE_URL'] ?? '',
                      ),
                    ),
                  })}
                />
              </LfStack>
            </LfCard>
          ) : null}
          {detail.status === 'PENDING' && (
            <LfButton
              label={SCR_A05_LABEL.pendingAction}
              variant="outlined"
              block
              onPress={() => router.push({ pathname: '/invite', params: { promise_id: detail.promise_id } })}
            />
          )}
          {detail.status === 'CHECKING' && (
            <LfButton
              label={SCR_A05_LABEL.checkingAction}
              block
              onPress={() => router.push({ pathname: '/fulfillment/[promise_id]', params: { promise_id: detail.promise_id } })}
            />
          )}
          {detail.status === 'DISPUTED' && (
            <LfButton
              label={SCR_A05_LABEL.disputedAction}
              block
              disabled={busy}
              onPress={() => void reopen()}
            />
          )}
          {detail.status === 'COMPLETED' && (
            <LfRow>
              <LfButton
                label={SCR_A05_LABEL.shareAction}
                variant="outlined"
                grow
                onPress={() =>
                  void Share.share({
                    message: SCR_A05_LABEL.shareMessage(
                      detail.title,
                      PROMISE_STATUS_LABEL.COMPLETED,
                    ),
                  })
                }
              />
              <LfButton
                label={SCR_A05_LABEL.newPromiseAction}
                grow
                onPress={() => router.push('/promise/edit')}
              />
            </LfRow>
          )}
          {canInviteWitness && (
            <LfButton
              label={SCR_A05_LABEL.witnessInviteAction}
              variant="tonal"
              block
              onPress={() => setWitnessSheetOpen(true)}
            />
          )}
          {terminal && (
            <LfButton
              label={SCR_A05_LABEL.hideAction}
              variant="outlined"
              block
              disabled={busy}
              onPress={() => void hideFromList()}
            />
          )}
          {counterpart !== null && (
            <LfRow>
              <LfButton
                label={SCR_A05_LABEL.userReport}
                variant="text"
                grow
                disabled={busy}
                onPress={confirmUserReport}
              />
              <LfButton
                label={SCR_A05_LABEL.userBlock}
                variant="danger"
                grow
                disabled={busy}
                onPress={confirmBlock}
              />
            </LfRow>
          )}
          {actionError && <LfText variant="caption" align="center">{SCR_A05_LABEL.actionFailed}</LfText>}
        </View>
      </ScrollView>
      <WitnessInviteSheet
        visible={witnessSheetOpen}
        promiseId={detail.promise_id}
        onClose={() => setWitnessSheetOpen(false)}
      />
      <PromiseAmendSheet
        visible={amendSheetOpen}
        detail={detail}
        now={new Date()}
        onClose={() => setAmendSheetOpen(false)}
        onSubmit={submitAmend}
        pickEndDate={openEndDatePicker}
        confirmCancel={confirmCancel}
      />
      <VersionHistorySheet
        visible={versionSheetOpen}
        state={versionState}
        onClose={() => setVersionSheetOpen(false)}
      />
      <CompletionCelebrationSheet
        visible={celebration !== null}
        celebration={celebration}
        onShown={acknowledgeCelebrationShown}
        onClose={closeCelebration}
        onNewPromise={createAfterCelebration}
        onShare={shareCelebration}
      />
    </ScreenFrame>
  );
}
