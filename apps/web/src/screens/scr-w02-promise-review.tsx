import {
  ddayFrom,
  ENDPOINT,
  ERROR_HTTP_STATUS,
  formatDday,
  formatKstDate,
  IDEMPOTENCY_KEY_HEADER,
  KEEPER_LABEL_BY_LOCALE,
  KST_MARK,
  PARTICIPANT_ROLE_LABEL_BY_LOCALE,
  PROMISE_CATEGORY_LABEL_BY_LOCALE,
  validateAmendSuggestion,
  type InvitePreviewResponse,
  type InviteTokenRequest,
  type PromiseAmendRequest,
  type PromiseDeclineRequest,
} from '@littlefinger/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { LfDisclaimer } from '../components/LfDisclaimer.tsx';
import { LfIcon } from '../components/LfIcon.tsx';
import {
  messageForFailure,
  NO_RESPONSE,
  readFailure,
  type ApiFailure,
} from '../lib/api-failure.ts';
import { useLabels, useLocale } from '../lib/locale.tsx';
import { functionUrl, getSupabase } from '../lib/supabase.ts';
import {
  approvalCompletePath,
  invitePath,
  responseCompletePath,
  RESPONSE_OUTCOME,
  type ResponseOutcome,
} from '../routes.ts';
import { PinkyBadge } from './scr-w01-invite-landing.tsx';
import { SCR_W02_LABEL } from './scr-w02-labels.ts';
import { parseApproveResponse } from './scr-w03-approval-complete.tsx';
import {
  isLinkUnavailableReason,
  ScrW06LinkExpired,
  type LinkUnavailableReason,
} from './scr-w06-link-expired.tsx';

/**
 * SCR-W02 약속 검토 — 02 §4-3-4. 로그인 **후** 화면이고, 이 서비스의 전환 화면이다.
 *
 * 데이터는 `invite-preview` 하나에서 온다. 그 함수는 승인의 **읽기 쌍둥이**라 같은 가드를
 * 같은 순서로 통과한 사람에게만 전문을 준다(ADR 0004) — 그래서 이 화면은 "볼 수 있으면
 * 승인할 수 있다"를 전제해도 된다. 예외는 종료일 하나뿐이다(EC-B10).
 *
 * 광고 없음, 주 CTA 하나(승인하기), 스크롤 최소화 — 3분 완주가 목표다(§4-3-4).
 */

// 문구는 scr-w02-labels.ts 로 옮겼다(이중언어 카탈로그). 헤드라인·확인 시트·EC-B10·
// 증인 안내·수정 제안 라벨의 출처 주석도 그곳에 있다.
const AMEND_FIELD_ID = 'w02-amend-note';
const AMEND_HINT_ID = 'w02-amend-hint';

/** 상태를 바꾸는 세 액션. `Idempotency-Key` 는 이 셋마다 따로 만든다(아래 주석). */
type ActionEndpoint =
  | typeof ENDPOINT.promiseApprove
  | typeof ENDPOINT.promiseDecline
  | typeof ENDPOINT.promiseAmend;

type Phase =
  | { kind: 'LOADING' }
  | { kind: 'READY'; preview: InvitePreviewResponse }
  | { kind: 'UNAVAILABLE'; reason: LinkUnavailableReason }
  /**
   * 세션이 없거나 만료됐다. 이 화면에는 로그인 버튼이 없고 만들 수도 없으므로
   * (카카오 CTA 는 SCR-W01 의 것이다) 문구만 띄우면 누를 것이 없는 막다른 길이 된다.
   */
  | { kind: 'SIGNED_OUT' }
  /**
   * SCR-W06 으로 보낼 수 없는 실패. 링크가 죽었다는 뜻이 아닌 것들이다.
   * 문구가 아니라 실패 자체를 담는다 — 문구는 그릴 때 로케일로 풀어야, 언어를 바꾸면
   * 이미 떠 있는 오류도 따라 바뀐다.
   */
  | { kind: 'RETRY'; failure: ApiFailure };

/** 액션 실패 중 화면을 유지한 채 알려야 하는 것. `endDatePassed` 는 EC-B10 의 출구다. */
interface ActionError {
  /** RETRY 와 같은 이유로 문구가 아니라 실패를 담는다. */
  failure: ApiFailure;
  endDatePassed: boolean;
}

function phaseForFailure(failure: ApiFailure): Phase {
  if (failure.code !== null && isLinkUnavailableReason(failure.code)) {
    return { kind: 'UNAVAILABLE', reason: failure.code };
  }
  // 로그인이 필요하다는 답에는 화면을 유지할 이유가 없다. 되돌려 보내는 SCR-W01 은
  // 세션이 살아 있으면 다시 여기로 보내므로, 살아 있는 세션이 랜딩에 갇히지도 않는다.
  if (failure.code === 'E_AUTH_REQUIRED') return { kind: 'SIGNED_OUT' };
  return { kind: 'RETRY', failure };
}

function isCategory(value: unknown): value is InvitePreviewResponse['category'] {
  return typeof value === 'string' && value in PROMISE_CATEGORY_LABEL_BY_LOCALE.ko;
}

function isKeeper(value: unknown): value is InvitePreviewResponse['keeper'] {
  return typeof value === 'string' && value in KEEPER_LABEL_BY_LOCALE.ko;
}

/** `YYYY-MM-DD` 인지. 아니면 D-Day 가 NaN 이 되고, `NaN < 0` 은 false 라 EC-B10 이 열린다. */
function isIsoDate(value: unknown): value is InvitePreviewResponse['end_date'] {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

/**
 * 200 이어도 형태까지 보장되지는 않는다. 빠진 필드를 그대로 그리면 보상·벌칙이 사라진
 * 약속을 승인하게 되는데, 승인은 되돌릴 수 없다(P3).
 */
function parsePreview(body: unknown): InvitePreviewResponse | null {
  if (typeof body !== 'object' || body === null) return null;
  const value = body as Record<string, unknown>;
  const creator = value['creator'];
  if (typeof creator !== 'object' || creator === null) return null;
  const { nickname, profile_image_url } = creator as Record<string, unknown>;

  // 열거값은 **소속까지** 본다. `typeof === 'string'` 만 보고 캐스팅하면 모르는 값이
  // 라벨 맵에서 `undefined` 로 떨어져 카테고리·지킬 사람 칸이 조용히 빈 채로 그려진다.
  // "전부 읽고 승인하는" 화면에서 조용히 비는 칸은 승인의 대상이 달라졌다는 뜻이다.
  if (
    typeof value['title'] !== 'string' ||
    typeof value['body'] !== 'string' ||
    !isCategory(value['category']) ||
    !isIsoDate(value['end_date']) ||
    !isKeeper(value['keeper']) ||
    typeof value['witness_enabled'] !== 'boolean' ||
    typeof nickname !== 'string'
  ) {
    return null;
  }

  return {
    title: value['title'],
    body: value['body'],
    category: value['category'],
    end_date: value['end_date'],
    keeper: value['keeper'],
    reward: typeof value['reward'] === 'string' ? value['reward'] : null,
    penalty: typeof value['penalty'] === 'string' ? value['penalty'] : null,
    witness_enabled: value['witness_enabled'],
    creator: {
      nickname,
      profile_image_url: typeof profile_image_url === 'string' ? profile_image_url : null,
    },
  };
}

interface CallResult {
  body: unknown;
  failure: ApiFailure | null;
}

/**
 * 로그인 후 함수 호출. `invite-preview` 도 `promise-approve` 도 `verify_jwt = true` 라
 * 세션의 액세스 토큰이 반드시 실려야 한다 — `invite-resolve`(SCR-W01)의 열쇠 없는 호출을
 * 그대로 베끼면 게이트웨이가 401 로 끊고 §2-3 코드는 오지 않는다.
 */
async function callFunction(
  slug: (typeof ENDPOINT)[keyof typeof ENDPOINT],
  token: string,
  extraHeaders: Record<string, string>,
  extraBody: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<CallResult> {
  // 클라이언트를 못 만드는 것은 로그인 문제가 아니라 배포 설정 문제다(`VITE_*` 누락).
  // 한 catch 로 묶으면 그 사고가 "로그인해 주세요"로 보고돼, 배포된 웹 전체가 멀쩡한
  // 세션을 가진 사람에게도 로그인을 요구하는 것처럼 보인다. EC-C02 가 맞는 답이다.
  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    return { body: null, failure: NO_RESPONSE };
  }

  let accessToken: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token ?? null;
  } catch {
    accessToken = null;
  }
  if (accessToken === null) {
    // 서버에 물어볼 것도 없다. 같은 코드를 서버가 낼 때와 같은 문구가 나간다(§2-3).
    return { body: null, failure: { code: 'E_AUTH_REQUIRED', message: null, action: null } };
  }

  let response: Response;
  try {
    response = await fetch(functionUrl(slug), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...extraHeaders,
      },
      // 토큰은 본문으로만 보낸다. 쿼리스트링에 실으면 프록시·히스토리·액세스 로그에
      // 원문이 남아 "원본 토큰 미저장"(§13)이 DB 밖에서 깨진다.
      body: JSON.stringify({ ...({ token } satisfies InviteTokenRequest), ...extraBody }),
      ...(signal ? { signal } : {}),
    });
  } catch {
    return { body: null, failure: NO_RESPONSE };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { body: null, failure: NO_RESPONSE };
  }

  if (response.ok) return { body, failure: null };

  const failure = readFailure(body);
  // 만료된 JWT 는 함수에 닿지도 못한다 — 게이트웨이가 401 로 끊고, 그 본문에는 §2-3 코드가
  // 없다. 그대로 두면 "서버에 문제가 생겼다"(EC-C02)로 보고되는데, 서버는 멀쩡하고 다시
  // 눌러도 같은 답만 돌아온다. 401 은 인증에 대한 답이므로 로그인할 수 있는 자리로 돌린다.
  if (failure.code === null && response.status === ERROR_HTTP_STATUS.E_AUTH_REQUIRED) {
    return { body: null, failure: { code: 'E_AUTH_REQUIRED', message: null, action: null } };
  }
  return { body: null, failure };
}

export function ScrW02PromiseReview(): React.JSX.Element {
  const L = useLabels(SCR_W02_LABEL);
  // 카탈로그 밖 문구(실패 문구·공용 라벨 맵)는 로케일 키로 직접 푼다.
  const { locale } = useLocale();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ kind: 'LOADING' });
  const [confirming, setConfirming] = useState(false);
  /** 진행 중인 액션. 셋 중 하나가 날아가는 동안 나머지도 잠근다. */
  const [pending, setPending] = useState<ActionEndpoint | null>(null);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [amendComment, setAmendComment] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  /**
   * `Idempotency-Key` 는 화면당 하나이되 **엔드포인트마다** 하나다(§7-3.6).
   *
   * 클릭마다 새로 만들면 두 번 눌린 액션이 서버에 두 요청으로 도착해 멱등 캐시가 잡아 줄
   * 근거가 사라진다 — 그래서 렌더가 아니라 화면 진입 때 한 번 만든다. 셋이 **같은** 키를
   * 나눠 쓰지 않는 이유는 `lf_idempotency_begin` 이 키를 (사용자, 엔드포인트)에 묶어
   * 두기 때문이다: 한 키가 다른 엔드포인트로 다시 오면 그 함수는 `E_FORBIDDEN` 을 던진다.
   */
  const [idempotencyKeys] = useState<Record<ActionEndpoint, string>>(() => ({
    [ENDPOINT.promiseApprove]: crypto.randomUUID(),
    [ENDPOINT.promiseDecline]: crypto.randomUUID(),
    [ENDPOINT.promiseAmend]: crypto.randomUUID(),
  }));

  useEffect(() => {
    if (token === undefined) {
      setPhase({ kind: 'UNAVAILABLE', reason: 'E_NOT_FOUND' });
      return;
    }
    const controller = new AbortController();
    void callFunction(ENDPOINT.invitePreview, token, {}, {}, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.failure !== null) {
        setPhase(phaseForFailure(result.failure));
        return;
      }
      const preview = parsePreview(result.body);
      setPhase(preview === null ? phaseForFailure(NO_RESPONSE) : { kind: 'READY', preview });
    });
    return () => controller.abort();
  }, [token]);

  /**
   * 확인 시트의 포커스. 이 시트는 오수락을 막는 유일한 방어선인데(EC-B04·S-3),
   * `role="dialog"` 만으로는 포커스가 시트로 들어가지도, 갇히지도, 돌아오지도 않는다 —
   * 키보드·스크린리더 사용자에게는 시트가 열린 줄 모른 채 뒤의 [승인하기]가 그대로
   * 잡히는 상태가 된다. 닫는 수단도 `aria-hidden` 인 스크림 클릭 하나뿐이라
   * 키보드로는 닫을 수도 없다.
   */
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!confirming || sheet === null) return;
    const restoreTo = document.activeElement;
    const focusable = (): HTMLElement[] => Array.from(sheet.querySelectorAll('button'));
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setConfirming(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (first === undefined || last === undefined) return;
      const active = document.activeElement;
      const outside = !sheet.contains(active);
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // 승인이 성공하면 이 화면 자체가 사라진다. 그때 떼어진 노드에 포커스를 돌려주면
      // 포커스가 문서 맨 앞으로 튄다.
      if (restoreTo instanceof HTMLElement && restoreTo.isConnected) restoreTo.focus();
    };
  }, [confirming]);

  /**
   * 승인·거절·수정 제안이 **같은 순서로** 겪는 실패 처리. 셋이 같은 토큰에 대한 3택이라
   * 서버 쪽 판정 순서도 같다(`_shared/transition.ts`) — 화면에서 갈라 놓으면 같은 코드에
   * 액션마다 다른 답이 나온다.
   */
  const applyFailure = useCallback((failure: ApiFailure): void => {
    if (failure.code !== null && isLinkUnavailableReason(failure.code)) {
      setPhase({ kind: 'UNAVAILABLE', reason: failure.code });
      return;
    }
    if (failure.code === 'E_AUTH_REQUIRED') {
      // 검토하는 동안 세션이 끊긴 경우. 여기 남겨 두면 다시 로그인할 방법이 없다.
      setPhase({ kind: 'SIGNED_OUT' });
      return;
    }
    // 나머지(E_STATE_CONFLICT · E_DUPLICATE_ROLE · E_VALIDATION …)는 §2-3 문구를 그대로
    // 띄우고 화면을 유지한다. 이 코드들 전용 화면은 명세에 없고, 지어내지 않는다.
    setActionError({
      failure,
      endDatePassed: failure.action === 'AMEND_SUGGEST',
    });
  }, []);

  const handleApprove = useCallback(async (): Promise<void> => {
    if (token === undefined) return;
    setPending(ENDPOINT.promiseApprove);
    setConfirming(false);
    setActionError(null);

    const result = await callFunction(ENDPOINT.promiseApprove, token, {
      [IDEMPOTENCY_KEY_HEADER]: idempotencyKeys[ENDPOINT.promiseApprove],
    });

    if (result.failure === null) {
      // **SCR-W03 과 같은 함수로 본다.** 여기가 더 느슨하면 저기서 걸리는 payload 가
      // `replace` 로 넘어가 빈 화면이 되는데, 그 시점에 초대는 이미 USED 라 뒤로가기도
      // 다시 읽을 경로도 없다. 확정은 끝났는데 기록 지문을 영영 못 보게 된다.
      const approved = parseApproveResponse(result.body);
      if (approved !== null) {
        // 초대는 이 순간 USED 다. `replace` 가 아니면 뒤로가기가 이미 소모된 토큰의
        // 검토 화면으로 돌아가고, 거기서는 E_INVITE_USED 밖에 나올 것이 없다(EC-B02).
        navigate(approvalCompletePath(token), { state: approved, replace: true });
        return;
      }
      setPending(null);
      setActionError({ failure: NO_RESPONSE, endDatePassed: false });
      return;
    }

    setPending(null);
    applyFailure(result.failure);
  }, [applyFailure, idempotencyKeys, navigate, token]);

  /**
   * 거절(T-04)과 수정 제안(T-05). 승인과 달리 응답 payload 를 읽지 않는다 — 종결 화면이
   * 그리는 것은 승인된 문장 하나뿐이고, 결과는 경로에 담겨 간다.
   */
  const handleRespond = useCallback(
    async (
      slug: typeof ENDPOINT.promiseDecline | typeof ENDPOINT.promiseAmend,
      // 토큰은 `callFunction` 이 붙인다. 여기 오는 것은 §5-3 의 추가 필드뿐이다.
      body: Omit<PromiseDeclineRequest, 'token'> | Omit<PromiseAmendRequest, 'token'>,
      outcome: ResponseOutcome,
    ): Promise<void> => {
      if (token === undefined) return;
      setPending(slug);
      setActionError(null);

      const result = await callFunction(
        slug,
        token,
        { [IDEMPOTENCY_KEY_HEADER]: idempotencyKeys[slug] },
        body,
      );

      if (result.failure === null) {
        // 초대는 이 순간 USED 다(§4-3-1 "1회용"). `replace` 가 아니면 뒤로가기가 소모된
        // 토큰의 검토 화면으로 돌아가, 이미 끝난 액션을 다시 권하게 된다(EC-B02).
        navigate(responseCompletePath(token, outcome), { replace: true });
        return;
      }

      setPending(null);
      applyFailure(result.failure);
    },
    [applyFailure, idempotencyKeys, navigate, token],
  );

  if (phase.kind === 'UNAVAILABLE') {
    return <ScrW06LinkExpired reason={phase.reason} />;
  }

  if (phase.kind === 'SIGNED_OUT') {
    // 카카오 로그인 버튼은 SCR-W01 에만 있다. `replace` 라 뒤로가기가 이 화면으로
    // 되돌아오지 않는다 — 돌아와 봐야 세션은 여전히 없다.
    return <Navigate to={invitePath(token ?? '')} replace />;
  }

  if (phase.kind === 'RETRY') {
    return (
      <div className="lf-screen">
        <div className="lf-screen__body lf-screen__body--web lf-screen__body--centered lf-gap-5">
          <div className="lf-status-icon">
            <LfIcon name="refresh" />
          </div>
          <p className="lf-body--secondary" role="alert" data-testid="retry-message">
            {messageForFailure(phase.failure, locale)}
          </p>
        </div>
      </div>
    );
  }

  if (phase.kind === 'LOADING') {
    // 로딩 문구도 `<h1>` 도 없다 — 명세에도 레퍼런스에도 없어서 지어내지 않는다
    // (SCR-W01 의 미해결 항목 ⑦·⑨를 그대로 물려받는다, PO 확인 필요).
    // 브랜드 마크는 SCR-W01 과 같은 것을 쓴다. 카톡 인앱 브라우저에서 3초를 목표로 하는
    // 흐름인데 한 화면만 완전한 백지면 로딩이 아니라 끊긴 것으로 읽힌다.
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

  const { preview } = phase;
  // 클라이언트가 D-Day 로 판단한다 — `lf_invite_preview` 는 종료일을 보지 않고 정상 응답을
  // 준다(그래야 EC-B10 의 출구를 그릴 수 있다). 규칙은 서버와 같다:
  // `end_date < 오늘(KST)`. 최종 판정은 언제나 승인 트랜잭션이다.
  const dday = preview.end_date === null ? null : ddayFrom(preview.end_date, new Date());
  const endDatePassed = (dday !== null && dday < 0) || actionError?.endDatePassed === true;

  // 5~300자는 `packages/shared` 의 §5-3 규칙 그대로다. 화면에서 다시 세면 정규화 순서가
  // 갈리고(§2-3), 서버가 통과시키는 입력을 화면이 막거나 그 반대가 된다.
  const amend = validateAmendSuggestion(amendComment, locale);
  // 하한 미달 문구는 §5-3 원문이다. 상한 초과에는 문구가 없어서(`message === null`)
  // 버튼 비활성만으로 답한다 — 지어내지 않는다.
  const amendHint = amend.valid ? null : amend.message;
  const amendBlocked = !amend.valid || pending !== null;

  const suggestAmend = (): void => {
    void handleRespond(
      ENDPOINT.promiseAmend,
      { comment: amendComment },
      RESPONSE_OUTCOME.amendSuggested,
    );
  };

  return (
    // 레퍼런스의 lf-device / lf-device__viewport / lf-browserbar 는 옮기지 않는다 —
    // 실제 카카오톡 인앱 브라우저가 그 자리다. 광고는 수락 웹 전체에 없다(CLAUDE.md §8-1).
    <div className="lf-screen">
      <div className="lf-screen__body lf-screen__body--web">
        <h1 className="lf-title lf-title--web">{L.headline(preview.creator.nickname)}</h1>

        {/* 작성자 프로필(§4-3-4 표시 요소). 이름 옆의 역할 라벨은 PARTICIPANT_ROLE_LABEL 이다.
            이미지가 뜨지 않으면 이니셜로 되돌아간다 — 카카오 CDN 은 수락 웹이 내는 유일한
            외부 요청이고, 그것이 실패했을 때 깨진 이미지 상자가 남으면 신뢰가 전부인
            화면에서 가장 먼저 눈에 띈다. */}
        <div className="lf-row lf-gap-3">
          {preview.creator.profile_image_url === null || avatarFailed ? (
            <span className="lf-avatar" aria-hidden="true">
              {[...preview.creator.nickname][0] ?? ''}
            </span>
          ) : (
            <img
              className="lf-avatar"
              src={preview.creator.profile_image_url}
              alt=""
              onError={() => setAvatarFailed(true)}
            />
          )}
          <span className="lf-body">{preview.creator.nickname}</span>
          <span className="lf-caption">{PARTICIPANT_ROLE_LABEL_BY_LOCALE[locale].CREATOR}</span>
        </div>

        <div className="lf-card lf-card--web lf-stack lf-gap-4 lf-text-left">
          <h2 className="lf-subtitle">{preview.title}</h2>
          <p className="lf-body">{preview.body}</p>
          <hr className="lf-divider" />
          <div className="lf-meta">
            <div className="lf-meta__row">
              <LfIcon name="event" />
              <span className="lf-meta__label">{L.endDate}</span>
              {/* EC-F09 — 날짜 옆 `(KST)` 고정 표기. 같은 흐름의 SCR-W03 이 지키는 규칙을
                  여기서만 빼면, 해외에서 여는 사람이 두 화면의 날짜를 다르게 읽는다. */}
              <span className="lf-meta__value">
                {preview.end_date === null ? L.noEndDate : `${formatKstDate(preview.end_date, locale)}${KST_MARK}`}
              </span>
              <span className="lf-dday" data-testid="dday">
                {dday === null ? '' : formatDday(dday)}
              </span>
            </div>
            <div className="lf-meta__row">
              <LfIcon name="person" />
              <span className="lf-meta__label">{L.keeper}</span>
              <span className="lf-meta__value">{KEEPER_LABEL_BY_LOCALE[locale][preview.keeper]}</span>
            </div>
            <div className="lf-meta__row">
              <LfIcon name="sell" />
              <span className="lf-meta__label">{L.category}</span>
              <span className="lf-meta__value">
                {PROMISE_CATEGORY_LABEL_BY_LOCALE[locale][preview.category]}
              </span>
            </div>
          </div>
        </div>

        {(preview.reward !== null || preview.penalty !== null) && (
          <div className="lf-outcomes">
            {preview.reward !== null && (
              <div className="lf-outcome lf-outcome--reward">
                <p className="lf-outcome__label">{L.reward}</p>
                <p className="lf-outcome__value">{preview.reward}</p>
              </div>
            )}
            {preview.penalty !== null && (
              <div className="lf-outcome lf-outcome--penalty">
                <p className="lf-outcome__label">{L.penalty}</p>
                <p className="lf-outcome__value">{preview.penalty}</p>
              </div>
            )}
          </div>
        )}

        {/* 증인 사용 **예정** 여부. false 일 때의 문구가 명세에 없어서 참일 때만 그린다. */}
        {preview.witness_enabled && (
          <p className="lf-notice" data-testid="witness-notice">
            <LfIcon name="person_add" />
            <span>{L.witnessNotice}</span>
          </p>
        )}

        <LfDisclaimer />

        {/* 수정 제안 의견. 레퍼런스와 같이 본문 끝, 액션 블록 **밖**에 둔다 — 액션 블록은
            화면 하단에 고정돼 있어서, 여기에 입력창을 넣으면 버튼들이 통째로 밀린다. */}
        <div className="lf-field">
          <label className="lf-field__label" htmlFor={AMEND_FIELD_ID}>
            {L.amendFieldLabel}
          </label>
          <textarea
            id={AMEND_FIELD_ID}
            className="lf-dashed lf-dashed--field"
            rows={2}
            value={amendComment}
            onChange={(event) => setAmendComment(event.target.value)}
            {...(amendHint === null ? {} : { 'aria-describedby': AMEND_HINT_ID })}
          />
          {amendHint !== null && (
            <p className="lf-field__hint" id={AMEND_HINT_ID} data-testid="amend-hint">
              {amendHint}
            </p>
          )}
        </div>
      </div>

      <div className="lf-screen__actions lf-screen__actions--web">
        {endDatePassed && (
          <p className="lf-body--secondary" role="alert" data-testid="end-date-passed">
            {actionError?.endDatePassed === true
              ? messageForFailure(actionError.failure, locale)
              : L.endDatePassedMessage}
          </p>
        )}
        {!endDatePassed && actionError !== null && (
          <p className="lf-body--secondary" role="alert" data-testid="action-error">
            {messageForFailure(actionError.failure, locale)}
          </p>
        )}

        <button
          className="lf-btn lf-btn--filled lf-btn--cta lf-btn--block"
          type="button"
          disabled={endDatePassed || pending !== null}
          onClick={() => setConfirming(true)}
        >
          {L.approveCta}
        </button>

        {/* EC-B10 의 유일한 출구. §4-3-4 가 "= 수정 제안 처리"라고 못박았으므로 [수정 제안]과
            **같은 함수를 같은 조건으로** 부른다 — 승인이 잠긴 상태에서 이것까지 막히면 약속이
            초대 만료까지 PENDING 에 갇힌다. */}
        {endDatePassed && (
          <button
            className="lf-btn lf-btn--outlined lf-btn--block"
            type="button"
            disabled={amendBlocked}
            onClick={suggestAmend}
          >
            {L.endDatePassedCta}
          </button>
        )}
        <div className="lf-screen__actions-row">
          <button
            className="lf-btn lf-btn--outlined lf-btn--compact lf-btn--grow"
            type="button"
            disabled={amendBlocked}
            onClick={suggestAmend}
          >
            {L.amendCta}
          </button>
          {/* 거절 사유는 §5-3 에서 **선택**이다(S-4 · O-D2 기본안). 그래서 입력을 기다리지
              않고 바로 보낸다 — 레퍼런스에 사유 입력칸이 없고, 승인이 주 CTA 인 화면에
              거절 전용 입력칸을 새로 만드는 것은 문구·배치 모두 승인받지 않은 결정이다
              (**PO 확인 필요**). 본문에 `reason` 을 싣지 않으면 RPC 가 NULL 로 마무리한다. */}
          <button
            className="lf-btn lf-btn--text lf-btn--compact lf-btn--grow"
            type="button"
            disabled={pending !== null}
            onClick={() => {
              void handleRespond(ENDPOINT.promiseDecline, {}, RESPONSE_OUTCOME.declined);
            }}
          >
            {L.declineCta}
          </button>
        </div>
      </div>

      {/* 오수락 방지 확인 시트(§4-3-4). 잘못된 상대가 수락한 기록은 시스템이 되돌리지
          않으므로(EC-B04, S-3) 이 한 번의 확인이 유일한 방어선이다. */}
      {confirming && (
        <>
          <div className="lf-scrim" onClick={() => setConfirming(false)} aria-hidden="true" />
          <div
            className="lf-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="w02-confirm-title"
            ref={sheetRef}
          >
            <div className="lf-sheet__handle" aria-hidden="true" />
            <h2 className="lf-sheet__title" id="w02-confirm-title">
              {L.confirmQuestion(preview.creator.nickname)}
            </h2>
            <p className="lf-body--secondary">{L.confirmBody}</p>
            <button
              className="lf-btn lf-btn--filled lf-btn--cta lf-btn--block"
              type="button"
              onClick={() => void handleApprove()}
            >
              {L.confirmYes}
            </button>
            <button className="lf-btn-link" type="button" onClick={() => setConfirming(false)}>
              {L.confirmNo}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
