import { Image, StyleSheet, Text, View, type ViewProps } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, border, radius, size as sizeToken, type, weight } from '../theme/tokens';

export type LfAvatarSize = 'sm' | 'row' | 'md' | 'lg' | 'xl';

export interface LfAvatarProps extends Omit<ViewProps, 'children' | 'style'> {
  nickname: string;
  profileImageUrl: string | null;
  accessibilityLabel: string;
  size?: LfAvatarSize;
  pending?: boolean;
}

/** README 아바타 md 44 — 토큰 없음, ADR 0020 예외 */
const AVATAR_MD = 44;

const avatarSize: Record<LfAvatarSize, number> = {
  sm: sizeToken.avatarSm,
  row: sizeToken.iconButton,
  md: AVATAR_MD,
  lg: sizeToken.avatarLg,
  xl: sizeToken.avatarXl,
};

const glyphSize: Record<LfAvatarSize, number> = {
  sm: type.chip,
  row: type.label,
  md: type.appbar,
  lg: type.stamp,
  xl: type.sheetTitle,
};

/** 잉크 원 + 옐로 첫 글자. 승인 대기는 뮤트 면 + 점선 */
export function LfAvatar({
  nickname,
  profileImageUrl,
  accessibilityLabel,
  size = 'md',
  pending = false,
  ...rest
}: LfAvatarProps): React.JSX.Element {
  const fallback = Array.from(nickname.trim())[0] ?? nickname;
  const edge = avatarSize[size];

  return (
    <View
      {...rest}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.avatar,
        { width: edge, height: edge },
        pending && styles.pending,
      ]}
    >
      {profileImageUrl === null ? (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.glyph,
            { fontSize: glyphSize[size], fontFamily: textFontFamily(size === 'xl' ? weight.heavy : weight.bold) },
            pending && styles.pendingGlyph,
          ]}
        >
          {fallback}
        </Text>
      ) : (
        <Image
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          source={{ uri: profileImageUrl }}
          style={{ width: edge, height: edge }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.text,
  },
  glyph: { color: colors.primaryContainer },
  pending: {
    borderWidth: border.pending,
    borderStyle: 'dashed',
    borderColor: colors.outlineStrong,
    backgroundColor: colors.surfaceMuted,
  },
  pendingGlyph: { color: colors.textMuted },
});
