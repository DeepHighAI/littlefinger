import { buildInviteAppIntentUri, buildPlayStoreUrl, ENDPOINT, type InviteResolveResponse, type InviteTokenRequest } from '@littlefinger/shared';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LfOval } from '../components/LfMascot.tsx';
import { messageForFailure, NO_RESPONSE, readFailure, type ApiFailure } from '../lib/api-failure.ts';
import { useLabels } from '../lib/locale.tsx';
import { functionUrl } from '../lib/supabase.ts';
import { SCR_W01_LABEL } from './scr-w01-labels.ts';
import { isLinkUnavailableReason, ScrW06LinkExpired, type LinkUnavailableReason } from './scr-w06-link-expired.tsx';
type InviteContent = Pick<InviteResolveResponse, 'creator_nickname' | 'title' | 'expires_at' | 'sender_nickname'> & {
  /** 모르는 값이면 `null`. 랜딩은 역할이 늘어난다고 죽으면 안 된다. */
  target_role: string | null;
};

type Phase =
  | { kind: 'LOADING' }
  | { kind: 'READY'; invite: InviteContent }
  | { kind: 'UNAVAILABLE'; reason: LinkUnavailableReason }
  /** SCR-W06 으로 보낼 수 없는 실패. 사용자가 다시 시도할 수 있는 것들이다. */
  | { kind: 'RETRY'; message: string };

// 서버 응답 형태가 바뀌어도 발송자나 제목이 비어 있는 초대를 표시하지 않는다.
function parseInviteContent(body: unknown): InviteContent | null {
  if (typeof body !== 'object' || body === null) return null;
  const { creator_nickname, title, expires_at, target_role } = body as Record<string, unknown>;
  if (
    typeof creator_nickname !== 'string' ||
    typeof title !== 'string' ||
    typeof expires_at !== 'string'
  ) {
    return null;
  }
  return {
    creator_nickname,
    ...(typeof (body as Record<string, unknown>)['sender_nickname'] === 'string' ? { sender_nickname: (body as Record<string, unknown>)['sender_nickname'] as string } : {}),
    title,
    expires_at,
    target_role: typeof target_role === 'string' ? target_role : null,
  };
}

/**
 * 실패 코드 → 화면.
 *
 * 다섯은 SCR-W06 이 사유별 문구를 갖고 있다. `E_RATE_LIMIT` 은 명세 어디에도 화면이 없어서
 * (SCR-W 목록에 없다) §2-3 의 문구만 띄우고, 그 밖의 코드와 응답 없음은 EC-C02 로 떨어진다.
 */
function phaseForFailure(failure: ApiFailure): Phase {
  if (failure.code !== null && isLinkUnavailableReason(failure.code)) {
    return { kind: 'UNAVAILABLE', reason: failure.code };
  }
  return { kind: 'RETRY', message: messageForFailure(failure) };
}

async function resolveInvite(token: string, signal: AbortSignal): Promise<Phase> {
  let response: Response;
  try {
    response = await fetch(functionUrl(ENDPOINT.inviteResolve), {
      method: 'POST',
      // 이 함수는 `verify_jwt = false` 다. apikey 도 Authorization 도 요구하지 않으므로
      // 보내지 않는다 — 로그인 전 화면이 가진 열쇠는 어차피 anon 키뿐이고,
      // 필요 없는 것을 실으면 CORS 허용 헤더에만 의존하는 표면이 넓어진다.
      headers: { 'Content-Type': 'application/json' },
      // 토큰은 본문으로만 보낸다. 쿼리스트링에 실으면 프록시·히스토리·액세스 로그에
      // 원문이 남아 "원본 토큰 미저장"(§13)이 DB 밖에서 깨진다.
      body: JSON.stringify({ token } satisfies InviteTokenRequest),
      signal,
    });
  } catch {
    // 네트워크 실패. 코드가 없다.
    return phaseForFailure(NO_RESPONSE);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return phaseForFailure(NO_RESPONSE);
  }

  if (!response.ok) {
    return phaseForFailure(readFailure(body));
  }

  const invite = parseInviteContent(body);
  return invite === null ? phaseForFailure(NO_RESPONSE) : { kind: 'READY', invite };
}

export function ScrW01InviteLanding(): React.JSX.Element {
  const L = useLabels(SCR_W01_LABEL);
  const { token = '' } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<Phase>({ kind: 'LOADING' });
  const [retry, setRetry] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const confirmHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (confirming) confirmHeading.current?.focus(); }, [confirming]);
  const [busy, setBusy] = useState(false);
  const declineRequest = useRef<AbortController | null>(null);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    declineRequest.current?.abort(); declineRequest.current = null; setBusy(false);
    setPhase({ kind: 'LOADING' }); setDeclined(false); setConfirming(false); setError('');
    void resolveInvite(token, controller.signal).then(next => {
      if (!controller.signal.aborted) setPhase(next);
    });
    return () => { controller.abort(); declineRequest.current?.abort(); };
  }, [token, retry]);
  async function decline(): Promise<void> {
    if (declineRequest.current !== null) return;
    const controller = new AbortController(); declineRequest.current = controller;
    setBusy(true); setError('');
    try {
      const response = await fetch(functionUrl(ENDPOINT.inviteDeclinePublic), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), signal: controller.signal,
      });
      const body: unknown = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const failure = phaseForFailure(readFailure(body));
        if (failure.kind === 'UNAVAILABLE') setPhase(failure);
        else if (failure.kind === 'RETRY') setError(failure.message);
        return;
      }
      if (typeof body !== 'object' || body === null || !('status' in body) || body.status !== 'DECLINED') {
        setError(messageForFailure(NO_RESPONSE)); return;
      }
      setDeclined(true); setConfirming(false);
    } catch { if (!controller.signal.aborted) setError(messageForFailure(NO_RESPONSE)); }
    finally { if (declineRequest.current === controller) { declineRequest.current = null; setBusy(false); } }
  }
  if (phase.kind === 'UNAVAILABLE') return <ScrW06LinkExpired reason={phase.reason} />;
  const android = /Android/iu.test(navigator.userAgent);
  const store = buildPlayStoreUrl({ source: 'invite', medium: 'web', campaign: 'app-handoff' });
  const appUri = buildInviteAppIntentUri(window.location.origin, token, store);
  return <div className="lf-screen lf-invite-landing">
    <main className="lf-screen__body lf-screen__body--web lf-invite-landing__body">
      <PinkyBadge />
      {phase.kind === 'LOADING' ? <div role="status" aria-busy="true" /> : null}
      {phase.kind === 'RETRY' ? <><p role="alert">{phase.message}</p><button className="lf-btn lf-btn--outlined" onClick={() => setRetry(n => n + 1)}>{L.retry}</button></> : null}
      {declined ? <><h1 className="lf-title">{L.declined}</h1><p className="lf-body--secondary">{L.declinedHint}</p></> : phase.kind === 'READY' ? <>
        <p className="lf-body--secondary lf-invite-landing__sender">{phase.invite.target_role === 'WITNESS' ? L.witnessHeadline(phase.invite.sender_nickname ?? phase.invite.creator_nickname) : L.headline(phase.invite.creator_nickname)}</p>
        <h1 className="lf-title lf-title--heavy lf-invite-landing__title">{phase.invite.title}</h1>
      </> : null}
    </main>
    {phase.kind === 'READY' && !declined ? <section className="lf-screen__actions lf-screen__actions--web lf-invite-landing__actions">
      {confirming ? <div className="lf-invite-landing__confirm" role="group" aria-labelledby="decline-heading">
        <h2 id="decline-heading" className="lf-title" tabIndex={-1} ref={confirmHeading}>{L.confirmDecline}</h2>
        <p className="lf-body--secondary">{L.declineHint}</p>
        <button className="lf-btn lf-btn--outlined lf-btn--block" disabled={busy} onClick={() => void decline()}>{busy ? L.declining : L.decline}</button>
        <button className="lf-btn lf-btn--text lf-btn--block" disabled={busy} onClick={() => setConfirming(false)}>{L.stay}</button>
      </div> : <>
        <a className="lf-btn lf-btn--filled lf-btn--cta lf-btn--block" href={android ? appUri ?? store : store} data-testid="continue-in-app">{L.continueInApp}</a>
        <button className="lf-btn lf-btn--outlined lf-btn--block" onClick={() => setConfirming(true)}>{L.decline}</button>
        <p className="lf-caption lf-text-center">{android ? <a href={store}>{L.installHint}</a> : L.androidHint}</p>
      </>}
      <p role="alert" className="lf-caption lf-text-center">{error}</p>
    </section> : null}
  </div>;
}
export function PinkyBadge(): React.JSX.Element { return <LfOval variant="web" />; }
