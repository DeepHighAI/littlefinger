import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { FONT_ASSETS } from './fontAssets';
import { TEXT_FONT_FILES, TEXT_FONTS_LOADED, textFontFamily } from './fonts';

/**
 * 근거: 04 §5-4 (정적 파일 원칙) + ADR 0014 (Pretendard 단일화).
 *
 * RN 안드로이드는 가변 폰트의 웨이트 축 선택이 불안정해서 정적 파일을 쓴다.
 * 번들에 없는 폰트 패밀리 이름을 style 에 넣으면 렌더가 깨지므로, 이름과 실제 파일이
 * 붙어 있는지를 테스트가 직접 확인한다.
 */

const FONT_DIR = join(__dirname, '../../assets/fonts');

describe('TEXT_FONT_FILES', () => {
  test('토큰이 쓰는 웨이트 4종을 모두 담는다', () => {
    expect(Object.keys(TEXT_FONT_FILES).sort()).toEqual(['400', '600', '700', '800']);
  });

  test.each([
    ['400', 'Regular'],
    ['600', 'SemiBold'],
    ['700', 'Bold'],
    ['800', 'ExtraBold'],
  ] as const)('weight %s 의 Pretendard-%s.ttf 가 실제로 있다', (_weight, suffix) => {
    expect(existsSync(join(FONT_DIR, `Pretendard-${suffix}.ttf`))).toBe(true);
  });
});

describe('textFontFamily', () => {
  test('폰트가 번들에 들어왔다고 표시돼 있다', () => {
    expect(TEXT_FONTS_LOADED).toBe(true);
  });

  test.each(Object.entries(TEXT_FONT_FILES))('weight %s → %s', (fontWeight, family) => {
    expect(textFontFamily(fontWeight as keyof typeof TEXT_FONT_FILES)).toBe(family);
  });

  test('굵기마다 서로 다른 파일을 쓴다', () => {
    const families = Object.values(TEXT_FONT_FILES);
    expect(new Set(families).size).toBe(families.length);
  });
});

describe('FONT_ASSETS — expo-font 에 넘길 로드 맵', () => {
  test('TEXT_FONT_FILES 의 모든 패밀리를 빠짐없이 담는다', () => {
    // 이름만 늘리고 로드 맵에 안 넣으면 그 굵기만 조용히 시스템 폰트로 떨어진다.
    expect(Object.keys(FONT_ASSETS).sort()).toEqual(Object.values(TEXT_FONT_FILES).sort());
  });

  test('모든 항목이 실제 에셋을 가리킨다', () => {
    for (const asset of Object.values(FONT_ASSETS)) {
      expect(asset).toBeDefined();
    }
  });
});
