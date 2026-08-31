import {
  INVITE_RESEND_MAX,
  INVITE_TTL_HOURS,
} from '@littlefinger/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAppBar } from '../components/LfAppBar';
import { LfButton } from '../components/LfButton';
import { LfCard } from '../components/LfCard';
import { LfChip } from '../components/LfChip';
import { LfIcon } from '../components/LfIcon';
import { LfPinky } from '../components/LfPinky';
import { LfRow } from '../components/LfRow';
import { LfStack } from '../components/LfStack';
import { LfText } from '../components/LfText';
import { SlotPaywallSheet } from '../components/slot-paywall-sheet.tsx';
import { WitnessInviteSheet } from '../components/witness-invite-sheet.tsx';
import {
  formatInviteCountdown,
  inviteRemainingSeconds,
  isInviteExpired,
  type InviteWithToken,
} from '../lib/invite-flow.ts';
import {
  copyInviteLink,
  deletePendingPromise,
  loadStoredInvite,
  reissueInvite,
  revokeInvite,
  shareInvite,
} from '../lib/invite-native.ts';
import { useLabels } from '../lib/locale-native';
import { MobileApiError } from '../lib/mobile-api.ts';
import { INVITE_LABEL } from '../screens/invite-labels.ts';
import { colors, gutter, radius, size, space } from '../theme/tokens';

const COUNTDOWN_REFRESH_MS = 60 * 1_000;
const COPY_FEEDBACK_MS = 2_500;

type InvitePhase = 'loading' | 'ready' | 'missing' | 'revoked' | 'error';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  back: {
    minWidth: size.touchMin,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: gutter.app,
    paddingBottom: space[9],
    gap: space[6],
  },
  stamp: {
    alignItems: 'center',
    borderRadius: radius.xl,
    backgroundColor: colors.primaryContainer,
    padding: space[8],
    gap: space[4],
  },
  preview: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: space[5],
  },
  bubble: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: space[5],
  },
  countdown: { flex: 1 },
  progress: {
    height: space[1],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

function promiseIdOf(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export default function InviteScreen(): React.JSX.Element {
  const LABEL = useLabels(INVITE_LABEL);
  const router = useRouter();
  const params = useLocalSearchParams<{
    promise_id?: string | string[];
    witness_enabled?: string | string[];
  }>();
  const promiseId = promiseIdOf(params.promise_id);
  const witnessEnabled = params.witness_enabled === 'true';
  const [phase, setPhase] = useState<InvitePhase>('loading');
  const [invite, setInvite] = useState<InviteWithToken | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    },
    [],
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [resendBlocked, setResendBlocked] = useState(false);
  const [witnessSheetOpen, setWitnessSheetOpen] = useState(false);
  const [slotSheetOpen, setSlotSheetOpen] = useState(false);

  useEffect(() => {
    if (promiseId === null) {
      setPhase('error');
      return;
    }
    let active = true;
    void loadStoredInvite(promiseId)
      .then((stored) => {
        if (!active) return;
        setInvite(stored);
        setPhase(stored === null ? 'missing' : 'ready');
      })
      .catch(() => {
        if (active) setPhase('error');
      });
    return () => {
      active = false;
    };
  }, [promiseId]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), COUNTDOWN_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const expired =
    invite !== null && isInviteExpired(invite.expires_at, now);
  const maxReached =
    resendBlocked ||
    (invite !== null && invite.resend_count >= INVITE_RESEND_MAX);
  const remaining =
    invite === null ? 0 : inviteRemainingSeconds(invite.expires_at, now);
  const progress = Math.min(
    100,
    (remaining / (INVITE_TTL_HOURS * 60 * 60)) * 100,
  );

  async function shareCurrent(): Promise<void> {
    if (invite === null || expired || busy) return;
    setBusy(true);
    setActionError(false);
    try {
      await shareInvite(invite);
      setShared(true);
    } catch {
      setActionError(true);
    } finally {
      setBusy(false);
    }
  }

  async function copyCurrent(): Promise<void> {
    if (invite === null || expired) return;
    setActionError(false);
    try {
      await copyInviteLink(invite);
      setCopied(true);
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      setActionError(true);
    }
  }

  async function issueAndShare(): Promise<void> {
    if (promiseId === null || maxReached || busy) return;
    setBusy(true);
    setActionError(false);
    try {
      const issued = await reissueInvite(promiseId);
      setInvite(issued);
      setPhase('ready');
      setNow(new Date());
      await shareInvite(issued);
      setShared(true);
    } catch (error) {
      if (error instanceof MobileApiError && error.code === 'E_RATE_LIMIT') {
        setResendBlocked(true);
      } else if (error instanceof MobileApiError && error.code === 'E_SLOT_LIMIT') {
        // DRAFT 발송이 슬롯 한도에 걸린 경우 — 결제 시트가 안내를 맡는다.
        setSlotSheetOpen(true);
      } else {
        setActionError(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function revokeCurrent(): Promise<void> {
    if (promiseId === null || busy) return;
    setBusy(true);
    setActionError(false);
    try {
      await revokeInvite(promiseId);
      setPhase('revoked');
      setShared(false);
    } catch {
      setActionError(true);
    } finally {
      setBusy(false);
    }
  }

  function confirmRevoke(): void {
    Alert.alert(LABEL.revokeFirstTitle, LABEL.revokeFirstBody, [
      { text: LABEL.cancel, style: 'cancel' },
      {
        text: LABEL.continue,
        onPress: () => {
          Alert.alert(LABEL.revokeFinalTitle, LABEL.revokeFinalBody, [
            { text: LABEL.cancel, style: 'cancel' },
            {
              text: LABEL.revoke,
              style: 'destructive',
              onPress: async () => await revokeCurrent(),
            },
          ]);
        },
      },
    ]);
  }

  async function deleteCurrent(): Promise<void> {
    if (promiseId === null || busy) return;
    setBusy(true);
    setActionError(false);
    try {
      await deletePendingPromise(promiseId);
      router.replace('/home');
    } catch {
      setActionError(true);
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(): void {
    Alert.alert(LABEL.deleteFirstTitle, LABEL.deleteFirstBody, [
      { text: LABEL.cancel, style: 'cancel' },
      {
        text: LABEL.continue,
        onPress: () => {
          Alert.alert(LABEL.deleteFinalTitle, LABEL.deleteFinalBody, [
            { text: LABEL.cancel, style: 'cancel' },
            {
              text: LABEL.deletePromise,
              style: 'destructive',
              onPress: async () => await deleteCurrent(),
            },
          ]);
        },
      },
    ]);
  }

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loading}>
          <LfText secondary>{LABEL.loading}</LfText>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loading}>
          <LfText variant="error" align="center">
            {LABEL.loadError}
          </LfText>
        </View>
      </SafeAreaView>
    );
  }

  const needsIssue = phase === 'missing' || phase === 'revoked' || expired;

  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        title={LABEL.title}
        leading={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={LABEL.back}
            onPress={() => router.push('/home')}
            style={styles.back}
          >
            <LfIcon name="arrow-back" />
          </Pressable>
        }
        action={<LfChip label={LABEL.waiting} tone="neutral" />}
      />

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.stamp}>
          <LfPinky size="lg" />
          <LfText variant="subtitle" align="center">
            {LABEL.headline}
          </LfText>
          <LfText variant="caption" align="center">
            {LABEL.description}
          </LfText>
        </View>

        {!needsIssue && invite !== null && (
          <>
            <LfStack gap={3}>
              <LfButton
                label={shared ? LABEL.shareAgain : LABEL.share}
                variant="filled"
                size="cta"
                block
                disabled={busy}
                onPress={() => void shareCurrent()}
              />
              <LfButton
                label={copied ? LABEL.copied : LABEL.copy}
                variant="tonal"
                block
                disabled={busy}
                onPress={() => void copyCurrent()}
              />
            </LfStack>

            <LfStack gap={3}>
              <LfText variant="sectionTitle">{LABEL.preview}</LfText>
              <View style={styles.preview}>
                <View style={styles.bubble}>
                  <LfStack gap={3}>
                    <LfText variant="subtitle">{LABEL.previewTitle(invite.title)}</LfText>
                    <LfText variant="caption">{LABEL.linkCta}</LfText>
                  </LfStack>
                </View>
              </View>
            </LfStack>

            <LfCard>
              <LfStack gap={4}>
                <LfRow gap={4}>
                  <LfIcon name="schedule" color="primary" />
                  <View style={styles.countdown}>
                    <LfText variant="caption">{LABEL.validTime}</LfText>
                    <LfText variant="headline">
                      {formatInviteCountdown(invite.expires_at, now)}
                    </LfText>
                  </View>
                </LfRow>
                <View style={styles.progress}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <LfText variant="caption">{LABEL.linkNotice}</LfText>
              </LfStack>
            </LfCard>

            <LfButton
              label={LABEL.revoke}
              variant="danger"
              block
              disabled={busy}
              onPress={confirmRevoke}
            />
          </>
        )}

        {needsIssue && (
          <LfCard variant="container">
            <LfStack gap={5} center>
              <LfIcon name="link-off" color="primary" />
              <LfText variant="subtitle" align="center">
                {phase === 'missing'
                  ? LABEL.missing
                  : phase === 'revoked'
                    ? LABEL.revoked
                    : LABEL.expired}
              </LfText>
              {maxReached && (
                <LfText variant="caption" align="center">
                  {LABEL.maxResend(INVITE_RESEND_MAX)}
                </LfText>
              )}
              <LfButton
                label={LABEL.reissue}
                variant="outlined"
                block
                disabled={busy || maxReached}
                onPress={() => void issueAndShare()}
              />
            </LfStack>
          </LfCard>
        )}

        {actionError && (
          <LfText variant="error" align="center">
            {LABEL.actionError}
          </LfText>
        )}

        {witnessEnabled && promiseId !== null && (
          <LfButton
            label={LABEL.witnessInvite}
            variant="tonal"
            block
            onPress={() => setWitnessSheetOpen(true)}
          />
        )}

        {promiseId !== null && (
          <LfButton
            label={LABEL.deletePromise}
            variant="text"
            block
            disabled={busy}
            onPress={confirmDelete}
          />
        )}
      </ScrollView>
      {promiseId !== null && (
        <WitnessInviteSheet
          visible={witnessSheetOpen}
          promiseId={promiseId}
          onClose={() => setWitnessSheetOpen(false)}
        />
      )}
      <SlotPaywallSheet
        visible={slotSheetOpen}
        reason="limit"
        onClose={() => setSlotSheetOpen(false)}
        // 결제 완료 = 막혔던 재발급·공유의 즉시 재개(PO 2026-08-26).
        onPurchased={() => {
          setSlotSheetOpen(false);
          void issueAndShare();
        }}
      />
    </SafeAreaView>
  );
}
