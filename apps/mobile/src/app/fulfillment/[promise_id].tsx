import {
  FULFILLMENT_COMMENT_MAX,
  KST_MARK,
  codepointLength,
  formatKstDate,
  formatKstDateTime,
  normalizeInput,
  type Answer,
  type FulfillmentCheckView,
  type FulfillmentRoundView,
  type ParticipantRole,
  type PromiseFulfillmentDetailResponse,
} from '@littlefinger/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAppBar } from '../../components/LfAppBar';
import { LfButton } from '../../components/LfButton';
import { LfCard } from '../../components/LfCard';
import { LfChip } from '../../components/LfChip';
import { LfField } from '../../components/LfField';
import { LfIcon } from '../../components/LfIcon';
import { LfRow } from '../../components/LfRow';
import { LfStack } from '../../components/LfStack';
import { LfText } from '../../components/LfText';
import { LfTextarea } from '../../components/LfTextarea';
import {
  createFulfillmentIdempotencyKey,
  loadFulfillmentDetail,
  reopenFulfillment,
  submitFulfillment,
} from '../../lib/fulfillment-native.ts';
import { MobileApiError } from '../../lib/mobile-api.ts';
import { SCR_A06_LABEL } from '../../screens/scr-a06-labels.ts';
import {
  colors,
  gutter,
  radius,
  size,
  space,
} from '../../theme/tokens';

const CLAIM_ROLES = ['CREATOR', 'PARTNER'] as const;

type ScreenPhase = 'loading' | 'ready' | 'not-found' | 'error';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  back: {
    minWidth: size.touchMin,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: gutter.app,
  },
  body: {
    padding: gutter.app,
    paddingBottom: space[9],
    gap: space[6],
  },
  actions: {
    paddingHorizontal: gutter.app,
    paddingTop: space[4],
    paddingBottom: space[6],
    backgroundColor: colors.surfaceChrome,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
  },
  question: { alignItems: 'center' },
  answer: {
    minHeight: size.touchMin + space[9],
    paddingHorizontal: space[8],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[5],
  },
  answerSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  answerText: { flex: 1 },
  counter: { alignItems: 'flex-end' },
  claim: { gap: space[4] },
  statusCard: { alignItems: 'center' },
});

function promiseIdOf(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function BackButton({ onPress }: { onPress(): void }): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={SCR_A06_LABEL.back}
      onPress={onPress}
      style={styles.back}
    >
      <LfIcon name="arrow-back" />
    </Pressable>
  );
}

function ScreenFrame({
  onBack,
  children,
}: {
  onBack(): void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        title={SCR_A06_LABEL.title}
        leading={<BackButton onPress={onBack} />}
      />
      {children}
    </SafeAreaView>
  );
}

function AnswerChoice({
  answer,
  selected,
  onPress,
}: {
  answer: Answer;
  selected: boolean;
  onPress(): void;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={SCR_A06_LABEL.answer[answer]}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.answer, selected && styles.answerSelected]}
    >
      <LfIcon
        name={answer === 'KEPT' ? 'check-circle' : 'cancel'}
        color={selected ? 'primary' : 'textMuted'}
      />
      <View style={styles.answerText}>
        <LfText variant="subtitle">{SCR_A06_LABEL.answer[answer]}</LfText>
        <LfText variant="disclaimer">
          {SCR_A06_LABEL.answerSubtitle[answer]}
        </LfText>
      </View>
      <LfIcon
        name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
        color={selected ? 'primary' : 'outlineIcon'}
      />
    </Pressable>
  );
}

function ClaimCard({ check }: { check: FulfillmentCheckView }): React.JSX.Element {
  return (
    <LfCard testID={`claim-${check.role}`}>
      <View style={styles.claim}>
        <LfRow>
          <View style={styles.answerText}>
            <LfText variant="sectionTitle">
              {SCR_A06_LABEL.role(check.role)}
            </LfText>
          </View>
          <LfChip
            label={SCR_A06_LABEL.answer[check.answer]}
            tone="status"
          />
        </LfRow>
        <LfText>
          {check.comment === null || check.comment.length === 0
            ? SCR_A06_LABEL.noComment
            : check.comment}
        </LfText>
        <LfRow>
          <View style={styles.answerText}>
            <LfText variant="caption">{SCR_A06_LABEL.submittedAt}</LfText>
          </View>
          <LfText variant="caption">
            {`${formatKstDateTime(new Date(check.submitted_at))}${KST_MARK}`}
          </LfText>
        </LfRow>
      </View>
    </LfCard>
  );
}

function checksByRole(
  own: FulfillmentCheckView | null,
  partner: FulfillmentCheckView | null,
): Record<Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>, FulfillmentCheckView | null> {
  const checks = { CREATOR: null, PARTNER: null } as Record<
    Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>,
    FulfillmentCheckView | null
  >;
  if (own !== null) checks[own.role] = own;
  if (partner !== null) checks[partner.role] = partner;
  return checks;
}

function RoundHistory({ round }: { round: FulfillmentRoundView }): React.JSX.Element {
  return (
    <LfStack gap={4}>
      <LfText variant="sectionTitle">
        {SCR_A06_LABEL.roundHistory(round.round_no)}
      </LfText>
      {round.creator_check !== null && <ClaimCard check={round.creator_check} />}
      {round.partner_check !== null && <ClaimCard check={round.partner_check} />}
    </LfStack>
  );
}

export default function FulfillmentScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ promise_id?: string | string[] }>();
  const promiseId = promiseIdOf(params.promise_id);
  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [detail, setDetail] = useState<PromiseFulfillmentDetailResponse | null>(
    null,
  );
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const submitIdempotencyKey = useRef<string | null>(null);
  const reopenIdempotencyKey = useRef<string | null>(null);

  const refresh = useCallback(
    async (): Promise<PromiseFulfillmentDetailResponse | null> => {
      if (promiseId === null) {
        setPhase('not-found');
        return null;
      }
      try {
        const nextDetail = await loadFulfillmentDetail(promiseId);
        setDetail(nextDetail);
        setPhase('ready');
        return nextDetail;
      } catch (error) {
        setPhase(
          error instanceof MobileApiError && error.code === 'E_NOT_FOUND'
            ? 'not-found'
            : 'error',
        );
        return null;
      }
    },
    [promiseId],
  );

  useEffect(() => {
    submitIdempotencyKey.current = null;
    reopenIdempotencyKey.current = null;
    void refresh();
  }, [refresh]);

  const commentLength = codepointLength(comment);
  const commentInvalid = commentLength > FULFILLMENT_COMMENT_MAX;

  function startRevision(): void {
    if (detail?.my_check === null || detail?.my_check === undefined) return;
    submitIdempotencyKey.current = null;
    setAnswer(detail.my_check.answer);
    setComment(detail.my_check.comment ?? '');
    setEditing(true);
    setActionMessage(null);
  }

  async function submit(): Promise<void> {
    if (
      promiseId === null ||
      answer === null ||
      commentInvalid ||
      busy
    ) {
      return;
    }
    setBusy(true);
    setActionMessage(null);
    const key =
      submitIdempotencyKey.current ?? createFulfillmentIdempotencyKey();
    submitIdempotencyKey.current = key;
    try {
      await submitFulfillment(
        {
          promise_id: promiseId,
          answer,
          ...(comment.length > 0 ? { comment } : {}),
          ...(editing ? { revise: true } : {}),
        },
        key,
      );
      submitIdempotencyKey.current = null;
      setEditing(false);
      setAnswer(null);
      setComment('');
      await refresh();
    } catch (error) {
      if (error instanceof MobileApiError && error.code === 'E_STATE_CONFLICT') {
        setActionMessage(
          detail?.status === 'ACTIVE' || detail?.checking_started_at === null
            ? SCR_A06_LABEL.beforeChecking
            : SCR_A06_LABEL.alreadyClosed,
        );
        const nextDetail = await refresh();
        if (
          nextDetail?.my_check?.answer === answer &&
          (nextDetail.my_check.comment ?? '') === comment
        ) {
          submitIdempotencyKey.current = null;
        }
      } else {
        setActionMessage(SCR_A06_LABEL.actionError);
      }
    } finally {
      setBusy(false);
    }
  }

  async function reopen(): Promise<void> {
    if (promiseId === null || busy) return;
    setBusy(true);
    setActionMessage(null);
    const key =
      reopenIdempotencyKey.current ?? createFulfillmentIdempotencyKey();
    reopenIdempotencyKey.current = key;
    const previousRound = detail?.check_round_no ?? 0;
    try {
      await reopenFulfillment(promiseId, key);
      reopenIdempotencyKey.current = null;
      await refresh();
    } catch (error) {
      if (error instanceof MobileApiError && error.code === 'E_STATE_CONFLICT') {
        const nextDetail = await refresh();
        if (
          nextDetail?.status === 'CHECKING' &&
          nextDetail.check_round_no > previousRound
        ) {
          reopenIdempotencyKey.current = null;
        }
      } else {
        setActionMessage(SCR_A06_LABEL.actionError);
      }
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'loading') {
    return (
      <ScreenFrame onBack={() => router.back()}>
        <View style={styles.centered}>
          <LfText secondary>{SCR_A06_LABEL.loading}</LfText>
        </View>
      </ScreenFrame>
    );
  }

  if (phase === 'not-found') {
    return (
      <ScreenFrame onBack={() => router.back()}>
        <View style={styles.centered}>
          <LfText secondary align="center">
            {SCR_A06_LABEL.notFound}
          </LfText>
        </View>
      </ScreenFrame>
    );
  }

  if (phase === 'error' || detail === null) {
    return (
      <ScreenFrame onBack={() => router.back()}>
        <View style={styles.centered}>
          <LfStack gap={5} center>
            <LfText secondary align="center">
              {SCR_A06_LABEL.loadError}
            </LfText>
            <LfButton
              label={SCR_A06_LABEL.retry}
              variant="outlined"
              onPress={() => {
                setPhase('loading');
                void refresh();
              }}
            />
          </LfStack>
        </View>
      </ScreenFrame>
    );
  }

  const isChecking = detail.status === 'CHECKING';
  const canAnswer = isChecking && detail.my_check === null;
  const showForm = canAnswer || editing;
  const currentChecks = checksByRole(detail.my_check, detail.partner_check);
  const isUnresolved = detail.status === 'UNRESOLVED';
  const isResult = ['COMPLETED', 'BROKEN', 'DISPUTED', 'UNRESOLVED'].includes(
    detail.status,
  );

  return (
    <ScreenFrame onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.body}>
        <LfCard>
          <LfStack gap={3}>
            <LfText variant="subtitle">{detail.title}</LfText>
            <LfText variant="caption">
              {SCR_A06_LABEL.endDate(formatKstDate(detail.end_date))}
              {KST_MARK}
            </LfText>
            <LfText variant="caption">
              {SCR_A06_LABEL.keeper(detail.keeper)}
            </LfText>
          </LfStack>
        </LfCard>

        {actionMessage !== null && (
          <LfCard variant="container">
            <LfText align="center">{actionMessage}</LfText>
          </LfCard>
        )}

        {showForm && (
          <>
            <View style={styles.question}>
              <LfText variant="headline" align="center">
                {SCR_A06_LABEL.question}
              </LfText>
              <LfText variant="caption" align="center">
                {SCR_A06_LABEL.sameQuestion}
              </LfText>
            </View>
            <LfStack
              gap={4}
              accessibilityRole="radiogroup"
              accessibilityLabel={SCR_A06_LABEL.answerLegend}
            >
              {(['KEPT', 'NOT_KEPT'] as const).map((value) => (
                <AnswerChoice
                  key={value}
                  answer={value}
                  selected={answer === value}
                  onPress={() => {
                    if (answer !== value) submitIdempotencyKey.current = null;
                    setAnswer(value);
                  }}
                />
              ))}
            </LfStack>
            <LfField
              label={SCR_A06_LABEL.comment}
              optional
              error={
                commentInvalid
                  ? SCR_A06_LABEL.commentLimit(FULFILLMENT_COMMENT_MAX)
                  : undefined
              }
            >
              <LfTextarea
                accessibilityLabel={SCR_A06_LABEL.comment}
                placeholder={SCR_A06_LABEL.commentPlaceholder}
                value={comment}
                onChangeText={(value) => {
                  const normalized = normalizeInput(value);
                  if (comment !== normalized) submitIdempotencyKey.current = null;
                  setComment(normalized);
                }}
              />
              <View style={styles.counter}>
                <LfText variant="caption">
                  {commentLength}/{FULFILLMENT_COMMENT_MAX}
                </LfText>
              </View>
            </LfField>
            {canAnswer && detail.partner_has_submitted && (
              <LfCard variant="container">
                <LfText align="center">{SCR_A06_LABEL.counterpartFirst}</LfText>
              </LfCard>
            )}
          </>
        )}

        {isChecking && detail.my_check !== null && !editing && (
          <LfStack gap={5}>
            <LfCard variant="container">
              <LfText align="center">{SCR_A06_LABEL.waiting}</LfText>
            </LfCard>
            <ClaimCard check={detail.my_check} />
            {detail.my_check.revised_at === null &&
            !detail.partner_has_submitted ? (
              <LfButton
                label={SCR_A06_LABEL.revise}
                variant="outlined"
                block
                disabled={busy}
                onPress={startRevision}
              />
            ) : (
              <LfText variant="caption" align="center">
                {SCR_A06_LABEL.revisionUsed}
              </LfText>
            )}
          </LfStack>
        )}

        {isResult && (
          <LfStack gap={5}>
            <View style={styles.statusCard}>
              <LfChip
                label={SCR_A06_LABEL.status(detail.status)}
                tone="status"
              />
            </View>
            {detail.status === 'DISPUTED' && (
              <LfCard variant="container">
                <LfText align="center">{SCR_A06_LABEL.disputed}</LfText>
              </LfCard>
            )}
            <LfText variant="sectionTitle">
              {SCR_A06_LABEL.currentResult}
            </LfText>
            {isUnresolved
              ? CLAIM_ROLES.map((role) => (
                  <LfText key={role}>
                    {currentChecks[role] === null
                      ? SCR_A06_LABEL.responseMissing(role)
                      : SCR_A06_LABEL.responseDone(role)}
                  </LfText>
                ))
              : CLAIM_ROLES.map((role) =>
                  currentChecks[role] === null ? null : (
                    <ClaimCard key={role} check={currentChecks[role]} />
                  ),
                )}
            {detail.status === 'DISPUTED' && (
              <LfButton
                label={SCR_A06_LABEL.reopen}
                variant="filled"
                block
                disabled={busy}
                onPress={() => void reopen()}
              />
            )}
          </LfStack>
        )}

        {detail.history.length > 0 && (
          <LfStack gap={5}>
            <LfText variant="subtitle">{SCR_A06_LABEL.history}</LfText>
            {[...detail.history]
              .sort((left, right) => left.round_no - right.round_no)
              .map((round) => (
                <RoundHistory key={round.round_no} round={round} />
              ))}
          </LfStack>
        )}
      </ScrollView>

      {showForm && (
        <View style={styles.actions}>
          <LfButton
            label={editing ? SCR_A06_LABEL.reviseSubmit : SCR_A06_LABEL.submit}
            size="cta"
            block
            disabled={answer === null || commentInvalid || busy}
            onPress={() => void submit()}
          />
        </View>
      )}
    </ScreenFrame>
  );
}
