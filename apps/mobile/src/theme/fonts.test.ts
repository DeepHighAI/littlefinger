import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { FONT_ASSETS } from './fontAssets';
import { BRAND_FONT_FILES, BRAND_FONTS_LOADED, brandFontFamily } from './fonts';

/**
 * 근거: 04 §5-4 (정적 파일 원칙) + ADR 0012 (Gaegu 교체).
 *
 * RN 안드로이드는 가변 폰트의 웨이트 축 선택이 불안정해서 정적 파일을 쓴다.
 * 그리고 **번들에 없는 폰트 패밀리 이름을 style 에 넣으면 렌더가 깨진다** — 그래서
 * 이름과 실제 파일이 붙어 있는지를 테스트가 직접 확인한다.
 * Gaegu 파일은 `@expo-google-fonts/gaegu` 패키지가 싣는다.
 */

const GAEGU_PACKAGE_DIR = dirname(require.resolve('@expo-google-fonts/gaegu/package.json'));

describe('BRAND_FONT_FILES', () => {
  test('토큰이 쓰는 웨이트 2종을 모두 담는다', () => {
    // tokens.ts 의 weight 는 400/700 으로 수렴됐다 (medium→400, heavy→700).
    expect(Object.keys(BRAND_FONT_FILES).sort()).toEqual(['400', '700']);
  });

  test.each([
    ['400', '400Regular'],
    ['700', '700Bold'],
  ] as const)('weight %s 의 Gaegu %s ttf 가 실제로 패키지에 있다', (_weight, dir) => {
    expect(existsSync(join(GAEGU_PACKAGE_DIR, dir, `Gaegu_${dir}.ttf`))).toBe(true);
  });
});

describe('brandFontFamily', () => {
  test('폰트가 번들에 들어왔다고 표시돼 있다', () => {
    expect(BRAND_FONTS_LOADED).toBe(true);
  });

  test.each(Object.entries(BRAND_FONT_FILES))('weight %s → %s', (weight, family) => {
    expect(brandFontFamily(weight as keyof typeof BRAND_FONT_FILES)).toBe(family);
  });

  test('굵기마다 서로 다른 파일을 쓴다', () => {
    const families = Object.values(BRAND_FONT_FILES);
    expect(new Set(families).size).toBe(families.length);
  });
});

describe('FONT_ASSETS — expo-font 에 넘길 로드 맵', () => {
  test('BRAND_FONT_FILES 의 모든 패밀리를 빠짐없이 담는다', () => {
    // 이름만 늘리고 로드 맵에 안 넣으면 그 굵기만 조용히 시스템 폰트로 떨어진다.
    expect(Object.keys(FONT_ASSETS).sort()).toEqual(Object.values(BRAND_FONT_FILES).sort());
  });

  test('모든 항목이 실제 에셋을 가리킨다', () => {
    for (const asset of Object.values(FONT_ASSETS)) {
      expect(asset).toBeDefined();
    }
  });
});
