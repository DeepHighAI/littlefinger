import type { Localized } from '@littlefinger/shared';

const ko = {
  edit: '별칭 설정',
  title: '나만의 별칭',
  close: '닫기',
  original: '상대방이 설정한 이름',
  explanation: '나에게만 보여요. 이 사람과의 모든 약속에 적용되고, 같은 계정으로 로그인한 기기에서도 보여요.',
  field: '내가 부를 이름',
  placeholder: '기억하기 쉬운 이름을 적어주세요',
  resetHelp: '비워두고 저장하면 원래 이름으로 보여요.',
  reset: '원래 이름으로 되돌리기',
  save: '저장',
  saving: '저장 중',
  loading: '이름을 불러오는 중이에요.',
  loadError: '이름을 불러오지 못했어요.',
  saveError: '별칭을 저장하지 못했어요. 다시 시도해주세요.',
  retry: '다시 시도',
  limit: (max: number) => `${max}자까지 입력할 수 있어요.`,
};

const en = {
  edit: 'Set alias',
  title: 'Your private alias',
  close: 'Close',
  original: 'Their profile name',
  explanation: 'Only you can see it. It applies to all promises with this person and syncs across devices signed in to your account.',
  field: 'What you call them',
  placeholder: 'Enter a name you will remember',
  resetHelp: 'Save an empty field to use their profile name.',
  reset: 'Restore profile name',
  save: 'Save',
  saving: 'Saving',
  loading: 'Loading their name…',
  loadError: 'Could not load their name.',
  saveError: 'Could not save the alias. Please try again.',
  retry: 'Try again',
  limit: (max: number) => `Use up to ${max} characters.`,
} satisfies typeof ko;

export const COUNTERPART_ALIAS_LABEL: Localized<typeof ko> = { ko, en };
