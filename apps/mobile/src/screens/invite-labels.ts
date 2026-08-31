import { PROMISE_STATUS_LABEL_BY_LOCALE, type Localized } from '@littlefinger/shared';

/**
 * SCR-A04 초대 전송·대기 문구 카탈로그.
 *
 * 재발송 한도처럼 수치가 끼는 문구는 함수다 — 정책 숫자의 출처는 config 상수이고,
 * 카탈로그에 박으면 그 규칙이 깨진다. 상태 라벨(승인 대기)은 공용 맵을 그대로 쓴다.
 */
const ko = {
  title: '초대 보내기',
  back: '뒤로가기',
  waiting: PROMISE_STATUS_LABEL_BY_LOCALE.ko.PENDING,
  headline: '상대방에게 손가락을 내밀어 볼까요?',
  description: '초대장을 보내면 상대방이 손가락을 걸어야 약속이 성립돼요',
  // 공유는 OS 공유 시트다(카톡·SMS·인스타 등 전부) — 카카오 전용처럼 읽히던 라벨을
  // 실제 동작대로 고쳤다(PO 2026-08-23, C-4 결정과 일치).
  share: '초대 링크 공유하기',
  shareAgain: '링크 다시 공유',
  copy: '링크 복사하기',
  copied: '링크를 복사했어요',
  preview: '상대방에게는 이렇게 보여요',
  previewTitle: (title: string) => `약속: ${title}`,
  linkCta: '약속 확인하기',
  validTime: '초대 링크 유효 시간',
  linkNotice: '링크는 1회용이에요 · 만료되면 다시 보낼 수 있어요',
  expired: '초대가 만료됐어요',
  missing: '저장된 초대 링크를 불러올 수 없어요',
  revoked: '초대 링크를 무효화했어요',
  reissue: '초대 다시 보내기',
  revoke: '초대 링크 무효화',
  revokeFirstTitle: '초대 링크를 무효화할까요?',
  revokeFirstBody: '상대방은 이 링크를 사용할 수 없게 돼요.',
  revokeFinalTitle: '정말 링크를 무효화할까요?',
  revokeFinalBody: '약속은 승인 대기 상태로 유지돼요.',
  deletePromise: '대기 중 약속 삭제',
  deleteFirstTitle: '대기 중인 약속을 삭제할까요?',
  deleteFirstBody: '상대방에게 보낸 초대도 함께 취소돼요.',
  deleteFinalTitle: '정말 삭제할까요?',
  deleteFinalBody: '삭제하면 상대방의 수락 대기 목록에서도 사라져요.',
  continue: '계속',
  cancel: '취소',
  maxResend: (max: number) => `초대는 약속당 ${max}번까지 보낼 수 있습니다.`,
  loading: '초대 링크를 불러오는 중이에요',
  loadError: '초대 링크를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  actionError: '요청을 처리하지 못했어요. 다시 시도해 주세요.',
  witnessInvite: '증인도 초대하기',
};

const en = {
  title: 'Send invite',
  back: 'Back',
  waiting: PROMISE_STATUS_LABEL_BY_LOCALE.en.PENDING,
  headline: 'Ready to offer your pinky to your partner?',
  description: 'Send the invite — the promise forms once your partner links pinkies',
  share: 'Share invite link',
  shareAgain: 'Share link again',
  copy: 'Copy link',
  copied: 'Link copied',
  preview: 'This is what your partner sees',
  previewTitle: (title: string) => `Promise: ${title}`,
  linkCta: 'View the promise',
  validTime: 'Invite link valid for',
  linkNotice: 'The link is single-use · you can resend it after it expires',
  expired: 'The invite has expired',
  missing: 'Could not load the saved invite link',
  revoked: 'The invite link has been revoked',
  reissue: 'Resend invite',
  revoke: 'Revoke invite link',
  revokeFirstTitle: 'Revoke this invite link?',
  revokeFirstBody: 'Your partner will no longer be able to use this link.',
  revokeFinalTitle: 'Really revoke the link?',
  revokeFinalBody: 'The promise stays in Awaiting approval.',
  deletePromise: 'Delete waiting promise',
  deleteFirstTitle: 'Delete this waiting promise?',
  deleteFirstBody: 'The invite sent to your partner will be canceled too.',
  deleteFinalTitle: 'Really delete it?',
  deleteFinalBody: "It will also disappear from your partner's waiting list.",
  continue: 'Continue',
  cancel: 'Cancel',
  maxResend: (max: number) =>
    max === 1
      ? 'You can send 1 invite per promise.'
      : `You can send up to ${max} invites per promise.`,
  loading: 'Loading the invite link',
  loadError: 'Could not load the invite link. Please try again shortly.',
  actionError: 'Could not complete the request. Please try again.',
  witnessInvite: 'Invite witnesses too',
} satisfies typeof ko;

export const INVITE_LABEL: Localized<typeof ko> = { ko, en };
