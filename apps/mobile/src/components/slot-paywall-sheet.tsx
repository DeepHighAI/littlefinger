import { SLOT_PRICE_KRW_DEFAULT, type SlotStatusResponse } from '@littlefinger/shared';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLabels } from '../lib/locale-native';
import {
  loadSlotPrice,
  purchaseSlot,
  reconcileSlotPurchases,
  SlotPurchaseCancelledError,
} from '../lib/slot-purchase-native.ts';
import { loadSlotStatus } from '../lib/slots-native.ts';
import { SLOT_LABEL } from '../screens/slot-labels.ts';
import { border, colors, radius, size, space } from '../theme/tokens.ts';
import { LfButton } from './LfButton.tsx';
import { LfCard } from './LfCard.tsx';
import { LfIcon } from './LfIcon.tsx';
import { LfSheet } from './LfSheet.tsx';
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
  content: { gap: space[6] },
  // 막힌 이유 안내 — 핑크 r10 2px 잉크, 그림자 없음 (`.lf-slot-sheet__notice`)
  notice: {
    paddingVertical: space[5],
    paddingHorizontal: space[6],
    borderWidth: border.chip,
    borderColor: colors.text,
    borderRadius: radius.sm,
    backgroundColor: colors.attentionContainer,
  },
  usage: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
});

/** MOD-04 슬롯 결제 — 안내(핑크) · 현황 한 줄 · 구매 항목(옐로 카드) · 옐로 CTA. 재촉 문구 없음(§8) */
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
    <LfSheet visible={visible} title={LABEL.sheetTitle} closeLabel={LABEL.close} onClose={onClose}>
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
                <LfText variant="note">{LABEL.fullNotice}</LfText>
              </View>
            )}

            <View style={styles.usage}>
              <LfIcon name="bookmark" size={size.appbarIcon} />
              <LfText
                variant="bodyStrong"
                accessibilityLabel={LABEL.usageAccessibility(status.used, status.capacity)}
              >
                {LABEL.usage(status.used, status.capacity)}
              </LfText>
            </View>
            <LfText variant="caption">{LABEL.explain}</LfText>

            <LfCard tone="yellow">
              <LfStack gap={1}>
                <LfText variant="stamp">{LABEL.addTitle}</LfText>
                <LfText variant="note">{LABEL.addDescription}</LfText>
              </LfStack>
            </LfCard>

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
              trailing="arrow_forward"
              disabled={busy}
              onPress={() => void buy()}
            />
          </>
        )}
      </View>
    </LfSheet>
  );
}
