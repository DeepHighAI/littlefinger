import {
  formatKstDateTime,
  toKstDate,
  type NotificationInboxItem,
} from '@littlefinger/shared';

import { SCR_A07_LABEL } from './scr-a07-labels.ts';

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
