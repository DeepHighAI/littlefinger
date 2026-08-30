import type { PromiseHomeCard } from '@littlefinger/shared';

import { homeListItemsOf } from './scr-a02-home-rows.ts';

function card(index: number): PromiseHomeCard {
  return { promise_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` } as PromiseHomeCard;
}

describe('SCR-A02 띠배너 삽입', () => {
  test('탭 약속이 6개 이상일 때 히어로를 포함한 다섯 번째 카드 뒤에 한 번 삽입한다', () => {
    const hero = card(1);
    const rows = [2, 3, 4, 5, 6].map(card);
    const items = homeListItemsOf(hero, rows, true, 6);

    expect(items.map((item) => item.kind)).toEqual([
      'PROMISE',
      'PROMISE',
      'PROMISE',
      'PROMISE',
      'BANNER',
      'PROMISE',
    ]);
  });

  test('히어로가 없는 대기 탭은 다섯 번째 행 뒤(인덱스 5)에 삽입한다', () => {
    const rows = [1, 2, 3, 4, 5, 6].map(card);
    const items = homeListItemsOf(null, rows, true, 6);

    expect(items.findIndex((item) => item.kind === 'BANNER')).toBe(5);
    expect(items.filter((item) => item.kind === 'BANNER')).toHaveLength(1);
  });

  test('전체 건수는 6 이상인데 아직 덜 불러왔으면 불러온 행 끝에 한 번 삽입한다', () => {
    const hero = card(1);
    const rows = [2, 3, 4].map(card);
    const items = homeListItemsOf(hero, rows, true, 8);

    expect(items.map((item) => item.kind)).toEqual(['PROMISE', 'PROMISE', 'PROMISE', 'BANNER']);
  });

  test('광고 비활성 또는 약속 5개 이하는 빈 자리조차 만들지 않는다', () => {
    const rows = [1, 2, 3, 4, 5, 6].map(card);
    expect(homeListItemsOf(null, rows, false, 6).every((item) => item.kind === 'PROMISE')).toBe(true);
    expect(homeListItemsOf(null, rows.slice(0, 5), true, 5).every(
      (item) => item.kind === 'PROMISE',
    )).toBe(true);
  });
});
