import { SLOT_PRICE_KRW_DEFAULT, type SlotStatusResponse } from '@littlefinger/shared';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useLabels } from '../lib/locale-native';
import {
  loadSlotPrice,
  purchaseSlot,
  reconcileSlotPurchases,
  SlotPurchaseCancelledError,
} from '../lib/slot-purchase-native.ts';
import { loadSlotStatus } from '../lib/slots-native.ts';
import { SLOT_LABEL } from '../screens/slot-labels.ts';
import { border, colors, elevation, gutter, radius, size, space } from '../theme/tokens.ts';
import { LfButton } from './LfButton.tsx';
import { LfIcon } from './LfIcon.tsx';
import { LfRow } from './LfRow.tsx';
import { LfStack } from './LfStack.tsx';
import { LfText } from './LfText.tsx';

export interface SlotPaywallSheetProps {
  visible: boolean;
  /** 'limit' 은 발송이 막혀서 열린 경우 — 가득 참 안내 한 줄이 추가된다. */
  reason: 'limit' | 'manage';
  onClose(): void;
  /** 부여까지 끝난 새 현황. 호출부가 자기 화면의 슬롯 표시를 갱신하는 데 쓴다. */
  onPurchased?(status: SlotStatusResponse): void;
}

type Phase = 'loading' | 'ready' | 'error';

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  dismissArea: { flex: 1 },
  sheet: {
    paddingHorizontal: gutter.app,
    paddingTop: space[5],
    paddingBottom: space[9],
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    backgroundColor: colors.surface,
    ...elevation.sheet,
    // 잉크&스티커: 시트는 상단+측면 잉크 테두리, 하단은 없음 (.lf-sheet, ADR 0012)
    borderWidth: border.sheet,
    borderBottomWidth: 0,
    borderColor: colors.text,
  },
  handle: {
    alignSelf: 'center',
    width: size.iconButton,
    height: space[1],
    marginBottom: space[7],
    borderRadius: radius.pill,
    backgroundColor: colors.outlineStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  close: {
    width: size.touchMin,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  content: { gap: space[6], paddingTop: space[5] },
  notice: {
    padding: space[6],
    borderRadius: radius.md,
    backgroundColor: colors.attentionContainer,
  },
  offer: {
    padding: space[7],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    gap: space[2],
  },
});

export function SlotPaywallSheet({
  visible,
  reason,
  onClose,
  onPurchased,
}: SlotPaywallSheetProps): React.JSX.Element {
  const LABEL = useLabels(SLOT_LABEL);
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<SlotStatusResponse | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [purchaseFailed, setPurchaseFailed] = useState(false);
  const [loadNonce, setLoadNonce] = useState(0);
  const purchasePending = useRef(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setPhase('loading');
    setPurchased(false);
    setPurchaseFailed(false);
    void (async () => {
      // 미소모 구매를 먼저 줍는다 — 지난 세션에서 결제만 되고 반영이 안 된 경우의 출구다.
      const reconciled = await reconcileSlotPurchases();
      if (reconciled !== null && active) onPurchased?.(reconciled);
      try {
        const [loadedStatus, loadedPrice] = await Promise.all([
          loadSlotStatus(),
          loadSlotPrice(),
        ]);
        if (!active) return;
        setStatus(loadedStatus);
        setPrice(loadedPrice);
        setPhase('ready');
      } catch {
        if (active) setPhase('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [loadNonce, onPurchased, visible]);

  async function buy(): Promise<void> {
    if (busy || purchasePending.current) return;
    purchasePending.current = true;
    setBusy(true);
    setPurchaseFailed(false);
    try {
      const next = await purchaseSlot();
      setStatus(next);
      setPurchased(true);
      onPurchased?.(next);
    } catch (error) {
      // 스토어 시트를 닫은 것은 실패가 아니다 — 아무 표시도 하지 않는다.
      if (!(error instanceof SlotPurchaseCancelledError)) setPurchaseFailed(true);
    } finally {
      purchasePending.current = false;
      setBusy(false);
    }
  }

  const priceText = price ?? LABEL.priceFallback(SLOT_PRICE_KRW_DEFAULT);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable
          style={styles.dismissArea}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.header}>
            <LfText variant="title">{LABEL.sheetTitle}</LfText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={LABEL.close}
              onPress={onClose}
              style={styles.close}
            >
              <LfIcon name="close" />
            </Pressable>
          </View>

          <View style={styles.content}>
            {phase === 'loading' && <LfText secondary>{LABEL.loading}</LfText>}

            {phase === 'error' && (
              <LfStack gap={4}>
                <LfText variant="error">{LABEL.loadError}</LfText>
                <LfButton
                  label={LABEL.retry}
                  variant="outlined"
                  block
                  onPress={() => setLoadNonce((nonce) => nonce + 1)}
                />
              </LfStack>
            )}

            {phase === 'ready' && status !== null && (
              <>
                {reason === 'limit' && !purchased && (
                  <View style={styles.notice}>
                    <LfText>{LABEL.fullNotice}</LfText>
                  </View>
                )}

                <LfRow gap={4}>
                  <LfIcon name="bookmark" color="primary" />
                  <LfText
                    variant="subtitle"
                    accessibilityLabel={LABEL.usageAccessibility(status.used, status.capacity)}
                  >
                    {LABEL.usage(status.used, status.capacity)}
                  </LfText>
                </LfRow>
                <LfText secondary>{LABEL.explain}</LfText>

                <View style={styles.offer}>
                  <LfText variant="subtitle">{LABEL.addTitle}</LfText>
                  <LfText variant="caption">{LABEL.addDescription}</LfText>
                </View>

                {purchased && <LfText align="center">{LABEL.purchased}</LfText>}
                {purchaseFailed && (
                  <LfText variant="error" align="center">
                    {LABEL.purchaseError}
                  </LfText>
                )}
                <LfButton
                  label={busy ? LABEL.purchasing : LABEL.purchase(priceText)}
                  size="cta"
                  block
                  disabled={busy}
                  onPress={() => void buy()}
                />
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
