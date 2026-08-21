import {
  buildInviteAppIntentUri,
  buildPlayStoreUrl,
  ENDPOINT,
  LEGAL_DOCUMENT_LABELS_BY_LOCALE,
  type InviteResolveResponse,
  type InviteTokenRequest,
} from '@littlefinger/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { GoogleMark } from '../components/google-mark.tsx';
import { LfIcon } from '../components/LfIcon.tsx';
import { LfPinky } from '../components/LfPinky.tsx';
import { TestLoginForm } from '../components/test-login-form.tsx';
import { INTERNAL_MESSAGE_BY_LOCALE, messageForFailure, NO_RESPONSE, readFailure, type ApiFailure } from '../lib/api-failure.ts';
import { useLabels, useLocale } from '../lib/locale.tsx';
import { functionUrl, getSupabase } from '../lib/supabase.ts';
import { signInWithGoogle, signInWithKakao } from '../lib/web-auth.ts';
import { invitePath, legalPath, reviewPath, witnessJoinPath } from '../routes.ts';
import { SCR_W01_LABEL } from './scr-w01-labels.ts';
import {
  isLinkUnavailableReason,
  ScrW06LinkExpired,
  type LinkUnavailableReason,
} from './scr-w06-link-expired.tsx';

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

// 문구는 scr-w01-labels.ts 로 옮겼다(첫 이중언어 카탈로그). 헤드라인 출처 주석도 그곳에.
const KAKAO_SILENT_ATTEMPT_KEY = 'lf:kakao-silent-attempted';
const KAKAOTALK_USER_AGENT = /KAKAOTALK/iu;
// 스토어 유도는 안드로이드에서만 의미가 있다 — 아이폰은 앱이 없다(EC-I03, 배너 미노출).
const ANDROID_USER_AGENT = /Android/iu;

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/** 화면이 실제로 그리는 셋 + 라우팅에만 쓰는 역할. 역할은 그리지 않는다(§4-3-3). */
type InviteContent = Pick<InviteResolveResponse, 'creator_nickname' | 'title' | 'expires_at'> & {
  /** 모르는 값이면 `null`. 랜딩은 역할이 늘어난다고 죽으면 안 된다. */
  target_role: string | null;
};

type Phase =
  | { kind: 'LOADING' }
  | { kind: 'READY'; invite: InviteContent }
  | { kind: 'UNAVAILABLE'; reason: LinkUnavailableReason }
  /** SCR-W06 으로 보낼 수 없는 실패. 사용자가 다시 시도할 수 있는 것들이다. */
  | { kind: 'RETRY'; message: string };

/**
 * 200 이라도 형태까지 보장되지는 않는다. 어긋난 채 그리면 크래시 없이 "님이 약속을 보냈어요"와
 * 사라진 카운트다운(`Date.parse(undefined)` = NaN)이 나와, 신뢰가 전부인 화면이 조용히 망가진다.
 *
 * `target_role` 은 없거나 모르는 값이어도 실패로 보지 않는다 — 그리지 않는 값이고,
 * 역할이 하나 늘었다고 랜딩이 열리지 않으면 그쪽이 더 나쁘다.
 */
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
    title,
    expires_at,
    target_role: typeof target_role === 'string' ? target_role : null,
  };
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
  const { locale } = useLocale();
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<Phase>({ kind: 'LOADING' });
  const [now, setNow] = useState(() => Date.now());
  const [signingIn, setSigningIn] = useState(false);
  const [signInFailed, setSignInFailed] = useState(false);
  /** `null` 은 아직 모른다는 뜻이다. 모르는 채로 랜딩을 그리면 W02 로 넘어갈 때 한 번 번쩍인다. */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    // **`invite-resolve` 와 나란히 돈다.** 세션 조회는 네트워크를 타지 않고(저장소를 읽는다),
    // 로그인한 사람이든 아니든 역할을 알아야 갈 곳이 정해지므로 resolve 는 어차피 필요하다 —
    // `invite-preview` 는 `target_role` 을 돌려주지 않고, 증인 토큰으로 부르면 E_FORBIDDEN 이라
    // 그 코드에는 화면도 문구도 없다. 그래서 이 화면이 resolve 를 내고, SCR-W02 가 preview 를
    // 낸다. 한 사람이 같은 정보를 두 번 받는 일은 없다.
    let alive = true;
    const settle = (value: boolean): void => {
      if (alive) setSignedIn(value);
    };
    try {
      // `detectSessionInUrl` 이 켜져 있어서, 이 promise 는 OAuth 리다이렉트가 조각(fragment)에
      // 실어 온 세션의 파싱까지 기다린 뒤 답한다. 먼저 읽으면 로그인 직후가 언제나 비로그인이다.
      void getSupabase()
        .auth.getSession()
        .then(({ data }) => settle(data.session !== null))
        .catch(() => settle(false));
    } catch {
      // 환경 변수가 없으면 클라이언트를 만들 수조차 없다. 로그인하지 않은 것과 같이 다룬다.
      settle(false);
    }
    return () => {
      alive = false;
    };
  }, []);

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

  const handleKakaoLogin = useCallback(async (prompt?: 'none'): Promise<void> => {
    setSigningIn(true);
    setSignInFailed(false);
    try {
      // **토큰은 복귀 경로에 남는다.** OAuth `state` 는 supabase-js 가 PKCE 검증에 쓰므로
      // 호출자가 끼워 넣을 수 없다. 계정 재접근과 같은 헬퍼를 쓰되 복귀 경로만 다르다.
      await signInWithKakao(invitePath(token ?? ''), prompt);
    } catch {
      // 로그인 실패로 화면을 갈아치우지 않는다. 여기서 사용자가 할 수 있는 일은
      // 다시 누르는 것뿐인데, 화면을 바꾸면 그 버튼이 사라진다.
      setSigningIn(false);
      setSignInFailed(true);
    }
  }, [token]);

  const handleGoogleLogin = useCallback(async (): Promise<void> => {
    setSigningIn(true);
    setSignInFailed(false);
    try {
      await signInWithGoogle(invitePath(token ?? ''));
    } catch {
      setSigningIn(false);
      setSignInFailed(true);
    }
  }, [token]);

  useEffect(() => {
    if (
      phase.kind !== 'READY' ||
      signedIn !== false ||
      phase.invite.target_role !== 'PARTNER' ||
      !KAKAOTALK_USER_AGENT.test(window.navigator.userAgent) ||
      window.sessionStorage.getItem(KAKAO_SILENT_ATTEMPT_KEY) === '1'
    ) {
      return;
    }

    // 리다이렉트가 실패로 돌아와도 다시 prompt=none 으로 튕기지 않게 탭에서 한 번만 한다.
    // 초대 토큰은 저장하지 않는다 — 원문 토큰을 브라우저 저장소에 복제할 이유가 없다.
    window.sessionStorage.setItem(KAKAO_SILENT_ATTEMPT_KEY, '1');
    void handleKakaoLogin('none');
  }, [handleKakaoLogin, phase, signedIn]);

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

  if (phase.kind === 'LOADING' || signedIn === null) {
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

  // 로그인은 `redirectTo` 로 이 화면에 되돌아온다(§4-3-3 이 OAuth `state` 에 요구한 복귀).
  // 여기서 갈라 주지 않으면 로그인한 사람이 같은 랜딩을 영원히 다시 본다.
  if (signedIn && phase.invite.target_role === 'PARTNER') {
    // `replace` 다. 뒤로가기가 이 랜딩으로 돌아오면 다시 여기로 튕겨 무한 왕복이 된다.
    return <Navigate to={reviewPath(token ?? '')} replace />;
  }

  if (signedIn && phase.invite.target_role === 'WITNESS') {
    return <Navigate to={witnessJoinPath(token ?? '')} replace />;
  }

  const remainingMs = Date.parse(phase.invite.expires_at) - now;

  // 설치면 앱이 열리고 미설치면 스토어로 가는 단일 인텐트 URI (PO 2026-08-20: 스토어 강한
  // 유도). 카카오톡 인앱 브라우저는 App Links 검증을 타지 않으므로 이 버튼이 유일한
  // 앱 진입로다. dev(http)에서는 null 이라 버튼 자체가 없다.
  const appIntentUri = ANDROID_USER_AGENT.test(window.navigator.userAgent)
    ? buildInviteAppIntentUri(
        window.location.origin,
        token ?? '',
        buildPlayStoreUrl({ source: 'littlefinger_web', medium: 'invite_landing' }),
      )
    : null;

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
            <span>{L.countdownSuffix}</span>
          </p>
        )}

        <PinkyBadge />

        <h1 className="lf-headline">{L.headline(phase.invite.creator_nickname)}</h1>

        <div className="lf-card lf-card--web lf-text-left">
          <p className="lf-section-title">{L.previewSectionTitle}</p>
          <p className="lf-preview__title">{phase.invite.title}</p>
          <p className="lf-preview__hint">{L.previewHint}</p>
        </div>

        <p className="lf-body--secondary">
          {L.serviceIntroLines[0]}
          <br />
          {L.serviceIntroLines[1]}
        </p>
      </div>

      <div className="lf-screen__actions lf-screen__actions--web lf-screen__actions--plain">
        {appIntentUri !== null && (
          <>
            <a
              className="lf-btn lf-btn--filled lf-btn--cta lf-btn--block"
              href={appIntentUri}
              data-testid="continue-in-app"
            >
              {L.continueInApp}
            </a>
            {/* 웹 승인 경로는 남는다(01 P6) — 로그인 버튼들이 이 캡션 아래의 보조 동선이다. */}
            <p className="lf-caption lf-text-center">{L.continueOnWeb}</p>
          </>
        )}
        <button
          className="lf-btn lf-btn--kakao lf-btn--cta lf-btn--block"
          type="button"
          disabled={signingIn}
          onClick={() => void handleKakaoLogin()}
        >
          <KakaoMark />
          <span>{L.kakaoCta}</span>
        </button>
        <button
          className="lf-btn lf-btn--google lf-btn--cta lf-btn--block"
          type="button"
          disabled={signingIn}
          onClick={() => void handleGoogleLogin()}
        >
          <GoogleMark />
          <span>{L.googleCta}</span>
        </button>
        {!signInFailed && <p className="lf-caption lf-text-center">{L.ctaCaption}</p>}
        <nav className="lf-login-legal" aria-label={L.legalNav}>
          <Link to={legalPath('TERMS')}>{LEGAL_DOCUMENT_LABELS_BY_LOCALE[locale].TERMS}</Link>
          <Link to={legalPath('PRIVACY')}>{LEGAL_DOCUMENT_LABELS_BY_LOCALE[locale].PRIVACY}</Link>
        </nav>
        {/* 라이브 리전은 **내용이 바뀌기 전부터** DOM 에 있어야 읽힌다. `role` 과 문구를 같이
            붙이면 대부분의 스크린리더가 로그인 실패를 놓치고, 버튼은 잠겨 있어 무반응으로만
            느껴진다. 그래서 빈 채로 항상 렌더한다. */}
        <p className="lf-caption lf-text-center" role="alert">
          {signInFailed
            ? KAKAOTALK_USER_AGENT.test(window.navigator.userAgent)
              ? L.externalBrowserGuide
              : INTERNAL_MESSAGE_BY_LOCALE[locale]
            : ''}
        </p>
        <TestLoginForm />
      </div>
    </div>
  );
}

/**
 * 브랜드 마크. 레퍼런스의 path 를 그대로 옮긴다 — 형태가 바뀌면 원본 대조가 무의미해진다.
 * SCR-W02 의 로딩도 이것을 쓴다. 같은 흐름의 두 화면 중 하나만 흰 화면이면 로딩이
 * 아니라 끊긴 것처럼 보인다.
 */
export function PinkyBadge(): React.JSX.Element {
  const L = useLabels(SCR_W01_LABEL);
  return (
    <div className="lf-pinky-badge">
      <LfPinky size="xl" accessibilityLabel={L.pinkyBadge} />
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
