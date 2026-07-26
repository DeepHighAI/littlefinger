import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { FONT_ASSETS } from './fontAssets';
import { BRAND_FONTS_LOADED, brandFontFamily, PRETENDARD_FILES } from './fonts';

/**
 * 근거: 04 §5-4.
 *
 * RN 안드로이드는 가변 폰트의 웨이트 축 선택이 불안정해서 정적 `.ttf` 4종을 쓴다.
 * 그리고 **번들에 없는 폰트 패밀리 이름을 style 에 넣으면 렌더가 깨진다** — 그래서
 * 이름과 실제 파일이 붙어 있는지를 테스트가 직접 확인한다.
 */

const FONT_DIR = join(__dirname, '../../assets/fonts');

describe('PRETENDARD_FILES', () => {
  test('토큰이 쓰는 웨이트 4종을 모두 담는다', () => {
    // tokens.ts 의 weight 는 400 / 600 / 700 / 800 이다.
    expect(Object.keys(PRETENDARD_FILES).sort()).toEqual(['400', '600', '700', '800']);
  });

  test.each(Object.entries(PRETENDARD_FILES))(
    'weight %s 의 %s.ttf 가 실제로 번들에 있다',
    (_weight, family) => {
      expect(existsSync(join(FONT_DIR, `${family}.ttf`))).toBe(true);
    },
  );
});

describe('brandFontFamily', () => {
  test('폰트가 번들에 들어왔다고 표시돼 있다', () => {
    expect(BRAND_FONTS_LOADED).toBe(true);
  });

  test.each(Object.entries(PRETENDARD_FILES))('weight %s → %s', (weight, family) => {
    expect(brandFontFamily(weight as keyof typeof PRETENDARD_FILES)).toBe(family);
  });

  test('굵기마다 서로 다른 파일을 쓴다', () => {
    const families = Object.values(PRETENDARD_FILES);
    expect(new Set(families).size).toBe(families.length);
  });
});

describe('FONT_ASSETS — expo-font 에 넘길 로드 맵', () => {
  test('PRETENDARD_FILES 의 모든 패밀리를 빠짐없이 담는다', () => {
    // 이름만 늘리고 로드 맵에 안 넣으면 그 굵기만 조용히 시스템 폰트로 떨어진다.
    expect(Object.keys(FONT_ASSETS).sort()).toEqual(Object.values(PRETENDARD_FILES).sort());
  });

  test('모든 항목이 실제 에셋을 가리킨다', () => {
    for (const asset of Object.values(FONT_ASSETS)) {
      expect(asset).toBeDefined();
    }
  });
});
