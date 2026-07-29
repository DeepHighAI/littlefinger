import {
  ddayFrom,
  ENDPOINT,
  formatDday,
  formatKstDate,
  IDEMPOTENCY_KEY_HEADER,
  KEEPER_LABEL,
  KST_MARK,
  PARTICIPANT_ROLE_LABEL,
  PROMISE_CATEGORY_LABEL,
  WITNESS_MAX,
  type InvitePreviewResponse,
  type InviteTokenRequest,
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
import { functionUrl, getSupabase } from '../lib/supabase.ts';
import { approvalCompletePath, invitePath } from '../routes.ts';
import { PinkyBadge } from './scr-w01-invite-landing.tsx';
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

// 레퍼런스 HTML(scr-w02-promise-review.html)의 헤드라인을 그대로 쓴다. SCR-W01 과 달리
// 여기서는 작성자 닉네임을 서버가 준다.
const HEADLINE_SUFFIX = '님과의 약속, 꼼꼼히 봐주세요';
const END_DATE_LABEL = '종료일';
const KEEPER_LABEL_TEXT = '지킬 사람';
const CATEGORY_LABEL_TEXT = '카테고리';
const REWARD_LABEL = '보상';
const PENALTY_LABEL = '벌칙';
const APPROVE_CTA = '승인하기';
const AMEND_CTA = '수정 제안';
const DECLINE_CTA = '거절하기';

// 오수락 방지 확인 시트(§4-3-4 · 상위기획서 F-03). 한 문장을 질문과 결과로 끊어 놓았을 뿐
// 문구는 명세 원문 그대로다.
const CONFIRM_QUESTION_SUFFIX = '님이 보낸 약속이 맞나요?';
const CONFIRM_BODY = '승인하면 두 사람의 기록으로 확정돼요.';
const CONFIRM_YES = '네, 승인합니다';
const CONFIRM_NO = '아니에요';

/**
 * EC-B10 — 대기하는 동안 종료일이 지나 버린 경우.
 *
 * `02` 는 §4-3-4(261행)와 §10(1108행)에 서로 다른 문구를 적어 두었다. **서버가 §4-3-4 를
 * 골랐으므로**(`promise-approve/handler.ts` 의 `APPROVE_VALIDATION`) 화면도 같은 쪽을
 * 따른다 — 클라이언트 판정과 서버 거절이 다른 문장을 내면 같은 사실이 두 번 다르게 보인다.
 * 두 곳에 같은 문자열이 있는 것은 알고 있다. 수락 웹은 Edge Function 코드를 import 하지 않는다.
 */
const END_DATE_PASSED_MESSAGE =
  '종료일이 지난 약속은 승인할 수 없어요. 작성자에게 종료일 변경을 요청해 주세요.';
const END_DATE_PASSED_CTA = '종료일 변경 요청하기';

// §4-2-1 원문. 증인 사용 **예정** 여부는 §4-3-4 의 표시 요소인데 전용 문구가 없어서,
// 같은 사실을 말하는 이 문장을 쓴다. 상한은 정책 상수에서 만든다.
const WITNESS_NOTICE = `확정 후 증인을 초대할 수 있어요(최대 ${WITNESS_MAX}명)`;

type Phase =
  | { kind: 'LOADING' }
  | { kind: 'READY'; preview: InvitePreviewResponse }
  | { kind: 'UNAVAILABLE'; reason: LinkUnavailableReason }
  /**
   * 세션이 없거나 만료됐다. 이 화면에는 로그인 버튼이 없고 만들 수도 없으므로
   * (카카오 CTA 는 SCR-W01 의 것이다) 문구만 띄우면 누를 것이 없는 막다른 길이 된다.
   */
  | { kind: 'SIGNED_OUT' }
  /** SCR-W06 으로 보낼 수 없는 실패. 링크가 죽었다는 뜻이 아닌 것들이다. */
  | { kind: 'RETRY'; message: string };

/** 승인 실패 중 화면을 유지한 채 알려야 하는 것. `action` 은 EC-B10 의 출구다. */
interface ApproveError {
  message: string;
  endDatePassed: boolean;
}

function phaseForFailure(failure: ApiFailure): Phase {
  if (failure.code !== null && isLinkUnavailableReason(failure.code)) {
    return { kind: 'UNAVAILABLE', reason: failure.code };
  }
  // 로그인이 필요하다는 답에는 화면을 유지할 이유가 없다. 되돌려 보내는 SCR-W01 은
  // 세션이 살아 있으면 다시 여기로 보내므로, 살아 있는 세션이 랜딩에 갇히지도 않는다.
  if (failure.code === 'E_AUTH_REQUIRED') return { kind: 'SIGNED_OUT' };
  return { kind: 'RETRY', message: messageForFailure(failure) };
}

function isCategory(value: unknown): value is InvitePreviewResponse['category'] {
  return typeof value === 'string' && value in PROMISE_CATEGORY_LABEL;
}

function isKeeper(value: unknown): value is InvitePreviewResponse['keeper'] {
  return typeof value === 'string' && value in KEEPER_LABEL;
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
      body: JSON.stringify({ token } satisfies InviteTokenRequest),
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

  return response.ok ? { body, failure: null } : { body: null, failure: readFailure(body) };
}

export function ScrW02PromiseReview(): React.JSX.Element {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ kind: 'LOADING' });
  const [confirming, setConfirming] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<ApproveError | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  /**
   * `Idempotency-Key` 는 화면당 하나다(§7-3.6). 클릭마다 새로 만들면 두 번 눌린 승인이
   * 서버에 두 요청으로 도착하고, 멱등 캐시가 잡아 줄 근거가 사라진다.
   */
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (token === undefined) {
      setPhase({ kind: 'UNAVAILABLE', reason: 'E_NOT_FOUND' });
      return;
    }
    const controller = new AbortController();
    void callFunction(ENDPOINT.invitePreview, token, {}, controller.signal).then((result) => {
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

  const handleApprove = useCallback(async (): Promise<void> => {
    if (token === undefined) return;
    setApproving(true);
    setConfirming(false);
    setApproveError(null);

    const result = await callFunction(ENDPOINT.promiseApprove, token, {
      [IDEMPOTENCY_KEY_HEADER]: idempotencyKey,
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
      setApproving(false);
      setApproveError({ message: messageForFailure(NO_RESPONSE), endDatePassed: false });
      return;
    }

    setApproving(false);
    if (result.failure.code !== null && isLinkUnavailableReason(result.failure.code)) {
      setPhase({ kind: 'UNAVAILABLE', reason: result.failure.code });
      return;
    }
    if (result.failure.code === 'E_AUTH_REQUIRED') {
      // 검토하는 동안 세션이 끊긴 경우. 여기 남겨 두면 다시 로그인할 방법이 없다.
      setPhase({ kind: 'SIGNED_OUT' });
      return;
    }
    // 나머지(E_STATE_CONFLICT · E_DUPLICATE_ROLE · E_VALIDATION …)는 §2-3 문구를 그대로
    // 띄우고 화면을 유지한다. 이 코드들 전용 화면은 명세에 없고, 지어내지 않는다.
    setApproveError({
      message: messageForFailure(result.failure),
      endDatePassed: result.failure.action === 'AMEND_SUGGEST',
    });
  }, [idempotencyKey, navigate, token]);

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
            {phase.message}
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
  const dday = ddayFrom(preview.end_date, new Date());
  const endDatePassed = dday < 0 || approveError?.endDatePassed === true;

  return (
    // 레퍼런스의 lf-device / lf-device__viewport / lf-browserbar 는 옮기지 않는다 —
    // 실제 카카오톡 인앱 브라우저가 그 자리다. 광고는 수락 웹 전체에 없다(CLAUDE.md §8-1).
    <div className="lf-screen">
      <div className="lf-screen__body lf-screen__body--web">
        <h1 className="lf-title lf-title--web">
          {preview.creator.nickname}
          {HEADLINE_SUFFIX}
        </h1>

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
          <span className="lf-caption">{PARTICIPANT_ROLE_LABEL.CREATOR}</span>
        </div>

        <div className="lf-card lf-card--web lf-stack lf-gap-4 lf-text-left">
          <h2 className="lf-subtitle">{preview.title}</h2>
          <p className="lf-body">{preview.body}</p>
          <hr className="lf-divider" />
          <div className="lf-meta">
            <div className="lf-meta__row">
              <LfIcon name="event" />
              <span className="lf-meta__label">{END_DATE_LABEL}</span>
              {/* EC-F09 — 날짜 옆 `(KST)` 고정 표기. 같은 흐름의 SCR-W03 이 지키는 규칙을
                  여기서만 빼면, 해외에서 여는 사람이 두 화면의 날짜를 다르게 읽는다. */}
              <span className="lf-meta__value">
                {formatKstDate(preview.end_date)}
                {KST_MARK}
              </span>
              <span className="lf-dday" data-testid="dday">
                {formatDday(dday)}
              </span>
            </div>
            <div className="lf-meta__row">
              <LfIcon name="person" />
              <span className="lf-meta__label">{KEEPER_LABEL_TEXT}</span>
              <span className="lf-meta__value">{KEEPER_LABEL[preview.keeper]}</span>
            </div>
            <div className="lf-meta__row">
              <LfIcon name="sell" />
              <span className="lf-meta__label">{CATEGORY_LABEL_TEXT}</span>
              <span className="lf-meta__value">{PROMISE_CATEGORY_LABEL[preview.category]}</span>
            </div>
          </div>
        </div>

        {(preview.reward !== null || preview.penalty !== null) && (
          <div className="lf-outcomes">
            {preview.reward !== null && (
              <div className="lf-outcome lf-outcome--reward">
                <p className="lf-outcome__label">{REWARD_LABEL}</p>
                <p className="lf-outcome__value">{preview.reward}</p>
              </div>
            )}
            {preview.penalty !== null && (
              <div className="lf-outcome lf-outcome--penalty">
                <p className="lf-outcome__label">{PENALTY_LABEL}</p>
                <p className="lf-outcome__value">{preview.penalty}</p>
              </div>
            )}
          </div>
        )}

        {/* 증인 사용 **예정** 여부. false 일 때의 문구가 명세에 없어서 참일 때만 그린다. */}
        {preview.witness_enabled && (
          <p className="lf-notice" data-testid="witness-notice">
            <LfIcon name="person_add" />
            <span>{WITNESS_NOTICE}</span>
          </p>
        )}

        <LfDisclaimer />
      </div>

      <div className="lf-screen__actions lf-screen__actions--web">
        {endDatePassed && (
          <p className="lf-body--secondary" role="alert" data-testid="end-date-passed">
            {approveError?.endDatePassed === true ? approveError.message : END_DATE_PASSED_MESSAGE}
          </p>
        )}
        {!endDatePassed && approveError !== null && (
          <p className="lf-body--secondary" role="alert" data-testid="approve-error">
            {approveError.message}
          </p>
        )}

        <button
          className="lf-btn lf-btn--filled lf-btn--cta lf-btn--block"
          type="button"
          disabled={endDatePassed || approving}
          onClick={() => setConfirming(true)}
        >
          {APPROVE_CTA}
        </button>

        {/* 거절 · 수정 제안 · [종료일 변경 요청하기]는 **아직 연결하지 않는다.**
            셋이 도착할 종결 화면은 SCR-ID 도 레퍼런스도 문구도 없다(미해결 항목 G4).
            서버(`promise-decline` · `promise-amend`)는 이미 살아 있으므로 남은 것은 그 화면의
            문구 두 개뿐이고, 그것은 지어낼 수 없다(CLAUDE.md §1-5). */}
        {endDatePassed && (
          <button className="lf-btn lf-btn--outlined lf-btn--block" type="button" disabled>
            {END_DATE_PASSED_CTA}
          </button>
        )}
        <div className="lf-screen__actions-row">
          <button
            className="lf-btn lf-btn--outlined lf-btn--compact lf-btn--grow"
            type="button"
            disabled
          >
            {AMEND_CTA}
          </button>
          <button
            className="lf-btn lf-btn--text lf-btn--compact lf-btn--grow"
            type="button"
            disabled
          >
            {DECLINE_CTA}
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
              {preview.creator.nickname}
              {CONFIRM_QUESTION_SUFFIX}
            </h2>
            <p className="lf-body--secondary">{CONFIRM_BODY}</p>
            <button
              className="lf-btn lf-btn--filled lf-btn--cta lf-btn--block"
              type="button"
              onClick={() => void handleApprove()}
            >
              {CONFIRM_YES}
            </button>
            <button className="lf-btn-link" type="button" onClick={() => setConfirming(false)}>
              {CONFIRM_NO}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
