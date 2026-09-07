import {
  END_DATE_EXTENSION_DAYS,
  PERMANENT_ACCESS_PRICE_KRW_DEFAULT,
  RETENTION_EXTENSION_DAYS,
  formatKstDate,
  formatKstDateTime,
  type PromiseEntitlementsView,
  type RewardAction,
} from '@littlefinger/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLabels, useLocale } from '../lib/locale-native';
import { getPromiseEntitlements, unlockWithRewardedAd } from '../lib/monetization-native.ts';
import {
  loadPermanentAccessPrice,
  purchasePermanentAccess,
  reconcilePermanentAccessPurchase,
  SlotPurchaseCancelledError,
} from '../lib/slot-purchase-native.ts';
import { PROMISE_ENTITLEMENT_LABEL } from '../screens/promise-entitlement-labels.ts';
import { colors, border, radius, size, space } from '../theme/tokens.ts';
import { LfButton } from './LfButton.tsx';
import { LfCard } from './LfCard.tsx';
import { LfHint } from './LfHint.tsx';
import { LfIcon } from './LfIcon.tsx';
import { LfSheet } from './LfSheet.tsx';
import { LfStack } from './LfStack.tsx';
import { LfText } from './LfText.tsx';

export interface PromiseEntitlementSheetProps {
  visible: boolean;
  promiseId: string;
  mode: 'DURATION' | 'RETENTION';
  /** 서버가 E_END_DATE_RANGE 로 막아 열린 시트 — 광고·구매 안내를 시트가 직접 말한다. */
  reason?: 'END_DATE_RANGE';
  onClose(): void;
  onChanged?(value: PromiseEntitlementsView): void;
}

type BusyAction = 'REWARD' | 'PURCHASE' | null;

const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  content: { gap: space[6] },
  // 막힌 이유 안내 — 핑크 flat 상자 (`.lf-slot-sheet__notice` 12 14 · 2px 잉크 r10)
  notice: {
    paddingVertical: space[5],
    paddingHorizontal: space[6],
    borderWidth: border.chip,
    borderColor: colors.text,
    borderRadius: radius.sm,
    backgroundColor: colors.attentionContainer,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  rowText: { flex: 1, minWidth: 0 },
});

export function PromiseEntitlementSheet({
  visible,
  promiseId,
  mode,
  reason,
  onClose,
  onChanged,
}: PromiseEntitlementSheetProps): React.JSX.Element {
  const LABEL = useLabels(PROMISE_ENTITLEMENT_LABEL);
  const { locale } = useLocale();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState<PromiseEntitlementsView | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const busy = busyAction !== null;

  const apply = useCallback((next: PromiseEntitlementsView) => {
    setValue(next);
    onChangedRef.current?.(next);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    setFailed(false);
    setLocked(false);
    setMessage(null);
    void Promise.all([
      getPromiseEntitlements(promiseId),
      loadPermanentAccessPrice(),
      reconcilePermanentAccessPurchase(promiseId),
    ])
      .then(([next, nextPrice, recovered]) => {
        if (!active) return;
        if (recovered === null) setValue(next);
        else apply(recovered);
        setPrice(nextPrice);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setFailed(true);
        }
      });
    return () => { active = false; };
  }, [apply, nonce, promiseId, visible]);

  async function reward(): Promise<void> {
    if (busy) return;
    const action: RewardAction = mode === 'DURATION' ? 'DURATION_30D' : 'RETENTION_30D';
    setBusyAction('REWARD');
    setMessage(null);
    setLocked(false);
    try {
      const result = await unlockWithRewardedAd(promiseId, action);
      if (result.phase === 'GRANTED') apply(result.entitlements);
      else if (result.phase === 'PENDING') setMessage(LABEL.unlocking);
      else if (result.phase === 'UNAVAILABLE') setLocked(true);
    } catch {
      setMessage(LABEL.rewardError);
    } finally {
      setBusyAction(null);
    }
  }

  async function buy(): Promise<void> {
    if (busy) return;
    setBusyAction('PURCHASE');
    setMessage(null);
    try {
      apply(await purchasePermanentAccess(promiseId));
      setMessage(LABEL.purchased);
    } catch (error) {
      if (!(error instanceof SlotPurchaseCancelledError)) setMessage(LABEL.purchaseError);
    } finally {
      setBusyAction(null);
    }
  }

  const permanent = value?.retention.permanent === true;
  // 서버는 DURATION 보상을 작성자에게만 허용한다 — 상대방에게 광고 버튼을 보여 주면 거절만 돌아온다.
  const creator = value?.my_role === 'CREATOR';
  const rewardAvailable = value !== null && !permanent && !locked && (
    mode === 'DURATION' ? creator && !value.duration.unlimited : value.retention.renewable
  );
  const creatorOnlyNotice = value !== null && mode === 'DURATION' && !creator && !value.duration.unlimited;
  const current = value === null ? null : mode === 'DURATION'
    ? value.duration.unlimited
      ? LABEL.unlimited
      : value.duration.ceiling_date === null
        ? LABEL.unlimited
        : LABEL.ceiling(formatKstDate(value.duration.ceiling_date, locale))
    : permanent
      ? LABEL.permanent
      : value.retention.expires_at === null
        ? LABEL.notRenewable
        : LABEL.expiry(formatKstDateTime(new Date(value.retention.expires_at)));
  const priceText = price ?? LABEL.priceFallback(PERMANENT_ACCESS_PRICE_KRW_DEFAULT);
  const rewardLabel = busyAction === 'REWARD'
    ? LABEL.rewarding
    : mode === 'DURATION'
      ? LABEL.rewardDuration(END_DATE_EXTENSION_DAYS)
      : LABEL.rewardRetention(RETENTION_EXTENSION_DAYS);

  return (
    <LfSheet
      visible={visible}
      title={mode === 'DURATION' ? LABEL.durationTitle : LABEL.retentionTitle}
      closeLabel={LABEL.close}
      onClose={onClose}
    >
      <ScrollView
        testID="entitlement-scroll"
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[9] }]}
      >
        {loading ? <LfText variant="caption">{LABEL.loading}</LfText> : null}
        {failed ? (
          <LfStack gap={4}>
            <LfText variant="error">{LABEL.loadError}</LfText>
            <LfButton label={LABEL.retry} variant="outlined" block onPress={() => setNonce((n) => n + 1)} />
          </LfStack>
        ) : null}
        {value !== null ? (
          <>
            {reason === 'END_DATE_RANGE' && mode === 'DURATION' ? (
              <View style={styles.notice}>
                <LfText variant="note">{LABEL.endDateRangeGuide(END_DATE_EXTENSION_DAYS)}</LfText>
              </View>
            ) : null}
            {!permanent ? (
              <LfText variant="caption">
                {mode === 'DURATION'
                  ? LABEL.durationDescription(END_DATE_EXTENSION_DAYS)
                  : LABEL.retentionDescription(RETENTION_EXTENSION_DAYS)}
              </LfText>
            ) : null}
            {current !== null ? (
              <View style={styles.row}>
                <LfIcon name={mode === 'DURATION' ? 'event' : 'inventory_2'} size={size.appbarIcon} />
                <View style={styles.rowText}><LfText variant="label">{current}</LfText></View>
              </View>
            ) : null}
            {creatorOnlyNotice ? <LfText variant="caption">{LABEL.durationCreatorOnly}</LfText> : null}
            {rewardAvailable ? (
              <LfButton
                label={rewardLabel}
                variant="outlined"
                block
                disabled={busy}
                onPress={() => void reward()}
              />
            ) : null}
            {/* 광고 버튼이 있던 자리 — 잠김은 글로만 말하고 빈 버튼을 남기지 않는다 */}
            {locked && !permanent ? <LfHint icon="lock" text={LABEL.locked} /> : null}
            {!permanent ? (
              <LfCard tone="sky" testID="entitlement-purchase-offer">
                <LfStack gap={4}>
                  <LfText variant="stamp">{LABEL.purchaseTitle}</LfText>
                  <LfText variant="note">{LABEL.purchaseDescription}</LfText>
                  <LfButton
                    label={busyAction === 'PURCHASE' ? LABEL.purchasing : LABEL.purchase(priceText)}
                    size="cta"
                    trailing="inventory_2"
                    block
                    inset
                    disabled={busy}
                    onPress={() => void buy()}
                  />
                </LfStack>
              </LfCard>
            ) : null}
            {message !== null ? <LfText variant="caption" align="center">{message}</LfText> : null}
          </>
        ) : null}
      </ScrollView>
    </LfSheet>
  );
}
