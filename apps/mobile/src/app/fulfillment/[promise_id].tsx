import {
  FULFILLMENT_COMMENT_MAX,
  EVIDENCE_MAX_COUNT,
  EVIDENCE_MAX_MB,
  KST_MARK,
  codepointLength,
  evidenceMimeOf,
  formatKstDate,
  formatKstDateTime,
  normalizeInput,
  validateEvidences,
  type Answer,
  type EvidenceView,
  type FulfillmentCheckView,
  type FulfillmentRoundView,
  type ParticipantRole,
  type PromiseFulfillmentDetailResponse,
} from '@littlefinger/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAppBar } from '../../components/LfAppBar';
import { LfButton } from '../../components/LfButton';
import { LfCard } from '../../components/LfCard';
import { LfChip } from '../../components/LfChip';
import { LfField } from '../../components/LfField';
import { LfIcon } from '../../components/LfIcon';
import { LfRow } from '../../components/LfRow';
import { LfStack } from '../../components/LfStack';
import { LfText } from '../../components/LfText';
import { LfTextarea } from '../../components/LfTextarea';
import {
  createFulfillmentIdempotencyKey,
  clearFulfillmentEvidenceDraft,
  discardFulfillmentEvidence,
  loadFulfillmentDetail,
  loadFulfillmentEvidenceDraft,
  pickFulfillmentEvidence,
  reopenFulfillment,
  saveFulfillmentEvidenceDraft,
  signFulfillmentEvidence,
  submitFulfillment,
  uploadFulfillmentEvidence,
  type PickedFulfillmentEvidence,
} from '../../lib/fulfillment-native.ts';
import { useLabels, useLocale } from '../../lib/locale-native';
import { MobileApiError } from '../../lib/mobile-api.ts';
import { SCR_A06_LABEL } from '../../screens/scr-a06-labels.ts';
import {
  colors,
  gutter,
  radius,
  size,
  space,
} from '../../theme/tokens';

const CLAIM_ROLES = ['CREATOR', 'PARTNER'] as const;

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
  },
  body: {
    padding: gutter.app,
    paddingBottom: space[9],
    gap: space[6],
  },
  actions: {
    paddingHorizontal: gutter.app,
    paddingTop: space[4],
    paddingBottom: space[6],
    backgroundColor: colors.surfaceChrome,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
  },
  question: { alignItems: 'center' },
  answer: {
    minHeight: size.touchMin + space[9],
    paddingHorizontal: space[8],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[5],
  },
  answerSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  answerText: { flex: 1 },
  counter: { alignItems: 'flex-end' },
  claim: { gap: space[4] },
  statusCard: { alignItems: 'center' },
  evidenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  evidenceTile: {
    width: size.evidenceThumb,
    height: size.evidenceThumb,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  evidenceAdd: {
    borderStyle: 'dashed',
    backgroundColor: colors.background,
    gap: space[2],
  },
  evidenceImage: {
    width: '100%',
    height: '100%',
  },
  evidenceRemove: {
    position: 'absolute',
    top: -space[3],
    right: -space[3],
    minWidth: size.touchMin,
    minHeight: size.touchMin,
    borderRadius: radius.pill,
    backgroundColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 제거 버튼과 좌우 대칭인 좌상단 자리. left/right 를 동시에 주면 버튼이 늘어나므로
  // 우측 기준 오프셋 하나로 계산한다.
  evidenceRetryOffset: {
    right: size.evidenceThumb - size.touchMin + space[3],
  },
  evidenceStatus: {
    position: 'absolute',
    left: space[1],
    right: space[1],
    bottom: space[1],
    padding: space[1],
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceChrome,
  },
  evidencePlaceholder: {
    padding: space[2],
  },
});

type UploadStatus = 'UPLOADING' | 'READY' | 'FAILED';

interface LocalEvidenceUpload {
  local_id: string;
  idempotency_key: string;
  asset: PickedFulfillmentEvidence;
  status: UploadStatus;
  upload_id?: string;
}

function promiseIdOf(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function BackButton({ onPress }: { onPress(): void }): React.JSX.Element {
  const LABEL = useLabels(SCR_A06_LABEL);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={LABEL.back}
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
  const LABEL = useLabels(SCR_A06_LABEL);
  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        title={LABEL.title}
        leading={<BackButton onPress={onBack} />}
      />
      {children}
    </SafeAreaView>
  );
}

function AnswerChoice({
  answer,
  selected,
  onPress,
}: {
  answer: Answer;
  selected: boolean;
  onPress(): void;
}): React.JSX.Element {
  const LABEL = useLabels(SCR_A06_LABEL);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={LABEL.answer[answer]}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.answer, selected && styles.answerSelected]}
    >
      <LfIcon
        name={answer === 'KEPT' ? 'check-circle' : 'cancel'}
        color={selected ? 'primary' : 'textMuted'}
      />
      <View style={styles.answerText}>
        <LfText variant="subtitle">{LABEL.answer[answer]}</LfText>
        <LfText variant="disclaimer">
          {LABEL.answerSubtitle[answer]}
        </LfText>
      </View>
      <LfIcon
        name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
        color={selected ? 'primary' : 'outlineIcon'}
      />
    </Pressable>
  );
}

function EvidenceViewTile({
  evidence,
  onRemove,
}: {
  evidence: EvidenceView;
  onRemove?: () => void;
}): React.JSX.Element {
  const LABEL = useLabels(SCR_A06_LABEL);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const loadThumbnail = useCallback(async () => {
    if (evidence.availability !== 'AVAILABLE') return;
    try {
      const signed = await signFulfillmentEvidence(
        evidence.evidence_id,
        'THUMBNAIL',
      );
      setThumbnailUrl(signed.signed_url);
    } catch {
      setThumbnailUrl(null);
    }
  }, [evidence.availability, evidence.evidence_id]);

  useEffect(() => {
    void loadThumbnail();
  }, [loadThumbnail]);

  if (evidence.availability === 'BLINDED') {
    return (
      <View style={[styles.evidenceTile, styles.evidencePlaceholder]}>
        <LfText variant="disclaimer" align="center">
          {LABEL.evidenceBlinded}
        </LfText>
      </View>
    );
  }
  if (evidence.availability === 'EXPIRED') {
    return (
      <View style={[styles.evidenceTile, styles.evidencePlaceholder]}>
        <LfText variant="disclaimer" align="center">
          {LABEL.evidenceExpired}
        </LfText>
      </View>
    );
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={LABEL.evidenceOpen(evidence.evidence_id)}
        style={styles.evidenceTile}
        onPress={async () => {
          try {
            const signed = await signFulfillmentEvidence(
              evidence.evidence_id,
              'FULL',
            );
            await Linking.openURL(signed.signed_url);
          } catch {
            await loadThumbnail();
          }
        }}
      >
        {thumbnailUrl === null ? (
          <LfIcon name="image" color="textMuted" />
        ) : (
          <Image
            testID={`evidence-image-${evidence.evidence_id}`}
            source={{ uri: thumbnailUrl }}
            resizeMode="cover"
            style={styles.evidenceImage}
            onError={() => void loadThumbnail()}
          />
        )}
      </Pressable>
      {onRemove !== undefined && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={LABEL.evidenceRemove(evidence.evidence_id)}
          onPress={onRemove}
          style={styles.evidenceRemove}
        >
          <LfIcon name="close" color="onPrimary" />
        </Pressable>
      )}
    </View>
  );
}

function LocalEvidenceTile({
  upload,
  onRemove,
  onRetry,
}: {
  upload: LocalEvidenceUpload;
  onRemove(): void;
  onRetry(): void;
}): React.JSX.Element {
  const LABEL = useLabels(SCR_A06_LABEL);
  return (
    <View>
      <View style={styles.evidenceTile}>
        <Image
          source={{ uri: upload.asset.uri }}
          resizeMode="cover"
          style={styles.evidenceImage}
        />
        <View style={styles.evidenceStatus}>
          <LfText variant="disclaimer" align="center">
            {upload.status === 'UPLOADING'
              ? LABEL.evidenceUploading
              : upload.status === 'READY'
                ? LABEL.evidenceReady
                : LABEL.evidenceFailed}
          </LfText>
        </View>
      </View>
      {upload.status === 'FAILED' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={LABEL.evidenceRetry}
          onPress={onRetry}
          style={[styles.evidenceRemove, styles.evidenceRetryOffset]}
        >
          <LfIcon name="refresh" color="onPrimary" />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={LABEL.evidenceRemove(upload.local_id)}
        disabled={upload.status === 'UPLOADING'}
        onPress={onRemove}
        style={styles.evidenceRemove}
      >
        <LfIcon name="close" color="onPrimary" />
      </Pressable>
    </View>
  );
}

function ClaimCard({ check }: { check: FulfillmentCheckView }): React.JSX.Element {
  const LABEL = useLabels(SCR_A06_LABEL);
  return (
    <LfCard testID={`claim-${check.role}`}>
      <View style={styles.claim}>
        <LfRow>
          <View style={styles.answerText}>
            <LfText variant="sectionTitle">
              {LABEL.role(check.role)}
            </LfText>
          </View>
          <LfChip
            label={LABEL.answer[check.answer]}
            tone="status"
          />
        </LfRow>
        <LfText>
          {check.comment === null || check.comment.length === 0
            ? LABEL.noComment
            : check.comment}
        </LfText>
        {check.evidences.length > 0 && (
          <View style={styles.evidenceRow}>
            {check.evidences.map((evidence) => (
              <EvidenceViewTile key={evidence.evidence_id} evidence={evidence} />
            ))}
          </View>
        )}
        <LfRow>
          <View style={styles.answerText}>
            <LfText variant="caption">{LABEL.submittedAt}</LfText>
          </View>
          <LfText variant="caption">
            {`${formatKstDateTime(new Date(check.submitted_at))}${KST_MARK}`}
          </LfText>
        </LfRow>
      </View>
    </LfCard>
  );
}

function checksByRole(
  own: FulfillmentCheckView | null,
  partner: FulfillmentCheckView | null,
): Record<Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>, FulfillmentCheckView | null> {
  const checks = { CREATOR: null, PARTNER: null } as Record<
    Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>,
    FulfillmentCheckView | null
  >;
  if (own !== null) checks[own.role] = own;
  if (partner !== null) checks[partner.role] = partner;
  return checks;
}

function submissionsByRole(
  detail: PromiseFulfillmentDetailResponse,
): Record<Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>, boolean> {
  return {
    CREATOR: detail.creator_has_submitted,
    PARTNER: detail.partner_has_submitted,
  };
}

function RoundHistory({ round }: { round: FulfillmentRoundView }): React.JSX.Element {
  const LABEL = useLabels(SCR_A06_LABEL);
  return (
    <LfStack gap={4}>
      <LfText variant="sectionTitle">
        {LABEL.roundHistory(round.round_no)}
      </LfText>
      {round.creator_check !== null && <ClaimCard check={round.creator_check} />}
      {round.partner_check !== null && <ClaimCard check={round.partner_check} />}
    </LfStack>
  );
}

export default function FulfillmentScreen(): React.JSX.Element {
  const LABEL = useLabels(SCR_A06_LABEL);
  const { locale } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ promise_id?: string | string[] }>();
  const promiseId = promiseIdOf(params.promise_id);
  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [detail, setDetail] = useState<PromiseFulfillmentDetailResponse | null>(
    null,
  );
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [uploads, setUploads] = useState<LocalEvidenceUpload[]>([]);
  const [retainedEvidenceIds, setRetainedEvidenceIds] = useState<string[]>([]);
  const [evidenceMessages, setEvidenceMessages] = useState<string[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const submitIdempotencyKey = useRef<string | null>(null);
  const reopenIdempotencyKey = useRef<string | null>(null);
  const loadedDraftKey = useRef<string | null>(null);

  const refresh = useCallback(
    async (): Promise<PromiseFulfillmentDetailResponse | null> => {
      if (promiseId === null) {
        setPhase('not-found');
        return null;
      }
      try {
        const nextDetail = await loadFulfillmentDetail(promiseId);
        setDetail(nextDetail);
        setPhase('ready');
        return nextDetail;
      } catch (error) {
        setPhase(
          error instanceof MobileApiError && error.code === 'E_NOT_FOUND'
            ? 'not-found'
            : 'error',
        );
        return null;
      }
    },
    [promiseId],
  );

  useEffect(() => {
    submitIdempotencyKey.current = null;
    reopenIdempotencyKey.current = null;
    loadedDraftKey.current = null;
    setDraftReady(false);
    setUploads([]);
    setRetainedEvidenceIds([]);
    setEvidenceMessages([]);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const counterpartRole =
      detail?.my_role === 'CREATOR' ? 'PARTNER' : 'CREATOR';
    const canRestoreRevision =
      detail?.my_check !== null &&
      detail?.my_check !== undefined &&
      detail.my_check.revised_at === null &&
      !submissionsByRole(detail)[counterpartRole];
    if (
      promiseId === null ||
      detail === null ||
      detail.status !== 'CHECKING' ||
      (detail.my_check !== null && !canRestoreRevision)
    ) {
      return;
    }
    const key = `${promiseId}.${detail.check_round_no}`;
    if (loadedDraftKey.current === key) return;
    loadedDraftKey.current = key;
    void loadFulfillmentEvidenceDraft(promiseId, detail.check_round_no)
      .then((draft) => {
        if (draft !== null) {
          setAnswer(draft.answer);
          setComment(draft.comment);
          setRetainedEvidenceIds(draft.retained_evidence_ids);
          if (detail.my_check !== null) setEditing(true);
          setUploads(
            draft.uploads.map((upload) => ({
              local_id: upload.local_id,
              idempotency_key: upload.idempotency_key,
              asset: {
                uri: upload.uri,
                file_name: upload.local_id,
                mime: upload.mime,
                bytes: upload.bytes,
              },
              status: 'READY',
              upload_id: upload.upload_id,
            })),
          );
        }
      })
      .catch(() => undefined)
      .finally(() => setDraftReady(true));
  }, [detail, promiseId]);

  useEffect(() => {
    if (
      !draftReady ||
      promiseId === null ||
      detail === null ||
      detail.status !== 'CHECKING' ||
      (detail.my_check !== null && !editing)
    ) {
      return;
    }
    void saveFulfillmentEvidenceDraft(promiseId, detail.check_round_no, {
      answer,
      comment,
      uploads: uploads.flatMap((upload) =>
        upload.status === 'READY' && upload.upload_id !== undefined
          ? [
              {
                local_id: upload.local_id,
                upload_id: upload.upload_id,
                idempotency_key: upload.idempotency_key,
                uri: upload.asset.uri,
                mime: upload.asset.mime,
                bytes: upload.asset.bytes,
              },
            ]
          : [],
      ),
      retained_evidence_ids: retainedEvidenceIds,
    }).catch(() => undefined);
  }, [
    answer,
    comment,
    detail,
    draftReady,
    editing,
    promiseId,
    retainedEvidenceIds,
    uploads,
  ]);

  const commentLength = codepointLength(comment);
  const commentInvalid = commentLength > FULFILLMENT_COMMENT_MAX;

  function startRevision(): void {
    if (detail?.my_check === null || detail?.my_check === undefined) return;
    submitIdempotencyKey.current = null;
    setAnswer(detail.my_check.answer);
    setComment(detail.my_check.comment ?? '');
    setUploads([]);
    setRetainedEvidenceIds(
      detail.my_check.evidences.map((evidence) => evidence.evidence_id),
    );
    setEvidenceMessages([]);
    setDraftReady(true);
    setEditing(true);
    setActionMessage(null);
  }

  async function runEvidenceUpload(upload: LocalEvidenceUpload): Promise<void> {
    if (promiseId === null || detail === null) return;
    try {
      const response = await uploadFulfillmentEvidence(
        promiseId,
        detail.check_round_no,
        upload.asset,
        upload.idempotency_key,
      );
      setUploads((current) =>
        current.map((item) =>
          item.local_id === upload.local_id
            ? { ...item, status: 'READY', upload_id: response.upload_id }
            : item,
        ),
      );
    } catch {
      setUploads((current) =>
        current.map((item) =>
          item.local_id === upload.local_id
            ? { ...item, status: 'FAILED' }
            : item,
        ),
      );
    }
  }

  async function addEvidence(): Promise<void> {
    if (detail === null) return;
    const remaining =
      EVIDENCE_MAX_COUNT - retainedEvidenceIds.length - uploads.length;
    if (remaining <= 0) return;

    let picked;
    try {
      picked = await pickFulfillmentEvidence(remaining);
    } catch {
      setActionMessage(LABEL.actionError);
      return;
    }
    if (picked.status === 'DENIED') {
      setEvidenceMessages([LABEL.evidencePermissionDenied]);
      return;
    }
    if (picked.status !== 'SELECTED') return;

    const messages = new Set<string>();
    const accepted: PickedFulfillmentEvidence[] = [];
    for (const asset of picked.assets.slice(0, remaining)) {
      if (
        asset.bytes < 0 ||
        asset.bytes > EVIDENCE_MAX_MB * 1024 * 1024
      ) {
        messages.add(LABEL.evidenceSize(EVIDENCE_MAX_MB));
        continue;
      }
      if (
        !validateEvidences([
          {
            mime: evidenceMimeOf(asset.mime, asset.file_name),
            bytes: asset.bytes,
          },
        ]).valid
      ) {
        messages.add(LABEL.evidenceType);
        continue;
      }
      accepted.push(asset);
    }
    setEvidenceMessages([...messages]);
    const pending = accepted.map((asset) => {
      const idempotencyKey = createFulfillmentIdempotencyKey();
      return {
        local_id: idempotencyKey,
        idempotency_key: idempotencyKey,
        asset,
        status: 'UPLOADING' as const,
      };
    });
    if (pending.length === 0) return;

    submitIdempotencyKey.current = null;
    setUploads((current) => [...current, ...pending]);
    await Promise.all(pending.map(runEvidenceUpload));
  }

  async function removeUpload(upload: LocalEvidenceUpload): Promise<void> {
    if (upload.status === 'UPLOADING') return;
    if (upload.status === 'READY' && upload.upload_id !== undefined) {
      try {
        await discardFulfillmentEvidence(
          upload.upload_id,
          createFulfillmentIdempotencyKey(),
        );
      } catch {
        setActionMessage(LABEL.actionError);
        return;
      }
    }
    submitIdempotencyKey.current = null;
    setUploads((current) =>
      current.filter((item) => item.local_id !== upload.local_id),
    );
  }

  function retryUpload(upload: LocalEvidenceUpload): void {
    submitIdempotencyKey.current = null;
    const retry = { ...upload, status: 'UPLOADING' as const };
    setUploads((current) =>
      current.map((item) => (item.local_id === upload.local_id ? retry : item)),
    );
    void runEvidenceUpload(retry);
  }

  async function submit(): Promise<void> {
    if (
      promiseId === null ||
      answer === null ||
      commentInvalid ||
      uploads.some((upload) => upload.status === 'UPLOADING') ||
      busy
    ) {
      return;
    }
    setBusy(true);
    setActionMessage(null);
    const key =
      submitIdempotencyKey.current ?? createFulfillmentIdempotencyKey();
    submitIdempotencyKey.current = key;
    try {
      const evidenceUploadIds = uploads.flatMap((upload) =>
        upload.status === 'READY' && upload.upload_id !== undefined
          ? [upload.upload_id]
          : [],
      );
      const result = await submitFulfillment(
        {
          promise_id: promiseId,
          answer,
          ...(comment.length > 0 ? { comment } : {}),
          ...(editing ? { revise: true } : {}),
          ...(evidenceUploadIds.length > 0
            ? { evidence_upload_ids: evidenceUploadIds }
            : {}),
          ...(editing && retainedEvidenceIds.length > 0
            ? { retained_evidence_ids: retainedEvidenceIds }
            : {}),
        },
        key,
      );
      await clearFulfillmentEvidenceDraft(
        promiseId,
        detail?.check_round_no ?? 1,
      ).catch(() => undefined);
      submitIdempotencyKey.current = null;
      setEditing(false);
      setAnswer(null);
      setComment('');
      setUploads([]);
      setRetainedEvidenceIds([]);
      setDraftReady(false);
      if (result.status === 'COMPLETED') {
        router.replace({
          pathname: '/promise/[promise_id]',
          params: { promise_id: promiseId },
        });
        return;
      }
      await refresh();
    } catch (error) {
      if (error instanceof MobileApiError && error.code === 'E_STATE_CONFLICT') {
        setActionMessage(
          detail?.status === 'ACTIVE' || detail?.checking_started_at === null
            ? LABEL.beforeChecking
            : LABEL.alreadyClosed,
        );
        const nextDetail = await refresh();
        if (
          nextDetail?.my_check?.answer === answer &&
          (nextDetail.my_check.comment ?? '') === comment
        ) {
          submitIdempotencyKey.current = null;
        }
      } else {
        setActionMessage(LABEL.actionError);
      }
    } finally {
      setBusy(false);
    }
  }

  async function reopen(): Promise<void> {
    if (promiseId === null || busy) return;
    setBusy(true);
    setActionMessage(null);
    const key =
      reopenIdempotencyKey.current ?? createFulfillmentIdempotencyKey();
    reopenIdempotencyKey.current = key;
    const previousRound = detail?.check_round_no ?? 0;
    try {
      await reopenFulfillment(promiseId, key);
      reopenIdempotencyKey.current = null;
      await refresh();
    } catch (error) {
      if (error instanceof MobileApiError && error.code === 'E_STATE_CONFLICT') {
        const nextDetail = await refresh();
        if (
          nextDetail?.status === 'CHECKING' &&
          nextDetail.check_round_no > previousRound
        ) {
          reopenIdempotencyKey.current = null;
        }
      } else {
        setActionMessage(LABEL.actionError);
      }
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'loading') {
    return (
      <ScreenFrame onBack={() => router.back()}>
        <View style={styles.centered}>
          <LfText secondary>{LABEL.loading}</LfText>
        </View>
      </ScreenFrame>
    );
  }

  if (phase === 'not-found') {
    return (
      <ScreenFrame onBack={() => router.back()}>
        <View style={styles.centered}>
          <LfText secondary align="center">
            {LABEL.notFound}
          </LfText>
        </View>
      </ScreenFrame>
    );
  }

  if (phase === 'error' || detail === null) {
    return (
      <ScreenFrame onBack={() => router.back()}>
        <View style={styles.centered}>
          <LfStack gap={5} center>
            <LfText secondary align="center">
              {LABEL.loadError}
            </LfText>
            <LfButton
              label={LABEL.retry}
              variant="outlined"
              onPress={() => {
                setPhase('loading');
                void refresh();
              }}
            />
          </LfStack>
        </View>
      </ScreenFrame>
    );
  }

  const isChecking = detail.status === 'CHECKING';
  const canAnswer = isChecking && detail.my_check === null;
  const showForm = canAnswer || editing;
  const currentChecks = checksByRole(detail.my_check, detail.partner_check);
  const currentSubmissions = submissionsByRole(detail);
  const counterpartRole = detail.my_role === 'CREATOR' ? 'PARTNER' : 'CREATOR';
  const counterpartHasSubmitted = currentSubmissions[counterpartRole];
  const retainedEvidences =
    editing && detail.my_check !== null
      ? detail.my_check.evidences.filter((evidence) =>
          retainedEvidenceIds.includes(evidence.evidence_id),
        )
      : [];
  const evidenceSlotCount = retainedEvidences.length + uploads.length;
  const failedUploadCount = uploads.filter(
    (upload) => upload.status === 'FAILED',
  ).length;
  const evidenceUploading = uploads.some(
    (upload) => upload.status === 'UPLOADING',
  );
  const isUnresolved = detail.status === 'UNRESOLVED';
  const isResult = ['COMPLETED', 'BROKEN', 'DISPUTED', 'UNRESOLVED'].includes(
    detail.status,
  );

  return (
    <ScreenFrame onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.body}>
        <LfCard>
          <LfStack gap={3}>
            <LfText variant="subtitle">{detail.title}</LfText>
            <LfText variant="caption">
              {LABEL.endDate(formatKstDate(detail.end_date, locale))}
              {KST_MARK}
            </LfText>
            <LfText variant="caption">
              {LABEL.keeper(detail.keeper)}
            </LfText>
          </LfStack>
        </LfCard>

        {actionMessage !== null && (
          <LfCard variant="container">
            <LfText align="center">{actionMessage}</LfText>
          </LfCard>
        )}

        {showForm && (
          <>
            <View style={styles.question}>
              <LfText variant="headline" align="center">
                {LABEL.question}
              </LfText>
              <LfText variant="caption" align="center">
                {LABEL.sameQuestion}
              </LfText>
            </View>
            <LfStack
              gap={4}
              accessibilityRole="radiogroup"
              accessibilityLabel={LABEL.answerLegend}
            >
              {(['KEPT', 'NOT_KEPT'] as const).map((value) => (
                <AnswerChoice
                  key={value}
                  answer={value}
                  selected={answer === value}
                  onPress={() => {
                    if (answer !== value) submitIdempotencyKey.current = null;
                    setAnswer(value);
                  }}
                />
              ))}
            </LfStack>
            <LfField
              label={LABEL.comment}
              optional
              error={
                commentInvalid
                  ? LABEL.commentLimit(FULFILLMENT_COMMENT_MAX)
                  : undefined
              }
            >
              <LfTextarea
                accessibilityLabel={LABEL.comment}
                placeholder={LABEL.commentPlaceholder}
                value={comment}
                onChangeText={(value) => {
                  const normalized = normalizeInput(value);
                  if (comment !== normalized) submitIdempotencyKey.current = null;
                  setComment(normalized);
                }}
              />
              <View style={styles.counter}>
                <LfText variant="caption">
                  {commentLength}/{FULFILLMENT_COMMENT_MAX}
                </LfText>
              </View>
            </LfField>
            <LfField label={LABEL.evidence} optional>
              <View style={styles.evidenceRow}>
                {retainedEvidences.map((evidence) => (
                  <EvidenceViewTile
                    key={evidence.evidence_id}
                    evidence={evidence}
                    onRemove={() => {
                      submitIdempotencyKey.current = null;
                      setRetainedEvidenceIds((current) =>
                        current.filter((id) => id !== evidence.evidence_id),
                      );
                    }}
                  />
                ))}
                {uploads.map((upload) => (
                  <LocalEvidenceTile
                    key={upload.local_id}
                    upload={upload}
                    onRemove={() => void removeUpload(upload)}
                    onRetry={() => retryUpload(upload)}
                  />
                ))}
                {evidenceSlotCount < EVIDENCE_MAX_COUNT && (
                  <Pressable
                    testID="evidence-picker"
                    accessibilityRole="button"
                    accessibilityLabel={LABEL.evidenceAdd}
                    style={[styles.evidenceTile, styles.evidenceAdd]}
                    onPress={() => void addEvidence()}
                  >
                    <LfIcon name="photo-camera" color="textMuted" />
                    <LfText variant="caption">
                      {LABEL.evidenceAdd}
                    </LfText>
                  </Pressable>
                )}
              </View>
              <LfText variant="caption">{LABEL.evidenceHint}</LfText>
              {evidenceMessages.map((message) => (
                <LfText key={message} variant="caption">
                  {message}
                </LfText>
              ))}
              {failedUploadCount > 0 && (
                <LfText variant="caption">
                  {LABEL.evidenceUploadFailed(failedUploadCount)}
                </LfText>
              )}
            </LfField>
            {canAnswer && counterpartHasSubmitted && (
              <LfCard variant="container">
                <LfText align="center">{LABEL.counterpartFirst}</LfText>
              </LfCard>
            )}
          </>
        )}

        {isChecking && detail.my_check !== null && !editing && (
          <LfStack gap={5}>
            <LfCard variant="container">
              <LfText align="center">{LABEL.waiting}</LfText>
            </LfCard>
            <ClaimCard check={detail.my_check} />
            {detail.my_check.revised_at === null &&
            !counterpartHasSubmitted ? (
              <LfButton
                label={LABEL.revise}
                variant="outlined"
                block
                disabled={busy}
                onPress={startRevision}
              />
            ) : (
              <LfText variant="caption" align="center">
                {LABEL.revisionUsed}
              </LfText>
            )}
          </LfStack>
        )}

        {isResult && (
          <LfStack gap={5}>
            <View style={styles.statusCard}>
              <LfChip
                label={LABEL.status(detail.status)}
                tone="status"
              />
            </View>
            {detail.status === 'DISPUTED' && (
              <LfCard variant="container">
                <LfText align="center">{LABEL.disputed}</LfText>
              </LfCard>
            )}
            <LfText variant="sectionTitle">
              {LABEL.currentResult}
            </LfText>
            {isUnresolved
              ? CLAIM_ROLES.map((role) => (
                  <LfText key={role}>
                    {currentSubmissions[role]
                      ? LABEL.responseDone(role)
                      : LABEL.responseMissing(role)}
                  </LfText>
                ))
              : CLAIM_ROLES.map((role) =>
                  currentChecks[role] === null ? null : (
                    <ClaimCard key={role} check={currentChecks[role]} />
                  ),
                )}
            {detail.status === 'DISPUTED' && (
              <LfButton
                label={LABEL.reopen}
                variant="filled"
                block
                disabled={busy}
                onPress={() => void reopen()}
              />
            )}
          </LfStack>
        )}

        {detail.history.length > 0 && (
          <LfStack gap={5}>
            <LfText variant="subtitle">{LABEL.history}</LfText>
            {[...detail.history]
              .sort((left, right) => left.round_no - right.round_no)
              .map((round) => (
                <RoundHistory key={round.round_no} round={round} />
              ))}
          </LfStack>
        )}
      </ScrollView>

      {showForm && (
        <View style={styles.actions}>
          <LfButton
            label={editing ? LABEL.reviseSubmit : LABEL.submit}
            size="cta"
            block
            disabled={
              answer === null || commentInvalid || evidenceUploading || busy
            }
            onPress={() => void submit()}
          />
        </View>
      )}
    </ScreenFrame>
  );
}
