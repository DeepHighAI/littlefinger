import { Modal, Pressable, StyleSheet, View, type ModalProps } from 'react-native';

import { colors, border, elevation, radius, size, space } from '../theme/tokens';
import { LfIconButton } from './LfIconButton';
import { LfText } from './LfText';

export interface LfSheetProps extends Pick<ModalProps, 'onShow' | 'testID'> {
  visible: boolean;
  title: string;
  closeLabel: string;
  onClose(): void;
  children: React.ReactNode;
  scrimTestID?: string;
  sheetTestID?: string;
  centered?: boolean;
}

export function LfSheet({
  visible,
  title,
  closeLabel,
  onClose,
  children,
  onShow,
  testID,
  scrimTestID,
  sheetTestID,
  centered = false,
}: LfSheetProps): React.JSX.Element {
  return (
    <Modal
      testID={testID}
      visible={visible}
      transparent
      animationType="slide"
      onShow={onShow}
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <Pressable
          testID={scrimTestID}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View
          testID={sheetTestID}
          style={[styles.sheet, centered && styles.centered]}
          accessibilityViewIsModal
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <LfText variant="sheetTitle">{title}</LfText>
            <LfIconButton icon="close" accessibilityLabel={closeLabel} onPress={onClose} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: {
    maxHeight: '88%',
    paddingTop: space[5],
    paddingRight: space[9],
    paddingBottom: space[3],
    paddingLeft: space[9],
    gap: space[6],
    backgroundColor: colors.surface,
    borderWidth: border.sheet,
    borderBottomWidth: 0,
    borderColor: colors.text,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    ...elevation.sheet,
  },
  centered: { alignItems: 'center', gap: space[5] },
  handle: {
    width: size.sheetHandleWidth,
    height: size.sheetHandleHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    opacity: 0.3,
    alignSelf: 'center',
  },
  header: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
});
