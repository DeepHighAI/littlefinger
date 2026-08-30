import {
  completionKeepRateLabel,
  type CompletionCelebrationView,
} from '@littlefinger/shared';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { useLabels, useLocale } from '../lib/locale-native';
import { MOD_03_LABEL } from '../screens/mod-03-completion-celebration-labels.ts';
import {
  border,
  colors,
  elevation,
  gutter,
  radius,
  size,
  space,
} from '../theme/tokens.ts';
import { LfButton } from './LfButton.tsx';
import { LfIcon } from './LfIcon.tsx';
import { LfPinky } from './LfPinky.tsx';
import { LfStack } from './LfStack.tsx';
import { LfText } from './LfText.tsx';

export interface CompletionCelebrationSheetProps {
  visible: boolean;
  celebration: CompletionCelebrationView | null;
  onShown(): void;
  onClose(): void;
  onNewPromise(): void;
  onShare(): void;
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  dismissArea: { flex: 1 },
  sheet: {
    alignItems: 'center',
    paddingHorizontal: gutter.app,
    paddingTop: space[5],
    paddingBottom: space[9],
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    backgroundColor: colors.primaryContainer,
    ...elevation.sheet,
    // 잉크&스티커: 시트는 상단+측면 잉크 테두리, 하단은 없음 (.lf-sheet, ADR 0012)
    borderWidth: border.sheet,
    borderBottomWidth: 0,
    borderColor: colors.text,
  },
  handle: {
    width: size.iconButton,
    height: space[1],
    borderRadius: radius.pill,
    backgroundColor: colors.outlineStrong,
  },
  close: {
    position: 'absolute',
    top: space[5],
    right: gutter.app,
    width: size.touchMin,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    paddingTop: space[7],
  },
  rate: {
    minHeight: size.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    paddingHorizontal: space[7],
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  actions: { width: '100%' },
});

export function CompletionCelebrationSheet({
  visible,
  celebration,
  onShown,
  onClose,
  onNewPromise,
  onShare,
}: CompletionCelebrationSheetProps): React.JSX.Element {
  const LABEL = useLabels(MOD_03_LABEL);
  const { locale } = useLocale();
  const open = visible && celebration !== null;
  return (
    <Modal
      testID="completion-celebration-modal"
      visible={open}
      transparent
      animationType="slide"
      onShow={onShown}
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <Pressable
          testID="completion-celebration-scrim"
          style={styles.dismissArea}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        {celebration !== null ? (
          <View
            testID="completion-celebration-sheet"
            style={styles.sheet}
            accessibilityViewIsModal
          >
            <View style={styles.handle} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={LABEL.close}
              style={styles.close}
              onPress={onClose}
            >
              <LfIcon name="close" />
            </Pressable>
            <View style={styles.content}>
              <LfStack gap={5} center>
                <LfPinky
                  size="xl"
                  tone="onContainer"
                  accessibilityLabel={LABEL.pinky}
                  testID="completion-celebration-pinky"
                />
                <LfText variant="title" align="center">{LABEL.title}</LfText>
                <LfStack gap={2} center>
                  <LfText secondary align="center">
                    {LABEL.complete(celebration.title)}
                  </LfText>
                  <LfText secondary align="center">
                    {LABEL.highFive(celebration.counterpart_nickname)}
                  </LfText>
                </LfStack>
                <View style={styles.rate}>
                  <LfIcon name="trending-up" color="primary" />
                  <LfText>
                    {completionKeepRateLabel(
                      celebration.keep_rate_before,
                      celebration.keep_rate_after,
                      locale,
                    )}
                  </LfText>
                </View>
                <View style={styles.actions}>
                  <LfStack gap={2}>
                    <LfButton
                      label={LABEL.newPromise}
                      size="cta"
                      block
                      onPress={onNewPromise}
                    />
                    <LfButton
                      label={LABEL.share}
                      variant="text"
                      block
                      onPress={onShare}
                    />
                  </LfStack>
                </View>
              </LfStack>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
