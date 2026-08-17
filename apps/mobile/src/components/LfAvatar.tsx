import { Image, StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, size } from '../theme/tokens';
import { LfText } from './LfText';

export interface LfAvatarProps extends Omit<ViewProps, 'children' | 'style'> {
  nickname: string;
  profileImageUrl: string | null;
  accessibilityLabel: string;
}

const styles = StyleSheet.create({
  avatar: {
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.primaryContainer,
  },
  image: {
    width: size.iconButton,
    height: size.iconButton,
  },
});

export function LfAvatar({
  nickname,
  profileImageUrl,
  accessibilityLabel,
  ...rest
}: LfAvatarProps): React.JSX.Element {
  const fallback = Array.from(nickname.trim())[0] ?? nickname;

  return (
    <View
      {...rest}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={styles.avatar}
    >
      {profileImageUrl === null ? (
        <LfText
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          variant="subtitle"
        >
          {fallback}
        </LfText>
      ) : (
        <Image
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          source={{ uri: profileImageUrl }}
          style={styles.image}
        />
      )}
    </View>
  );
}
