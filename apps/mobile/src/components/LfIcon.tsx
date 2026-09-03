import { createIconSet } from '@expo/vector-icons';

import { ICON_FONT_FAMILY } from '../theme/fonts';
import { ICON_CODEPOINT } from '../theme/icon-codepoints';
import { colors, type as typeScale } from '../theme/tokens';

/**
 * 아이콘 — 04 §5-4 · 2026-09-03 확정안의 Material Symbols **Rounded**.
 *
 * Expo 에는 Rounded 가 없어서 `tools/subset-icon-font.js` 가 구운 정적 서브셋 TTF 를 직접
 * 등록한다. 이름 집합은 생성된 코드포인트 표로 닫혀 있다 — 표에 없는 이름은 컴파일이 막고,
 * 표에 있는 이름은 폰트에 반드시 글리프가 있다(생성기 테스트가 잠근다). C-2 는 이것으로 닫혔다.
 *
 * **화면에서 아이콘 폰트를 직접 import 하지 않는다.** 전부 이 컴포넌트를 거친다.
 */

const MaterialSymbols = createIconSet(
  ICON_CODEPOINT,
  ICON_FONT_FAMILY,
  require('../../assets/fonts/MaterialSymbolsRounded-subset.ttf') as number,
);

export type LfIconName = keyof typeof ICON_CODEPOINT;
export type LfIconColor = keyof typeof colors;

export interface LfIconProps {
  name: LfIconName;
  size?: number;
  color?: LfIconColor;
  /** 의미가 있는 아이콘에만 붙인다. 없으면 스크린리더가 건너뛴다. */
  accessibilityLabel?: string;
  testID?: string;
}

export function LfIcon({
  name,
  size = typeScale.subtitle,
  color = 'text',
  accessibilityLabel,
  testID,
}: LfIconProps): React.JSX.Element {
  const decorative = accessibilityLabel === undefined;

  return (
    <MaterialSymbols
      name={name}
      size={size}
      color={colors[color]}
      testID={testID}
      // 장식용 아이콘이 스크린리더에 읽히면 소음이 된다.
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      {...(decorative ? {} : { accessible: true, accessibilityLabel })}
    />
  );
}
