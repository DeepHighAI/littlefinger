import { describe, expect, test } from 'vitest';

import { profileNameFromMetadata, safeProfileName } from './profile-name.ts';

describe('공개 프로필 이름', () => {
  test('이메일 이름을 건너뛰고 제공자의 닉네임 후보를 찾는다', () => {
    expect(profileNameFromMetadata({ name: 'person@example.com', full_name: '민준' })).toBe('민준');
    expect(profileNameFromMetadata({ name: 'person@example.com', full_name: 'person@example.com' })).toBeNull();
    expect(profileNameFromMetadata({ nickname: '내 별명', name: '제공자 이름' })).toBe('내 별명');
  });
  test('빈 이름과 이메일을 가리고 정상 이름은 NFC로 표시한다', () => {
    expect(safeProfileName('  ')).toBeNull();
    expect(safeProfileName(' person@example.com ')).toBeNull();
    expect(safeProfileName('  가  ')).toBe('가');
  });
});
