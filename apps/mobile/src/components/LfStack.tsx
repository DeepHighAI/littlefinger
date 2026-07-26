import { View, type ViewProps } from 'react-native';

import { space } from '../theme/tokens';

/** 원본 `.lf-stack` + `.lf-gap-*` + `.lf-grow` + `.lf-center` (04 §5-2) */

export type LfGap = keyof typeof space;

export interface LfStackProps extends Omit<ViewProps, 'style'> {
  /** 간격 눈금. 숫자를 직접 쓰지 않고 토큰 눈금만 받는다. */
  gap?: LfGap;
  grow?: boolean;
  center?: boolean;
}

export function LfStack({
  gap,
  grow = false,
  center = false,
  ...rest
}: LfStackProps): React.JSX.Element {
  return (
    <View
      {...rest}
      style={[
        { flexDirection: 'column' },
        gap !== undefined && { gap: space[gap] },
        grow && { flex: 1 },
        center && { alignItems: 'center', justifyContent: 'center' },
      ]}
    />
  );
}
