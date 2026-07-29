import {
  ENDPOINT,
  ERROR_CODES,
  ERROR_MESSAGE,
  type ErrorCode,
  type InviteResolveResponse,
  type InviteTokenRequest,
} from '@littlefinger/shared';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { LfIcon } from '../components/LfIcon.tsx';
import { functionUrl, getSupabase } from '../lib/supabase.ts';
import { invitePath } from '../routes.ts';
import { ScrW06LinkExpired, type LinkUnavailableReason } from './scr-w06-link-expired.tsx';

/**
 * SCR-W01 초대 랜딩 — 02 §4-3-3. **로그인 전** 화면이다.
 *
 * 카톡 링크를 누른 직후의 첫 화면이고, 여기서 보여 주는 것은 §4-3-3 이 열거한 최소 정보
 * 넷뿐이다: 작성자 닉네임 · 약속 제목 · 만료 카운트다운 · 서비스 한 줄 소개. 본문·보상·
 * 벌칙은 로그인 후 SCR-W02 의 몫이다("링크 유출 대비").
 *
 * 그 경계는 이 파일이 지키는 것이 아니라 **서버가 지킨다** — `invite-resolve` 는 애초에
 * 그 넷과 대상 역할만 돌려준다. 화면은 받은 것을 다 그린다.
 */

// 레퍼런스 HTML(scr-w01-invite-landing.html)의 문구를 그대로 옮긴다. 다만 헤드라인만은
// 디자인 요청서 §5-2 의 "○○님이 약속을 보냈어요"를 쓴다 — 레퍼런스의
// "민준님, 지우님이 새끼손가락을 내밀었어요!"는 **받는 사람 이름**을 부르는데,
// 로그인 전인 이 화면은 그 이름을 알 수 없고 서버도 주지 않는다.
const HEADLINE_SUFFIX = '님이 약속을 보냈어요';
const COUNTDOWN_SUFFIX = '안에 확인해 주세요';
const PREVIEW_SECTION_TITLE = '약속 미리보기';
const PREVIEW_HINT = '자세한 내용은 로그인 후 볼 수 있어요';
const SERVICE_INTRO_LINES = ['리틀핑거는 둘이 합의한 약속을 기록하고', '지키게 돕는 서비스예요'];
const KAKAO_CTA = '카카오 로그인하고 내용 보기';
const CTA_CAPTION = '앱 설치 없이 3분이면 끝나요';

/**
 * EC-C02 가 지정한 원문. 서버의 `INTERNAL_ERROR` 와 같은 문장이지만 그쪽은
 * `supabase/functions/_shared` 에 있고, 수락 웹은 Edge Function 코드를 import 하지 않는다.
 * 네트워크가 끊겨 응답 자체가 없을 때도 이 문구를 쓴다 — 그 경우 코드가 없다.
 */
const INTERNAL_MESSAGE = '처리 중 문제가 발생했습니다. 다시 시도해 주세요.';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

const W06_REASONS: readonly LinkUnavailableReason[] = [
  'E_INVITE_EXPIRED',
  'E_INVITE_USED',
  'E_INVITE_REVOKED',
  'E_BLOCKED',
  'E_NOT_FOUND',
];

/** 화면이 실제로 그리는 셋. `target_role` 은 받되 그리지 않는다(§4-3-3). */
type InviteContent = Pick<InviteResolveResponse, 'creator_nickname' | 'title' | 'expires_at'>;

type Phase =
  | { kind: 'LOADING' }
  | { kind: 'READY'; invite: InviteContent }
  | { kind: 'UNAVAILABLE'; reason: LinkUnavailableReason }
  /** SCR-W06 으로 보낼 수 없는 실패. 사용자가 다시 시도할 수 있는 것들이다. */
  | { kind: 'RETRY'; message: string };

function isW06Reason(code: string): code is LinkUnavailableReason {
  return (W06_REASONS as readonly string[]).includes(code);
}

function isErrorCode(code: string): code is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(code);
}

/**
 * 200 이라도 형태까지 보장되지는 않는다. 어긋난 채 그리면 크래시 없이 "님이 약속을 보냈어요"와
 * 사라진 카운트다운(`Date.parse(undefined)` = NaN)이 나와, 신뢰가 전부인 화면이 조용히 망가진다.
 * 역할이 늘어난다고 랜딩이 죽으면 안 되므로 그리지 않는 `target_role` 은 보지 않는다.
 */
function isInviteContent(body: unknown): body is InviteContent {
  if (typeof body !== 'object' || body === null) return false;
  const { creator_nickname, title, expires_at } = body as Record<string, unknown>;
  return (
    typeof creator_nickname === 'string' &&
    typeof title === 'string' &&
    typeof expires_at === 'string'
  );
}

/**
 * 남은 시간 `HH:MM:SS`. `INVITE_TTL_HOURS` 가 72라 시는 두 자리로 충분하다.
 *
 * 초 단위 표시라 내림으로 자른다 — 올림하면 마지막 1초가 `00:00:01` 에서 멈춘 것처럼 보인다.
 */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / MS_PER_SECOND));
  const seconds = total % SECONDS_PER_MINUTE;
  const minutes = Math.floor(total / SECONDS_PER_MINUTE) % MINUTES_PER_HOUR;
  const hours = Math.floor(total / (SECONDS_PER_MINUTE * MINUTES_PER_HOUR));
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

/**
 * 실패 코드 → 화면.
 *
 * 다섯은 SCR-W06 이 사유별 문구를 갖고 있다. `E_RATE_LIMIT` 은 명세 어디에도 화면이 없어서
 * (SCR-W 목록에 없다) §2-3 의 문구만 띄우고, 그 밖의 코드와 응답 없음은 EC-C02 로 떨어진다.
 */
function phaseForFailure(code: string | null): Phase {
  if (code !== null && isW06Reason(code)) {
    return { kind: 'UNAVAILABLE', reason: code };
  }
  const message = code !== null && isErrorCode(code) ? ERROR_MESSAGE[code] : null;
  return { kind: 'RETRY', message: message ?? INTERNAL_MESSAGE };
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
    return phaseForFailure(null);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return phaseForFailure(null);
  }

  if (!response.ok) {
    const code =
      typeof body === 'object' && body !== null && typeof (body as { code?: unknown }).code === 'string'
        ? ((body as { code: string }).code)
        : null;
    return phaseForFailure(code);
  }

  return isInviteContent(body) ? { kind: 'READY', invite: body } : phaseForFailure(null);
}

export function ScrW01InviteLanding(): React.JSX.Element {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<Phase>({ kind: 'LOADING' });
  const [now, setNow] = useState(() => Date.now());
  const [signingIn, setSigningIn] = useState(false);
  const [signInFailed, setSignInFailed] = useState(false);

  useEffect(() => {
    if (token === undefined) {
      setPhase({ kind: 'UNAVAILABLE', reason: 'E_NOT_FOUND' });
      return;
    }
    // StrictMode 는 이펙트를 두 번 돌리고, 토큰이 바뀌면 앞 요청이 아직 살아 있다. 취소하지
    // 않으면 먼저 띄운 요청의 늦은 응답이 뒤 결과를 덮어쓴다. 빈도 제한을 아껴 주지는
    // 못한다 — invite-resolve 는 토큰 조회보다 **먼저** 세므로 이미 소모된 뒤다.
    const controller = new AbortController();
    void resolveInvite(token, controller.signal).then((next) => {
      if (!controller.signal.aborted) setPhase(next);
    });
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (phase.kind !== 'READY') return;
    const timer = setInterval(() => setNow(Date.now()), MS_PER_SECOND);
    return () => clearInterval(timer);
  }, [phase.kind]);

  const handleKakaoLogin = useCallback(async (): Promise<void> => {
    setSigningIn(true);
    setSignInFailed(false);
    try {
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          // **토큰은 `redirectTo` 에 실어 되돌아온다.** §2-2·§4-3-3 은 OAuth `state` 에
          // 담으라고 적었지만 그 자리는 쓸 수 없다 — supabase-js 가 PKCE 검증용으로
          // `state` 를 직접 만들고 콜백에서 자기 값과 대조하므로, 우리가 끼워 넣으면
          // 로그인 자체가 깨진다. 같은 초대 URL 로 돌아오면 토큰은 경로에 그대로 있고,
          // 명세가 `state` 에 요구한 것(로그인 후 이 초대로 복귀)은 그대로 성립한다.
          redirectTo: `${window.location.origin}${invitePath(token ?? '')}`,
        },
      });
      if (error) throw error;
    } catch {
      // 로그인 실패로 화면을 갈아치우지 않는다. 여기서 사용자가 할 수 있는 일은
      // 다시 누르는 것뿐인데, 화면을 바꾸면 그 버튼이 사라진다.
      setSigningIn(false);
      setSignInFailed(true);
    }
  }, [token]);

  if (phase.kind === 'UNAVAILABLE') {
    return <ScrW06LinkExpired reason={phase.reason} />;
  }

  if (phase.kind === 'RETRY') {
    return (
      <div className="lf-screen">
        <div className="lf-screen__body lf-screen__body--web lf-screen__body--centered lf-gap-5">
          <div className="lf-status-icon">
            <LfIcon name="refresh" />
          </div>
          <p className="lf-body--secondary" role="alert" data-testid="retry-message">
            {phase.message}
          </p>
        </div>
      </div>
    );
  }

  if (phase.kind === 'LOADING') {
    // 로딩 문구는 명세에도 레퍼런스에도 없다. 없는 문구를 지어내는 대신 브랜드 마크만
    // 두고 상태는 `role="status"` 로만 알린다(PO 확인 필요).
    return (
      <div className="lf-screen">
        <div className="lf-screen__body lf-screen__body--web lf-screen__body--centered lf-gap-7">
          <div className="lf-empty" role="status" aria-busy="true" data-testid="loading">
            <PinkyBadge />
          </div>
        </div>
      </div>
    );
  }

  const remainingMs = Date.parse(phase.invite.expires_at) - now;

  return (
    // 레퍼런스의 lf-device / lf-device__viewport / lf-browserbar 는 옮기지 않는다 —
    // 실제 카카오톡 인앱 브라우저가 그 자리다. 광고는 수락 웹 전체에 없다(CLAUDE.md §8-1).
    <div className="lf-screen">
      <div className="lf-screen__body lf-screen__body--web lf-screen__body--centered lf-gap-7">
        {/* 만료 카운트다운(§4-3-3). 0 이 되면 안내를 감춘다 — 만료 판정은 서버의 몫이고
            (기기 시계는 믿지 않는다, EC-F09), 여기서 화면을 SCR-W06 으로 바꿔 버리면
            시계가 앞선 기기에서 멀쩡한 초대가 열리지 않는다. */}
        {remainingMs > 0 && (
          <p className="lf-notice">
            <LfIcon name="schedule" />
            <span className="lf-notice__timer" data-testid="countdown">
              {formatRemaining(remainingMs)}
            </span>
            <span>{COUNTDOWN_SUFFIX}</span>
          </p>
        )}

        <PinkyBadge />

        <h1 className="lf-headline">
          {phase.invite.creator_nickname}
          {HEADLINE_SUFFIX}
        </h1>

        <div className="lf-card lf-card--web lf-text-left">
          <p className="lf-section-title">{PREVIEW_SECTION_TITLE}</p>
          <p className="lf-preview__title">{phase.invite.title}</p>
          <p className="lf-preview__hint">{PREVIEW_HINT}</p>
        </div>

        <p className="lf-body--secondary">
          {SERVICE_INTRO_LINES[0]}
          <br />
          {SERVICE_INTRO_LINES[1]}
        </p>
      </div>

      <div className="lf-screen__actions lf-screen__actions--web lf-screen__actions--plain">
        <button
          className="lf-btn lf-btn--kakao lf-btn--cta lf-btn--block"
          type="button"
          disabled={signingIn}
          onClick={() => void handleKakaoLogin()}
        >
          <KakaoMark />
          <span>{KAKAO_CTA}</span>
        </button>
        {!signInFailed && <p className="lf-caption lf-text-center">{CTA_CAPTION}</p>}
        {/* 라이브 리전은 **내용이 바뀌기 전부터** DOM 에 있어야 읽힌다. `role` 과 문구를 같이
            붙이면 대부분의 스크린리더가 로그인 실패를 놓치고, 버튼은 잠겨 있어 무반응으로만
            느껴진다. 그래서 빈 채로 항상 렌더한다. */}
        <p className="lf-caption lf-text-center" role="alert">
          {signInFailed ? INTERNAL_MESSAGE : ''}
        </p>
      </div>
    </div>
  );
}

/** 브랜드 마크. 레퍼런스의 path 를 그대로 옮긴다 — 형태가 바뀌면 원본 대조가 무의미해진다. */
function PinkyBadge(): React.JSX.Element {
  return (
    <div className="lf-pinky-badge">
      <svg className="lf-pinky lf-pinky--xl" viewBox="0 0 120 120" role="img" aria-label="새끼손가락 걸기">
        <path className="lf-pinky__left" d="M40 14 L40 62 A21 21 0 0 0 82 62 L82 50" />
        <path className="lf-pinky__right" d="M80 106 L80 58 A21 21 0 0 0 38 58 L38 70" />
      </svg>
    </div>
  );
}

/** 카카오 말풍선. Material Symbols 에 없는 브랜드 마크라 인라인 SVG 다(레퍼런스와 동일). */
function KakaoMark(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7L5.6 21c-.1.4.3.7.6.5l4.1-2.7c.5.1 1.1.1 1.7.1 5.5 0 10-3.6 10-8S17.5 3 12 3z"
        fill="currentColor"
      />
    </svg>
  );
}
