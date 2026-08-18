import {
  formatKstDateTime,
  toKstDate,
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
  | 'pinky'
  | 'person-off'
  | 'sync-alt'
  | 'alarm'
  | 'notification-important'
  | 'fact-check';

export interface NotificationAppearance {
  semanticType: NotificationSemanticType;
  icon: NotificationIcon;
  tone: 'accent' | 'urgent' | 'default';
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
};

const NOTIFICATION_SEMANTIC_APPEARANCE: Record<
  NotificationSemanticType,
  Omit<NotificationAppearance, 'semanticType'>
> = {
  CONFIRMATION: {
    icon: 'pinky',
    tone: 'accent',
    label: SCR_A07_NOTIFICATION_SEMANTIC_LABEL.CONFIRMATION,
  },
  APPROVAL: {
    icon: 'person-off',
    tone: 'default',
    label: SCR_A07_NOTIFICATION_SEMANTIC_LABEL.APPROVAL,
  },
  AMEND: {
    icon: 'sync-alt',
    tone: 'default',
    label: SCR_A07_NOTIFICATION_SEMANTIC_LABEL.AMEND,
  },
  REMINDER: {
    icon: 'alarm',
    tone: 'default',
    label: SCR_A07_NOTIFICATION_SEMANTIC_LABEL.REMINDER,
  },
  FULFILLMENT: {
    icon: 'notification-important',
    tone: 'urgent',
    label: SCR_A07_NOTIFICATION_SEMANTIC_LABEL.FULFILLMENT,
  },
  RESULT: {
    icon: 'fact-check',
    tone: 'default',
    label: SCR_A07_NOTIFICATION_SEMANTIC_LABEL.RESULT,
  },
};

export function notificationAppearance(event: NotificationEvent): NotificationAppearance {
  const semanticType = NOTIFICATION_EVENT_SEMANTIC_TYPE[event];
  return { semanticType, ...NOTIFICATION_SEMANTIC_APPEARANCE[semanticType] };
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

function sectionTitle(createdAt: Date, now: Date): string {
  const createdDate = toKstDate(createdAt);
  const today = toKstDate(now);
  if (createdDate === today) return SCR_A07_LABEL.today;

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  if (createdDate === toKstDate(yesterday)) return SCR_A07_LABEL.yesterday;

  const { month, day } = kstDateParts(createdAt);
  return SCR_A07_LABEL.earlierDate(month, day);
}

export function notificationTimeLabel(createdAt: string, now: Date): string {
  const created = new Date(createdAt);
  const title = sectionTitle(created, now);
  const elapsedMinutes = Math.floor((now.getTime() - created.getTime()) / (60 * 1_000));
  if (title === SCR_A07_LABEL.today) {
    if (elapsedMinutes < 1) return SCR_A07_LABEL.justNow;
    if (elapsedMinutes < 60) return SCR_A07_LABEL.minutesAgo(elapsedMinutes);
    return SCR_A07_LABEL.hoursAgo(Math.floor(elapsedMinutes / 60));
  }

  const { time } = kstDateParts(created);
  return title === SCR_A07_LABEL.yesterday
    ? SCR_A07_LABEL.yesterdayTime(time)
    : SCR_A07_LABEL.earlierTime(title, time);
}

export function notificationSections(
  items: readonly NotificationInboxItem[],
  now: Date,
): readonly NotificationSection[] {
  const sections = new Map<string, NotificationInboxItem[]>();
  [...items]
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .forEach((item) => {
      const title = sectionTitle(new Date(item.created_at), now);
      const section = sections.get(title);
      if (section === undefined) sections.set(title, [item]);
      else section.push(item);
    });
  return [...sections].map(([title, section]) => ({ title, items: section }));
}
