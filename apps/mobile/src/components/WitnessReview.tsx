import { ENDPOINT, asWitnessDetailResponse, asWitnessJoinResponse, asWitnessSignResponse, asWitnessLeaveResponse, KEEPER_LABEL_BY_LOCALE, PROMISE_CATEGORY_LABEL_BY_LOCALE, type WitnessDetailResponse } from '@littlefinger/shared';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { callMobileFunctionNative, callMobileFunctionPublicNative } from '../lib/mobile-api-native.ts';
import { createInviteReviewIdempotencyKey } from '../lib/invite-review-native.ts';
import { useLabels, useLocale } from '../lib/locale-native';
import { MobileApiError } from '../lib/mobile-api.ts';
import { clearPendingEntry } from '../lib/pending-entry.ts';
import { WITNESS_REVIEW_LABEL } from '../screens/witness-review-labels.ts';
import { colors, space } from '../theme/tokens';
import { LfAppBar } from './LfAppBar';
import { LfButton } from './LfButton';
import { LfText } from './LfText';
import { LfCard } from './LfCard';
import { LfOval } from './LfOval';

export function WitnessReview({ token, promiseId }: { token?: string; promiseId?: string }): React.JSX.Element {
  const L = useLabels(WITNESS_REVIEW_LABEL); const { locale } = useLocale(); const router = useRouter();
  const [detail, setDetail] = useState<WitnessDetailResponse | null>(null);
  const [joinedId, setJoinedId] = useState(promiseId ?? null);
  const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false); const locked = useRef(false);
  const [confirmLeave, setConfirmLeave] = useState(false); const [left, setLeft] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false); const [declined, setDeclined] = useState(false);
  const [keys] = useState(() => ({ join: createInviteReviewIdempotencyKey(), sign: createInviteReviewIdempotencyKey(), leave: createInviteReviewIdempotencyKey() }));
  const home = (): void => { clearPendingEntry(); router.replace('/home'); };
  useEffect(() => {
    let alive = true; setError('');
    void callMobileFunctionNative<unknown>(joinedId === null ? ENDPOINT.witnessPreview : ENDPOINT.witnessDetail,
      joinedId === null ? { token } : { promise_id: joinedId }, { idempotent: false })
      .then(raw => { const parsed = asWitnessDetailResponse(raw); if (!parsed) throw new Error('INVALID_WITNESS_DETAIL'); if (alive) setDetail(parsed); })
      .catch(e => { if (alive) setError(e instanceof MobileApiError ? e.message : L.error); });
    return () => { alive = false; };
  }, [token, joinedId, retry, L.error]);
  async function accept(): Promise<void> {
    if (locked.current || detail === null) return;
    locked.current = true; setBusy(true); setError(''); let id = joinedId;
    try {
      if (id === null) {
        const joined = asWitnessJoinResponse(await callMobileFunctionNative(ENDPOINT.witnessJoin, { token }, { idempotent: true, idempotencyKey: keys.join }));
        if (!joined) throw new Error('INVALID_WITNESS_JOIN');
        id = joined.promise_id; setJoinedId(id);
      }
      if (detail.visibility === 'FULL') {
        const signed = asWitnessSignResponse(await callMobileFunctionNative(ENDPOINT.witnessSign, { promise_id: id }, { idempotent: true, idempotencyKey: keys.sign }));
        if (!signed) throw new Error('INVALID_WITNESS_SIGN');
        setDetail(current => current && { ...current, signed_at: signed.signed_at });
        setRetry(n => n + 1);
      }
    } catch (e) { setError(e instanceof MobileApiError ? e.message : id !== null ? L.signFailed : L.error); }
    finally { locked.current = false; setBusy(false); }
  }
  async function decline(): Promise<void> {
    if (locked.current) return; locked.current = true; setBusy(true); setError('');
    try {
      const raw = await callMobileFunctionPublicNative<{ status: string }>(ENDPOINT.inviteDeclinePublic, { token });
      if (raw.status !== 'DECLINED') throw new Error('INVALID_DECLINE');
      setDeclined(true);
    } catch (e) { setError(e instanceof MobileApiError ? e.message : L.error); }
    finally { locked.current = false; setBusy(false); }
  }
  async function leave(): Promise<void> {
    if (locked.current || joinedId === null) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const result = asWitnessLeaveResponse(await callMobileFunctionNative(ENDPOINT.witnessLeave, { promise_id: joinedId }, { idempotent: true, idempotencyKey: keys.leave }));
      if (!result) throw new Error('INVALID_WITNESS_LEAVE');
      setLeft(true); setConfirmLeave(false);
    } catch (e) { setError(e instanceof MobileApiError ? e.message : L.error); }
    finally { locked.current = false; setBusy(false); }
  }
  return <SafeAreaView style={styles.screen}>
    <LfAppBar title={L.title} leading="close" leadingAccessibilityLabel={L.close} onLeadingPress={home} />
    <ScrollView contentContainerStyle={styles.body} testID="witness-review-body">
      <View style={styles.art}><LfOval variant="web" /></View>
      {declined || left ? <LfText variant="title">{left ? L.left : L.declined}</LfText> : detail === null ? <LfText>{error || L.loading}</LfText> : <>
        <LfText variant="title">{detail.title}</LfText>
        <LfText secondary>{L.role}</LfText>
        <LfText>{L.creator}: {detail.creator.nickname}</LfText>
        {detail.partner && <LfText>{L.partner}: {detail.partner.nickname}</LfText>}
        {joinedId !== null && <LfText>{detail.signed_at ? L.confirmed : L.joined}</LfText>}
        {detail.content === null ? <LfText secondary>{L.waiting}</LfText> : <LfCard>
          <View style={styles.content}>
            <LfText variant="subtitle">{L.body}</LfText><LfText>{detail.content.body}</LfText>
            <LfText>{L.category}: {PROMISE_CATEGORY_LABEL_BY_LOCALE[locale][detail.content.category]}</LfText>
            <LfText>{L.keeper}: {KEEPER_LABEL_BY_LOCALE[locale][detail.content.keeper]}</LfText>
            <LfText>{L.endDate}: {detail.content.end_date ?? L.noEndDate}</LfText>
            {detail.content.reward && <LfText>{L.reward}: {detail.content.reward}</LfText>}
            {detail.content.penalty && <LfText>{L.penalty}: {detail.content.penalty}</LfText>}
          </View>
        </LfCard>}
      </>}
      {error !== '' && detail !== null && <LfText accessibilityRole="alert">{error}</LfText>}
    </ScrollView>
    <View style={styles.actions}>
      {confirmLeave ? <>
        <LfText variant="subtitle">{L.leaveConfirm}</LfText><LfText secondary>{L.leaveHint}</LfText>
        <LfButton label={L.leave} disabled={busy} onPress={() => void leave()} />
        <LfButton label={L.stay} variant="text" disabled={busy} onPress={() => setConfirmLeave(false)} />
      </> : declined || left || detail?.signed_at ? <LfButton label={L.close} onPress={home} /> : detail === null ? <LfButton label={L.retry} onPress={() => setRetry(n => n + 1)} /> : confirmDecline ? <>
        <LfText>{L.declineConfirm}</LfText>
        <LfButton label={L.decline} disabled={busy} onPress={() => void decline()} />
        <LfButton label={L.stay} variant="text" disabled={busy} onPress={() => setConfirmDecline(false)} />
      </> : <>
        {joinedId === null || detail.visibility === 'FULL' ? <LfButton label={busy ? L.busy : detail.visibility === 'FULL' ? L.sign : L.join} disabled={busy} onPress={() => void accept()} /> : <LfButton label={L.retry} onPress={() => setRetry(n => n + 1)} />}
        {joinedId === null && <LfButton label={L.decline} variant="text" disabled={busy} onPress={() => setConfirmDecline(true)} />}
      </>}
      {joinedId !== null && !left && !confirmLeave && <>
        <LfButton label={L.viewRecord} variant="outlined" disabled={busy} onPress={() => { clearPendingEntry(); router.replace(`/promise/${joinedId}`); }} />
        <LfButton label={L.leave} variant="text" disabled={busy} onPress={() => setConfirmLeave(true)} />
      </>}
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { padding: space[9], gap: space[7] }, art: { alignItems: 'center' },
  content: { gap: space[5] }, actions: { padding: space[9], gap: space[5] },
});
