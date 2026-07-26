/**
 * `expo-font` 에 넘길 폰트 에셋 맵 — 04 §5-4.
 *
 * 키는 `PRETENDARD_FILES` 의 패밀리 이름과 **정확히** 같아야 한다.
 * 여기 빠진 굵기는 에러 없이 시스템 폰트로 떨어져 버리므로 테스트가 대조한다.
 *
 * 라이선스: SIL Open Font License 1.1 (`assets/fonts/Pretendard-LICENSE.txt`).
 */
export const FONT_ASSETS = {
  'Pretendard-Regular': require('../../assets/fonts/Pretendard-Regular.ttf'),
  'Pretendard-SemiBold': require('../../assets/fonts/Pretendard-SemiBold.ttf'),
  'Pretendard-Bold': require('../../assets/fonts/Pretendard-Bold.ttf'),
  'Pretendard-ExtraBold': require('../../assets/fonts/Pretendard-ExtraBold.ttf'),
} as const;
