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

import { MOD_03_LABEL } from '../screens/mod-03-completion-celebration-labels.ts';
import {
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
              accessibilityLabel={MOD_03_LABEL.close}
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
                  accessibilityLabel={MOD_03_LABEL.pinky}
                  testID="completion-celebration-pinky"
                />
                <LfText variant="title" align="center">{MOD_03_LABEL.title}</LfText>
                <LfStack gap={2} center>
                  <LfText secondary align="center">
                    {MOD_03_LABEL.complete(celebration.title)}
                  </LfText>
                  <LfText secondary align="center">
                    {MOD_03_LABEL.highFive(celebration.counterpart_nickname)}
                  </LfText>
                </LfStack>
                <View style={styles.rate}>
                  <LfIcon name="trending-up" color="primary" />
                  <LfText>
                    {completionKeepRateLabel(
                      celebration.keep_rate_before,
                      celebration.keep_rate_after,
                    )}
                  </LfText>
                </View>
                <View style={styles.actions}>
                  <LfStack gap={2}>
                    <LfButton
                      label={MOD_03_LABEL.newPromise}
                      size="cta"
                      block
                      onPress={onNewPromise}
                    />
                    <LfButton
                      label={MOD_03_LABEL.share}
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
