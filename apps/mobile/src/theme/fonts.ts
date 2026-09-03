/**
 * 폰트 패밀리 해석 — Android 가변 폰트 축의 불안정성을 피하는 04 §5-4 정적 파일 원칙.
 *
 * 모든 사용자 텍스트는 Pretendard 한 패밀리를 쓰되 400/600/700/800 정적 파일을
 * 굵기별로 등록한다. 스플래시가 로딩 완료까지 화면을 가리므로 시스템 폰트가 먼저
 * 비치는 구간은 없다.
 *
 * 없는 패밀리 이름을 style 에 넣으면 안드로이드에서 렌더가 깨질 수 있으므로,
 * 등록 여부는 이 함수 한 곳에서만 판정한다. 화면·컴포넌트는 이 함수만 부른다.
 */

/** `expo-font` 에 등록되는 패밀리 이름들. `FONT_ASSETS` 의 키와 1:1 이다. */
export const TEXT_FONT_FILES = {
  '400': 'Pretendard-Regular',
  '600': 'Pretendard-SemiBold',
  '700': 'Pretendard-Bold',
  '800': 'Pretendard-ExtraBold',
} as const;

export type TextFontWeight = keyof typeof TEXT_FONT_FILES;

/**
 * 아이콘 폰트 패밀리 — Material Symbols Rounded 정적 서브셋(`tools/subset-icon-font.js`).
 * 텍스트 폰트와 같은 `FONT_ASSETS` 로 스플래시 뒤에서 미리 올린다. LfIcon 만 이 이름을 안다.
 */
export const ICON_FONT_FAMILY = 'MaterialSymbolsRounded';

/**
 * 폰트 파일이 번들에 들어왔는지.
 * `fonts.test.ts` 가 이 플래그와 실제 폰트 모듈 존재를 함께 검사하므로,
 * 파일 없이 true 로 켜두면 테스트가 막는다.
 */
export const TEXT_FONTS_LOADED = true;

export function textFontFamily(fontWeight: TextFontWeight): string | undefined {
  return TEXT_FONTS_LOADED ? TEXT_FONT_FILES[fontWeight] : undefined;
}
