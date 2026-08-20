import type { Localized } from '@littlefinger/shared';

const ko = {
  badge: '새끼손가락 걸기',
  title: '화면을 찾을 수 없어요',
  copy: '주소가 바뀌었거나 만료된 링크일 수 있어요.',
  action: '처음으로',
};

const en = {
  badge: 'Pinky promise',
  title: 'Screen not found',
  copy: 'The address may have changed or the link may have expired.',
  action: 'Back to start',
} satisfies typeof ko;

export const NOT_FOUND_LABEL: Localized<typeof ko> = { ko, en };
