import type { Localized } from '@littlefinger/shared';

const ko = {
  title: '알림',
  back: '뒤로가기',
  readAll: '모두 읽음',
  refresh: '새로고침',
  loading: '알림을 불러오는 중이에요',
  empty: '알림이 없어요',
  emptyDescription: '새로운 알림이 오면 여기에 보여요',
  loadError: '알림을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  pageLoadError: '알림을 더 불러오지 못했어요. 다시 시도해 주세요.',
  loadMore: '알림 더 보기',
  loadingMore: '알림을 더 불러오는 중이에요',
  retry: '다시 시도',
  today: '오늘',
  yesterday: '어제',
  unread: '읽지 않음',
  read: '읽음',
  justNow: '방금',
  minutesAgo: (minutes: number) => `${minutes}분 전`,
  hoursAgo: (hours: number) => `${hours}시간 전`,
  yesterdayTime: (time: string) => `어제 ${time}`,
  earlierDate: (month: string, day: string) => `${month}월 ${day}일`,
  earlierTime: (date: string, time: string) => `${date} ${time}`,
  item: (title: string, body: string, time: string, read: boolean) =>
    `${title} ${body} ${time} ${read ? '읽음' : '읽지 않음'}`,
};

// 영어 월 이름 — earlierDate 인자가 숫자 문자열이라 로케일 함수 안에서만 이름으로 바꾼다.
const EN_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const en = {
  title: 'Notifications',
  back: 'Back',
  readAll: 'Mark all read',
  refresh: 'Refresh',
  loading: 'Loading notifications',
  empty: 'No notifications',
  emptyDescription: 'New notifications will show up here',
  loadError: 'Could not load notifications. Please try again shortly.',
  pageLoadError: 'Could not load more notifications. Please try again.',
  loadMore: 'Load more notifications',
  loadingMore: 'Loading more notifications',
  retry: 'Try again',
  today: 'Today',
  yesterday: 'Yesterday',
  unread: 'Unread',
  read: 'Read',
  justNow: 'Just now',
  minutesAgo: (minutes: number) =>
    minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`,
  hoursAgo: (hours: number) => (hours === 1 ? '1 hour ago' : `${hours} hours ago`),
  yesterdayTime: (time: string) => `Yesterday ${time}`,
  earlierDate: (month: string, day: string) =>
    `${EN_MONTH_NAMES[Number(month) - 1] ?? month} ${day}`,
  earlierTime: (date: string, time: string) => `${date} ${time}`,
  item: (title: string, body: string, time: string, read: boolean) =>
    `${title} ${body} ${time} ${read ? 'Read' : 'Unread'}`,
} satisfies typeof ko;

export const SCR_A07_LABEL: Localized<typeof ko> = { ko, en };

const semanticKo = {
  CONFIRMATION: '약속 확정',
  APPROVAL: '승인 응답',
  AMEND: '변경 요청',
  REMINDER: '리마인드',
  FULFILLMENT: '이행 확인',
  RESULT: '이행 결과',
};

const semanticEn = {
  CONFIRMATION: 'Promise confirmed',
  APPROVAL: 'Approval response',
  AMEND: 'Change request',
  REMINDER: 'Reminder',
  FULFILLMENT: 'Fulfillment check',
  RESULT: 'Fulfillment result',
} satisfies typeof semanticKo;

export const SCR_A07_NOTIFICATION_SEMANTIC_LABEL: Localized<typeof semanticKo> = {
  ko: semanticKo,
  en: semanticEn,
};
