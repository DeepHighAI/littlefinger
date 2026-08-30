import { HOME_BANNER_AFTER_PROMISES, type PromiseHomeCard } from '@littlefinger/shared';

export type HomeListItem =
  | { kind: 'PROMISE'; promise: PromiseHomeCard }
  | { kind: 'BANNER' };

export function homeListItemsOf(
  hero: PromiseHomeCard | null,
  rows: readonly PromiseHomeCard[],
  adsEnabled: boolean,
  totalCount: number,
): HomeListItem[] {
  const items = rows.map((promise): HomeListItem => ({ kind: 'PROMISE', promise }));
  if (!adsEnabled || totalCount <= HOME_BANNER_AFTER_PROMISES) return items;
  const promisesBeforeRows = hero === null ? 0 : 1;
  const insertAt = Math.max(0, HOME_BANNER_AFTER_PROMISES - promisesBeforeRows);
  items.splice(Math.min(insertAt, items.length), 0, { kind: 'BANNER' });
  return items;
}
