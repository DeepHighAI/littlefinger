import {
  FULFILLMENT_COMMENT_MAX,
  KST_MARK,
  PARTICIPANT_ROLE_LABEL,
  PROMISE_STATUS_LABEL,
  codepointLength,
  formatKstDate,
  formatKstDateTime,
  normalizeInput,
  type Answer,
  type FulfillmentCheckView,
  type ParticipantPromiseSummary,
  type ParticipantRole,
  type PromiseFulfillmentDetailResponse,
} from '@littlefinger/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { LfIcon } from '../components/LfIcon.tsx';
import {
  FulfillmentApiError,
  getPromiseFulfillmentDetail,
  listParticipantPromises,
  reopenFulfillment,
  submitFulfillment,
} from '../lib/fulfillment-api.ts';
import { INTERNAL_MESSAGE } from '../lib/api-failure.ts';
import { getSupabase } from '../lib/supabase.ts';
import { signInWithKakao } from '../lib/web-auth.ts';
import { promisesPath } from '../routes.ts';
import { PinkyBadge } from './scr-w01-invite-landing.tsx';

const PAGE_TITLE = '참여 중인 약속';
const RESPONSE_COUNT_PREFIX = '응답이 필요해요';
const SIGN_IN_CTA = '카카오 로그인';
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

const ANSWER_LABEL: Record<Answer, string> = {
  KEPT: '지켰어요',
  NOT_KEPT: '안 지켜졌어요',
};

interface PromiseView {
  summary: ParticipantPromiseSummary;
  detail: PromiseFulfillmentDetailResponse;
}

type Phase =
  | { kind: 'LOADING' }
  | { kind: 'SIGNED_OUT' }
  | { kind: 'ERROR'; message: string }
  | { kind: 'READY'; accessToken: string; promises: PromiseView[] };

interface ResponseDraft {
  answer: Answer | null;
  comment: string;
  revising: boolean;
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
  role: Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>;
  check: FulfillmentCheckView | null;
}

function Claim({ role, check }: ClaimProps): React.JSX.Element {
  return (
    <div className="lf-claim">
      <p className="lf-claim__who">{PARTICIPANT_ROLE_LABEL[role]}</p>
      <p className="lf-claim__answer">
        {check === null ? '응답 없음' : ANSWER_LABEL[check.answer]}
      </p>
      {check?.comment && <p className="lf-claim__comment">{check.comment}</p>}
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
  detail: PromiseFulfillmentDetailResponse;
}

function Claims({ detail }: ClaimsProps): React.JSX.Element {
  const checks = checksByRole(detail);
  return (
    <div className="lf-claims">
      <Claim role="CREATOR" check={checks.CREATOR} />
      <Claim role="PARTNER" check={checks.PARTNER} />
    </div>
  );
}

interface ResponseFormProps {
  draft: ResponseDraft;
  pending: boolean;
  onChange: (next: ResponseDraft) => void;
  onSubmit: () => void;
}

function ResponseForm({
  draft,
  pending,
  onChange,
  onSubmit,
}: ResponseFormProps): React.JSX.Element {
  const normalized = normalizeInput(draft.comment);
  const tooLong = codepointLength(normalized) > FULFILLMENT_COMMENT_MAX;
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
      <button
        className="lf-btn lf-btn--filled lf-btn--block"
        type="button"
        disabled={pending || draft.answer === null || tooLong}
        onClick={onSubmit}
      >
        {draft.revising ? REVISE_SUBMIT_CTA : SUBMIT_CTA}
      </button>
    </div>
  );
}

interface PromiseCardProps {
  view: PromiseView;
  draft: ResponseDraft | undefined;
  pending: boolean;
  onDraft: (promiseId: string, draft: ResponseDraft) => void;
  onSubmit: (view: PromiseView, draft: ResponseDraft) => void;
  onReopen: (view: PromiseView) => void;
}

function PromiseCard({
  view,
  draft,
  pending,
  onDraft,
  onSubmit,
  onReopen,
}: PromiseCardProps): React.JSX.Element {
  const { detail, summary } = view;
  const currentDraft = draft ?? { answer: null, comment: '', revising: false };
  const currentChecks = checksByRole(detail);

  return (
    <li>
      <article
        className={`lf-card lf-card--web lf-text-left ${
          summary.needs_response ? 'lf-card--emphasis' : ''
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

        {detail.status === 'CHECKING' && detail.my_check === null && (
          <>
            <div className="lf-info-banner lf-stack lf-gap-1 lf-mt-4">
              <p>{MY_RESPONSE_PENDING}</p>
              <p>
                {detail.partner_has_submitted
                  ? COUNTERPART_SUBMITTED
                  : COUNTERPART_RESPONSE_PENDING}
              </p>
            </div>
            <ResponseForm
              draft={currentDraft}
              pending={pending}
              onChange={(next) => onDraft(detail.promise_id, next)}
              onSubmit={() => onSubmit(view, currentDraft)}
            />
          </>
        )}

        {detail.status === 'CHECKING' && detail.my_check !== null && (
          <div className="lf-stack lf-gap-3 lf-mt-4">
            <p className="lf-body--secondary">
              내 응답: {ANSWER_LABEL[detail.my_check.answer]}
            </p>
            {!detail.partner_has_submitted && <p className="lf-caption">{WAITING_COPY}</p>}
            {!currentDraft.revising &&
              !detail.partner_has_submitted &&
              detail.my_check.revised_at === null && (
                <button
                  className="lf-btn lf-btn--tonal lf-btn--block"
                  type="button"
                  onClick={() =>
                    onDraft(detail.promise_id, {
                      answer: detail.my_check?.answer ?? null,
                      comment: detail.my_check?.comment ?? '',
                      revising: true,
                    })
                  }
                >
                  {REVISE_CTA}
                </button>
              )}
            {currentDraft.revising && (
              <ResponseForm
                draft={currentDraft}
                pending={pending}
                onChange={(next) => onDraft(detail.promise_id, next)}
                onSubmit={() => onSubmit(view, currentDraft)}
              />
            )}
          </div>
        )}

        {(detail.status === 'COMPLETED' || detail.status === 'BROKEN') && (
          <div className="lf-mt-4">
            <Claims detail={detail} />
          </div>
        )}

        {detail.status === 'DISPUTED' && (
          <div className="lf-stack lf-gap-4 lf-mt-4">
            <p className="lf-body--secondary">{DISPUTED_COPY}</p>
            <Claims detail={detail} />
            {detail.history.map((round) => (
              <section className="lf-history" key={round.round_no}>
                <h3 className="lf-section-title">{round.round_no}차 확인 기록</h3>
                <div className="lf-claims">
                  <Claim role="CREATOR" check={round.creator_check} />
                  <Claim role="PARTNER" check={round.partner_check} />
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

        {detail.status === 'UNRESOLVED' && (
          <div className="lf-claims lf-mt-4">
            {(['CREATOR', 'PARTNER'] as const).map((role) => (
              <div className="lf-claim" key={role}>
                <p className="lf-claim__answer">
                  {PARTICIPANT_ROLE_LABEL[role]}{' '}
                  {currentChecks[role] === null ? '미응답' : '응답 완료'}
                </p>
              </div>
            ))}
          </div>
        )}
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
  const mutationIntents = useRef<MutationIntentStore>({});

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    setPhase({ kind: 'LOADING' });
    try {
      const { data } = await getSupabase().auth.getSession();
      const session = data.session;
      if (session === null) {
        setPhase({ kind: 'SIGNED_OUT' });
        return;
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
      if (signal?.aborted) return;
      const promises = summaries.map((summary, index) => ({
        summary,
        detail: details[index] as PromiseFulfillmentDetailResponse,
      }));
      reconcileMutationIntents(mutationIntents.current, promises);
      setPhase({
        kind: 'READY',
        accessToken: session.access_token,
        promises,
      });
    } catch (raised) {
      if (signal?.aborted) return;
      if (raised instanceof FulfillmentApiError && raised.authExpired) {
        setPhase({ kind: 'SIGNED_OUT' });
        return;
      }
      setPhase({
        kind: 'ERROR',
        message: raised instanceof Error ? raised.message : INTERNAL_MESSAGE,
      });
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

  const handleSubmit = useCallback(
    async (view: PromiseView, draft: ResponseDraft): Promise<void> => {
      if (phase.kind !== 'READY' || draft.answer === null) return;
      setPendingPromiseId(view.detail.promise_id);
      const comment = normalizeInput(draft.comment);
      const request = {
        promise_id: view.detail.promise_id,
        answer: draft.answer,
        ...(comment === '' ? {} : { comment }),
        ...(draft.revising ? { revise: true } : {}),
      };
      const storedComment = comment === '' ? null : comment;
      const slot = submitSlot(view.detail.promise_id);
      const identity = JSON.stringify([
        view.detail.promise_id,
        view.detail.check_round_no,
        draft.answer,
        storedComment,
        draft.revising,
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

  const responseCount =
    phase.kind === 'READY'
      ? phase.promises.filter(({ summary }) => summary.needs_response).length
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
            <p role="alert" className="lf-caption">
              {signInError ? INTERNAL_MESSAGE : ''}
            </p>
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
                    view={view}
                    draft={drafts[view.detail.promise_id]}
                    pending={pendingPromiseId === view.detail.promise_id}
                    onDraft={(promiseId, draft) =>
                      setDrafts((current) => ({ ...current, [promiseId]: draft }))
                    }
                    onSubmit={(nextView, draft) => void handleSubmit(nextView, draft)}
                    onReopen={(nextView) => void handleReopen(nextView)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
