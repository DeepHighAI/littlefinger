import type { Localized } from '@littlefinger/shared';

const ko = {
  title: '닉네임 설정',
  back: '뒤로',
  field: '닉네임',
  placeholder: '약속 기록에 표시할 이름',
  save: '저장',
  empty: '닉네임을 입력해 주세요.',
  tooLong: '닉네임은 40자 이하로 입력해 주세요.',
  saveError: '닉네임을 저장하지 못했어요. 다시 시도해 주세요.',
};

const en = {
  title: 'Nickname',
  back: 'Back',
  field: 'Nickname',
  placeholder: 'Name shown on promise records',
  save: 'Save',
  empty: 'Please enter a nickname.',
  tooLong: 'Nicknames can be up to 40 characters.',
  saveError: 'Could not save the nickname. Please try again.',
} satisfies typeof ko;

export const PROFILE_NICKNAME_LABEL: Localized<typeof ko> = { ko, en };
