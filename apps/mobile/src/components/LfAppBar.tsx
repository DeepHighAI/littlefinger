import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { colors, border, elevation, gutter, radius, size, space } from '../theme/tokens';
import { LfIcon } from './LfIcon';
import { LfIconButton } from './LfIconButton';
import { LfMascotFace } from './LfMascot';
import { LfOval } from './LfOval';
import { LfText } from './LfText';

export interface LfAppBarMenu {
  label: string;
  onPress: () => void;
  /** 읽지 않은 알림이 있으면 핑크 점을 단다 — 라벨로도 알려야 하므로 accessibilityLabel 을 같이 준다 */
  badge?: boolean;
  accessibilityLabel?: string;
}

export interface LfAppBarProps extends Omit<ViewProps, 'style' | 'children'> {
  title: string;
  leading?: 'back' | 'close';
  leadingAccessibilityLabel?: string;
  onLeadingPress?: () => void;
  brand?: boolean;
  actions?: React.ReactNode;
  /** 홈 브랜드 앱바의 "메뉴 ☰" — 종·아바타 대신 메뉴 시트를 연다 */
  menu?: LfAppBarMenu;
}

/** README 메뉴 점 9 — 토큰 없음, ADR 0020 예외 */
const MENU_DOT = 9;
const MENU_HIT_SLOP = (size.touchMin - size.iconCircle) / 2;
const PRESSED_OPACITY = 0.6;

export function LfAppBar({
  title,
  leading,
  leadingAccessibilityLabel,
  onLeadingPress,
  brand = false,
  actions,
  menu,
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

  const menuControl = menu === undefined ? null : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={menu.accessibilityLabel ?? menu.label}
      hitSlop={MENU_HIT_SLOP}
      onPress={menu.onPress}
      testID={rest.testID === undefined ? undefined : `${rest.testID}-menu`}
      style={({ pressed }) => [styles.menu, pressed && { opacity: PRESSED_OPACITY }]}
    >
      <LfText variant="label">{menu.label}</LfText>
      <LfIcon name="menu" size={size.appbarIcon} />
      {menu.badge === true ? <View style={styles.menuDot} /> : null}
    </Pressable>
  );

  return (
    <View {...rest} style={styles.container}>
      {leadingControl}
      {brand ? (
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={title}
          style={styles.brand}
        >
          <LfOval variant="tile"><LfMascotFace size="sm" /></LfOval>
          <LfText variant="appbarBrand" numberOfLines={1}>{title}</LfText>
        </View>
      ) : (
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={title}
          style={styles.title}
        >
          <LfText variant="appbar" align="center" numberOfLines={1}>{title}</LfText>
        </View>
      )}
      {menuControl ?? actions ?? (leadingControl === null ? null : <View style={styles.spacer} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  // 종이 블록 52h · margin 8 16 0 · 2.5 잉크 · 5px 그림자
  container: {
    marginTop: space[3],
    marginHorizontal: gutter.app,
    height: size.appbarHeight,
    paddingHorizontal: space[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.surface,
    borderWidth: border.card,
    borderColor: colors.text,
    borderRadius: radius.md,
    ...elevation.card,
  },
  title: { flex: 1, minWidth: 0 },
  brand: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  menu: {
    height: size.iconCircle,
    paddingLeft: space[6],
    paddingRight: space[5],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  menuDot: {
    position: 'absolute',
    top: space[1],
    right: space[2],
    width: MENU_DOT,
    height: MENU_DOT,
    borderRadius: radius.pill,
    backgroundColor: colors.attentionContainer,
    borderWidth: border.chip,
    borderColor: colors.text,
  },
  spacer: { width: size.iconButton },
});
