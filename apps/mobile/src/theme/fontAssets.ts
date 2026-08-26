/**
 * `expo-font` 에 넘길 폰트 에셋 맵 — 04 §5-4.
 *
 * 키는 `BRAND_FONT_FILES` 의 패밀리 이름과 **정확히** 같아야 한다.
 * 여기 빠진 굵기는 에러 없이 시스템 폰트로 떨어져 버리므로 테스트가 대조한다.
 *
 * Gaegu 파일은 `@expo-google-fonts/gaegu` 패키지에서 온다 (OFL 1.1, 패키지 LICENSE_FONT).
 * 기존 `assets/fonts/Pretendard-*.ttf` 는 참조가 사라져 번들에 실리지 않는다.
 */
import { Gaegu_400Regular, Gaegu_700Bold } from '@expo-google-fonts/gaegu';

export const FONT_ASSETS = {
  'Gaegu-Regular': Gaegu_400Regular,
  'Gaegu-Bold': Gaegu_700Bold,
} as const;
