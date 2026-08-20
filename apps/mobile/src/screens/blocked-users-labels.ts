import type { Localized } from '@littlefinger/shared';

// 닉네임이 끼는 문구는 함수다 — 영어는 어순이 달라 문자열 접합으로는 못 담는다.
const ko = {
  title: '차단 목록 관리',
  back: '뒤로',
  loading: '차단 목록을 불러오는 중이에요',
  loadError: '차단 목록을 불러오지 못했어요. 다시 시도해 주세요.',
  retry: '다시 시도',
  empty: '차단한 사용자가 없어요',
  emptyDescription: '차단하면 새 초대만 제한되고 기존 기록은 바뀌지 않아요.',
  unblock: '차단 해제',
  unblockAccessibility: (nickname: string) => `${nickname} 차단 해제`,
  unblockTitle: '차단을 해제할까요?',
  unblockBody: (nickname: string) => `${nickname}님이 다시 초대를 보낼 수 있게 돼요.`,
  unblockConfirm: '해제',
  cancel: '취소',
  unblockError: '차단을 해제하지 못했어요. 다시 시도해 주세요.',
};

const en = {
  title: 'Blocked users',
  back: 'Back',
  loading: 'Loading blocked users',
  loadError: 'Could not load blocked users. Please try again.',
  retry: 'Try again',
  empty: 'No blocked users',
  emptyDescription: 'Blocking only stops new invites — existing records stay unchanged.',
  unblock: 'Unblock',
  unblockAccessibility: (nickname: string) => `Unblock ${nickname}`,
  unblockTitle: 'Unblock this user?',
  unblockBody: (nickname: string) => `${nickname} will be able to send you invites again.`,
  unblockConfirm: 'Unblock',
  cancel: 'Cancel',
  unblockError: 'Could not unblock. Please try again.',
} satisfies typeof ko;

export const BLOCKED_USERS_LABEL: Localized<typeof ko> = { ko, en };
