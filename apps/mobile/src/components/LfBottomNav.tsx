import { useContext } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useLabels } from '../lib/locale-native';
import { MOBILE_CHROME_LABEL } from '../screens/mobile-chrome-labels.ts';
import { colors, elevation, size, space } from '../theme/tokens';
import { LfIcon } from './LfIcon';
import { LfPinky } from './LfPinky';
import { LfText } from './LfText';

export type LfBottomNavDestination = 'home' | 'profile';

export interface LfBottomNavProps {
  active: LfBottomNavDestination;
  onHomePress: () => void;
  onCreatePress: () => void;
  onProfilePress: () => void;
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.surfaceChrome,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
    ...elevation.sheet,
  },
  content: {
    minHeight: size.bottomNavContentHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: gutterForNav(),
  },
  destination: {
    flex: 1,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
  },
  create: {
    width: size.centerFab,
    height: size.centerFab,
    minWidth: size.touchMin,
    minHeight: size.touchMin,
    borderRadius: size.centerFab / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.actionFill,
    ...elevation.fab,
  },
});

// 하단 내비의 좌우 여백은 4dp 리듬으로만 구성한다.
function gutterForNav(): number {
  return space[3];
}

function Destination({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: 'home' | 'person';
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={styles.destination}
      onPress={onPress}
    >
      <LfIcon name={icon} size={size.navIcon} color={active ? 'primaryInk' : 'textMuted'} />
      <LfText variant={active ? 'listStatus' : 'caption'}>{label}</LfText>
    </Pressable>
  );
}

export function LfBottomNav({
  active,
  onHomePress,
  onCreatePress,
  onProfilePress,
}: LfBottomNavProps): React.JSX.Element {
  const LABEL = useLabels(MOBILE_CHROME_LABEL);
  // 앱 루트에서는 항상 provider가 있지만 독립 스토리·테스트도 안전하게 0 inset으로 그린다.
  const insets = useContext(SafeAreaInsetsContext);

  return (
    <View testID="lf-bottom-nav" style={[styles.shell, { paddingBottom: insets?.bottom ?? 0 }]}>
      <View accessibilityRole="tablist" style={styles.content}>
        <Destination
          active={active === 'home'}
          icon="home"
          label={LABEL.home}
          onPress={onHomePress}
        />
        <View style={styles.destination}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={LABEL.create}
            style={styles.create}
            onPress={onCreatePress}
          >
            <LfPinky size="sm" tone="onPrimary" testID="lf-bottom-nav-create-mark" />
          </Pressable>
          <LfText variant="caption">{LABEL.create}</LfText>
        </View>
        <Destination
          active={active === 'profile'}
          icon="person"
          label={LABEL.profile}
          onPress={onProfilePress}
        />
      </View>
    </View>
  );
}
