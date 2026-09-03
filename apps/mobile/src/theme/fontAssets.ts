/**
 * `expo-font` 에 넘길 폰트 에셋 맵 — 04 §5-4.
 *
 * 키는 `TEXT_FONT_FILES` 의 패밀리 이름과 **정확히** 같아야 한다.
 * 여기 빠진 굵기는 에러 없이 시스템 폰트로 떨어져 버리므로 테스트가 대조한다.
 *
 * Pretendard 정적 파일은 `assets/fonts` 에 자체 호스팅한다(OFL 1.1).
 * 아이콘 폰트도 여기서 같이 올린다 — createIconSet 의 지연 로드에 맡기면 첫 화면이 빈 칸으로 뜬다.
 */
import { ICON_FONT_FAMILY } from './fonts';

export const FONT_ASSETS = {
  'Pretendard-Regular': require('../../assets/fonts/Pretendard-Regular.ttf') as number,
  'Pretendard-SemiBold': require('../../assets/fonts/Pretendard-SemiBold.ttf') as number,
  'Pretendard-Bold': require('../../assets/fonts/Pretendard-Bold.ttf') as number,
  'Pretendard-ExtraBold': require('../../assets/fonts/Pretendard-ExtraBold.ttf') as number,
  [ICON_FONT_FAMILY]: require('../../assets/fonts/MaterialSymbolsRounded-subset.ttf') as number,
} as const;
