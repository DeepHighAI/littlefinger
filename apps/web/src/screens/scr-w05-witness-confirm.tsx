import {
  KEEPER_LABEL,
  KST_MARK,
  PARTICIPANT_ROLE_LABEL,
  PROMISE_CATEGORY_LABEL,
  PROMISE_STATUS_LABEL,
  formatKstDateTime,
  type EvidenceView,
  type WitnessDetailResponse,
  type WitnessFulfillmentClaim,
} from '@littlefinger/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { LfIcon } from '../components/LfIcon.tsx';
import { signFulfillmentEvidence } from '../lib/fulfillment-api.ts';
import { INTERNAL_MESSAGE } from '../lib/api-failure.ts';
import { getSupabase } from '../lib/supabase.ts';
import { signInWithKakao } from '../lib/web-auth.ts';
import {
  getWitnessDetail,
  joinWitness,
  leaveWitness,
  signWitness,
  WitnessApiError,
} from '../lib/witness-api.ts';
import { promisesPath, witnessJoinPath, witnessPath } from '../routes.ts';
import { SCR_W05_LABEL } from './scr-w05-labels.ts';

type Phase =
  | { kind: 'LOADING' }
  | { kind: 'SIGNED_OUT'; returnPath: string }
  | { kind: 'READY'; accessToken: string; detail: WitnessDetailResponse }
  | { kind: 'LEFT' }
  | { kind: 'ERROR'; message: string };

const MIN_SIGNED_URL_REFRESH_DELAY_MS = 1_000;

function kst(instant: string): string {
  return `${formatKstDateTime(new Date(instant))}${KST_MARK}`;
}

function EvidenceTile({
  accessToken,
  evidence,
}: {
  accessToken: string;
  evidence: EvidenceView;
}): React.JSX.Element {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (evidence.availability !== 'AVAILABLE') return;
    try {
      const signed = await signFulfillmentEvidence(
        accessToken,
        evidence.evidence_id,
        'THUMBNAIL',
      );
      if (!mounted.current) return;
      setSignedUrl(signed.signed_url);
      if (expiryTimer.current !== null) clearTimeout(expiryTimer.current);
      const delay = Math.max(
        MIN_SIGNED_URL_REFRESH_DELAY_MS,
        Date.parse(signed.expires_at) - Date.now(),
      );
      expiryTimer.current = setTimeout(() => void refresh(), delay);
    } catch {
      if (mounted.current) setSignedUrl(null);
    }
  }, [accessToken, evidence.availability, evidence.evidence_id]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      if (expiryTimer.current !== null) clearTimeout(expiryTimer.current);
    };
  }, [refresh]);

  if (evidence.availability === 'BLINDED') {
    return <div className="lf-proof lf-proof--tile">{SCR_W05_LABEL.evidenceBlinded}</div>;
  }
  if (evidence.availability === 'EXPIRED') {
    return <div className="lf-proof lf-proof--tile">{SCR_W05_LABEL.evidenceExpired}</div>;
  }

  return (
    <button
      className="lf-proof lf-proof--tile"
      type="button"
      aria-label={SCR_W05_LABEL.evidenceOpen}
      onClick={async () => {
        try {
          const signed = await signFulfillmentEvidence(
            accessToken,
            evidence.evidence_id,
            'FULL',
          );
          window.open(signed.signed_url, '_blank', 'noopener,noreferrer');
        } catch {
          await refresh();
        }
      }}
    >
      {signedUrl === null ? (
        <LfIcon name="image" />
      ) : (
        <img src={signedUrl} alt={SCR_W05_LABEL.evidencePhoto} onError={() => void refresh()} />
      )}
    </button>
  );
}

function Claim({
  accessToken,
  claim,
}: {
  accessToken: string;
  claim: WitnessFulfillmentClaim;
}): React.JSX.Element {
  return (
    <section className="lf-claim">
      <p className="lf-claim__answer">
        {PARTICIPANT_ROLE_LABEL[claim.role]} · {SCR_W05_LABEL.answer[claim.answer]}
      </p>
      <p className="lf-body">{claim.comment ?? SCR_W05_LABEL.noComment}</p>
      {claim.evidences.length > 0 && (
        <div className="lf-claim__evidence">
          {claim.evidences.map((evidence) => (
            <EvidenceTile
              key={evidence.evidence_id}
              accessToken={accessToken}
              evidence={evidence}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function WitnessContent({
  accessToken,
  detail,
}: {
  accessToken: string;
  detail: WitnessDetailResponse;
}): React.JSX.Element {
  if (detail.visibility === 'LIMITED') {
    return (
      <article className="lf-card lf-card--web lf-stack lf-gap-4 lf-text-left">
        <span className="lf-chip lf-chip--neutral">{SCR_W05_LABEL.readOnly}</span>
        <h2 className="lf-subtitle">{detail.title}</h2>
        <p className="lf-body--secondary">{SCR_W05_LABEL.limitedCreator(detail.creator.nickname)}</p>
        <p className="lf-info-banner__text">{SCR_W05_LABEL.limitedWait}</p>
      </article>
    );
  }

  const content = detail.content!;
  const partner = detail.partner!;
  return (
    <>
      <article className="lf-card lf-card--web lf-stack lf-gap-4 lf-text-left">
        <div className="lf-card__header">
          <span className="lf-chip lf-chip--neutral">{SCR_W05_LABEL.readOnly}</span>
          <span className="lf-chip lf-chip--status">{PROMISE_STATUS_LABEL[detail.status]}</span>
        </div>
        <h2 className="lf-subtitle">{detail.title}</h2>
        <p className="lf-body">{content.body}</p>
        <hr className="lf-divider" />
        <p className="lf-body--secondary">
          {SCR_W05_LABEL.category} {PROMISE_CATEGORY_LABEL[content.category]} ·{' '}
          {SCR_W05_LABEL.endDate} {content.end_date} ·{' '}
          {SCR_W05_LABEL.keeper} {KEEPER_LABEL[content.keeper]}
        </p>
        <p className="lf-caption">{SCR_W05_LABEL.parties(detail.creator.nickname, partner.nickname)}</p>
        <p className="lf-caption">{kst(detail.activated_at!)}</p>
        {content.reward !== null && <p className="lf-body">{SCR_W05_LABEL.reward} · {content.reward}</p>}
        {content.penalty !== null && <p className="lf-body">{SCR_W05_LABEL.penalty} · {content.penalty}</p>}
      </article>

      {detail.fulfillment !== null && (
        <div className="lf-claims">
          {detail.fulfillment.claims.map((claim) => (
            <Claim key={claim.role} accessToken={accessToken} claim={claim} />
          ))}
        </div>
      )}
    </>
  );
}

function WitnessActions({
  canSign,
  signedAt,
  checked,
  signPending,
  leavePending,
  onChecked,
  onSign,
  onLeave,
}: {
  canSign: boolean;
  signedAt: string | null;
  checked: boolean;
  signPending: boolean;
  leavePending: boolean;
  onChecked(value: boolean): void;
  onSign(): void;
  onLeave(): void;
}): React.JSX.Element {
  return (
    <div className="lf-screen__actions lf-screen__actions--web">
      {canSign && signedAt === null ? (
        <div className="lf-stack lf-gap-4">
          <label className="lf-row lf-gap-3">
            <input
              type="checkbox"
              checked={checked}
              disabled={leavePending}
              onChange={(event) => onChecked(event.currentTarget.checked)}
            />
            <span>{SCR_W05_LABEL.confirmCheckbox}</span>
          </label>
          <p className="lf-caption lf-text-center">{SCR_W05_LABEL.signHint}</p>
          <button
            className="lf-btn lf-btn--filled lf-btn--cta lf-btn--block"
            type="button"
            disabled={!checked || signPending || leavePending}
            onClick={onSign}
          >
            {SCR_W05_LABEL.sign}
          </button>
        </div>
      ) : canSign && signedAt !== null ? (
        <p className="lf-notice">{SCR_W05_LABEL.signedAt(kst(signedAt))}</p>
      ) : null}
      <button
        className="lf-btn lf-btn--danger lf-btn--block"
        type="button"
        disabled={signPending || leavePending}
        onClick={onLeave}
      >
        {SCR_W05_LABEL.leave}
      </button>
    </div>
  );
}

function WitnessLeaveDialog({
  signed,
  pending,
  error,
  onStay,
  onLeave,
}: {
  signed: boolean;
  pending: boolean;
  error: string | null;
  onStay(): void;
  onLeave(): void;
}): React.JSX.Element {
  return (
    <div className="lf-witness-leave-overlay">
      <button
        className="lf-scrim"
        type="button"
        aria-label={SCR_W05_LABEL.leaveStay}
        disabled={pending}
        onClick={onStay}
      />
      <section
        className="lf-sheet lf-witness-leave-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="witness-leave-title"
      >
        <div className="lf-sheet__handle" />
        <h2 id="witness-leave-title" className="lf-sheet__title">{SCR_W05_LABEL.leave}</h2>
        <p className="lf-body">
          {signed ? SCR_W05_LABEL.leaveSignedWarning : SCR_W05_LABEL.leaveUnsignedWarning}
        </p>
        {error !== null && <p role="alert" className="lf-error-text">{error}</p>}
        <div className="lf-screen__actions-row">
          <button
            className="lf-btn lf-btn--outlined lf-btn--grow"
            type="button"
            disabled={pending}
            onClick={onStay}
          >
            {SCR_W05_LABEL.leaveStay}
          </button>
          <button
            className="lf-btn lf-btn--danger lf-btn--grow"
            type="button"
            disabled={pending}
            onClick={onLeave}
          >
            {SCR_W05_LABEL.leaveConfirm}
          </button>
        </div>
      </section>
    </div>
  );
}

export function ScrW05WitnessConfirm(): React.JSX.Element {
  const { token, promise_id: promiseId } = useParams<{
    token?: string;
    promise_id?: string;
  }>();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ kind: 'LOADING' });
  const [checked, setChecked] = useState(false);
  const [signing, setSigning] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const signPending = useRef(false);
  const leavePending = useRef(false);
  const joinKey = useRef(crypto.randomUUID());
  const signKey = useRef(crypto.randomUUID());
  const leaveKey = useRef(crypto.randomUUID());

  const load = useCallback(async (signal?: AbortSignal) => {
    const returnPath = token !== undefined
      ? witnessJoinPath(token)
      : witnessPath(promiseId ?? '');
    setPhase({ kind: 'LOADING' });
    try {
      const { data } = await getSupabase().auth.getSession();
      const session = data.session;
      if (session === null) {
        setPhase({ kind: 'SIGNED_OUT', returnPath });
        return;
      }
      if (token !== undefined) {
        const joined = await joinWitness(
          session.access_token,
          token,
          joinKey.current,
          signal,
        );
        if (!signal?.aborted) navigate(witnessPath(joined.promise_id), { replace: true });
        return;
      }
      if (promiseId === undefined) throw new Error('MISSING_PROMISE_ID');
      const detail = await getWitnessDetail(session.access_token, promiseId, signal);
      if (!signal?.aborted) setPhase({ kind: 'READY', accessToken: session.access_token, detail });
    } catch (raised) {
      if (signal?.aborted) return;
      if (raised instanceof WitnessApiError && raised.authExpired) {
        setPhase({ kind: 'SIGNED_OUT', returnPath });
      } else {
        setPhase({ kind: 'ERROR', message: raised instanceof Error ? raised.message : INTERNAL_MESSAGE });
      }
    }
  }, [navigate, promiseId, token]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const runSign = useCallback(async () => {
    if (phase.kind !== 'READY' || !checked || signPending.current || leavePending.current) return;
    signPending.current = true;
    setSigning(true);
    try {
      const signed = await signWitness(
        phase.accessToken,
        phase.detail.promise_id,
        signKey.current,
      );
      setPhase((current) => current.kind === 'READY'
        ? { ...current, detail: { ...current.detail, signed_at: signed.signed_at } }
        : current);
    } catch (raised) {
      setPhase({ kind: 'ERROR', message: raised instanceof Error ? raised.message : INTERNAL_MESSAGE });
    } finally {
      signPending.current = false;
      setSigning(false);
    }
  }, [checked, phase]);

  const runLeave = useCallback(async () => {
    if (phase.kind !== 'READY' || !leaveOpen || leavePending.current || signPending.current) return;
    leavePending.current = true;
    setLeaving(true);
    setLeaveError(null);
    try {
      await leaveWitness(
        phase.accessToken,
        phase.detail.promise_id,
        leaveKey.current,
      );
      setLeaveOpen(false);
      setPhase({ kind: 'LEFT' });
    } catch (raised) {
      setLeaveError(raised instanceof Error ? raised.message : INTERNAL_MESSAGE);
    } finally {
      leavePending.current = false;
      setLeaving(false);
    }
  }, [leaveOpen, phase]);

  return (
    <div className="lf-screen">
      <div className="lf-screen__body lf-screen__body--web">
        <h1 className="lf-title lf-title--web">{SCR_W05_LABEL.title}</h1>
        <div className="lf-info-banner">
          <LfIcon name="visibility" />
          <p className="lf-info-banner__text">{SCR_W05_LABEL.role}</p>
        </div>

        {phase.kind === 'LOADING' && <div role="status" aria-label={SCR_W05_LABEL.loading} />}
        {phase.kind === 'SIGNED_OUT' && (
          <button
            className="lf-btn lf-btn--kakao lf-btn--cta lf-btn--block"
            type="button"
            onClick={() => void signInWithKakao(phase.returnPath)}
          >
            {SCR_W05_LABEL.signIn}
          </button>
        )}
        {phase.kind === 'ERROR' && (
          <div className="lf-empty">
            <p role="alert">{phase.message}</p>
            <button className="lf-btn lf-btn--tonal" type="button" onClick={() => void load()}>
              {SCR_W05_LABEL.retry}
            </button>
          </div>
        )}
        {phase.kind === 'LEFT' && (
          <div className="lf-empty">
            <p className="lf-subtitle">{SCR_W05_LABEL.leaveComplete}</p>
            <button
              className="lf-btn lf-btn--tonal lf-btn--block"
              type="button"
              onClick={() => navigate(promisesPath(), { replace: true })}
            >
              {SCR_W05_LABEL.leaveCompleteAction}
            </button>
          </div>
        )}
        {phase.kind === 'READY' && (
          <WitnessContent
            accessToken={phase.accessToken}
            detail={phase.detail}
          />
        )}
      </div>
      {phase.kind === 'READY' && (
        <WitnessActions
          canSign={phase.detail.visibility === 'FULL'}
          signedAt={phase.detail.signed_at}
          checked={checked}
          signPending={signing}
          leavePending={leaving}
          onChecked={setChecked}
          onSign={() => void runSign()}
          onLeave={() => {
            setLeaveError(null);
            setLeaveOpen(true);
          }}
        />
      )}
      {phase.kind === 'READY' && leaveOpen && (
        <WitnessLeaveDialog
          signed={phase.detail.signed_at !== null}
          pending={leaving}
          error={leaveError}
          onStay={() => {
            if (leavePending.current) return;
            setLeaveError(null);
            setLeaveOpen(false);
          }}
          onLeave={() => void runLeave()}
        />
      )}
    </div>
  );
}
