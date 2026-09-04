import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors, size } from '../theme/tokens';

export interface LfBottomFadeProps extends Omit<ViewProps, 'children' | 'style'> {
  small?: boolean;
}

export function LfBottomFade({ small = false, ...rest }: LfBottomFadeProps): React.JSX.Element {
  const height = small ? size.fadeHeightSm : size.fadeHeight;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...rest}
      style={[styles.fade, { height }]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity="0" />
            <Stop offset="1" stopColor={colors.background} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#fade)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', right: 0, bottom: 0, left: 0 },
});
