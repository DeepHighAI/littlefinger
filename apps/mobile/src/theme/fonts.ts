/**
 * 폰트 패밀리 해석 — 04 §5-4.
 *
 * Pretendard 정적 `.ttf` 4종(400/600/700/800)이 아직 저장소에 없다.
 * (`design-reference/assets/fonts/` 의 woff2 는 **웹 전용**이라 RN 에서 못 쓴다.)
 *
 * 없는 패밀리 이름을 style 에 넣으면 안드로이드에서 렌더가 깨질 수 있으므로,
 * 파일이 들어오기 전까지 `undefined` 를 돌려 시스템 폰트로 그린다.
 * 굵기는 `fontWeight` 로 정확히 나오므로 자형만 다르고 레이아웃은 같다.
 *
 * **파일이 준비되면 여기 한 곳만 고치면 된다.** 화면·컴포넌트는 이 함수만 부른다.
 */

/** `.ttf` 가 들어오면 이 이름들로 `expo-font` 에 등록한다. */
export const PRETENDARD_FILES = {
  '400': 'Pretendard-Regular',
  '600': 'Pretendard-SemiBold',
  '700': 'Pretendard-Bold',
  '800': 'Pretendard-ExtraBold',
} as const;

export type PretendardWeight = keyof typeof PRETENDARD_FILES;

/** 폰트 파일이 번들에 들어왔는지. 파일 추가 시 true 로 바꾼다. */
export const BRAND_FONTS_LOADED = false;

export function brandFontFamily(fontWeight: PretendardWeight): string | undefined {
  return BRAND_FONTS_LOADED ? PRETENDARD_FILES[fontWeight] : undefined;
}
