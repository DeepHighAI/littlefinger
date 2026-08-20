/**
 * 폰트 패밀리 해석 — 04 §5-4.
 *
 * Pretendard 정적 `.ttf` 4종(400/600/700/800)은 `assets/fonts/` 에 있고,
 * `fontAssets.ts` 의 `FONT_ASSETS` 를 통해 `_layout.tsx` 의 `useFonts` 로 등록된다.
 * 스플래시가 로딩 완료까지 화면을 가리므로 시스템 폰트가 먼저 비치는 구간은 없다.
 * (`design-reference/assets/fonts/` 의 woff2 는 **웹 전용**이라 RN 에서 못 쓴다.)
 *
 * 없는 패밀리 이름을 style 에 넣으면 안드로이드에서 렌더가 깨질 수 있으므로,
 * 등록 여부는 이 함수 한 곳에서만 판정한다. 화면·컴포넌트는 이 함수만 부른다.
 */

/** `expo-font` 에 등록되는 패밀리 이름들. `FONT_ASSETS` 의 키와 1:1 이다. */
export const PRETENDARD_FILES = {
  '400': 'Pretendard-Regular',
  '600': 'Pretendard-SemiBold',
  '700': 'Pretendard-Bold',
  '800': 'Pretendard-ExtraBold',
} as const;

export type PretendardWeight = keyof typeof PRETENDARD_FILES;

/**
 * 폰트 파일이 번들에 들어왔는지.
 * `fonts.test.ts` 가 이 플래그와 실제 `.ttf` 존재를 함께 검사하므로,
 * 파일 없이 true 로 켜두면 테스트가 막는다.
 */
export const BRAND_FONTS_LOADED = true;

export function brandFontFamily(fontWeight: PretendardWeight): string | undefined {
  return BRAND_FONTS_LOADED ? PRETENDARD_FILES[fontWeight] : undefined;
}
