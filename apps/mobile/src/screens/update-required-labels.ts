import type { Localized } from '@littlefinger/shared';

const ko = {
  badge: '새끼손가락 걸기',
  title: '업데이트 후 이용해 주세요.',
  copy: '안전하게 약속을 이어가려면 최신 버전이 필요해요.',
  store: '스토어로 이동',
};

const en = {
  badge: 'Pinky promise',
  title: 'Please update to continue.',
  copy: 'The latest version is needed to keep your promises safe.',
  store: 'Go to store',
} satisfies typeof ko;

export const UPDATE_REQUIRED_LABEL: Localized<typeof ko> = { ko, en };
