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
import { LfAvatar } from '../../components/LfAvatar';
import { LfButton } from '../../components/LfButton';
import { LfCard } from '../../components/LfCard';
import { LfChip } from '../../components/LfChip';
import { LfField } from '../../components/LfField';
import { LfIcon } from '../../components/LfIcon';
import { LfRow } from '../../components/LfRow';
import { LfStack } from '../../components/LfStack';
import { LfStatusTile } from '../../components/LfStatusTile';
import { LfInkContext, LfText } from '../../components/LfText';
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
import { useKeyboardScroll } from '../../lib/use-keyboard-scroll.ts';
import { SCR_A06_LABEL } from '../../screens/scr-a06-labels.ts';
import { statusToneOf } from '../../screens/status-tone.ts';
import {
  border,
  colors,
  elevation,
  gutter,
  radius,
  size,
  space,
} from '../../theme/tokens';

const CLAIM_ROLES = ['CREATOR', 'PARTNER'] as const;

type ScreenPhase = 'loading' | 'ready' | 'not-found' | 'error';

/** README 본문 상단 22 · 라디오 24/12 · 썸네일 글리프 24 · 제거 버튼 22/14 · 대기 아이콘 20 — 토큰 없음, ADR 0020 예외 */
const BODY_TOP = 22;
const RADIO_SIZE = 24;
const RADIO_DOT = 12;
const PROOF_ICON = 24;
const REMOVE_SIZE = 22;
const REMOVE_ICON = 14;
const REMOVE_HIT_SLOP = (size.touchMin - REMOVE_SIZE) / 2;
const PARTNER_ICON = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: gutter.app,
  },
  // 본문 22 20 20 16 · 블록 간 14
  body: {
    paddingTop: BODY_TOP,
    paddingRight: space[8],
    paddingBottom: space[8],
    paddingLeft: gutter.app,
    gap: space[6],
  },
  // 하단 액션 — 주 CTA 하나를 오른쪽에 (`.lf-screen__actions--end`)
  actions: {
    alignItems: 'flex-end',
    paddingHorizontal: space[8],
    paddingTop: space[5],
    paddingBottom: space[7],
    backgroundColor: colors.background,
  },
  question: { paddingTop: space[3], paddingHorizontal: space[1], gap: space[2] },
  // 선택 카드 — 종이 r14 2.5 잉크, 선택 = 옐로 + 5px (`.lf-answer`)
  answer: {
    minHeight: size.touchMin + space[9],
    paddingVertical: space[7],
    paddingHorizontal: size.cardPadding,
    borderRadius: radius.xl,
    borderWidth: border.card,
    borderColor: colors.text,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[5],
  },
  answerSelected: { backgroundColor: colors.primaryContainer, ...elevation.card },
  answerText: { flex: 1, minWidth: 0 },
  // 라디오 24 잉크 링, 선택되면 12 잉크 점
  radio: {
    width: RADIO_SIZE,
    height: RADIO_SIZE,
    borderRadius: radius.pill,
    borderWidth: border.chip,
    borderColor: colors.text,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: RADIO_DOT,
    height: RADIO_DOT,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  counter: { alignItems: 'flex-end' },
  claim: { gap: space[4] },
  statusCard: { alignItems: 'center' },
  evidenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
  },
  // 증빙 타일 84 r12 2px 잉크 + 3px (`.lf-proof--thumb`). 그림자가 잘리지 않게 overflow 는 이미지가 맡는다
  evidenceTile: {
    width: size.thumbLg,
    height: size.thumbLg,
    borderRadius: radius['2xl'],
    borderWidth: border.chip,
    borderColor: colors.text,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    ...elevation.sm,
  },
  // 사진 추가 — 점선 2px, 면·그림자 없음 (`.lf-proof--dashed`)
  evidenceAdd: {
    borderStyle: 'dashed',
    borderColor: colors.outlineStrong,
    backgroundColor: 'transparent',
    boxShadow: [],
  },
  evidenceFileName: { width: size.thumbLg, marginTop: space[1] },
  evidenceImage: {
    width: '100%',
    height: '100%',
    borderRadius: radius['2xl'] - border.chip,
  },
  // 타일 우상단 제거 버튼 22 잉크 원 — hitSlop 으로 48 (`.lf-proof__remove`)
  evidenceRemove: {
    position: 'absolute',
    top: -space[3],
    right: -space[3],
    width: REMOVE_SIZE,
    height: REMOVE_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 제거 버튼과 좌우 대칭인 좌상단 자리. left/right 를 동시에 주면 버튼이 늘어나므로
  // 우측 기준 오프셋 하나로 계산한다.
  evidenceRetryOffset: {
    right: size.thumbLg - REMOVE_SIZE + space[3],
  },
  evidenceStatus: {
    position: 'absolute',
    left: space[1],
    right: space[1],
    bottom: space[1],
    padding: space[1],
    borderRadius: radius.xs,
    backgroundColor: colors.surface,
  },
  evidencePlaceholder: {
    padding: space[2],
  },
  // 상대 응답 대기 행 — flat 카드 (`.lf-partner-status`)
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  partnerText: { flex: 1, minWidth: 0 },
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
        leading="back"
        leadingAccessibilityLabel={LABEL.back}
        onLeadingPress={onBack}
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
      {/* 선택(옐로 면)되면 부제도 잉크로 — 색만으로 구분하지 않고 라디오 점이 함께 말한다 */}
      <LfInkContext.Provider value={selected}>
        <LfStatusTile
          icon={answer === 'KEPT' ? 'check' : 'close'}
          tone={answer === 'KEPT' ? 'mint' : 'pink'}
        />
        <View style={styles.answerText}>
          <LfText variant="stamp">{LABEL.answer[answer]}</LfText>
          <LfText variant="disclaimer">{LABEL.answerSubtitle[answer]}</LfText>
        </View>
        <View style={styles.radio}>{selected ? <View style={styles.radioDot} /> : null}</View>
      </LfInkContext.Provider>
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
          <LfIcon name="image" size={PROOF_ICON} color="text" />
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
          hitSlop={REMOVE_HIT_SLOP}
          onPress={onRemove}
          style={styles.evidenceRemove}
        >
          <LfIcon name="close" size={REMOVE_ICON} color="onAction" />
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
          hitSlop={REMOVE_HIT_SLOP}
          onPress={onRetry}
          style={[styles.evidenceRemove, styles.evidenceRetryOffset]}
        >
          <LfIcon name="refresh" size={REMOVE_ICON} color="onAction" />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={LABEL.evidenceRemove(upload.local_id)}
        disabled={upload.status === 'UPLOADING'}
        hitSlop={REMOVE_HIT_SLOP}
        onPress={onRemove}
        style={styles.evidenceRemove}
      >
        <LfIcon name="close" size={REMOVE_ICON} color="onAction" />
      </Pressable>
      <View style={styles.evidenceFileName}>
        <LfText variant="eyebrow" align="center" numberOfLines={1}>
          {upload.asset.file_name}
        </LfText>
      </View>
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
            <LfText variant="eyebrow">
              {LABEL.role(check.role)}
            </LfText>
          </View>
          <LfChip
            label={LABEL.answer[check.answer]}
            tone="paper"
            kind="status"
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
      <LfText variant="eyebrow">
        {LABEL.roundHistory(round.round_no)}
      </LfText>
      {round.creator_check !== null && <ClaimCard check={round.creator_check} />}
      {round.partner_check !== null && <ClaimCard check={round.partner_check} />}
    </LfStack>
  );
}

export default function FulfillmentScreen(): React.JSX.Element {
  const keyboard = useKeyboardScroll(true);
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

  const normalizedComment = normalizeInput(comment);
  const commentLength = codepointLength(normalizedComment);
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
          ...(normalizedComment.length > 0 ? { comment: normalizedComment } : {}),
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
          (nextDetail.my_check.comment ?? '') === normalizedComment
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
            <LfText variant="error" align="center">
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
      <ScrollView
        ref={keyboard.scrollRef}
        keyboardShouldPersistTaps="handled"
        onScroll={keyboard.onScroll}
        scrollEventThrottle={16}
        onLayout={() => keyboard.reveal()}
        onContentSizeChange={() => keyboard.reveal()}
        contentContainerStyle={[styles.body, { paddingBottom: space[8] + keyboard.inset }]}
      >
        <LfCard tone="muted" shadow={false}>
          <LfStack gap={1}>
            <LfText variant="bodyStrong">{detail.title}</LfText>
            <LfText variant="meta">
              {detail.end_date === null
                ? LABEL.noEndDate
                : `${LABEL.endDate(formatKstDate(detail.end_date, locale))}${KST_MARK}`}
            </LfText>
            <LfText variant="meta">
              {LABEL.keeper(detail.keeper)}
            </LfText>
          </LfStack>
        </LfCard>

        {actionMessage !== null && (
          <LfCard tone="yellow">
            <LfText align="center">{actionMessage}</LfText>
          </LfCard>
        )}

        {showForm && (
          <>
            <View style={styles.question}>
              <LfText variant="title">{LABEL.question}</LfText>
              <LfText variant="bodySm" secondary>{LABEL.sameQuestion}</LfText>
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
                onFocus={keyboard.onFocus}
                onChangeText={(value) => {
                  if (comment !== value) submitIdempotencyKey.current = null;
                  setComment(value);
                }}
              />
              <View style={styles.counter}>
                <LfText variant="meta">
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
                    <LfIcon name="photo_camera" size={PROOF_ICON} color="textMuted" />
                    <LfText variant="eyebrow">
                      {LABEL.evidenceAdd}
                    </LfText>
                  </Pressable>
                )}
              </View>
              <LfText variant="meta" secondary>{LABEL.evidenceHint}</LfText>
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
              <LfCard tone="yellow">
                <LfText align="center">{LABEL.counterpartFirst}</LfText>
              </LfCard>
            )}
          </>
        )}

        {isChecking && detail.my_check !== null && !editing && (
          <LfStack gap={5}>
            <LfCard shadow={false}>
              <View style={styles.partnerRow}>
                <LfAvatar
                  size="sm"
                  pending
                  nickname="?"
                  profileImageUrl={null}
                  accessibilityLabel={LABEL.role(counterpartRole)}
                />
                <View style={styles.partnerText}>
                  <LfText variant="note">{LABEL.waiting}</LfText>
                </View>
                <LfIcon name="hourglass_empty" size={PARTNER_ICON} color="textMuted" />
              </View>
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
                tone={statusToneOf(detail.status)}
                kind="status"
              />
            </View>
            {detail.status === 'DISPUTED' && (
              <LfCard tone="yellow">
                <LfText align="center">{LABEL.disputed}</LfText>
              </LfCard>
            )}
            <LfText variant="eyebrow">
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
            trailing="check"
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
