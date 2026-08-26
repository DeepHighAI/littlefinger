/**
 * 폰트 패밀리 해석 — 04 §5-4 의 정적 파일 원칙 유지, 서체만 Gaegu 로 교체 (ADR 0012).
 *
 * Gaegu 는 400/700 두 정적 웨이트뿐이다. 토큰 쪽에서 medium→400, heavy→700 으로
 * 수렴시켰으므로 (`tokens.ts` weight), 여기 매핑은 두 키만 갖는다.
 * 파일은 `@expo-google-fonts/gaegu` 패키지가 싣고, `fontAssets.ts` 의 `FONT_ASSETS` 를
 * 통해 `_layout.tsx` 의 `useFonts` 로 등록된다. 스플래시가 로딩 완료까지 화면을 가리므로
 * 시스템 폰트가 먼저 비치는 구간은 없다.
 *
 * 없는 패밀리 이름을 style 에 넣으면 안드로이드에서 렌더가 깨질 수 있으므로,
 * 등록 여부는 이 함수 한 곳에서만 판정한다. 화면·컴포넌트는 이 함수만 부른다.
 */

/** `expo-font` 에 등록되는 패밀리 이름들. `FONT_ASSETS` 의 키와 1:1 이다. */
export const BRAND_FONT_FILES = {
  '400': 'Gaegu-Regular',
  '700': 'Gaegu-Bold',
} as const;

export type BrandFontWeight = keyof typeof BRAND_FONT_FILES;

/**
 * 폰트 파일이 번들에 들어왔는지.
 * `fonts.test.ts` 가 이 플래그와 실제 폰트 모듈 존재를 함께 검사하므로,
 * 파일 없이 true 로 켜두면 테스트가 막는다.
 */
export const BRAND_FONTS_LOADED = true;

export function brandFontFamily(fontWeight: BrandFontWeight): string | undefined {
  return BRAND_FONTS_LOADED ? BRAND_FONT_FILES[fontWeight] : undefined;
}
