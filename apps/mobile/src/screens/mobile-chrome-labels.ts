import type { Localized } from '@littlefinger/shared';

const ko = {
  home: '홈',
  create: '작성',
  profile: '마이',
  trustRate: '약속 지킴율',
  trustPending: '집계 중',
  trustSummary: (rate: number) => `지금까지 약속의 ${rate}%를 지켰어요`,
  trustPendingSummary: '약속 3개부터 지킴율을 알려드려요',
};

const en = {
  home: 'Home',
  create: 'Create',
  profile: 'My',
  trustRate: 'Promise keep rate',
  trustPending: 'Calculating',
  trustSummary: (rate: number) => `You have kept ${rate}% of your promises`,
  trustPendingSummary: 'Your keep rate appears after 3 promises',
} satisfies typeof ko;

export const MOBILE_CHROME_LABEL: Localized<typeof ko> = { ko, en };
