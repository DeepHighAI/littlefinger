import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { colors, type as typeScale } from '../theme/tokens';

/**
 * 아이콘 — 04 §5-4.
 *
 * 원본은 Material Symbols **Rounded** 지만 Expo 에 들어 있지 않다. MVP 는 내장 MaterialIcons 로
 * 간다 — 모서리 곡률이 미세하게 다르고 기능 차이는 없다(오픈 이슈 C-2).
 *
 * **화면에서 MaterialIcons 를 직접 import 하지 않는다.** 전부 이 컴포넌트를 거쳐야
 * 나중에 진짜 Rounded 폰트로 바꿀 때 고칠 자리가 여기 하나로 남는다.
 */

export type LfIconName = React.ComponentProps<typeof MaterialIcons>['name'];
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
    <MaterialIcons
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
