import { View, type ViewProps } from 'react-native';

import { space } from '../theme/tokens';
import type { LfGap } from './LfStack';

/** 원본 `.lf-row` — 가로 배치 + 세로 가운데 정렬이 기본이다 (04 §5-2) */

export interface LfRowProps extends Omit<ViewProps, 'style'> {
  gap?: LfGap;
  grow?: boolean;
  center?: boolean;
  wrap?: boolean;
}

export function LfRow({
  gap,
  grow = false,
  center = false,
  wrap = false,
  ...rest
}: LfRowProps): React.JSX.Element {
  return (
    <View
      {...rest}
      style={[
        { flexDirection: 'row', alignItems: 'center' },
        gap !== undefined && { gap: space[gap] },
        grow && { flex: 1 },
        center && { justifyContent: 'center' },
        wrap && { flexWrap: 'wrap' },
      ]}
    />
  );
}
