import type { ErrorCode } from '@littlefinger/shared';

import { LfIcon } from '../components/LfIcon.tsx';
import { LfBlob } from '../components/LfMascot.tsx';
import { useLabels } from '../lib/locale.tsx';
import { SCR_W06_LABEL } from './scr-w06-labels.ts';

/**
 * SCR-W06 링크 무효·만료 안내.
 *
 * §4-3-3: 토큰이 만료·사용됨·무효화·없음이면 **즉시** 이 화면이고, 문구는 **사유별**이다.
 * 그래서 사유를 받는다 — 하나로 뭉친 문구는 "재발송을 부탁하면 되는지"와 "열 수 없는
 * 초대인지"를 구분해 주지 못한다.
 *
 * 문구는 `02` §10 원문이다. 레퍼런스 HTML 은 넷을 한 문장으로 합치고 "지우님에게 재발송을
 * 부탁해 주세요"로 작성자를 부르는데, **이 화면은 작성자를 알 수 없다** — invite-resolve 는
 * 실패하면 닉네임을 포함해 아무것도 돌려주지 않는다. CLAUDE.md §4 의 문서 우선순위에서
 * `02` 가 디자인 레퍼런스보다 위이므로 §10 을 따른다.
 */
type LinkUnavailableReason = Extract<
  ErrorCode,
  'E_INVITE_EXPIRED' | 'E_INVITE_USED' | 'E_INVITE_REVOKED' | 'E_BLOCKED' | 'E_NOT_FOUND'
>;

/**
 * 이 화면이 답할 수 있는 코드. 나머지 §2-3 코드는 링크가 죽었다는 뜻이 아니라서
 * 여기로 보내면 거짓말이 된다(`E_RATE_LIMIT` 은 잠시 후 열린다).
 * 사유별 문구(`02` §10 "사용자 노출" 열 그대로)는 scr-w06-labels.ts 의 reasonBody 다.
 */
const LINK_UNAVAILABLE_REASONS: readonly LinkUnavailableReason[] = [
  'E_INVITE_EXPIRED',
  'E_INVITE_USED',
  'E_INVITE_REVOKED',
  'E_BLOCKED',
  'E_NOT_FOUND',
];

export function isLinkUnavailableReason(code: string): code is LinkUnavailableReason {
  return (LINK_UNAVAILABLE_REASONS as readonly string[]).includes(code);
}

// 1회용이라는 안내는 만료·사용됨에만 맞는 설명이다. 취소·차단·없음에 붙이면 원인을
// 잘못 짚어 준다 — 링크를 다시 받아도 열리지 않는 경우들이다.
const ONE_TIME_NOTICE_REASONS: readonly LinkUnavailableReason[] = [
  'E_INVITE_EXPIRED',
  'E_INVITE_USED',
];

export function ScrW06LinkExpired({ reason }: { reason: LinkUnavailableReason }): React.JSX.Element {
  const L = useLabels(SCR_W06_LABEL);
  return (
    // 카톡 인앱 브라우저에서 열리는 종결 화면이다. 광고 금지, 주 CTA 없음.
    // 레퍼런스의 lf-browserbar 는 옮기지 않는다 — 실제 카톡 인앱 브라우저가 그 자리다.
    <div className="lf-screen">
      <div className="lf-screen__body lf-screen__body--web lf-screen__body--centered lf-gap-5">
        <LfBlob variant="empty" />

        <h1 className="lf-title lf-title--web">{L.title}</h1>

        <p className="lf-body--secondary" data-testid="reason">
          {L.reasonBody[reason]}
        </p>

        {ONE_TIME_NOTICE_REASONS.includes(reason) && (
          <p className="lf-notice">
            <LfIcon name="info" />
            <span>{L.oneTimeNotice}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export type { LinkUnavailableReason };
