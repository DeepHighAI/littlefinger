import { describe, expect, test } from 'vitest';
import { asPromiseFeaturedPresets } from './promise-presets.ts';

const valid = {
  reward: { ko: ['메뉴 고르기', '주말 계획', '칭찬 세 가지'], en: ['Menu', 'Weekend', 'Compliments'] },
  penalty: { ko: ['설거지', '소원권', '노래방'], en: ['Dishes', 'Wish', 'Karaoke'] },
};

describe('remote featured presets', () => {
  test('accepts complete bilingual configuration and normalizes text', () => {
    expect(asPromiseFeaturedPresets(valid)).toEqual(valid);
    expect(asPromiseFeaturedPresets({
      ...valid, reward: { ...valid.reward, ko: ['  메뉴 고르기 ', '주말 계획', '칭찬 세 가지'] },
    })).toEqual(valid);
  });

  test.each([null, {}, { ...valid, penalty: {} }, {
    ...valid, reward: { ...valid.reward, ko: ['한 개'] },
  }, {
    ...valid, reward: { ...valid.reward, en: ['Same', 'Same', 'Third'] },
  }, {
    ...valid, reward: { ...valid.reward, en: ['x'.repeat(101), 'Second', 'Third'] },
  }])('rejects malformed config without exposing partial locale data: %j', (value) => {
    expect(asPromiseFeaturedPresets(value)).toBeNull();
  });
});
