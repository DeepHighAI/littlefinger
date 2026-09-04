import { Image, StyleSheet, View, type ViewProps } from 'react-native';

import { colors, border, radius, size as sizeToken } from '../theme/tokens';
import { LfText } from './LfText';

export type LfAvatarSize = 'md' | 'lg' | 'xl';

export interface LfAvatarProps extends Omit<ViewProps, 'children' | 'style'> {
  nickname: string;
  profileImageUrl: string | null;
  accessibilityLabel: string;
  size?: LfAvatarSize;
  pending?: boolean;
}

const avatarSize: Record<LfAvatarSize, number> = {
  md: sizeToken.iconButton,
  lg: sizeToken.avatarLg,
  xl: sizeToken.avatarXl,
};

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
        <LfText
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          variant="label"
        >
          {fallback}
        </LfText>
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
    borderWidth: border.chip,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.primaryContainer,
  },
  pending: {
    borderWidth: border.pending,
    borderStyle: 'dashed',
    borderColor: colors.outlineStrong,
    backgroundColor: colors.surfaceMuted,
  },
});
