import {
  INVITE_RESEND_MAX,
  INVITE_TTL_HOURS,
  PROMISE_STATUS_LABEL,
} from '@littlefinger/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { WitnessInviteSheet } from '../components/witness-invite-sheet.tsx';
import {
  formatInviteCountdown,
  inviteRemainingSeconds,
  isInviteExpired,
  type InviteWithToken,
} from '../lib/invite-flow.ts';
import {
  loadStoredInvite,
  reissueInvite,
  revokeInvite,
  shareInvite,
} from '../lib/invite-native.ts';
import { MobileApiError } from '../lib/mobile-api.ts';
import { colors, gutter, radius, size, space } from '../theme/tokens';

const COUNTDOWN_REFRESH_MS = 60 * 1_000;

const INVITE_LABEL = {
  title: '초대 보내기',
  back: '뒤로가기',
  waiting: PROMISE_STATUS_LABEL.PENDING,
  headline: '상대방에게 손가락을 내밀어 볼까요?',
  description: '초대장을 보내면 상대방이 손가락을 걸어야 약속이 성립돼요',
  share: '카카오톡으로 초대 보내기',
  shareAgain: '링크 다시 공유',
  preview: '상대방에게는 이렇게 보여요',
  linkCta: '약속 확인하기',
  validTime: '초대 링크 유효 시간',
  linkNotice: '링크는 1회용이에요 · 만료되면 다시 보낼 수 있어요',
  expired: '초대가 만료됐어요',
  missing: '저장된 초대 링크를 불러올 수 없어요',
  revoked: '초대 링크를 무효화했어요',
  reissue: '초대 다시 보내기',
  revoke: '초대 링크 무효화',
  revokeFirstTitle: '초대 링크를 무효화할까요?',
  revokeFirstBody: '상대방은 이 링크를 사용할 수 없게 돼요.',
  revokeFinalTitle: '정말 링크를 무효화할까요?',
  revokeFinalBody: '약속은 승인 대기 상태로 유지돼요.',
  continue: '계속',
  cancel: '취소',
  maxResend: `초대는 약속당 ${INVITE_RESEND_MAX}번까지 보낼 수 있습니다.`,
  loading: '초대 링크를 불러오는 중이에요',
  loadError: '초대 링크를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  actionError: '초대 링크를 처리하지 못했어요. 다시 시도해 주세요.',
  witnessInvite: '증인도 초대하기',
} as const;

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
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [resendBlocked, setResendBlocked] = useState(false);
  const [witnessSheetOpen, setWitnessSheetOpen] = useState(false);

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
    Alert.alert(INVITE_LABEL.revokeFirstTitle, INVITE_LABEL.revokeFirstBody, [
      { text: INVITE_LABEL.cancel, style: 'cancel' },
      {
        text: INVITE_LABEL.continue,
        onPress: () => {
          Alert.alert(INVITE_LABEL.revokeFinalTitle, INVITE_LABEL.revokeFinalBody, [
            { text: INVITE_LABEL.cancel, style: 'cancel' },
            {
              text: INVITE_LABEL.revoke,
              style: 'destructive',
              onPress: async () => await revokeCurrent(),
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
          <LfText secondary>{INVITE_LABEL.loading}</LfText>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loading}>
          <LfText secondary align="center">
            {INVITE_LABEL.loadError}
          </LfText>
        </View>
      </SafeAreaView>
    );
  }

  const needsIssue = phase === 'missing' || phase === 'revoked' || expired;

  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        title={INVITE_LABEL.title}
        leading={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={INVITE_LABEL.back}
            onPress={() => router.push('/home')}
            style={styles.back}
          >
            <LfIcon name="arrow-back" />
          </Pressable>
        }
        action={<LfChip label={INVITE_LABEL.waiting} tone="neutral" />}
      />

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.stamp}>
          <LfPinky size="lg" tone="onContainer" />
          <LfText variant="subtitle" align="center">
            {INVITE_LABEL.headline}
          </LfText>
          <LfText variant="caption" align="center">
            {INVITE_LABEL.description}
          </LfText>
        </View>

        {!needsIssue && invite !== null && (
          <>
            <LfButton
              label={shared ? INVITE_LABEL.shareAgain : INVITE_LABEL.share}
              variant="kakao"
              size="cta"
              block
              disabled={busy}
              onPress={() => void shareCurrent()}
            />

            <LfStack gap={3}>
              <LfText variant="sectionTitle">{INVITE_LABEL.preview}</LfText>
              <View style={styles.preview}>
                <View style={styles.bubble}>
                  <LfStack gap={3}>
                    <LfText variant="subtitle">약속: {invite.title}</LfText>
                    <LfText variant="caption">{INVITE_LABEL.linkCta}</LfText>
                  </LfStack>
                </View>
              </View>
            </LfStack>

            <LfCard>
              <LfStack gap={4}>
                <LfRow gap={4}>
                  <LfIcon name="schedule" color="primary" />
                  <View style={styles.countdown}>
                    <LfText variant="caption">{INVITE_LABEL.validTime}</LfText>
                    <LfText variant="headline">
                      {formatInviteCountdown(invite.expires_at, now)}
                    </LfText>
                  </View>
                </LfRow>
                <View style={styles.progress}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <LfText variant="caption">{INVITE_LABEL.linkNotice}</LfText>
              </LfStack>
            </LfCard>

            <LfButton
              label={INVITE_LABEL.revoke}
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
                  ? INVITE_LABEL.missing
                  : phase === 'revoked'
                    ? INVITE_LABEL.revoked
                    : INVITE_LABEL.expired}
              </LfText>
              {maxReached && (
                <LfText variant="caption" align="center">
                  {INVITE_LABEL.maxResend}
                </LfText>
              )}
              <LfButton
                label={INVITE_LABEL.reissue}
                variant="outlined"
                block
                disabled={busy || maxReached}
                onPress={() => void issueAndShare()}
              />
            </LfStack>
          </LfCard>
        )}

        {actionError && (
          <LfText variant="caption" align="center">
            {INVITE_LABEL.actionError}
          </LfText>
        )}

        {witnessEnabled && promiseId !== null && (
          <LfButton
            label={INVITE_LABEL.witnessInvite}
            variant="tonal"
            block
            onPress={() => setWitnessSheetOpen(true)}
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
    </SafeAreaView>
  );
}
