import {
  formatKstDateTime,
  toKstDate,
  type Locale,
  type NotificationInboxItem,
  type NotificationEvent,
} from '@littlefinger/shared';

import {
  SCR_A07_LABEL,
  SCR_A07_NOTIFICATION_SEMANTIC_LABEL,
} from './scr-a07-labels.ts';

export type NotificationSemanticType =
  | 'CONFIRMATION'
  | 'APPROVAL'
  | 'AMEND'
  | 'REMINDER'
  | 'FULFILLMENT'
  | 'RESULT';

export type NotificationIcon =
  | 'eyes'
  | 'cancel'
  | 'sync_alt'
  | 'alarm'
  | 'notification_important'
  | 'inventory_2';

export interface NotificationAppearance {
  semanticType: NotificationSemanticType;
  icon: NotificationIcon;
  tone: 'paper' | 'pink' | 'cream' | 'sky' | 'muted';
  label: string;
}

const NOTIFICATION_EVENT_SEMANTIC_TYPE: Record<
  NotificationEvent,
  NotificationSemanticType
> = {
  'NT-01': 'CONFIRMATION',
  'NT-02': 'APPROVAL',
  'NT-03': 'AMEND',
  'NT-04': 'REMINDER',
  'NT-05': 'REMINDER',
  'NT-06': 'REMINDER',
  'NT-07': 'REMINDER',
  'NT-08': 'FULFILLMENT',
  'NT-09': 'FULFILLMENT',
  'NT-10': 'FULFILLMENT',
  'NT-11': 'RESULT',
  'NT-12': 'RESULT',
  'NT-13': 'RESULT',
  'NT-14': 'RESULT',
  'NT-15': 'AMEND',
  'NT-16': 'AMEND',
  'NT-17': 'AMEND',
  'NT-18': 'CONFIRMATION',
  'NT-19': 'FULFILLMENT',
  'NT-20': 'AMEND',
  'NT-21': 'REMINDER',
  'NT-22': 'REMINDER',
  'NT-23': 'REMINDER',
};

// 라벨은 로케일에 따라 호출 시점에 고르므로 아이콘·톤만 정적 표에 남긴다.
const NOTIFICATION_SEMANTIC_APPEARANCE: Record<
  NotificationSemanticType,
  Omit<NotificationAppearance, 'semanticType' | 'label'>
> = {
  CONFIRMATION: { icon: 'eyes', tone: 'paper' },
  APPROVAL: { icon: 'cancel', tone: 'muted' },
  AMEND: { icon: 'sync_alt', tone: 'sky' },
  REMINDER: { icon: 'alarm', tone: 'cream' },
  FULFILLMENT: { icon: 'notification_important', tone: 'pink' },
  RESULT: { icon: 'inventory_2', tone: 'paper' },
};

export function notificationAppearance(
  event: NotificationEvent,
  locale: Locale = 'ko',
): NotificationAppearance {
  const semanticType = NOTIFICATION_EVENT_SEMANTIC_TYPE[event];
  return {
    semanticType,
    ...NOTIFICATION_SEMANTIC_APPEARANCE[semanticType],
    label: SCR_A07_NOTIFICATION_SEMANTIC_LABEL[locale][semanticType],
  };
}

export interface NotificationSection {
  title: string;
  items: readonly NotificationInboxItem[];
}

function kstDateParts(instant: Date): { month: string; day: string; time: string } {
  const [date, time] = formatKstDateTime(instant).split(' ');
  const [, month = '', day = ''] = date?.split('-') ?? [];
  return { month: String(Number(month)), day: String(Number(day)), time: time ?? '' };
}

function sectionTitle(createdAt: Date, now: Date, locale: Locale): string {
  const labels = SCR_A07_LABEL[locale];
  const createdDate = toKstDate(createdAt);
  const today = toKstDate(now);
  if (createdDate === today) return labels.today;

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  if (createdDate === toKstDate(yesterday)) return labels.yesterday;

  const { month, day } = kstDateParts(createdAt);
  return labels.earlierDate(month, day);
}

export function notificationTimeLabel(
  createdAt: string,
  now: Date,
  locale: Locale = 'ko',
): string {
  const labels = SCR_A07_LABEL[locale];
  const created = new Date(createdAt);
  const title = sectionTitle(created, now, locale);
  const elapsedMinutes = Math.floor((now.getTime() - created.getTime()) / (60 * 1_000));
  if (title === labels.today) {
    if (elapsedMinutes < 1) return labels.justNow;
    if (elapsedMinutes < 60) return labels.minutesAgo(elapsedMinutes);
    return labels.hoursAgo(Math.floor(elapsedMinutes / 60));
  }

  const { time } = kstDateParts(created);
  return title === labels.yesterday
    ? labels.yesterdayTime(time)
    : labels.earlierTime(title, time);
}

export function notificationSections(
  items: readonly NotificationInboxItem[],
  now: Date,
  locale: Locale = 'ko',
): readonly NotificationSection[] {
  const sections = new Map<string, NotificationInboxItem[]>();
  [...items]
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .forEach((item) => {
      const title = sectionTitle(new Date(item.created_at), now, locale);
      const section = sections.get(title);
      if (section === undefined) sections.set(title, [item]);
      else section.push(item);
    });
  return [...sections].map(([title, section]) => ({ title, items: section }));
}
