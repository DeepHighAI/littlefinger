import {
  KEEPER_LABEL,
  PARTICIPANT_ROLE_LABEL,
  PROMISE_CATEGORY_LABEL,
  PROMISE_STATUS_LABEL,
  type EvidenceView,
  type FulfillmentCheckView,
  type PromiseDetailPerson,
  type PromiseDetailResponse,
  type PromiseDetailVersion,
} from '@littlefinger/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
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
import { WitnessInviteSheet } from '../../components/witness-invite-sheet.tsx';
import {
  createFulfillmentIdempotencyKey,
  reopenFulfillment,
  signFulfillmentEvidence,
} from '../../lib/fulfillment-native.ts';
import { MobileApiError } from '../../lib/mobile-api.ts';
import { getPromiseDetail } from '../../lib/promise-detail-native.ts';
import {
  claimPresentation,
  detailStatusOf,
  evidenceAvailabilityText,
  fingerprintText,
  formatDetailDate,
  formatDetailDday,
  formatDetailInstant,
  responseFact,
} from '../../screens/scr-a05-detail-state.ts';
import { SCR_A05_LABEL } from '../../screens/scr-a05-labels.ts';
import { colors, gutter, radius, size, space } from '../../theme/tokens';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const WITNESS_INVITE_STATUSES = new Set(['PENDING', 'ACTIVE', 'AMEND_PENDING', 'CHECKING']);

type ScreenPhase = 'loading' | 'ready' | 'not-found' | 'error';

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
  claims: { gap: space[5] },
  claim: { flex: 1, gap: space[3], alignItems: 'center' },
  actions: { gap: space[4] },
  compare: { gap: space[5] },
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

function EvidenceTile({ evidence }: { evidence: EvidenceView }): React.JSX.Element {
  const placeholder = evidenceAvailabilityText(evidence.availability);
  if (placeholder !== null) {
    return (
      <View style={styles.evidence}>
        <LfText variant="disclaimer" align="center">{placeholder}</LfText>
      </View>
    );
  }
  return (
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
  );
}

function ClaimCard({
  check,
  nickname,
}: {
  check: FulfillmentCheckView;
  nickname: string;
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
              <EvidenceTile key={evidence.evidence_id} evidence={evidence} />
            ))}
          </View>
        )}
      </View>
    </LfCard>
  );
}

function VersionSummary({
  label,
  version,
}: {
  label: string;
  version: PromiseDetailVersion;
}): React.JSX.Element {
  return (
    <LfCard>
      <LfStack gap={4}>
        <LfText variant="sectionTitle">{label}</LfText>
        <LfText variant="subtitle">{version.title}</LfText>
        <LfText>{version.body}</LfText>
        <InfoRow label={SCR_A05_LABEL.endDate} value={formatDetailDate(version.end_date)} />
        <LfText variant="caption">{fingerprintText(version.fingerprint)}</LfText>
      </LfStack>
    </LfCard>
  );
}

function FulfillmentSection({ detail }: { detail: PromiseDetailResponse }): React.JSX.Element | null {
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
  const reopenKey = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (promiseId === null) {
      setPhase('not-found');
      return;
    }
    setPhase('loading');
    try {
      setDetail(await getPromiseDetail(promiseId));
      setPhase('ready');
    } catch (error) {
      setPhase(
        error instanceof MobileApiError && error.code === 'E_NOT_FOUND' ? 'not-found' : 'error',
      );
    }
  }, [promiseId]);

  useEffect(() => {
    reopenKey.current = null;
    void refresh();
  }, [refresh]);

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

        {detail.status === 'AMEND_PENDING' && detail.amend_request?.proposed_version !== null && detail.amend_request?.proposed_version !== undefined && (
          <LfStack gap={4}>
            <LfText variant="sectionTitle">{SCR_A05_LABEL.amend}</LfText>
            <View style={styles.compare}>
              <VersionSummary label={SCR_A05_LABEL.before} version={detail.current_version} />
              <VersionSummary label={SCR_A05_LABEL.after} version={detail.amend_request.proposed_version} />
            </View>
            {detail.amend_request.reason !== null && <LfText>{detail.amend_request.reason}</LfText>}
            <LfText variant="caption">{SCR_A05_LABEL.amendReadOnly}</LfText>
          </LfStack>
        )}

        <FulfillmentSection detail={detail} />

        <LfStack gap={4}>
          <LfText variant="sectionTitle">{SCR_A05_LABEL.record}</LfText>
          <LfCard variant="container">
            <View style={styles.info}>
              <LfText variant="caption">{fingerprintText(detail.current_version.fingerprint)}</LfText>
              {detail.activated_at !== null && (
                <LfText variant="caption">{formatDetailInstant(detail.activated_at)}</LfText>
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
        </LfStack>

        {terminalReason !== null && <LfCard><LfText>{terminalReason}</LfText></LfCard>}

        <View style={styles.actions}>
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
          {actionError && <LfText variant="caption" align="center">{SCR_A05_LABEL.actionFailed}</LfText>}
        </View>
      </ScrollView>
      <WitnessInviteSheet
        visible={witnessSheetOpen}
        promiseId={detail.promise_id}
        onClose={() => setWitnessSheetOpen(false)}
      />
    </ScreenFrame>
  );
}
