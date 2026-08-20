import {
  KEEPER_LABEL,
  PROMISE_CATEGORY_LABEL,
  ddayFrom,
  formatDday,
  validateAmendSuggestion,
  type InvitePreviewResponse,
  type InviteResolveResponse,
} from '@littlefinger/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleMark } from '../../components/GoogleMark';
import { LfButton } from '../../components/LfButton';
import { LfCard } from '../../components/LfCard';
import { LfDisclaimer } from '../../components/LfDisclaimer';
import { LfPinky } from '../../components/LfPinky';
import { LfText } from '../../components/LfText';
import { LfTextarea } from '../../components/LfTextarea';
import { formatInviteCountdown } from '../../lib/invite-flow.ts';
import { openInviteInBrowserNative } from '../../lib/invite-link-native.ts';
import {
  approveInviteNative,
  createInviteReviewIdempotencyKey,
  declineInviteNative,
  previewInviteNative,
  resolveInviteNative,
  suggestInviteAmendNative,
  watchMobileSession,
} from '../../lib/invite-review-native.ts';
import { signInWithGoogle, signInWithKakao } from '../../lib/kakao-auth-native.ts';
import { useLabels } from '../../lib/locale-native';
import { MobileApiError } from '../../lib/mobile-api.ts';
import { INVITE_REVIEW_LABEL } from '../../screens/invite-review-labels.ts';
import {
  phaseAfterResolve,
  phaseForInviteFailure,
  type InviteReviewPhase,
} from '../../screens/invite-review-state.ts';
import { space } from '../../theme/tokens';

/**
 * 앱 내 초대 검토 — EC-I01 "해당 약속 화면으로 딥링크"의 실구현 (PO 2026-08-20, ADR 0007).
 *
 * 웹 SCR-W01→W02 를 한 라우트가 이어받는다. 이 라우트는 _layout 의 인증 가드 **밖**에
 * 있고 로그인 전후 리다이렉트에서 제외돼 있어, 로그인 도중에도 토큰이 라우트를 떠나지
 * 않는다. RN fetch 는 Origin 헤더를 보내지 않으므로 여기서의 승인은 `surface=APP` 으로
 * 기록된다 — 클라이언트가 선언하는 값이 아니라 서버가 헤더 부재로 판정한다.
 *
 * 증인 토큰은 웹 SCR-W05 로 핸드오프한다(참여·서명 UI 는 웹이 완성본, ADR 0007).
 * 광고 없음 — 수락·검토 표면 전체가 광고 금지다(CLAUDE.md §8-1).
 */

const MS_PER_SECOND = 1000;

type PendingAction = 'APPROVE' | 'DECLINE' | 'AMEND' | null;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: space[8], gap: space[6], alignItems: 'stretch' },
  centered: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: space[6] },
  badge: { alignItems: 'center' },
  fields: { gap: space[4] },
  fieldRow: { gap: space[1] },
  actions: { gap: space[3], marginTop: space[4] },
});

export default function InviteReviewScreen(): React.JSX.Element {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const L = useLabels(INVITE_REVIEW_LABEL);

  const [phase, setPhase] = useState<InviteReviewPhase>({ kind: 'RESOLVING' });
  const [invite, setInvite] = useState<InviteResolveResponse | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [amending, setAmending] = useState(false);
  const [amendComment, setAmendComment] = useState('');
  const [pending, setPending] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [handoffFailed, setHandoffFailed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [reloadNonce, setReloadNonce] = useState(0);
  // 엔드포인트마다 화면 진입 시 한 번 — 두 번 눌린 액션이 서버에 한 요청으로 접힌다(§7-3.6).
  const [idempotencyKeys] = useState(() => ({
    approve: createInviteReviewIdempotencyKey(),
    decline: createInviteReviewIdempotencyKey(),
    amend: createInviteReviewIdempotencyKey(),
  }));

  const tokenValue = typeof token === 'string' ? token : '';

  useEffect(() => watchMobileSession(setHasSession), []);

  useEffect(() => {
    if (tokenValue.length === 0) return;
    let alive = true;
    setPhase({ kind: 'RESOLVING' });
    setInvite(null);
    void resolveInviteNative(tokenValue)
      .then((resolved) => {
        if (alive) setInvite(resolved);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        const failure = error instanceof MobileApiError ? error : null;
        setPhase(phaseForInviteFailure(failure?.code ?? null, failure?.message ?? ''));
      });
    return () => {
      alive = false;
    };
  }, [tokenValue, reloadNonce]);

  // resolve 결과와 세션 판정이 둘 다 도착하면 단계가 정해진다. 로그인이 뒤늦게 끝나면
  // LANDING → REVIEW_LOADING 으로만 올라간다 — 진행 중인 검토·종결 화면은 덮지 않는다.
  useEffect(() => {
    if (invite === null || hasSession === null) return;
    setPhase((current) => {
      if (current.kind === 'RESOLVING') return phaseAfterResolve(invite, hasSession);
      if (current.kind === 'LANDING' && hasSession) return phaseAfterResolve(invite, hasSession);
      return current;
    });
  }, [invite, hasSession]);

  useEffect(() => {
    if (phase.kind !== 'REVIEW_LOADING') return;
    let alive = true;
    void previewInviteNative(tokenValue)
      .then((preview) => {
        if (alive) setPhase({ kind: 'REVIEW', invite: phase.invite, preview });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        const failure = error instanceof MobileApiError ? error : null;
        if (failure?.code === 'E_AUTH_REQUIRED') {
          // 검토 직전 세션이 끊겼다 — 로그인 버튼이 있는 랜딩으로 되돌린다.
          setPhase({ kind: 'LANDING', invite: phase.invite });
          return;
        }
        setPhase(phaseForInviteFailure(failure?.code ?? null, failure?.message ?? ''));
      });
    return () => {
      alive = false;
    };
  }, [phase, tokenValue]);

  useEffect(() => {
    if (phase.kind !== 'LANDING') return;
    const timer = setInterval(() => setNow(new Date()), MS_PER_SECOND);
    return () => clearInterval(timer);
  }, [phase.kind]);

  const applyActionFailure = useCallback(
    (error: unknown): void => {
      const failure = error instanceof MobileApiError ? error : null;
      if (failure?.code === 'E_AUTH_REQUIRED' && invite !== null) {
        setPhase({ kind: 'LANDING', invite });
        return;
      }
      const next = phaseForInviteFailure(failure?.code ?? null, failure?.message ?? '');
      if (next.kind === 'RETRY') {
        // 링크가 죽은 게 아니면 화면을 유지하고 문구만 띄운다 — 재시도 버튼이 남는다.
        setActionError(next.message.length > 0 ? next.message : L.authError);
        return;
      }
      setPhase(next);
    },
    [L.authError, invite],
  );

  async function handleSignIn(provider: 'kakao' | 'google'): Promise<void> {
    setSigningIn(true);
    setAuthMessage(null);
    try {
      const result = provider === 'kakao' ? await signInWithKakao() : await signInWithGoogle();
      if (result === 'CANCELED') setAuthMessage(L.authCanceled);
      if (result === 'NICKNAME_REQUIRED') setAuthMessage(L.authError);
    } catch {
      setAuthMessage(L.authError);
    } finally {
      setSigningIn(false);
    }
  }

  async function handleApprove(): Promise<void> {
    setConfirming(false);
    setPending('APPROVE');
    setActionError(null);
    try {
      const approved = await approveInviteNative(tokenValue, idempotencyKeys.approve);
      // 초대는 이 순간 USED 다. replace 가 아니면 뒤로가기가 소모된 토큰으로 돌아간다(EC-B02).
      router.replace(`/promise/${approved.promise_id}`);
    } catch (error) {
      setPending(null);
      applyActionFailure(error);
    }
  }

  async function handleDecline(): Promise<void> {
    setPending('DECLINE');
    setActionError(null);
    try {
      await declineInviteNative(tokenValue, '', idempotencyKeys.decline);
      setPhase({ kind: 'DONE', outcome: 'DECLINED' });
    } catch (error) {
      setPending(null);
      applyActionFailure(error);
    }
  }

  async function handleAmend(): Promise<void> {
    const validation = validateAmendSuggestion(amendComment);
    if (!validation.valid) {
      setActionError(validation.message ?? L.authError);
      return;
    }
    setPending('AMEND');
    setActionError(null);
    try {
      await suggestInviteAmendNative(tokenValue, amendComment, idempotencyKeys.amend);
      setPhase({ kind: 'DONE', outcome: 'AMEND_SUGGESTED' });
    } catch (error) {
      setPending(null);
      applyActionFailure(error);
    }
  }

  if (tokenValue.length === 0) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={[styles.scroll, styles.centered]}>
          <LfText variant="body" align="center">{L.invalidToken}</LfText>
        </View>
      </SafeAreaView>
    );
  }

  if (phase.kind === 'RESOLVING' || phase.kind === 'REVIEW_LOADING') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={[styles.scroll, styles.centered]} accessibilityRole="progressbar">
          <LfPinky size="xl" accessibilityLabel={L.handoffTitle} />
        </View>
      </SafeAreaView>
    );
  }

  if (phase.kind === 'UNAVAILABLE') {
    const oneTime = phase.reason === 'E_INVITE_EXPIRED' || phase.reason === 'E_INVITE_USED';
    return (
      <SafeAreaView style={styles.screen}>
        <View style={[styles.scroll, styles.centered]}>
          <LfText variant="title" align="center">{L.unavailableTitle}</LfText>
          <LfText variant="body" secondary align="center">
            {L.unavailableReason[phase.reason]}
          </LfText>
          {oneTime && (
            <LfText variant="caption" align="center">{L.oneTimeNotice}</LfText>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (phase.kind === 'SELF_INVITE') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={[styles.scroll, styles.centered]}>
          <LfText variant="body" align="center">{L.selfInvite}</LfText>
          <LfButton label={L.goHome} onPress={() => router.replace('/home')} />
        </View>
      </SafeAreaView>
    );
  }

  if (phase.kind === 'RETRY') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={[styles.scroll, styles.centered]}>
          <LfText variant="body" secondary align="center" accessibilityRole="alert">
            {phase.message}
          </LfText>
          <LfButton label={L.retryCta} onPress={() => setReloadNonce((nonce) => nonce + 1)} />
        </View>
      </SafeAreaView>
    );
  }

  if (phase.kind === 'DONE') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={[styles.scroll, styles.centered]}>
          <LfText variant="title" align="center">
            {phase.outcome === 'DECLINED' ? L.doneDeclined : L.doneAmendSuggested}
          </LfText>
          <LfButton label={L.goHome} size="cta" onPress={() => router.replace('/home')} />
        </View>
      </SafeAreaView>
    );
  }

  if (phase.kind === 'HANDOFF') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={[styles.scroll, styles.centered]}>
          <LfText variant="title" align="center">{L.handoffTitle}</LfText>
          <LfText variant="body" secondary align="center">{L.handoffBody}</LfText>
          {handoffFailed && (
            <LfText variant="caption" align="center" accessibilityRole="alert">
              {L.handoffFailure}
            </LfText>
          )}
          <LfButton
            label={L.handoffAction}
            size="cta"
            block
            onPress={() => {
              setHandoffFailed(false);
              openInviteInBrowserNative(tokenValue).catch(() => setHandoffFailed(true));
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (phase.kind === 'LANDING') {
    const remaining = formatInviteCountdown(phase.invite.expires_at, now);
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.scroll, styles.centered]}>
          <LfText variant="caption" align="center">
            {`${remaining} ${L.countdownSuffix}`}
          </LfText>
          <View style={styles.badge}>
            <LfPinky size="xl" accessibilityLabel={L.previewSectionTitle} />
          </View>
          <LfText variant="title" align="center">
            {L.landingHeadline(phase.invite.creator_nickname)}
          </LfText>
          <LfCard>
            <View style={styles.fieldRow}>
              <LfText variant="sectionTitle">{L.previewSectionTitle}</LfText>
              <LfText variant="subtitle">{phase.invite.title}</LfText>
              <LfText variant="caption">{L.previewHint}</LfText>
            </View>
          </LfCard>
          <View style={styles.actions}>
            <LfButton
              variant="kakao"
              size="cta"
              block
              label={L.kakaoCta}
              disabled={signingIn}
              onPress={() => void handleSignIn('kakao')}
            />
            <LfButton
              variant="google"
              size="cta"
              block
              leading={<GoogleMark />}
              label={L.googleCta}
              disabled={signingIn}
              onPress={() => void handleSignIn('google')}
            />
            {authMessage !== null && (
              <LfText variant="caption" align="center" accessibilityRole="alert">
                {authMessage}
              </LfText>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // REVIEW — §4-3-4 전문. D-Day 는 클라이언트가 계산한다(서버는 end_date 만 준다).
  const { preview } = phase;
  const dday = ddayFrom(preview.end_date, now);
  const endDatePassed = dday < 0;
  const busy = pending !== null;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LfText variant="title">{L.reviewHeadline(preview.creator.nickname)}</LfText>
        <LfCard>
          <View style={styles.fields}>
            <LfText variant="subtitle">{preview.title}</LfText>
            <LfText variant="body">{preview.body}</LfText>
            <ReviewField label={L.category} value={PROMISE_CATEGORY_LABEL[preview.category]} />
            <ReviewField
              label={L.endDate}
              value={`${preview.end_date} · ${formatDday(dday)}`}
            />
            <ReviewField label={L.keeper} value={KEEPER_LABEL[preview.keeper]} />
            {preview.reward !== null && <ReviewField label={L.reward} value={preview.reward} />}
            {preview.penalty !== null && (
              <ReviewField label={L.penalty} value={preview.penalty} />
            )}
            {preview.witness_enabled && (
              <LfText variant="caption">{L.witnessNotice}</LfText>
            )}
          </View>
        </LfCard>
        <LfDisclaimer />
        {endDatePassed && (
          <LfText variant="caption" accessibilityRole="alert">
            {L.endDatePassedMessage}
          </LfText>
        )}
        {actionError !== null && (
          <LfText variant="caption" accessibilityRole="alert">{actionError}</LfText>
        )}

        {confirming ? (
          <View style={styles.actions}>
            <LfText variant="subtitle" align="center">
              {L.confirmQuestion(preview.creator.nickname)}
            </LfText>
            <LfText variant="body" secondary align="center">{L.confirmBody}</LfText>
            <LfButton
              size="cta"
              block
              label={L.confirmYes}
              disabled={busy}
              onPress={() => void handleApprove()}
            />
            <LfButton
              variant="outlined"
              block
              label={L.confirmNo}
              disabled={busy}
              onPress={() => setConfirming(false)}
            />
          </View>
        ) : amending ? (
          <View style={styles.actions}>
            <LfText variant="sectionTitle">{L.amendFieldLabel}</LfText>
            <LfTextarea
              value={amendComment}
              onChangeText={setAmendComment}
              accessibilityLabel={L.amendFieldLabel}
            />
            <LfButton
              size="cta"
              block
              label={L.amendCta}
              disabled={busy}
              onPress={() => void handleAmend()}
            />
            <LfButton
              variant="outlined"
              block
              label={L.confirmNo}
              disabled={busy}
              onPress={() => setAmending(false)}
            />
          </View>
        ) : (
          <View style={styles.actions}>
            <LfButton
              size="cta"
              block
              label={L.approveCta}
              disabled={busy || endDatePassed}
              onPress={() => setConfirming(true)}
            />
            <LfButton
              variant="tonal"
              block
              label={L.amendCta}
              disabled={busy}
              onPress={() => setAmending(true)}
            />
            <LfButton
              variant="outlined"
              block
              label={L.declineCta}
              disabled={busy}
              onPress={() => void handleDecline()}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReviewField({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.fieldRow}>
      <LfText variant="sectionTitle">{label}</LfText>
      <LfText variant="body">{value}</LfText>
    </View>
  );
}
