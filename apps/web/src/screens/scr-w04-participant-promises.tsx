import {
  EVIDENCE_MAX_COUNT,
  EVIDENCE_MAX_MB,
  FULFILLMENT_COMMENT_MAX,
  KEEPER_LABEL,
  KST_MARK,
  PARTICIPANT_ROLE_LABEL,
  PROMISE_CATEGORY_LABEL,
  PROMISE_STATUS_LABEL,
  changedPromiseFields,
  codepointLength,
  evidenceMimeOf,
  formatKstDate,
  formatKstDateTime,
  normalizeInput,
  validateAmendReason,
  validateBody,
  validateCategory,
  validateEndDate,
  validateKeeper,
  validatePenalty,
  validateReward,
  validateTitle,
  validateEvidences,
  type Answer,
  type EvidenceView,
  type FulfillmentCheckView,
  type ParticipantPromiseSummary,
  type ParticipantRole,
  type PromiseAmendCreateRequest,
  type PromiseAmendDecision,
  type PromiseAmendProposal,
  type PromiseCategory,
  type PromiseDetailResponse,
  type PromiseFulfillmentDetailResponse,
  type PromiseVersionListResponse,
  type Keeper,
} from '@littlefinger/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { GoogleMark } from '../components/google-mark.tsx';
import { LfIcon } from '../components/LfIcon.tsx';
import { TestLoginForm } from '../components/test-login-form.tsx';
import {
  discardFulfillmentEvidence,
  FulfillmentApiError,
  getPromiseFulfillmentDetail,
  listParticipantPromises,
  reopenFulfillment,
  signFulfillmentEvidence,
  submitFulfillment,
  uploadFulfillmentEvidence,
} from '../lib/fulfillment-api.ts';
import { INTERNAL_MESSAGE } from '../lib/api-failure.ts';
import {
  getPromiseAmendDetail,
  listPromiseVersions,
  PromiseAmendApiError,
  requestPromiseAmend,
  respondPromiseAmend,
  withdrawPromiseAmend,
} from '../lib/promise-amend-api.ts';
import { getSupabase } from '../lib/supabase.ts';
import { signInWithGoogle, signInWithKakao } from '../lib/web-auth.ts';
import { promisesPath } from '../routes.ts';
import { PinkyBadge } from './scr-w01-invite-landing.tsx';

const PAGE_TITLE = '참여 중인 약속';
const RESPONSE_COUNT_PREFIX = '응답이 필요해요';
const SIGN_IN_CTA = '카카오 로그인';
const GOOGLE_SIGN_IN_CTA = 'Google 로그인';
const RETRY_CTA = '다시 시도';
const EMPTY_COPY = '참여 중인 약속이 아직 없어요';
const MY_RESPONSE_PENDING = '내 응답 전';
const COUNTERPART_RESPONSE_PENDING = '상대방 응답 전';
const COUNTERPART_SUBMITTED = '상대방이 먼저 응답했어요';
const WAITING_COPY = '상대방의 응답을 기다리고 있어요';
const RESPONSE_QUESTION = '약속이 지켜졌나요?';
const COMMENT_LABEL = '한 줄 의견';
const SUBMIT_CTA = '응답 제출';
const REVISE_CTA = '응답 수정';
const REVISE_SUBMIT_CTA = '수정 제출';
const REOPEN_CTA = '다시 확인 요청하기';
const DISPUTED_COPY = '두 분의 확인이 서로 달라요. 대화로 다시 정해보세요.';
const COMMENT_LIMIT_COPY = `의견은 ${FULFILLMENT_COMMENT_MAX}자 이하로 입력해 주세요.`;
const EVIDENCE_LABEL = '증빙 사진';
const EVIDENCE_INPUT_LABEL = '증빙 사진 선택';
const EVIDENCE_ADD = '사진 추가';
const EVIDENCE_HINT = '상대와 증인에게 공개돼요';
const EVIDENCE_TYPE_COPY = 'JPEG, PNG, WEBP, HEIC 사진만 올릴 수 있어요.';
const EVIDENCE_SIZE_COPY = `사진은 장당 ${EVIDENCE_MAX_MB}MB까지 올릴 수 있어요.`;
const EVIDENCE_COUNT_COPY = `사진은 최대 ${EVIDENCE_MAX_COUNT}장까지 올릴 수 있어요.`;
const EVIDENCE_UPLOADING = '업로드 중';
const EVIDENCE_READY = '업로드 완료';
const EVIDENCE_FAILED = '업로드 실패';
const EVIDENCE_RETRY = '다시 시도';
const EVIDENCE_BLINDED = '신고 접수로 가려진 이미지입니다';
const EVIDENCE_EXPIRED = '보관 기간이 만료된 증빙입니다';
const AMEND_REQUEST_CTA = '변경·파기 요청';
const AMEND_TAB = '내용 변경';
const CANCEL_TAB = '파기 요청';
const AMEND_SUBMIT_CTA = '요청 보내기';
const AMEND_COMMON_NOTICE = '상대가 승인하면 적용돼요. 승인 전까지는 지금 약속이 그대로 유지돼요.';
const CANCEL_NOTICE = '두 사람 모두 동의하면 약속이 파기돼요';
const NO_AMEND_CHANGES = '변경된 내용이 없어요.';
const AMEND_REASON_LABEL = '변경 이유';
const AMEND_REASON_PLACEHOLDER = '변경이나 파기를 요청하는 이유를 남겨주세요.';
const AMEND_CLOSE = '변경·파기 요청 닫기';
const AMEND_WITHDRAW = '요청 철회';
const AMEND_APPROVE = '변경 승인';
const CANCEL_APPROVE = '파기 승인';
const AMEND_DECLINE = '거절';
const VERSION_HISTORY_CTA = '버전 이력 보기';
const VERSION_HISTORY_TITLE = '버전 이력';
const VERSION_HISTORY_CLOSE = '버전 이력 닫기';
const VERSION_HISTORY_LOADING = '버전 이력을 불러오는 중이에요';
const CANCEL_CONFIRM = '상대방이 승인하면 약속이 파기되고 되돌릴 수 없어요. 파기를 요청할까요?';
const OPTIONAL_LABEL = '선택';
const REQUESTER_LABEL = '요청자';
const REQUESTED_AT_LABEL = '요청 시각';
const BEFORE_LABEL = '변경 전';
const AFTER_LABEL = '변경 후';
const NO_REWARD_LABEL = '보상 없음';
const NO_PENALTY_LABEL = '벌칙 없음';
const VERSION_PREFIX = 'v';
const cancelRequestLabel = (nickname: string): string => `${nickname}님이 파기를 요청했어요`;

const AMEND_FIELD_LABEL = {
  title: '제목',
  body: '약속 내용',
  category: '카테고리',
  end_date: '종료일',
  keeper: '지킬 사람',
  reward: '보상',
  penalty: '벌칙',
} as const;

const CATEGORIES = Object.keys(PROMISE_CATEGORY_LABEL) as PromiseCategory[];
const KEEPERS = Object.keys(KEEPER_LABEL) as Keeper[];

const ANSWER_LABEL: Record<Answer, string> = {
  KEPT: '지켰어요',
  NOT_KEPT: '안 지켜졌어요',
};

interface PromiseView {
  summary: ParticipantPromiseSummary;
  detail: PromiseFulfillmentDetailResponse;
  agreement: PromiseDetailResponse | null;
}

interface AmendIntent {
  identity: string;
  key: string;
}

type AmendIntentStore = Record<string, AmendIntent>;

type Phase =
  | { kind: 'LOADING' }
  | { kind: 'SIGNED_OUT' }
  | { kind: 'ERROR'; message: string }
  | {
      kind: 'READY';
      accessToken: string;
      userId: string;
      promises: PromiseView[];
    };

type EvidenceUploadStatus = 'UPLOADING' | 'READY' | 'FAILED';

interface EvidenceUploadDraft {
  localId: string;
  idempotencyKey: string;
  name: string;
  file: File | null;
  previewUrl: string | null;
  status: EvidenceUploadStatus;
  uploadId?: string;
}

interface ResponseDraft {
  answer: Answer | null;
  comment: string;
  revising: boolean;
  uploads: EvidenceUploadDraft[];
  retainedEvidenceIds: string[];
  evidenceMessages: string[];
}

interface StoredResponseDraft {
  answer: Answer | null;
  comment: string;
  evidence_upload_ids: string[];
}

interface SubmitMutationIntent {
  kind: 'SUBMIT';
  identity: string;
  key: string;
  promiseId: string;
  roundNo: number;
  answer: Answer;
  comment: string | null;
  revise: boolean;
}

interface ReopenMutationIntent {
  kind: 'REOPEN';
  identity: string;
  key: string;
  promiseId: string;
  roundNo: number;
}

type MutationIntent = SubmitMutationIntent | ReopenMutationIntent;
type MutationIntentWithoutKey =
  | Omit<SubmitMutationIntent, 'key'>
  | Omit<ReopenMutationIntent, 'key'>;
type MutationIntentStore = Record<string, MutationIntent>;

function emptyDraft(revising = false): ResponseDraft {
  return {
    answer: null,
    comment: '',
    revising,
    uploads: [],
    retainedEvidenceIds: [],
    evidenceMessages: [],
  };
}

function evidenceDraftKey(
  userId: string,
  promiseId: string,
  roundNo: number,
): string {
  return `lf.fulfillment-evidence-draft.${userId}.${promiseId}.${roundNo}`;
}

function readStoredDraft(
  userId: string,
  detail: PromiseFulfillmentDetailResponse,
): ResponseDraft | null {
  try {
    const value = sessionStorage.getItem(
      evidenceDraftKey(userId, detail.promise_id, detail.check_round_no),
    );
    if (value === null) return null;
    const parsed = JSON.parse(value) as Partial<StoredResponseDraft>;
    if (
      (parsed.answer !== null &&
        parsed.answer !== 'KEPT' &&
        parsed.answer !== 'NOT_KEPT') ||
      typeof parsed.comment !== 'string' ||
      !Array.isArray(parsed.evidence_upload_ids) ||
      parsed.evidence_upload_ids.some((id) => typeof id !== 'string')
    ) {
      return null;
    }
    return {
      answer: parsed.answer ?? null,
      comment: parsed.comment,
      revising: detail.my_check !== null,
      uploads: parsed.evidence_upload_ids.map((uploadId) => ({
        localId: uploadId,
        idempotencyKey: crypto.randomUUID(),
        name: uploadId,
        file: null,
        previewUrl: null,
        status: 'READY',
        uploadId,
      })),
      retainedEvidenceIds:
        detail.my_check?.evidences.map((evidence) => evidence.evidence_id) ?? [],
      evidenceMessages: [],
    };
  } catch {
    return null;
  }
}

function persistDraft(
  userId: string,
  detail: PromiseFulfillmentDetailResponse,
  draft: ResponseDraft,
): void {
  const stored: StoredResponseDraft = {
    answer: draft.answer,
    comment: draft.comment,
    evidence_upload_ids: draft.uploads.flatMap((upload) =>
      upload.status === 'READY' && upload.uploadId !== undefined
        ? [upload.uploadId]
        : [],
    ),
  };
  try {
    sessionStorage.setItem(
      evidenceDraftKey(userId, detail.promise_id, detail.check_round_no),
      JSON.stringify(stored),
    );
  } catch {
    // 브라우저 저장소 실패가 서버 응답을 막지 않게 한다.
  }
}

function clearStoredDraft(
  userId: string,
  detail: PromiseFulfillmentDetailResponse,
): void {
  try {
    sessionStorage.removeItem(
      evidenceDraftKey(userId, detail.promise_id, detail.check_round_no),
    );
  } catch {
    // 브라우저 저장소 실패가 서버 응답을 막지 않게 한다.
  }
}

function submitSlot(promiseId: string): string {
  return `SUBMIT:${promiseId}`;
}

function reopenSlot(promiseId: string): string {
  return `REOPEN:${promiseId}`;
}

function keyForIntent(
  store: MutationIntentStore,
  slot: string,
  intent: MutationIntentWithoutKey,
): string {
  const existing = store[slot];
  if (existing?.identity === intent.identity) return existing.key;
  const key = crypto.randomUUID();
  store[slot] = { ...intent, key } as MutationIntent;
  return key;
}

function keyForAmendIntent(store: AmendIntentStore, slot: string, identity: string): string {
  const existing = store[slot];
  if (existing?.identity === identity) return existing.key;
  const key = crypto.randomUUID();
  store[slot] = { identity, key };
  return key;
}

/**
 * 응답 유실 뒤 서버를 다시 읽었을 때 전이가 실제 반영됐는지 판정한다.
 *
 * 반영되지 않은 intent는 같은 키로 재시도해야 하므로 남긴다. 상태/라운드/내 응답이 서버
 * 결과와 맞아 authoritative convergence가 확인된 경우에만 지운다.
 */
function reconcileMutationIntents(
  store: MutationIntentStore,
  promises: PromiseView[],
): void {
  for (const [slot, intent] of Object.entries(store)) {
    const view = promises.find(({ detail }) => detail.promise_id === intent.promiseId);
    if (view === undefined) {
      delete store[slot];
      continue;
    }
    const { detail } = view;
    if (intent.kind === 'REOPEN') {
      if (detail.status !== 'DISPUTED' || detail.check_round_no !== intent.roundNo) {
        delete store[slot];
      }
      continue;
    }

    if (detail.status !== 'CHECKING' || detail.check_round_no !== intent.roundNo) {
      delete store[slot];
      continue;
    }
    const check = detail.my_check;
    const applied =
      check !== null &&
      check.round_no === intent.roundNo &&
      check.answer === intent.answer &&
      check.comment === intent.comment &&
      (!intent.revise || check.revised_at !== null);
    if (applied) delete store[slot];
  }
}

function orderPromises(rows: ParticipantPromiseSummary[]): ParticipantPromiseSummary[] {
  return [...rows].sort((left, right) => {
    if (left.needs_response !== right.needs_response) return left.needs_response ? -1 : 1;
    const leftDeadline = left.check_deadline_at
      ? Date.parse(left.check_deadline_at)
      : Number.POSITIVE_INFINITY;
    const rightDeadline = right.check_deadline_at
      ? Date.parse(right.check_deadline_at)
      : Number.POSITIVE_INFINITY;
    if (leftDeadline !== rightDeadline) return leftDeadline - rightDeadline;
    return Date.parse(right.updated_at) - Date.parse(left.updated_at);
  });
}

function isAmendResponder(agreement: PromiseDetailResponse | null): boolean {
  const request = agreement?.amend_request;
  if (agreement === null || agreement === undefined || request === null || request === undefined) {
    return false;
  }
  const myUserId = agreement.my_role === 'CREATOR'
    ? agreement.creator.user_id
    : agreement.my_role === 'PARTNER'
      ? agreement.partner?.user_id ?? null
      : null;
  return myUserId !== null && request.requester.user_id !== myUserId;
}

function promiseNeedsResponse(view: PromiseView): boolean {
  return view.summary.needs_response || isAmendResponder(view.agreement);
}

function orderPromiseViews(views: PromiseView[]): PromiseView[] {
  return [...views].sort((left, right) => {
    const leftNeedsResponse = promiseNeedsResponse(left);
    const rightNeedsResponse = promiseNeedsResponse(right);
    if (leftNeedsResponse !== rightNeedsResponse) return leftNeedsResponse ? -1 : 1;
    const leftDeadline = left.summary.check_deadline_at
      ? Date.parse(left.summary.check_deadline_at)
      : Number.POSITIVE_INFINITY;
    const rightDeadline = right.summary.check_deadline_at
      ? Date.parse(right.summary.check_deadline_at)
      : Number.POSITIVE_INFINITY;
    if (leftDeadline !== rightDeadline) return leftDeadline - rightDeadline;
    return Date.parse(right.summary.updated_at) - Date.parse(left.summary.updated_at);
  });
}

function checksByRole(
  detail: PromiseFulfillmentDetailResponse,
): Record<Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>, FulfillmentCheckView | null> {
  const checks = [detail.my_check, detail.partner_check].filter(
    (check): check is FulfillmentCheckView => check !== null,
  );
  return {
    CREATOR: checks.find((check) => check.role === 'CREATOR') ?? null,
    PARTNER: checks.find((check) => check.role === 'PARTNER') ?? null,
  };
}

function submissionsByRole(
  detail: PromiseFulfillmentDetailResponse,
): Record<Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>, boolean> {
  return {
    CREATOR: detail.creator_has_submitted,
    PARTNER: detail.partner_has_submitted,
  };
}

function statusChipClass(status: PromiseFulfillmentDetailResponse['status']): string {
  if (status === 'CHECKING') return 'lf-chip--urgent';
  if (status === 'COMPLETED') return 'lf-chip--done';
  if (status === 'BROKEN') return 'lf-chip--broken';
  if (status === 'AMEND_PENDING') return 'lf-chip--pending';
  return 'lf-chip--status';
}

function deadlineCopy(deadline: string): string {
  const remainingMs = Date.parse(deadline) - Date.now();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  return `응답 기한 ${remainingDays}일 · ${formatKstDateTime(new Date(deadline))}${KST_MARK}`;
}

interface ClaimProps {
  accessToken: string;
  role: Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>;
  check: FulfillmentCheckView | null;
}

function EvidenceTile({
  accessToken,
  evidence,
  onRemove,
  compact = false,
}: {
  accessToken: string;
  evidence: EvidenceView;
  onRemove?: () => void;
  compact?: boolean;
}): React.JSX.Element {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const loadThumbnail = useCallback(async (): Promise<void> => {
    if (evidence.availability !== 'AVAILABLE') return;
    try {
      const signed = await signFulfillmentEvidence(
        accessToken,
        evidence.evidence_id,
        'THUMBNAIL',
      );
      setSignedUrl(signed.signed_url);
    } catch {
      setSignedUrl(null);
    }
  }, [accessToken, evidence.availability, evidence.evidence_id]);

  useEffect(() => {
    void loadThumbnail();
  }, [loadThumbnail]);

  if (evidence.availability === 'BLINDED') {
    return (
      <div
        className={
          compact ? 'lf-proof lf-proof--tile lf-attach-btn' : 'lf-proof'
        }
      >
        {EVIDENCE_BLINDED}
      </div>
    );
  }
  if (evidence.availability === 'EXPIRED') {
    return (
      <div
        className={
          compact ? 'lf-proof lf-proof--tile lf-attach-btn' : 'lf-proof'
        }
      >
        {EVIDENCE_EXPIRED}
      </div>
    );
  }

  return (
    <div
      className={`lf-evidence-tile ${
        compact ? '' : 'lf-evidence-tile--full'
      }`}
    >
      <button
        className={
          compact ? 'lf-proof lf-proof--tile lf-attach-btn' : 'lf-proof'
        }
        type="button"
        aria-label={`${evidence.evidence_id} 증빙 열기`}
        onClick={async () => {
          try {
            const signed = await signFulfillmentEvidence(
              accessToken,
              evidence.evidence_id,
              'FULL',
            );
            window.open(signed.signed_url, '_blank', 'noopener,noreferrer');
          } catch {
            await loadThumbnail();
          }
        }}
      >
        {signedUrl === null ? (
          <LfIcon name="image" />
        ) : (
          <img
            src={signedUrl}
            alt={`${evidence.evidence_id} 증빙`}
            onError={() => void loadThumbnail()}
          />
        )}
      </button>
      {onRemove !== undefined && (
        <button
          className="lf-evidence-remove"
          type="button"
          aria-label={`${evidence.evidence_id} 삭제`}
          onClick={onRemove}
        >
          <LfIcon name="close" />
        </button>
      )}
    </div>
  );
}

function Claim({ accessToken, role, check }: ClaimProps): React.JSX.Element {
  return (
    <div className="lf-claim">
      <p className="lf-claim__who">{PARTICIPANT_ROLE_LABEL[role]}</p>
      <p className="lf-claim__answer">
        {check === null ? '응답 없음' : ANSWER_LABEL[check.answer]}
      </p>
      {check?.comment && <p className="lf-claim__comment">{check.comment}</p>}
      {check !== null && check.evidences.length > 0 && (
        <div className="lf-claim__evidence">
          {check.evidences.map((evidence) => (
            <EvidenceTile
              key={evidence.evidence_id}
              accessToken={accessToken}
              evidence={evidence}
            />
          ))}
        </div>
      )}
      {check && (
        <p className="lf-claim__time">
          {formatKstDateTime(new Date(check.submitted_at))}
          {KST_MARK}
        </p>
      )}
    </div>
  );
}

interface ClaimsProps {
  accessToken: string;
  detail: PromiseFulfillmentDetailResponse;
}

function Claims({ accessToken, detail }: ClaimsProps): React.JSX.Element {
  const checks = checksByRole(detail);
  return (
    <div className="lf-claims">
      <Claim accessToken={accessToken} role="CREATOR" check={checks.CREATOR} />
      <Claim accessToken={accessToken} role="PARTNER" check={checks.PARTNER} />
    </div>
  );
}

interface ResponseFormProps {
  accessToken: string;
  detail: PromiseFulfillmentDetailResponse;
  draft: ResponseDraft;
  pending: boolean;
  onChange: (next: ResponseDraft) => void;
  onFiles: (files: File[]) => void;
  onRemoveUpload: (upload: EvidenceUploadDraft) => void;
  onRetryUpload: (upload: EvidenceUploadDraft) => void;
  onRemoveRetained: (evidenceId: string) => void;
  onSubmit: () => void;
}

function ResponseForm({
  accessToken,
  detail,
  draft,
  pending,
  onChange,
  onFiles,
  onRemoveUpload,
  onRetryUpload,
  onRemoveRetained,
  onSubmit,
}: ResponseFormProps): React.JSX.Element {
  const normalized = normalizeInput(draft.comment);
  const tooLong = codepointLength(normalized) > FULFILLMENT_COMMENT_MAX;
  const retainedEvidences =
    detail.my_check?.evidences.filter((evidence) =>
      draft.retainedEvidenceIds.includes(evidence.evidence_id),
    ) ?? [];
  const evidenceCount = retainedEvidences.length + draft.uploads.length;
  const evidenceUploading = draft.uploads.some(
    (upload) => upload.status === 'UPLOADING',
  );
  return (
    <div className="lf-stack lf-gap-3 lf-mt-4">
      <p className="lf-body lf-fulfillment-question">{RESPONSE_QUESTION}</p>
      <div className="lf-row lf-gap-3">
        {(['KEPT', 'NOT_KEPT'] as const).map((answer) => (
          <button
            className={`lf-response-btn ${
              draft.answer === answer ? 'lf-response-btn--yes' : 'lf-response-btn--no'
            }`}
            type="button"
            aria-pressed={draft.answer === answer}
            key={answer}
            onClick={() => onChange({ ...draft, answer })}
          >
            {answer === 'KEPT' && <LfIcon name="check" />}
            {ANSWER_LABEL[answer]}
          </button>
        ))}
      </div>
      <label className="lf-field">
        <span className="lf-field__label">{COMMENT_LABEL}</span>
        <textarea
          className="lf-input lf-textarea"
          value={draft.comment}
          aria-invalid={tooLong}
          onChange={(event) => onChange({ ...draft, comment: event.target.value })}
        />
      </label>
      {tooLong && (
        <p className="lf-field__hint lf-field__hint--error" role="alert">
          {COMMENT_LIMIT_COPY}
        </p>
      )}
      <div className="lf-field">
        <span className="lf-field__label">
          {EVIDENCE_LABEL} · 선택
        </span>
        <div className="lf-evidence-grid">
          {retainedEvidences.map((evidence) => (
            <EvidenceTile
              key={evidence.evidence_id}
              accessToken={accessToken}
              evidence={evidence}
              compact
              onRemove={() => onRemoveRetained(evidence.evidence_id)}
            />
          ))}
          {draft.uploads.map((upload) => (
            <div className="lf-evidence-tile" key={upload.localId}>
              <div className="lf-proof lf-proof--tile lf-attach-btn">
                {upload.previewUrl === null ? (
                  <LfIcon name="image" />
                ) : (
                  <img
                    src={upload.previewUrl}
                    alt={`${upload.name} 미리보기`}
                  />
                )}
                <span className="lf-proof__status">
                  {upload.status === 'UPLOADING'
                    ? EVIDENCE_UPLOADING
                    : upload.status === 'READY'
                      ? EVIDENCE_READY
                      : EVIDENCE_FAILED}
                </span>
              </div>
              {upload.status === 'FAILED' ? (
                <button
                  className="lf-evidence-remove"
                  type="button"
                  aria-label={EVIDENCE_RETRY}
                  onClick={() => onRetryUpload(upload)}
                >
                  <LfIcon name="refresh" />
                </button>
              ) : (
                <button
                  className="lf-evidence-remove"
                  type="button"
                  aria-label={`${upload.name} 삭제`}
                  disabled={upload.status === 'UPLOADING'}
                  onClick={() => onRemoveUpload(upload)}
                >
                  <LfIcon name="close" />
                </button>
              )}
            </div>
          ))}
          {evidenceCount < EVIDENCE_MAX_COUNT && (
            <label className="lf-attach-btn">
              <LfIcon name="photo_camera" />
              <span className="lf-attach-btn__label">{EVIDENCE_ADD}</span>
              <input
                className="lf-sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                multiple
                aria-label={EVIDENCE_INPUT_LABEL}
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files ?? []);
                  event.currentTarget.value = '';
                  onFiles(files);
                }}
              />
            </label>
          )}
        </div>
        <span className="lf-field__hint">{EVIDENCE_HINT}</span>
        {draft.evidenceMessages.map((message) => (
          <span
            className="lf-field__hint lf-field__hint--error"
            key={message}
          >
            {message}
          </span>
        ))}
      </div>
      <button
        className="lf-btn lf-btn--filled lf-btn--block"
        type="button"
        disabled={
          pending ||
          draft.answer === null ||
          tooLong ||
          evidenceUploading
        }
        onClick={onSubmit}
      >
        {draft.revising ? REVISE_SUBMIT_CTA : SUBMIT_CTA}
      </button>
    </div>
  );
}

function proposalOf(detail: PromiseFulfillmentDetailResponse): PromiseAmendProposal {
  return {
    title: detail.title,
    body: detail.body,
    category: detail.category,
    end_date: detail.end_date,
    keeper: detail.keeper,
    reward: detail.reward,
    penalty: detail.penalty,
  };
}

function AmendRequestSheet({
  detail,
  pending,
  onClose,
  onSubmit,
}: {
  detail: PromiseFulfillmentDetailResponse;
  pending: boolean;
  onClose(): void;
  onSubmit(input: PromiseAmendCreateRequest): Promise<void>;
}): React.JSX.Element {
  const [mode, setMode] = useState<'AMEND' | 'CANCEL'>('AMEND');
  const [proposal, setProposal] = useState<PromiseAmendProposal>(() => proposalOf(detail));
  const [reason, setReason] = useState('');
  const current = proposalOf(detail);
  const normalizedReason = normalizeInput(reason);
  const changed = changedPromiseFields(current, proposal).length > 0;
  const valid = validateTitle(proposal.title).valid
    && validateBody(proposal.body).valid
    && validateCategory(proposal.category).valid
    && validateEndDate(proposal.end_date, new Date()).valid
    && validateKeeper(proposal.keeper).valid
    && validateReward(proposal.reward ?? '').valid
    && validatePenalty(proposal.penalty ?? '').valid
    && validateAmendReason(reason).valid;
  const disabled = pending || !validateAmendReason(reason).valid || (mode === 'AMEND' && (!changed || !valid));

  function update<K extends keyof PromiseAmendProposal>(
    field: K,
    value: PromiseAmendProposal[K],
  ): void {
    setProposal((valueBefore) => ({ ...valueBefore, [field]: value }));
  }

  async function submit(): Promise<void> {
    if (disabled) return;
    if (mode === 'CANCEL') {
      if (!window.confirm(CANCEL_CONFIRM)) return;
      await onSubmit({
        promise_id: detail.promise_id,
        type: 'CANCEL',
        ...(normalizedReason === '' ? {} : { reason: normalizedReason }),
      });
      return;
    }
    await onSubmit({
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
    });
  }

  return (
    <div className="lf-f11-overlay" role="dialog" aria-modal="true" aria-label={AMEND_REQUEST_CTA}>
      <button className="lf-scrim" type="button" aria-label={AMEND_CLOSE} onClick={onClose} />
      <section className="lf-sheet lf-f11-sheet">
        <div className="lf-sheet__handle" aria-hidden="true" />
        <div className="lf-row lf-gap-3">
          <h3 className="lf-sheet__title lf-grow">{AMEND_REQUEST_CTA}</h3>
          <button className="lf-btn lf-btn--text" type="button" onClick={onClose}>{AMEND_CLOSE}</button>
        </div>
        <div className="lf-segmented">
          <button type="button" aria-pressed={mode === 'AMEND'} onClick={() => setMode('AMEND')}>{AMEND_TAB}</button>
          <button type="button" aria-pressed={mode === 'CANCEL'} onClick={() => setMode('CANCEL')}>{CANCEL_TAB}</button>
        </div>
        <p className="lf-info-banner">{AMEND_COMMON_NOTICE}</p>
        {mode === 'AMEND' ? (
          <div className="lf-stack lf-gap-4">
            <label className="lf-field">{AMEND_FIELD_LABEL.title}<input className="lf-input" value={proposal.title} onChange={(event) => update('title', event.target.value)} /></label>
            <label className="lf-field">{AMEND_FIELD_LABEL.body}<textarea className="lf-input lf-textarea" value={proposal.body} onChange={(event) => update('body', event.target.value)} /></label>
            <div className="lf-field"><span className="lf-field__label">{AMEND_FIELD_LABEL.category}</span><div className="lf-choices">{CATEGORIES.map((category) => <button className="lf-choice" type="button" key={category} aria-pressed={proposal.category === category} onClick={() => update('category', category)}>{PROMISE_CATEGORY_LABEL[category]}</button>)}</div></div>
            <label className="lf-field">{AMEND_FIELD_LABEL.end_date}<input className="lf-input" type="date" value={proposal.end_date} onChange={(event) => update('end_date', event.target.value)} /></label>
            <div className="lf-field"><span className="lf-field__label">{AMEND_FIELD_LABEL.keeper}</span><div className="lf-choices">{KEEPERS.map((keeper) => <button className="lf-choice" type="button" key={keeper} aria-pressed={proposal.keeper === keeper} onClick={() => update('keeper', keeper)}>{KEEPER_LABEL[keeper]}</button>)}</div></div>
            <label className="lf-field">{AMEND_FIELD_LABEL.reward}<input className="lf-input" value={proposal.reward ?? ''} onChange={(event) => update('reward', event.target.value === '' ? null : event.target.value)} /></label>
            <label className="lf-field">{AMEND_FIELD_LABEL.penalty}<input className="lf-input" value={proposal.penalty ?? ''} onChange={(event) => update('penalty', event.target.value === '' ? null : event.target.value)} /></label>
            {!changed ? <p className="lf-field__hint">{NO_AMEND_CHANGES}</p> : null}
          </div>
        ) : <p className="lf-info-banner">{CANCEL_NOTICE}</p>}
        <label className="lf-field">
          <span className="lf-field__label">{AMEND_REASON_LABEL} · {OPTIONAL_LABEL}</span>
          <textarea className="lf-input lf-textarea" aria-label={AMEND_REASON_LABEL} placeholder={AMEND_REASON_PLACEHOLDER} value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <button className="lf-btn lf-btn--filled lf-btn--cta lf-btn--block" type="button" disabled={disabled} onClick={() => void submit()}>{AMEND_SUBMIT_CTA}</button>
      </section>
    </div>
  );
}

function amendFieldValue(
  detail: PromiseDetailResponse['current_version'],
  field: ReturnType<typeof changedPromiseFields>[number],
): string {
  if (field === 'category') return PROMISE_CATEGORY_LABEL[detail.category];
  if (field === 'keeper') return KEEPER_LABEL[detail.keeper];
  if (field === 'end_date') return formatKstDate(detail.end_date);
  if (field === 'reward') return detail.reward ?? NO_REWARD_LABEL;
  if (field === 'penalty') return detail.penalty ?? NO_PENALTY_LABEL;
  return detail[field];
}

function PendingAmendPanel({
  agreement,
  pending,
  onWithdraw,
  onRespond,
}: {
  agreement: PromiseDetailResponse;
  pending: boolean;
  onWithdraw(): void;
  onRespond(decision: PromiseAmendDecision): void;
}): React.JSX.Element | null {
  const request = agreement.amend_request;
  if (request === null) return null;
  const proposed = request.proposed_version;
  const myUserId = agreement.my_role === 'CREATOR'
    ? agreement.creator.user_id
    : agreement.partner?.user_id ?? null;
  const requester = request.requester.user_id === myUserId;
  const fields = proposed === null
    ? []
    : changedPromiseFields(agreement.current_version, proposed);
  return (
    <div className="lf-stack lf-gap-4 lf-mt-4">
      {request.type === 'CANCEL' ? (
        <p className="lf-info-banner">{cancelRequestLabel(request.requester.nickname)}</p>
      ) : proposed !== null ? (
        <div className="lf-stack lf-gap-3">
          {fields.map((field) => (
            <div className="lf-compare" key={field}>
              <div className="lf-compare__item lf-compare__item--before"><p className="lf-compare__label">{BEFORE_LABEL} · {AMEND_FIELD_LABEL[field]}</p><p className="lf-compare__value">{amendFieldValue(agreement.current_version, field)}</p></div>
              <div className="lf-compare__item lf-compare__item--after"><p className="lf-compare__label">{AFTER_LABEL} · {AMEND_FIELD_LABEL[field]}</p><p className="lf-compare__value">{amendFieldValue(proposed, field)}</p></div>
            </div>
          ))}
        </div>
      ) : null}
      <p className="lf-caption">{REQUESTER_LABEL} · {request.requester.nickname}</p>
      <p className="lf-caption">{REQUESTED_AT_LABEL} · {formatKstDateTime(new Date(request.created_at))}{KST_MARK}</p>
      {request.reason !== null ? <p>{request.reason}</p> : null}
      {requester ? (
        <button className="lf-btn lf-btn--outlined lf-btn--block" type="button" disabled={pending} onClick={onWithdraw}>{AMEND_WITHDRAW}</button>
      ) : (
        <div className="lf-row lf-gap-3">
          <button className="lf-btn lf-btn--filled lf-btn--grow" type="button" disabled={pending} onClick={() => onRespond('APPROVE')}>{request.type === 'AMEND' ? AMEND_APPROVE : CANCEL_APPROVE}</button>
          <button className="lf-btn lf-btn--outlined lf-btn--grow" type="button" disabled={pending} onClick={() => onRespond('DECLINE')}>{AMEND_DECLINE}</button>
        </div>
      )}
    </div>
  );
}

function VersionHistoryOverlay({
  value,
  onClose,
}: {
  value: PromiseVersionListResponse | null;
  onClose(): void;
}): React.JSX.Element {
  return (
    <div className="lf-f11-overlay" role="dialog" aria-modal="true" aria-label={VERSION_HISTORY_TITLE}>
      <button className="lf-scrim" type="button" aria-label={VERSION_HISTORY_CLOSE} onClick={onClose} />
      <section className="lf-sheet lf-f11-sheet">
        <div className="lf-sheet__handle" aria-hidden="true" />
        <h3 className="lf-sheet__title">{VERSION_HISTORY_TITLE}</h3>
        {value === null ? <p>{VERSION_HISTORY_LOADING}</p> : value.versions.map((item) => (
          <article className="lf-card" key={item.version.version_no}>
            <div className="lf-stack lf-gap-3">
              <h4>{VERSION_PREFIX}{item.version.version_no}</h4>
              <p>{item.version.title}</p><p>{item.version.body}</p>
              <p>{PROMISE_CATEGORY_LABEL[item.version.category]} · {KEEPER_LABEL[item.version.keeper]}</p>
              <p>{formatKstDate(item.version.end_date)}</p>
              <p>{item.version.reward ?? NO_REWARD_LABEL}</p><p>{item.version.penalty ?? NO_PENALTY_LABEL}</p>
              <p>{item.version.content_hash.slice(0, 8)}</p>
              {item.change_requester !== null ? <p>{item.change_requester.nickname}</p> : null}
              {item.approved_by !== null ? <p>{item.approved_by.nickname}</p> : null}
              {item.approved_at !== null ? <p>{formatKstDateTime(new Date(item.approved_at))}{KST_MARK}</p> : null}
              {item.change_reason !== null ? <p>{item.change_reason}</p> : null}
            </div>
          </article>
        ))}
        <button className="lf-btn lf-btn--outlined lf-btn--block" type="button" onClick={onClose}>{VERSION_HISTORY_CLOSE}</button>
      </section>
    </div>
  );
}

interface PromiseCardProps {
  accessToken: string;
  view: PromiseView;
  draft: ResponseDraft | undefined;
  pending: boolean;
  onDraft: (view: PromiseView, draft: ResponseDraft) => void;
  onFiles: (view: PromiseView, files: File[]) => void;
  onRemoveUpload: (
    view: PromiseView,
    upload: EvidenceUploadDraft,
  ) => void;
  onRetryUpload: (
    view: PromiseView,
    upload: EvidenceUploadDraft,
  ) => void;
  onRemoveRetained: (view: PromiseView, evidenceId: string) => void;
  onSubmit: (view: PromiseView, draft: ResponseDraft) => void;
  onReopen: (view: PromiseView) => void;
  amendOpen: boolean;
  onOpenAmend: (view: PromiseView) => void;
  onCloseAmend: () => void;
  onRequestAmend: (view: PromiseView, input: PromiseAmendCreateRequest) => Promise<void>;
  onWithdrawAmend: (view: PromiseView) => void;
  onRespondAmend: (view: PromiseView, decision: PromiseAmendDecision) => void;
  onVersionHistory: (view: PromiseView) => void;
}

function PromiseCard({
  accessToken,
  view,
  draft,
  pending,
  onDraft,
  onFiles,
  onRemoveUpload,
  onRetryUpload,
  onRemoveRetained,
  onSubmit,
  onReopen,
  amendOpen,
  onOpenAmend,
  onCloseAmend,
  onRequestAmend,
  onWithdrawAmend,
  onRespondAmend,
  onVersionHistory,
}: PromiseCardProps): React.JSX.Element {
  const { detail, summary } = view;
  const currentDraft = draft ?? emptyDraft();
  const currentChecks = checksByRole(detail);
  const currentSubmissions = submissionsByRole(detail);
  const counterpartRole = detail.my_role === 'CREATOR' ? 'PARTNER' : 'CREATOR';
  const counterpartHasSubmitted = currentSubmissions[counterpartRole];

  return (
    <li>
      <article
        className={`lf-card lf-card--web lf-text-left ${
          promiseNeedsResponse(view) ? 'lf-card--emphasis' : ''
        }`}
      >
        <div className="lf-card__header">
          <span className={`lf-chip ${statusChipClass(detail.status)}`}>
            {PROMISE_STATUS_LABEL[detail.status]}
          </span>
          <span className="lf-card__spacer" />
          {detail.status === 'CHECKING' && detail.check_deadline_at && (
            <span className="lf-caption">{deadlineCopy(detail.check_deadline_at)}</span>
          )}
        </div>
        <h2 className="lf-card__title" data-testid="promise-card-title">
          {detail.title}
        </h2>
        <p className="lf-card__meta">
          종료일 {formatKstDate(detail.end_date)}
          {KST_MARK}
        </p>

        {detail.status === 'ACTIVE' && (
          <button
            className="lf-btn lf-btn--outlined lf-btn--block lf-mt-4"
            type="button"
            disabled={pending}
            onClick={() => onOpenAmend(view)}
          >
            {AMEND_REQUEST_CTA}
          </button>
        )}

        {detail.status === 'AMEND_PENDING' && view.agreement !== null ? (
          <PendingAmendPanel
            agreement={view.agreement}
            pending={pending}
            onWithdraw={() => onWithdrawAmend(view)}
            onRespond={(decision) => onRespondAmend(view, decision)}
          />
        ) : null}

        {detail.status === 'CHECKING' && detail.my_check === null && (
          <>
            <div className="lf-info-banner lf-stack lf-gap-1 lf-mt-4">
              <p>{MY_RESPONSE_PENDING}</p>
              <p>
                {counterpartHasSubmitted
                  ? COUNTERPART_SUBMITTED
                  : COUNTERPART_RESPONSE_PENDING}
              </p>
            </div>
            <ResponseForm
              accessToken={accessToken}
              detail={detail}
              draft={currentDraft}
              pending={pending}
              onChange={(next) => onDraft(view, next)}
              onFiles={(files) => onFiles(view, files)}
              onRemoveUpload={(upload) => onRemoveUpload(view, upload)}
              onRetryUpload={(upload) => onRetryUpload(view, upload)}
              onRemoveRetained={(evidenceId) =>
                onRemoveRetained(view, evidenceId)
              }
              onSubmit={() => onSubmit(view, currentDraft)}
            />
          </>
        )}

        {detail.status === 'CHECKING' && detail.my_check !== null && (
          <div className="lf-stack lf-gap-3 lf-mt-4">
            <p className="lf-body--secondary">
              내 응답: {ANSWER_LABEL[detail.my_check.answer]}
            </p>
            {!counterpartHasSubmitted && <p className="lf-caption">{WAITING_COPY}</p>}
            {!currentDraft.revising &&
              !counterpartHasSubmitted &&
              detail.my_check.revised_at === null && (
                <button
                  className="lf-btn lf-btn--tonal lf-btn--block"
                  type="button"
                  onClick={() =>
                    onDraft(view, {
                      answer: detail.my_check?.answer ?? null,
                      comment: detail.my_check?.comment ?? '',
                      revising: true,
                      uploads: [],
                      retainedEvidenceIds:
                        detail.my_check?.evidences.map(
                          (evidence) => evidence.evidence_id,
                        ) ?? [],
                      evidenceMessages: [],
                    })
                  }
                >
                  {REVISE_CTA}
                </button>
              )}
            {currentDraft.revising && (
              <ResponseForm
                accessToken={accessToken}
                detail={detail}
                draft={currentDraft}
                pending={pending}
                onChange={(next) => onDraft(view, next)}
                onFiles={(files) => onFiles(view, files)}
                onRemoveUpload={(upload) => onRemoveUpload(view, upload)}
                onRetryUpload={(upload) => onRetryUpload(view, upload)}
                onRemoveRetained={(evidenceId) =>
                  onRemoveRetained(view, evidenceId)
                }
                onSubmit={() => onSubmit(view, currentDraft)}
              />
            )}
          </div>
        )}

        {(detail.status === 'COMPLETED' || detail.status === 'BROKEN') && (
          <div className="lf-mt-4">
            <Claims accessToken={accessToken} detail={detail} />
          </div>
        )}

        {detail.status === 'DISPUTED' && (
          <div className="lf-stack lf-gap-4 lf-mt-4">
            <p className="lf-body--secondary">{DISPUTED_COPY}</p>
            <Claims accessToken={accessToken} detail={detail} />
            {detail.history.map((round) => (
              <section className="lf-history" key={round.round_no}>
                <h3 className="lf-section-title">{round.round_no}차 확인 기록</h3>
                <div className="lf-claims">
                  <Claim
                    accessToken={accessToken}
                    role="CREATOR"
                    check={round.creator_check}
                  />
                  <Claim
                    accessToken={accessToken}
                    role="PARTNER"
                    check={round.partner_check}
                  />
                </div>
              </section>
            ))}
            <button
              className="lf-btn lf-btn--tonal lf-btn--block"
              type="button"
              disabled={pending}
              onClick={() => onReopen(view)}
            >
              {REOPEN_CTA}
            </button>
          </div>
        )}

        {detail.status !== 'DISPUTED' && detail.history.length > 0 && (
          <div className="lf-stack lf-gap-4 lf-mt-4">
            {detail.history.map((round) => (
              <section className="lf-history" key={round.round_no}>
                <h3 className="lf-section-title">
                  {round.round_no}차 확인 기록
                </h3>
                <div className="lf-claims">
                  <Claim
                    accessToken={accessToken}
                    role="CREATOR"
                    check={round.creator_check}
                  />
                  <Claim
                    accessToken={accessToken}
                    role="PARTNER"
                    check={round.partner_check}
                  />
                </div>
              </section>
            ))}
          </div>
        )}

        {detail.status === 'UNRESOLVED' && (
          <div className="lf-claims lf-mt-4">
            {(['CREATOR', 'PARTNER'] as const).map((role) => (
              <div className="lf-claim" key={role}>
                <p className="lf-claim__answer">
                  {PARTICIPANT_ROLE_LABEL[role]}{' '}
                  {currentSubmissions[role] ? '응답 완료' : '미응답'}
                </p>
              </div>
            ))}
          </div>
        )}

        {(detail.status === 'ACTIVE' || detail.status === 'AMEND_PENDING') ? (
          <button
            className="lf-btn lf-btn--text lf-btn--block lf-mt-4"
            type="button"
            onClick={() => onVersionHistory(view)}
          >
            {VERSION_HISTORY_CTA}
          </button>
        ) : null}

        {amendOpen ? (
          <AmendRequestSheet
            detail={detail}
            pending={pending}
            onClose={onCloseAmend}
            onSubmit={(input) => onRequestAmend(view, input)}
          />
        ) : null}
      </article>
    </li>
  );
}

export function ScrW04ParticipantPromises(): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: 'LOADING' });
  const [drafts, setDrafts] = useState<Record<string, ResponseDraft>>({});
  const [pendingPromiseId, setPendingPromiseId] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState(false);
  const [activeAmendId, setActiveAmendId] = useState<string | null>(null);
  const [versionHistory, setVersionHistory] = useState<{
    promiseId: string;
    value: PromiseVersionListResponse | null;
  } | null>(null);
  const mutationIntents = useRef<MutationIntentStore>({});
  const amendIntents = useRef<AmendIntentStore>({});
  const objectUrls = useRef(new Set<string>());

  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
      objectUrls.current.clear();
    },
    [],
  );

  const load = useCallback(async (signal?: AbortSignal): Promise<PromiseView[] | null> => {
    setPhase({ kind: 'LOADING' });
    try {
      const { data } = await getSupabase().auth.getSession();
      const session = data.session;
      if (session === null) {
        setPhase({ kind: 'SIGNED_OUT' });
        return null;
      }
      const summaries = orderPromises(
        await listParticipantPromises(session.access_token, signal),
      );
      const details = await Promise.all(
        summaries.map((summary) =>
          getPromiseFulfillmentDetail(
            session.access_token,
            summary.promise_id,
            signal,
          ),
        ),
      );
      const agreements = await Promise.all(
        details.map((detail) => detail.status === 'AMEND_PENDING'
          ? getPromiseAmendDetail(session.access_token, detail.promise_id, signal)
          : Promise.resolve(null)),
      );
      if (signal?.aborted) return null;
      const promises = orderPromiseViews(
        summaries.map((summary, index) => ({
          summary,
          detail: details[index] as PromiseFulfillmentDetailResponse,
          agreement: agreements[index] ?? null,
        })),
      );
      reconcileMutationIntents(mutationIntents.current, promises);
      setDrafts((current) => {
        const next = { ...current };
        for (const view of promises) {
          if (
            next[view.detail.promise_id] !== undefined ||
            view.detail.status !== 'CHECKING'
          ) {
            continue;
          }
          const counterpartRole =
            view.detail.my_role === 'CREATOR' ? 'PARTNER' : 'CREATOR';
          const canRestore =
            view.detail.my_check === null ||
            (view.detail.my_check.revised_at === null &&
              !submissionsByRole(view.detail)[counterpartRole]);
          if (!canRestore) {
            clearStoredDraft(session.user.id, view.detail);
            continue;
          }
          const restored = readStoredDraft(session.user.id, view.detail);
          if (restored !== null) next[view.detail.promise_id] = restored;
        }
        return next;
      });
      setPhase({
        kind: 'READY',
        accessToken: session.access_token,
        userId: session.user.id,
        promises,
      });
      return promises;
    } catch (raised) {
      if (signal?.aborted) return null;
      if (
        (raised instanceof FulfillmentApiError && raised.authExpired)
        || (raised instanceof PromiseAmendApiError && raised.authExpired)
      ) {
        setPhase({ kind: 'SIGNED_OUT' });
        return null;
      }
      setPhase({
        kind: 'ERROR',
        message: raised instanceof Error ? raised.message : INTERNAL_MESSAGE,
      });
      return null;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleSignIn = useCallback(async (): Promise<void> => {
    setSigningIn(true);
    setSignInError(false);
    try {
      await signInWithKakao(promisesPath());
    } catch {
      setSigningIn(false);
      setSignInError(true);
    }
  }, []);

  const handleGoogleSignIn = useCallback(async (): Promise<void> => {
    setSigningIn(true);
    setSignInError(false);
    try {
      await signInWithGoogle(promisesPath());
    } catch {
      setSigningIn(false);
      setSignInError(true);
    }
  }, []);

  const updateDraft = useCallback(
    (
      view: PromiseView,
      update: (current: ResponseDraft) => ResponseDraft,
    ): void => {
      if (phase.kind !== 'READY') return;
      setDrafts((current) => {
        const nextDraft = update(
          current[view.detail.promise_id] ?? emptyDraft(),
        );
        persistDraft(phase.userId, view.detail, nextDraft);
        return {
          ...current,
          [view.detail.promise_id]: nextDraft,
        };
      });
    },
    [phase],
  );

  const runEvidenceUpload = useCallback(
    async (
      view: PromiseView,
      upload: EvidenceUploadDraft,
    ): Promise<void> => {
      if (phase.kind !== 'READY' || upload.file === null) return;
      try {
        const response = await uploadFulfillmentEvidence(
          phase.accessToken,
          view.detail.promise_id,
          view.detail.check_round_no,
          upload.file,
          upload.idempotencyKey,
        );
        updateDraft(view, (current) => ({
          ...current,
          uploads: current.uploads.map((item) =>
            item.localId === upload.localId
              ? {
                  ...item,
                  status: 'READY',
                  uploadId: response.upload_id,
                }
              : item,
          ),
        }));
      } catch {
        updateDraft(view, (current) => ({
          ...current,
          uploads: current.uploads.map((item) =>
            item.localId === upload.localId
              ? { ...item, status: 'FAILED' }
              : item,
          ),
        }));
      }
    },
    [phase, updateDraft],
  );

  const handleFiles = useCallback(
    (view: PromiseView, files: File[]): void => {
      if (phase.kind !== 'READY' || files.length === 0) return;
      const current = drafts[view.detail.promise_id] ?? emptyDraft();
      const remaining =
        EVIDENCE_MAX_COUNT -
        current.retainedEvidenceIds.length -
        current.uploads.length;
      const messages = new Set<string>();
      if (files.length > remaining) messages.add(EVIDENCE_COUNT_COPY);

      const accepted: File[] = [];
      for (const file of files) {
        if (file.size > EVIDENCE_MAX_MB * 1024 * 1024) {
          messages.add(EVIDENCE_SIZE_COPY);
          continue;
        }
        if (
          !validateEvidences([
            { mime: evidenceMimeOf(file.type, file.name), bytes: file.size },
          ]).valid
        ) {
          messages.add(EVIDENCE_TYPE_COPY);
          continue;
        }
        if (accepted.length < remaining) accepted.push(file);
      }

      const pending = accepted.map((file) => {
        const localId = crypto.randomUUID();
        const previewUrl = URL.createObjectURL(file);
        objectUrls.current.add(previewUrl);
        return {
          localId,
          idempotencyKey: localId,
          name: file.name,
          file,
          previewUrl,
          status: 'UPLOADING' as const,
        };
      });
      updateDraft(view, (latest) => ({
        ...latest,
        uploads: [...latest.uploads, ...pending],
        evidenceMessages: [...messages],
      }));
      void Promise.all(
        pending.map((upload) => runEvidenceUpload(view, upload)),
      );
    },
    [drafts, phase, runEvidenceUpload, updateDraft],
  );

  const handleRetryUpload = useCallback(
    (view: PromiseView, upload: EvidenceUploadDraft): void => {
      if (upload.file === null) return;
      const retry = { ...upload, status: 'UPLOADING' as const };
      updateDraft(view, (current) => ({
        ...current,
        uploads: current.uploads.map((item) =>
          item.localId === upload.localId ? retry : item,
        ),
      }));
      void runEvidenceUpload(view, retry);
    },
    [runEvidenceUpload, updateDraft],
  );

  const handleRemoveUpload = useCallback(
    async (
      view: PromiseView,
      upload: EvidenceUploadDraft,
    ): Promise<void> => {
      if (phase.kind !== 'READY' || upload.status === 'UPLOADING') return;
      if (upload.status === 'READY' && upload.uploadId !== undefined) {
        try {
          await discardFulfillmentEvidence(
            phase.accessToken,
            upload.uploadId,
          );
        } catch {
          updateDraft(view, (current) => ({
            ...current,
            evidenceMessages: [INTERNAL_MESSAGE],
          }));
          return;
        }
      }
      if (upload.previewUrl !== null) {
        URL.revokeObjectURL(upload.previewUrl);
        objectUrls.current.delete(upload.previewUrl);
      }
      updateDraft(view, (current) => ({
        ...current,
        uploads: current.uploads.filter(
          (item) => item.localId !== upload.localId,
        ),
      }));
    },
    [phase, updateDraft],
  );

  const handleRemoveRetained = useCallback(
    (view: PromiseView, evidenceId: string): void => {
      updateDraft(view, (current) => ({
        ...current,
        retainedEvidenceIds: current.retainedEvidenceIds.filter(
          (id) => id !== evidenceId,
        ),
      }));
    },
    [updateDraft],
  );

  const handleSubmit = useCallback(
    async (view: PromiseView, draft: ResponseDraft): Promise<void> => {
      if (phase.kind !== 'READY' || draft.answer === null) return;
      setPendingPromiseId(view.detail.promise_id);
      const comment = normalizeInput(draft.comment);
      const evidenceUploadIds = draft.uploads.flatMap((upload) =>
        upload.status === 'READY' && upload.uploadId !== undefined
          ? [upload.uploadId]
          : [],
      );
      const request = {
        promise_id: view.detail.promise_id,
        answer: draft.answer,
        ...(comment === '' ? {} : { comment }),
        ...(draft.revising ? { revise: true } : {}),
        ...(evidenceUploadIds.length === 0
          ? {}
          : { evidence_upload_ids: evidenceUploadIds }),
        ...(draft.revising && draft.retainedEvidenceIds.length > 0
          ? { retained_evidence_ids: draft.retainedEvidenceIds }
          : {}),
      };
      const storedComment = comment === '' ? null : comment;
      const slot = submitSlot(view.detail.promise_id);
      const identity = JSON.stringify([
        view.detail.promise_id,
        view.detail.check_round_no,
        draft.answer,
        storedComment,
        draft.revising,
        evidenceUploadIds,
        draft.retainedEvidenceIds,
      ]);
      const idempotencyKey = keyForIntent(mutationIntents.current, slot, {
        kind: 'SUBMIT',
        identity,
        promiseId: view.detail.promise_id,
        roundNo: view.detail.check_round_no,
        answer: draft.answer,
        comment: storedComment,
        revise: draft.revising,
      });
      try {
        await submitFulfillment(phase.accessToken, request, idempotencyKey);
        delete mutationIntents.current[slot];
        clearStoredDraft(phase.userId, view.detail);
        for (const upload of draft.uploads) {
          if (upload.previewUrl === null) continue;
          URL.revokeObjectURL(upload.previewUrl);
          objectUrls.current.delete(upload.previewUrl);
        }
        setDrafts((current) => {
          const next = { ...current };
          delete next[view.detail.promise_id];
          return next;
        });
        await load();
      } catch (raised) {
        if (raised instanceof FulfillmentApiError && raised.authExpired) {
          setPhase({ kind: 'SIGNED_OUT' });
        } else if (
          raised instanceof FulfillmentApiError &&
          raised.failure.code === 'E_STATE_CONFLICT'
        ) {
          await load();
        } else {
          setPhase({
            kind: 'ERROR',
            message: raised instanceof Error ? raised.message : INTERNAL_MESSAGE,
          });
        }
      } finally {
        setPendingPromiseId(null);
      }
    },
    [load, phase],
  );

  const handleReopen = useCallback(
    async (view: PromiseView): Promise<void> => {
      if (phase.kind !== 'READY') return;
      setPendingPromiseId(view.detail.promise_id);
      const slot = reopenSlot(view.detail.promise_id);
      const identity = JSON.stringify([
        view.detail.promise_id,
        view.detail.check_round_no,
      ]);
      const idempotencyKey = keyForIntent(mutationIntents.current, slot, {
        kind: 'REOPEN',
        identity,
        promiseId: view.detail.promise_id,
        roundNo: view.detail.check_round_no,
      });
      try {
        await reopenFulfillment(
          phase.accessToken,
          { promise_id: view.detail.promise_id },
          idempotencyKey,
        );
        delete mutationIntents.current[slot];
        await load();
      } catch (raised) {
        if (raised instanceof FulfillmentApiError && raised.authExpired) {
          setPhase({ kind: 'SIGNED_OUT' });
        } else if (
          raised instanceof FulfillmentApiError &&
          raised.failure.code === 'E_STATE_CONFLICT'
        ) {
          await load();
        } else {
          setPhase({
            kind: 'ERROR',
            message: raised instanceof Error ? raised.message : INTERNAL_MESSAGE,
          });
        }
      } finally {
        setPendingPromiseId(null);
      }
    },
    [load, phase],
  );

  const handleRequestAmend = useCallback(
    async (view: PromiseView, input: PromiseAmendCreateRequest): Promise<void> => {
      if (phase.kind !== 'READY') return;
      setPendingPromiseId(view.detail.promise_id);
      const slot = `AMEND_REQUEST:${view.detail.promise_id}`;
      const key = keyForAmendIntent(amendIntents.current, slot, JSON.stringify(input));
      try {
        await requestPromiseAmend(phase.accessToken, input, key);
        const refreshed = await load();
        const current = refreshed?.find(({ detail }) => detail.promise_id === view.detail.promise_id);
        if (current?.detail.status === 'AMEND_PENDING') {
          delete amendIntents.current[slot];
          setActiveAmendId(null);
        }
      } catch (raised) {
        if (raised instanceof PromiseAmendApiError && raised.authExpired) {
          setPhase({ kind: 'SIGNED_OUT' });
        } else if (
          raised instanceof PromiseAmendApiError
          && (raised.failure.code === 'E_STATE_CONFLICT' || raised.failure.code === 'E_VALIDATION')
        ) {
          await load();
        } else {
          setPhase({ kind: 'ERROR', message: raised instanceof Error ? raised.message : INTERNAL_MESSAGE });
        }
      } finally {
        setPendingPromiseId(null);
      }
    },
    [load, phase],
  );

  const handleWithdrawAmend = useCallback(
    async (view: PromiseView): Promise<void> => {
      if (phase.kind !== 'READY' || view.agreement?.amend_request === null || view.agreement === null) return;
      const requestId = view.agreement.amend_request.request_id;
      const slot = `AMEND_WITHDRAW:${view.detail.promise_id}`;
      const key = keyForAmendIntent(amendIntents.current, slot, requestId);
      setPendingPromiseId(view.detail.promise_id);
      try {
        await withdrawPromiseAmend(phase.accessToken, view.detail.promise_id, requestId, key);
        const refreshed = await load();
        const current = refreshed?.find(({ detail }) => detail.promise_id === view.detail.promise_id);
        if (current !== undefined && current.detail.status !== 'AMEND_PENDING') {
          delete amendIntents.current[slot];
        }
      } catch (raised) {
        if (raised instanceof PromiseAmendApiError && raised.authExpired) setPhase({ kind: 'SIGNED_OUT' });
        else if (raised instanceof PromiseAmendApiError && raised.failure.code === 'E_STATE_CONFLICT') await load();
        else setPhase({ kind: 'ERROR', message: raised instanceof Error ? raised.message : INTERNAL_MESSAGE });
      } finally {
        setPendingPromiseId(null);
      }
    },
    [load, phase],
  );

  const handleRespondAmend = useCallback(
    async (view: PromiseView, decision: PromiseAmendDecision): Promise<void> => {
      if (phase.kind !== 'READY' || view.agreement?.amend_request === null || view.agreement === null) return;
      const requestId = view.agreement.amend_request.request_id;
      if (decision === 'APPROVE' && view.agreement.amend_request.type === 'CANCEL' && !window.confirm(CANCEL_CONFIRM)) return;
      const slot = `AMEND_RESPOND:${view.detail.promise_id}`;
      const identity = JSON.stringify([requestId, decision]);
      const key = keyForAmendIntent(amendIntents.current, slot, identity);
      setPendingPromiseId(view.detail.promise_id);
      try {
        await respondPromiseAmend(phase.accessToken, {
          promise_id: view.detail.promise_id,
          request_id: requestId,
          decision,
        }, key);
        const refreshed = await load();
        const current = refreshed?.find(({ detail }) => detail.promise_id === view.detail.promise_id);
        if (current !== undefined && current.detail.status !== 'AMEND_PENDING') {
          delete amendIntents.current[slot];
        }
      } catch (raised) {
        if (raised instanceof PromiseAmendApiError && raised.authExpired) setPhase({ kind: 'SIGNED_OUT' });
        else if (
          raised instanceof PromiseAmendApiError
          && (raised.failure.code === 'E_STATE_CONFLICT' || raised.failure.code === 'E_VALIDATION')
        ) await load();
        else setPhase({ kind: 'ERROR', message: raised instanceof Error ? raised.message : INTERNAL_MESSAGE });
      } finally {
        setPendingPromiseId(null);
      }
    },
    [load, phase],
  );

  const handleVersionHistory = useCallback(
    async (view: PromiseView): Promise<void> => {
      if (phase.kind !== 'READY') return;
      setVersionHistory({ promiseId: view.detail.promise_id, value: null });
      try {
        const value = await listPromiseVersions(phase.accessToken, view.detail.promise_id);
        setVersionHistory({ promiseId: view.detail.promise_id, value });
      } catch (raised) {
        if (raised instanceof PromiseAmendApiError && raised.authExpired) setPhase({ kind: 'SIGNED_OUT' });
        else setPhase({ kind: 'ERROR', message: raised instanceof Error ? raised.message : INTERNAL_MESSAGE });
        setVersionHistory(null);
      }
    },
    [phase],
  );

  const responseCount =
    phase.kind === 'READY'
      ? phase.promises.filter(promiseNeedsResponse).length
      : 0;

  return (
    <div className="lf-screen">
      <div className="lf-screen__body lf-screen__body--web">
        <h1 className="lf-title lf-title--web">{PAGE_TITLE}</h1>

        {phase.kind === 'LOADING' && (
          <div className="lf-empty" role="status" aria-busy="true">
            <PinkyBadge />
          </div>
        )}

        {phase.kind === 'SIGNED_OUT' && (
          <div className="lf-empty">
            <PinkyBadge />
            <button
              className="lf-btn lf-btn--kakao lf-btn--cta lf-btn--block"
              type="button"
              disabled={signingIn}
              onClick={() => void handleSignIn()}
            >
              {SIGN_IN_CTA}
            </button>
            <button
              className="lf-btn lf-btn--google lf-btn--cta lf-btn--block"
              type="button"
              disabled={signingIn}
              onClick={() => void handleGoogleSignIn()}
            >
              <GoogleMark />
              <span>{GOOGLE_SIGN_IN_CTA}</span>
            </button>
            <p role="alert" className="lf-caption">
              {signInError ? INTERNAL_MESSAGE : ''}
            </p>
            <TestLoginForm />
          </div>
        )}

        {phase.kind === 'ERROR' && (
          <div className="lf-empty">
            <p className="lf-body--secondary" role="alert">
              {phase.message}
            </p>
            <button
              className="lf-btn lf-btn--tonal"
              type="button"
              onClick={() => void load()}
            >
              {RETRY_CTA}
            </button>
          </div>
        )}

        {phase.kind === 'READY' && (
          <>
            {responseCount > 0 && (
              <p className="lf-caption lf-caption--accent">
                {RESPONSE_COUNT_PREFIX} · {responseCount}건
              </p>
            )}
            {phase.promises.length === 0 ? (
              <div className="lf-empty">
                <PinkyBadge />
                <p className="lf-empty__title">{EMPTY_COPY}</p>
              </div>
            ) : (
              <ul className="lf-stack lf-gap-5">
                {phase.promises.map((view) => (
                  <PromiseCard
                    key={view.detail.promise_id}
                    accessToken={phase.accessToken}
                    view={view}
                    draft={drafts[view.detail.promise_id]}
                    pending={pendingPromiseId === view.detail.promise_id}
                    onDraft={(nextView, draft) =>
                      updateDraft(nextView, () => draft)
                    }
                    onFiles={handleFiles}
                    onRemoveUpload={(nextView, upload) =>
                      void handleRemoveUpload(nextView, upload)
                    }
                    onRetryUpload={handleRetryUpload}
                    onRemoveRetained={handleRemoveRetained}
                    onSubmit={(nextView, draft) => void handleSubmit(nextView, draft)}
                    onReopen={(nextView) => void handleReopen(nextView)}
                    amendOpen={activeAmendId === view.detail.promise_id}
                    onOpenAmend={(nextView) => setActiveAmendId(nextView.detail.promise_id)}
                    onCloseAmend={() => setActiveAmendId(null)}
                    onRequestAmend={handleRequestAmend}
                    onWithdrawAmend={(nextView) => void handleWithdrawAmend(nextView)}
                    onRespondAmend={(nextView, decision) => void handleRespondAmend(nextView, decision)}
                    onVersionHistory={(nextView) => void handleVersionHistory(nextView)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
        {versionHistory !== null ? (
          <VersionHistoryOverlay
            value={versionHistory.value}
            onClose={() => setVersionHistory(null)}
          />
        ) : null}
      </div>
    </div>
  );
}
