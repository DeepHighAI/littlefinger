import {
  buildPlayStoreUrl,
  formatKstDateTime,
  KST_MARK,
  PARTICIPANT_ROLE_LABEL_BY_LOCALE,
  type PromiseApprovalLog,
  type PromiseApproveResponse,
} from '@littlefinger/shared';
import { Link, useLocation } from 'react-router-dom';

import { LfDisclaimer } from '../components/LfDisclaimer.tsx';
import { useLabels, useLocale } from '../lib/locale.tsx';
import { LfIcon } from '../components/LfIcon.tsx';
import { LfPinky } from '../components/LfPinky.tsx';
import { promisesPath } from '../routes.ts';
import { SCR_W03_LABEL } from './scr-w03-labels.ts';

/**
 * SCR-W03 승인 완료 — 02 §4-4-3 · §4-4-4.
 *
 * 데이터는 승인 응답 하나뿐이고, 그 응답은 **한 번만 존재한다** — 승인과 함께 초대가
 * `USED` 가 되고, 확정 기록을 계정으로 다시 읽는 경로(SCR-W04)는 아직 없다. 그래서
 * SCR-W02 가 라우터 state 로 넘긴다.
 *
 * 이 화면은 §4-4-4 의 일부만 그린다. 빠진 셋은 아래 주석이 각각 미해결 항목 번호와 함께
 * 이유를 적어 둔다 — 문구가 없거나 부를 곳이 없어서지, 잊어서가 아니다.
 */

// 문구는 scr-w03-labels.ts 로 옮겼다(이중언어 카탈로그). 라벨 출처 주석도 그곳에.
// UTM 값 유지 — 설치 전환 KPI 의 시계열이 여기서 끊기면 안 된다(02 §4-4-4).
const ANDROID_STORE_URL = buildPlayStoreUrl({
  source: 'littlefinger_web',
  medium: 'approval_complete',
});
const IOS_USER_AGENT = /iPhone|iPad|iPod/iu;

function AndroidAppHint(): React.JSX.Element | null {
  const L = useLabels(SCR_W03_LABEL);
  if (IOS_USER_AGENT.test(window.navigator.userAgent)) return null;
  return (
    <a
      aria-label={L.androidStoreCta}
      className="lf-card lf-card--web lf-app-hint"
      href={ANDROID_STORE_URL}
      rel="noreferrer"
    >
      <LfPinky size="sm" />
      <span className="lf-app-hint__text">{L.androidStoreCopy}</span>
      <LfIcon name="east" />
    </a>
  );
}

function RevisitCard(): React.JSX.Element {
  const L = useLabels(SCR_W03_LABEL);
  return (
    <div className="lf-card lf-card--web lf-stack lf-gap-4 lf-text-center">
      <p className="lf-body--secondary">{L.revisitCopy}</p>
      <Link className="lf-btn lf-btn--tonal lf-btn--block" to={promisesPath()}>
        {L.revisitCta}
      </Link>
    </div>
  );
}

function parseApprovalLog(value: unknown): PromiseApprovalLog | null {
  if (typeof value !== 'object' || value === null) return null;
  const { role, nickname, acted_at } = value as Record<string, unknown>;
  if ((role !== 'CREATOR' && role !== 'PARTNER') || typeof nickname !== 'string') return null;
  if (typeof acted_at !== 'string' || Number.isNaN(Date.parse(acted_at))) return null;
  return { role, nickname, acted_at };
}

/**
 * 라우터 state 검증. 확정 화면은 "제대로 기록됐다"를 말하는 자리라, 시각이나 지문이
 * 비어 있는 채로 그리면 그 말이 거짓이 된다.
 *
 * **SCR-W02 도 넘기기 전에 이 함수를 쓴다.** 보내는 쪽이 더 느슨하면 여기서 걸리는
 * payload 가 `replace` 로 넘어와 버리고, 그 시점에 초대는 이미 `USED` 라 뒤로가기도
 * 다시 읽을 경로도 없다.
 */
export function parseApproveResponse(state: unknown): PromiseApproveResponse | null {
  if (typeof state !== 'object' || state === null) return null;
  const { activated_at, fingerprint, approvals } = state as Record<string, unknown>;
  if (typeof activated_at !== 'string' || Number.isNaN(Date.parse(activated_at))) return null;
  if (typeof fingerprint !== 'string' || fingerprint.length === 0) return null;
  if (!Array.isArray(approvals)) return null;

  const rows = approvals.map(parseApprovalLog);
  // §4-3-5 5단계가 **2행**을 남긴다. 한쪽만 그리면 "양측 승인"이 성립하지 않는다.
  if (rows.length !== 2 || rows.some((row) => row === null)) return null;

  return { ...(state as PromiseApproveResponse), approvals: rows as PromiseApprovalLog[] };
}

export function ScrW03ApprovalComplete(): React.JSX.Element {
  const L = useLabels(SCR_W03_LABEL);
  const { locale } = useLocale();
  const { state } = useLocation();
  const result = parseApproveResponse(state);

  if (result === null) {
    // 승인 응답은 라우터 state 라 새로고침하면 사라진다. 확정 스탬프를 재구성하지는
    // 못하지만 계정 기반 SCR-W04는 서버에서 다시 읽으므로 이 출구는 항상 유효하다.
    return (
      <div className="lf-screen" data-testid="no-result">
        <div className="lf-screen__body lf-screen__body--web lf-screen__body--centered">
          <RevisitCard />
        </div>
      </div>
    );
  }

  return (
    // 레퍼런스의 lf-device / lf-device__viewport / lf-browserbar 는 옮기지 않는다.
    // 광고는 수락 웹 전체에 없다(CLAUDE.md §8-1).
    <div className="lf-screen">
      <div className="lf-screen__body lf-screen__body--web">
        {/* 확정 스탬프 — 법적 문서가 아니라 "제대로 기록됐다"는 느낌만 준다(CLAUDE.md §8-3). */}
        <div className="lf-stamp">
          <PinkyHooked />
          <h1 className="lf-stamp__headline">{L.stampLabel}</h1>
          <p className="lf-stamp__time" data-testid="confirmed-at">
            {L.confirmedAt(`${formatKstDateTime(new Date(result.activated_at))}${KST_MARK}`)}
          </p>

          {/* 양측 승인 로그(§4-3-6). 작성자의 승인 시각은 **초대 발송 시각**이고 상대방의
              것은 승인 클릭 시각이라, 두 시각이 다른 것이 정상이다. */}
          <div className="lf-stamp__approvals">
            {result.approvals.map((approval) => (
              <span className="lf-approval" key={approval.role} data-testid="approval-row">
                <LfIcon name="check" />
                {L.approvalLine(
                  approval.nickname,
                  PARTICIPANT_ROLE_LABEL_BY_LOCALE[locale][approval.role],
                  `${formatKstDateTime(new Date(approval.acted_at))}${KST_MARK}`,
                )}
              </span>
            ))}
          </div>

          {/* 기록 지문 — 확정 영역에는 항상 노출한다(Q-4). "해시"라고 부르지 않는다(§7). */}
          <p className="lf-fingerprint">
            <LfIcon name="fingerprint" />
            {L.fingerprintLabel}{' '}
            <span className="lf-fingerprint__code" data-testid="fingerprint">
              {result.fingerprint}
            </span>
          </p>
        </div>

        <LfDisclaimer />
        <RevisitCard />
        <AndroidAppHint />

        {/* 여기서 **일부러 빼는 것**:
            · 리마인드 이메일 카드(§4-4-4 2항) — PO 결정으로 MVP 미수집·미발송.
            · [버전 이력 보기](§4-4-3) — 미해결 항목 **G8**. 버전 이력을 읽는 슬러그가 없다.
            증인 서명 현황(§4-4-3)도 없다 — 확정 직후에는 증인이 존재하지 않는다(F-05 는 M3). */}
      </div>
    </div>
  );
}

/** 브랜드 마크(걸린 상태). 모든 표면이 승인된 동일 이미지 자산을 쓴다. */
function PinkyHooked(): React.JSX.Element {
  const L = useLabels(SCR_W03_LABEL);
  return <LfPinky size="lg" tone="onContainer" hooked accessibilityLabel={L.pinkyAlt} />;
}
