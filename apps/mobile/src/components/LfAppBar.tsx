import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, gutter, size, space } from '../theme/tokens';
import { LfIconButton } from './LfIconButton';
import { LfMascotFace } from './LfMascot';
import { LfText } from './LfText';

export interface LfAppBarProps extends Omit<ViewProps, 'style' | 'children'> {
  title: string;
  leading?: 'back' | 'close';
  leadingAccessibilityLabel?: string;
  onLeadingPress?: () => void;
  brand?: boolean;
  actions?: React.ReactNode;
}

export function LfAppBar({
  title,
  leading,
  leadingAccessibilityLabel,
  onLeadingPress,
  brand = false,
  actions,
  ...rest
}: LfAppBarProps): React.JSX.Element {
  const leadingControl = leading !== undefined
    && leadingAccessibilityLabel !== undefined
    && onLeadingPress !== undefined
    ? (
        <LfIconButton
          icon={leading === 'back' ? 'arrow_back' : 'close'}
          accessibilityLabel={leadingAccessibilityLabel}
          onPress={onLeadingPress}
        />
      )
    : null;

  return (
    <View {...rest} style={[styles.container, brand && styles.brandContainer]}>
      {leadingControl}
      {brand ? (
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={title}
          style={styles.brand}
        >
          <LfMascotFace size="sm" />
          <LfText variant="bodyStrong">{title}</LfText>
        </View>
      ) : (
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={title}
          style={styles.title}
        >
          <LfText variant="bodyStrong" align="center">{title}</LfText>
        </View>
      )}
      {actions ?? (leadingControl === null ? null : <View style={styles.spacer} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: size.appbarHeight,
    paddingHorizontal: gutter.app,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.surfaceChrome,
  },
  brandContainer: { paddingLeft: space[8] },
  title: { flex: 1, minWidth: 0 },
  brand: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  spacer: { width: size.iconButton },
});
