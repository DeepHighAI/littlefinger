import type { Localized } from '@littlefinger/shared';

import type { LinkUnavailableReason } from './scr-w06-link-expired.tsx';

/**
 * SCR-W06 문구.
 *
 * reasonBody 의 ko 는 `02` §10 의 "사용자 노출" 열 그대로다. §2-3 의 같은 코드 문구는
 * API 레벨 메시지이고, 이 화면은 그것을 덮어쓴다(§4-3-3 "사유별 문구").
 *
 * en 은 앱 INVITE_REVIEW_LABEL 의 unavailable* 문구와 문자 그대로 같아야 한다 —
 * 같은 실패를 앱에서 만나든 웹에서 만나든 같은 문장을 읽어야 한다.
 */
const ko = {
  title: '이 링크는 더 쓸 수 없어요',
  oneTimeNotice: '초대 링크는 1회용이에요',
  reasonBody: {
    E_INVITE_EXPIRED: '초대 링크가 만료되었습니다. 상대에게 새 링크를 요청해 주세요.',
    E_INVITE_USED: '이미 사용된 초대입니다.',
    E_INVITE_REVOKED: '이 초대는 취소되었습니다.',
    E_BLOCKED: '이 초대는 열 수 없습니다.',
    E_NOT_FOUND: '초대 링크를 찾을 수 없습니다.',
  } satisfies Record<LinkUnavailableReason, string>,
};

const en = {
  title: 'This link can no longer be used',
  oneTimeNotice: 'Invite links are single-use',
  reasonBody: {
    E_INVITE_EXPIRED: 'This invite link has expired. Ask for a new link.',
    E_INVITE_USED: 'This invite has already been used.',
    E_INVITE_REVOKED: 'This invite has been canceled.',
    E_BLOCKED: 'This invite cannot be opened.',
    E_NOT_FOUND: 'Invite link not found.',
  },
} satisfies typeof ko;

export const SCR_W06_LABEL: Localized<typeof ko> = { ko, en };
