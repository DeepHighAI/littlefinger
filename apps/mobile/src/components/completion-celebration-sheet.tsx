import {
  completionKeepRateLabel,
  type CompletionCelebrationView,
} from '@littlefinger/shared';
import { StyleSheet, View } from 'react-native';

import { useLabels, useLocale } from '../lib/locale-native';
import { MOD_03_LABEL } from '../screens/mod-03-completion-celebration-labels.ts';
import { border, colors, elevation, radius, size, space } from '../theme/tokens.ts';
import { LfButton } from './LfButton.tsx';
import { LfIcon } from './LfIcon.tsx';
import { LfOval } from './LfOval.tsx';
import { LfPinkyLoop } from './LfPinkyLoop.tsx';
import { LfSheet } from './LfSheet.tsx';
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

/** README 지킴율 변화 칩 아이콘 16 — 토큰 없음, ADR 0020 예외 */
const STAT_ICON = 16;

const styles = StyleSheet.create({
  // 지킴율 변화 칩 34h r8 옐로 2px 잉크 + 3px (`.lf-stat-change`)
  rate: {
    height: size.tabHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[6],
    borderRadius: radius.xs,
    borderWidth: border.chip,
    borderColor: colors.text,
    backgroundColor: colors.primaryContainer,
    ...elevation.sm,
  },
  actions: { width: '100%' },
});

/** MOD-03 완료 축하 — 가운데 정렬 종이 시트, 옐로 타원 마스코트 + 손 루프, 24/900 제목 */
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
    <LfSheet
      testID="completion-celebration-modal"
      visible={open}
      onShow={onShown}
      onClose={onClose}
      title={LABEL.title}
      closeLabel={LABEL.close}
      scrimTestID="completion-celebration-scrim"
      sheetTestID="completion-celebration-sheet"
      centered
      art={
        <LfOval variant="celebrate">
          <LfPinkyLoop
            size="eyes"
            variant="solid"
            spark
            accessibilityLabel={LABEL.pinky}
            testID="completion-celebration-pinky"
          />
        </LfOval>
      }
    >
      {celebration !== null ? (
        <>
          <LfStack gap={1} center>
            <LfText variant="bodySm" secondary align="center">
              {LABEL.complete(celebration.title)}
            </LfText>
            <LfText variant="bodySm" secondary align="center">
              {LABEL.highFive(celebration.counterpart_nickname)}
            </LfText>
          </LfStack>
          <View style={styles.rate}>
            <LfIcon name="trending_up" size={STAT_ICON} />
            <LfText variant="note">
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
                trailing="add"
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
        </>
      ) : null}
    </LfSheet>
  );
}
