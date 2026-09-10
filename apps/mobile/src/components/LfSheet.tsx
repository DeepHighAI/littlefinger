import { Modal, Pressable, StyleSheet, View, type ModalProps } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

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
  /** 축하 시트(MOD-03) — 가운데 정렬, 제목 24/900 이 아트 아래에 오고 닫기는 우상단에 뜬다 */
  centered?: boolean;
  /** centered 시트의 마스코트 아트 — 핸들과 제목 사이 */
  art?: React.ReactNode;
  /** 제목과 닫기 사이의 칩 — 증인 초대의 "증인 1 / 2" (MOD-02) */
  titleAccessory?: React.ReactNode;
}

/** README 시트 좌우 18 — 토큰 없음, ADR 0020 예외 */
const SIDE_PADDING = 18;

/** 바텀시트 — 종이 · r20 상단 · 2.5 잉크(하단 없음) · 그림자 없음 · 핸들 40×5 잉크 */
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
  art,
  titleAccessory,
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
      {/* Modal은 별도 창이므로 본문과 다른 시스템 바 여백을 직접 측정한다. */}
      <SafeAreaProvider style={styles.scrim}>
        <Pressable
          testID={scrimTestID}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <SafeAreaView
          testID={sheetTestID}
          edges={['bottom', 'left', 'right']}
          style={[styles.sheet, centered && styles.centered]}
          accessibilityViewIsModal
        >
          <View style={styles.handle} />
          {centered ? (
            <>
              <View style={styles.floatingClose}>
                <LfIconButton icon="close" accessibilityLabel={closeLabel} onPress={onClose} />
              </View>
              {art}
              <LfText variant="titleHeavy" align="center">{title}</LfText>
            </>
          ) : (
            <View style={styles.header}>
              <View style={styles.title}><LfText variant="sheetTitle">{title}</LfText></View>
              {titleAccessory}
              <LfIconButton icon="close" accessibilityLabel={closeLabel} onPress={onClose} />
            </View>
          )}
          {children}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: {
    maxHeight: '88%',
    paddingTop: space[4],
    paddingHorizontal: SIDE_PADDING,
    paddingBottom: space[9],
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
    alignSelf: 'center',
  },
  header: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  title: { flex: 1 },
  // 아트보드에는 닫기가 없지만 접근성 닫기 경로는 남긴다 — 핸들 줄 오른쪽에 띄운다
  floatingClose: { position: 'absolute', top: space[4], right: SIDE_PADDING },
});
