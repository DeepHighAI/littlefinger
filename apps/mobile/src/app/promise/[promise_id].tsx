import {
  buildParticipantPromisesWebUrl,
  ddayFrom,
  formatDday,
  formatKstDate,
  KEEPER_LABEL_BY_LOCALE,
  PARTICIPANT_ROLE_LABEL_BY_LOCALE,
  PROMISE_CATEGORY_LABEL_BY_LOCALE,
  PROMISE_STATUS_LABEL_BY_LOCALE,
  toKstDate,
  type CompletionCelebrationView,
  type EvidenceView,
  type FulfillmentCheckView,
  type PromiseDetailPerson,
  type PromiseDetailResponse,
  type PromiseDetailVersion,
  type PromiseEntitlementsView,
  type PromiseAmendCreateRequest,
  type PromiseAmendDecision,
  type PromiseVersionListResponse,
} from '@littlefinger/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAppBar } from '../../components/LfAppBar';
import { LfAvatar } from '../../components/LfAvatar';
import { LfButton } from '../../components/LfButton';
import { LfCard } from '../../components/LfCard';
import { LfChip } from '../../components/LfChip';
import { LfDday } from '../../components/LfDday';
import { LfDisclaimer } from '../../components/LfDisclaimer';
import { LfIcon, type LfIconName } from '../../components/LfIcon';
import { LfOutcomes } from '../../components/LfOutcomes';
import { LfSheet } from '../../components/LfSheet';
import { LfStack } from '../../components/LfStack';
import { LfStamp, type LfStampCorner } from '../../components/LfStamp';
import { LfStatusTile } from '../../components/LfStatusTile';
import { LfInkContext, LfText } from '../../components/LfText';
import { CompletionCelebrationSheet } from '../../components/completion-celebration-sheet.tsx';
import { PromiseAmendSheet } from '../../components/promise-amend-sheet.tsx';
import { PromiseEntitlementSheet } from '../../components/promise-entitlement-sheet.tsx';
import { WitnessInviteSheet } from '../../components/witness-invite-sheet.tsx';
import {
  blockUserNative,
  hidePromiseNative,
  reportSafetyIssueNative,
} from '../../lib/account-safety-native.ts';
import {
  claimCompletionCelebration,
  markCompletionCelebrationShown,
} from '../../lib/completion-celebration-native.ts';
import {
  createFulfillmentIdempotencyKey,
  reopenFulfillment,
  signFulfillmentEvidence,
} from '../../lib/fulfillment-native.ts';
import { useLabels, useLocale } from '../../lib/locale-native';
import { MobileApiError } from '../../lib/mobile-api.ts';
import { getPromiseEntitlements } from '../../lib/monetization-native.ts';
import {
  createPromiseAmendIdempotencyKey,
  listPromiseVersions,
  requestPromiseAmend,
  respondPromiseAmend,
  withdrawPromiseAmend,
} from '../../lib/promise-amend-native.ts';
import { getPromiseDetail } from '../../lib/promise-detail-native.ts';
import { openEndDatePicker } from '../../lib/promise-editor-native.ts';
import {
  changedVersionRows,
  claimPresentation,
  detailStatusOf,
  detailVisualModeOf,
  evidenceAvailabilityText,
  fingerprintText,
  formatDetailDate,
  formatDetailDday,
  formatDetailInstant,
  responseFact,
  type PromiseDetailVisualMode,
} from '../../screens/scr-a05-detail-state.ts';
import { MOD_01_LABEL, SCR_A05_LABEL } from '../../screens/scr-a05-labels.ts';
import { textFontFamily } from '../../theme/fonts';
import { border, colors, elevation, gutter, line, radius, size, space, type, weight } from '../../theme/tokens';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const WITNESS_INVITE_STATUSES = new Set(['PENDING', 'ACTIVE', 'AMEND_PENDING', 'CHECKING']);
/** README 상세 본문 22/20/20/16 · 주장 증빙 자리 56 · 결과 필 아이콘 14 · 행 아이콘 20 · 지킴 체크 16 · 행 링크 화살표 18 · 증빙 아이콘 24 — 토큰 없음, ADR 0020 예외 */
const BODY_TOP = 22;
const CLAIM_EVIDENCE_HEIGHT = 56;
const RESULT_ICON = 14;
const ROW_ICON = 20;
const KEPT_ICON = 16;
const LINK_ICON = 18;
const PROOF_ICON = 24;

type ScreenPhase = 'loading' | 'ready' | 'not-found' | 'error';
/** 헤더 상태 칩 옆 한 줄 — "종료일 2026-08-11 (화)" 처럼 라벨·값이 갈리거나 한 문장 */
interface HeadLine {
  label?: string;
  value: string;
}
interface IntentKey {
  signature: string;
  key: string;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: gutter.app,
    gap: space[6],
  },
  body: {
    paddingTop: BODY_TOP,
    paddingRight: space[8],
    paddingBottom: space[8],
    paddingLeft: gutter.app,
    gap: space[6],
  },
  // 헤더 — 상태 칩 + 날짜 · 제목 · D-Day (`.lf-detail__head` 4 4 6)
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[5],
    paddingTop: space[1],
    paddingHorizontal: space[1],
    paddingBottom: space[2],
  },
  headMain: { flex: 1, minWidth: 0 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  headDate: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: space[1] },
  headTitle: { marginTop: space[4] },
  content: { gap: space[4] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  // 안내 배너 — 스카이 카드 노트 (`.lf-note`), 종이 변형은 배경만 다르다
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[6],
    paddingHorizontal: space[7],
    borderRadius: radius.xl,
    borderWidth: border.card,
    borderColor: colors.text,
    backgroundColor: colors.recordContainer,
    ...elevation.card,
  },
  notePaper: { backgroundColor: colors.surface },
  noteText: { flex: 1, minWidth: 0 },
  // 행 링크 — 48h · 13/800 · 화살표 18 (`.lf-row-link`)
  rowLink: {
    minHeight: size.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[2],
  },
  rowLinkLabel: { flex: 1, minWidth: 0 },
  // 정보 행 — 40 아이콘 타일 + eyebrow 위 · 값 아래 (`.lf-info-row`)
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: space[5] },
  infoBody: { flex: 1, minWidth: 0 },
  infoValue: { marginTop: space[1] },
  // flat 카드 안 점선 구분 행 (`.lf-response-list` · `.lf-response-row` 12 0)
  list: { paddingVertical: space[1] },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space[5], paddingVertical: space[5] },
  divided: { borderTopWidth: border.dashed, borderTopColor: colors.outline, borderStyle: 'dashed' },
  rowText: { flex: 1, minWidth: 0 },
  divider: { height: 0, borderTopWidth: border.dashed, borderTopColor: colors.outline, borderStyle: 'dashed' },
  // 내 기록 보관 행 (`.lf-retention-row`)
  retention: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  // 변경 협의 비교 칸 (`.lf-compare__item` r10 2px · 12 14) — 변경 전은 뮤트 + 취소선
  compare: { flexDirection: 'row', gap: space[4] },
  compareItem: {
    flex: 1,
    paddingVertical: space[5],
    paddingHorizontal: space[6],
    borderRadius: radius.sm,
    borderWidth: border.chip,
    borderColor: colors.text,
    backgroundColor: colors.surface,
  },
  compareBefore: { backgroundColor: colors.surfaceMuted },
  compareValue: { marginTop: space[1] },
  strike: {
    fontSize: type.label,
    lineHeight: line.bodyStrong,
    fontFamily: textFontFamily(weight.bold),
    color: colors.text,
    textDecorationLine: 'line-through',
  },
  // 의견 불일치 주장 — 두 카드가 같은 크기·순서 (P1, `.lf-claims` 16)
  claims: { flexDirection: 'row', gap: space[7] },
  claim: {
    flex: 1,
    alignItems: 'center',
    gap: space[2],
    paddingVertical: size.cardPadding,
    paddingHorizontal: space[5],
    borderRadius: radius.lg,
    borderWidth: border.card,
    borderColor: colors.text,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  claimEvidence: {
    alignSelf: 'stretch',
    minHeight: CLAIM_EVIDENCE_HEIGHT,
    marginTop: space[2],
    padding: space[3],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: border.chip,
    borderColor: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  claimEvidenceEmpty: {
    backgroundColor: 'transparent',
    borderWidth: border.dashed,
    borderStyle: 'dashed',
    borderColor: colors.outlineStrong,
  },
  evidenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  evidenceGroup: { alignItems: 'center', gap: space[2] },
  // 증빙 썸네일 (`.lf-photo` 84 r12 2px + 3px) · 가려짐·만료 자리는 점선
  photo: {
    width: size.thumb,
    height: size.thumb,
    padding: space[2],
    gap: space[1],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius['2xl'],
    borderWidth: border.chip,
    borderColor: colors.text,
    backgroundColor: colors.surface,
    ...elevation.sm,
  },
  photoPlaceholder: {
    backgroundColor: 'transparent',
    borderWidth: border.dashed,
    borderStyle: 'dashed',
    borderColor: colors.outlineStrong,
    ...elevation.sheet,
  },
  // 결과 필 (`.lf-result` 28h r8 2px) — 민트=지킴 · 핑크=안 지킴, 글자가 상태를 말한다
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    height: size.chipStatusHeight,
    paddingHorizontal: space[4],
    borderRadius: radius.xs,
    borderWidth: border.chip,
    borderColor: colors.text,
  },
  resultKept: { backgroundColor: colors.successContainer },
  resultBroken: { backgroundColor: colors.attentionContainer },
  // 하단 — 보조 outlined(내용 폭) + 주 CTA(남는 폭) 56h (`.lf-detail__actions`)
  actions: {
    paddingHorizontal: space[8],
    paddingTop: space[5],
    paddingBottom: space[7],
    gap: space[3],
    backgroundColor: colors.background,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: space[5] },
  actionMain: { flex: 1 },
  safetyRow: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  historyContent: { gap: space[5], paddingBottom: space[5] },
});

function promiseIdOf(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : null;
}

function ScreenFrame({
  onBack,
  mode = 'terminal-neutral',
  children,
}: {
  onBack(): void;
  mode?: PromiseDetailVisualMode;
  children: React.ReactNode;
}): React.JSX.Element {
  const LABEL = useLabels(SCR_A05_LABEL);
  return (
    <SafeAreaView style={styles.screen} testID={`promise-detail-${mode}`}>
      <LfAppBar
        title={LABEL.title}
        leading="back"
        leadingAccessibilityLabel={LABEL.back}
        onLeadingPress={onBack}
      />
      {children}
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View>
      <LfText variant="eyebrow">{label}</LfText>
      <LfText variant="label">{value}</LfText>
    </View>
  );
}

function ListRow({
  divided = false,
  children,
}: {
  divided?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return <View style={[styles.listRow, divided && styles.divided]}>{children}</View>;
}

function PersonRow({
  person,
  divided = false,
}: {
  person: PromiseDetailPerson;
  divided?: boolean;
}): React.JSX.Element {
  const LABEL = useLabels(SCR_A05_LABEL);
  const { locale } = useLocale();
  return (
    <ListRow divided={divided}>
      <LfAvatar
        size="row"
        nickname={person.nickname}
        profileImageUrl={person.profile_image_url}
        accessibilityLabel={LABEL.profileImage(person.nickname)}
      />
      <View style={styles.rowText}>
        <LfText variant="label">{person.nickname}</LfText>
        <LfText variant="meta">{PARTICIPANT_ROLE_LABEL_BY_LOCALE[locale][person.role]}</LfText>
      </View>
    </ListRow>
  );
}

/** 양측 응답 행 — 제출 사실은 글자로, 결과는 필로. DISPUTED 는 필 없이 사실만 (P1) */
function ResponseRow({
  nickname,
  profileImageUrl,
  submitted,
  check,
  silent = false,
  divided = false,
}: {
  nickname: string;
  profileImageUrl: string | null;
  submitted: boolean;
  check: FulfillmentCheckView | null;
  silent?: boolean;
  divided?: boolean;
}): React.JSX.Element {
  const LABEL = useLabels(SCR_A05_LABEL);
  const { locale } = useLocale();
  const kept = check?.answer === 'KEPT';
  return (
    <ListRow divided={divided}>
      <LfAvatar
        size="row"
        pending={!submitted}
        nickname={nickname}
        profileImageUrl={profileImageUrl}
        accessibilityLabel={LABEL.profileImage(nickname)}
      />
      <View style={styles.rowText}>
        <LfText variant="label">{responseFact(nickname, submitted, locale)}</LfText>
      </View>
      {check !== null ? (
        <View style={[styles.result, kept ? styles.resultKept : styles.resultBroken]}>
          <LfIcon name={kept ? 'check' : 'close'} size={RESULT_ICON} />
          <LfText variant="chip">{LABEL.answer[check.answer]}</LfText>
        </View>
      ) : submitted ? (
        <LfIcon name="check" size={KEPT_ICON} />
      ) : (
        <LfIcon name={silent ? 'notifications_off' : 'hourglass_empty'} size={ROW_ICON} color="textMuted" />
      )}
    </ListRow>
  );
}

function InfoCard({
  tone,
  icon,
  label,
  value,
  action,
}: {
  tone: 'sky' | 'yellow';
  icon: LfIconName;
  label: string;
  value: string;
  action?: React.ReactNode;
}): React.JSX.Element {
  return (
    <LfCard tone={tone}>
      <View style={styles.infoRow}>
        <LfStatusTile icon={icon} tone="paper" />
        <View style={styles.infoBody}>
          <LfText variant="eyebrow">{label}</LfText>
          <View style={styles.infoValue}><LfText variant="label">{value}</LfText></View>
        </View>
        {action}
      </View>
    </LfCard>
  );
}

function NoteBanner({
  icon,
  text,
  tone = 'sky',
}: {
  icon: LfIconName;
  text: string;
  tone?: 'sky' | 'paper';
}): React.JSX.Element {
  return (
    <View style={[styles.note, tone === 'paper' && styles.notePaper]}>
      <LfIcon name={icon} size={ROW_ICON} />
      <View style={styles.noteText}><LfText variant="note">{text}</LfText></View>
    </View>
  );
}

/** 행 링크 — 누를 수 없으면 버튼 역할도 주지 않는다 (종결 화면의 "가짜 액션" 금지) */
function RowLink({
  icon,
  label,
  accessibilityLabel,
  onPress,
}: {
  icon?: LfIconName;
  label: string;
  accessibilityLabel?: string;
  onPress?: () => void;
}): React.JSX.Element {
  const content = (
    <>
      {icon === undefined ? null : <LfIcon name={icon} size={LINK_ICON} />}
      <View style={styles.rowLinkLabel}><LfText variant="note">{label}</LfText></View>
      <LfIcon name="arrow_forward" size={LINK_ICON} />
    </>
  );
  if (onPress === undefined) return <View style={styles.rowLink}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={styles.rowLink}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

function CompareItem({
  label,
  value,
  before = false,
}: {
  label: string;
  value: string;
  before?: boolean;
}): React.JSX.Element {
  return (
    <LfInkContext.Provider value={!before}>
      <View style={[styles.compareItem, before && styles.compareBefore]}>
        <LfText variant="eyebrow">{label}</LfText>
        <View style={styles.compareValue}>
          {before ? <Text style={styles.strike}>{value}</Text> : <LfText variant="label">{value}</LfText>}
        </View>
      </View>
    </LfInkContext.Provider>
  );
}

function EvidenceTile({
  evidence,
  onReport,
}: {
  evidence: EvidenceView;
  onReport(evidenceId: string): void;
}): React.JSX.Element {
  const LABEL = useLabels(SCR_A05_LABEL);
  const { locale } = useLocale();
  const placeholder = evidenceAvailabilityText(evidence.availability, locale);
  if (placeholder !== null) {
    return (
      <View style={[styles.photo, styles.photoPlaceholder]}>
        <LfText variant="micro" align="center">{placeholder}</LfText>
      </View>
    );
  }
  return (
    <View style={styles.evidenceGroup}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={LABEL.evidenceOpen}
        style={styles.photo}
        onPress={async () => {
          try {
            const signed = await signFulfillmentEvidence(evidence.evidence_id, 'FULL');
            await Linking.openURL(signed.signed_url);
          } catch {
            // 열람 실패는 화면의 기록 자체를 숨기지 않는다.
          }
        }}
      >
        <LfIcon name="image" size={PROOF_ICON} />
        <LfText variant="eyebrow" align="center">{LABEL.evidenceOpen}</LfText>
      </Pressable>
      <LfButton
        label={LABEL.evidenceReport}
        variant="text"
        size="compact"
        onPress={() => onReport(evidence.evidence_id)}
      />
    </View>
  );
}

function ClaimCard({
  check,
  nickname,
  profileImageUrl,
  onReportEvidence,
}: {
  check: FulfillmentCheckView;
  nickname: string;
  profileImageUrl: string | null;
  onReportEvidence(evidenceId: string): void;
}): React.JSX.Element {
  const LABEL = useLabels(SCR_A05_LABEL);
  const { locale } = useLocale();
  const claim = claimPresentation(check, nickname, locale);
  const empty = check.evidences.length === 0;
  return (
    <View style={styles.claim} testID={`detail-claim-${check.role}`}>
      <LfAvatar
        size="md"
        nickname={nickname}
        profileImageUrl={profileImageUrl}
        accessibilityLabel={LABEL.profileImage(nickname)}
      />
      <LfText variant="label" align="center">{claim.nickname}</LfText>
      <LfChip label={claim.answer} tone="paper" kind="status" />
      <LfText variant="bodySm" align="center">
        {check.comment === null || check.comment.length === 0
          ? LABEL.noComment
          : check.comment}
      </LfText>
      <LfText variant="meta" align="center">{`${claim.submittedAt} · ${claim.evidenceCount}`}</LfText>
      <View style={[styles.claimEvidence, empty && styles.claimEvidenceEmpty]}>
        {empty ? null : (
          <View style={styles.evidenceRow}>
            {check.evidences.map((evidence) => (
              <EvidenceTile
                key={evidence.evidence_id}
                evidence={evidence}
                onReport={onReportEvidence}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function ChangedVersionSection({
  before,
  after,
}: {
  before: PromiseDetailVersion;
  after: PromiseDetailVersion;
}): React.JSX.Element {
  const LABEL = useLabels(SCR_A05_LABEL);
  const { locale } = useLocale();
  const rows = changedVersionRows(before, after, locale);
  return (
    <LfStack gap={4}>
      {rows.map((row) => (
        <View key={row.field} style={styles.compare}>
          <CompareItem label={LABEL.changedBefore(row.label)} value={row.before} before />
          <CompareItem label={LABEL.changedAfter(row.label)} value={row.after} />
        </View>
      ))}
    </LfStack>
  );
}

function VersionHistorySheet({
  visible,
  state,
  onClose,
}: {
  visible: boolean;
  state: { phase: 'idle' | 'loading' | 'error' } | {
    phase: 'ready';
    value: PromiseVersionListResponse;
  };
  onClose(): void;
}): React.JSX.Element {
  const LABEL = useLabels(SCR_A05_LABEL);
  const { locale } = useLocale();
  return (
    <LfSheet
      visible={visible}
      title={LABEL.versionHistoryTitle}
      closeLabel={LABEL.versionHistoryClose}
      onClose={onClose}
    >
      {state.phase === 'loading' || state.phase === 'idle' ? (
        <LfText>{LABEL.versionHistoryLoading}</LfText>
      ) : null}
      {state.phase === 'error' ? <LfText variant="error">{LABEL.loadError}</LfText> : null}
      {state.phase === 'ready' ? (
        <ScrollView contentContainerStyle={styles.historyContent}>
          {state.value.versions.length === 0 ? (
            <LfText>{LABEL.versionHistoryEmpty}</LfText>
          ) : state.value.versions.map((item) => (
            <LfCard key={item.version.version_no} shadow={false}>
              <LfStack gap={3}>
                <LfChip label={LABEL.version(item.version.version_no)} tone="paper" kind="status" />
                <LfText variant="bodyStrong">{item.version.title}</LfText>
                <LfText variant="bodySm">{item.version.body}</LfText>
                <InfoRow label={LABEL.category} value={PROMISE_CATEGORY_LABEL_BY_LOCALE[locale][item.version.category]} />
                <InfoRow label={LABEL.endDate} value={formatDetailDate(item.version.end_date, locale)} />
                <InfoRow label={LABEL.keeper} value={KEEPER_LABEL_BY_LOCALE[locale][item.version.keeper]} />
                <InfoRow label={LABEL.reward} value={item.version.reward ?? LABEL.noReward} />
                <InfoRow label={LABEL.penalty} value={item.version.penalty ?? LABEL.noPenalty} />
                <InfoRow label={LABEL.contentHash} value={item.version.content_hash.slice(0, 8)} />
                {item.version.activated_at !== null ? (
                  <InfoRow label={LABEL.versionActivated} value={formatDetailInstant(item.version.activated_at)} />
                ) : null}
                {item.version.superseded_at !== null ? (
                  <InfoRow label={LABEL.versionSuperseded} value={formatDetailInstant(item.version.superseded_at)} />
                ) : null}
                {item.change_requester !== null ? (
                  <InfoRow label={LABEL.versionRequester} value={item.change_requester.nickname} />
                ) : null}
                {item.approved_by !== null ? (
                  <InfoRow label={LABEL.versionApprover} value={item.approved_by.nickname} />
                ) : null}
                {item.approved_at !== null ? (
                  <InfoRow label={LABEL.versionApproved} value={formatDetailInstant(item.approved_at)} />
                ) : null}
                {item.change_reason !== null ? (
                  <InfoRow label={LABEL.versionReason} value={item.change_reason} />
                ) : null}
              </LfStack>
            </LfCard>
          ))}
        </ScrollView>
      ) : null}
    </LfSheet>
  );
}

/** 이행 확인 — 응답 기한(핑크) · 양측 응답 행 · 증빙 · DISPUTED 는 두 주장을 같은 무게로 나란히 (P1) */
function FulfillmentSection({
  detail,
  headline,
  onReportEvidence,
}: {
  detail: PromiseDetailResponse;
  headline: string;
  onReportEvidence(evidenceId: string): void;
}): React.JSX.Element | null {
  const LABEL = useLabels(SCR_A05_LABEL);
  const { locale } = useLocale();
  const fulfillment = detail.fulfillment;
  if (fulfillment === null) return null;
  const partnerName = detail.partner?.nickname ?? PARTICIPANT_ROLE_LABEL_BY_LOCALE[locale].PARTNER;
  const partnerImage = detail.partner?.profile_image_url ?? null;
  const personOf = (role: FulfillmentCheckView['role']) => role === 'CREATOR'
    ? { nickname: detail.creator.nickname, profileImageUrl: detail.creator.profile_image_url }
    : { nickname: partnerName, profileImageUrl: partnerImage };
  const disputed = detail.status === 'DISPUTED';
  const checks = [fulfillment.creator_check, fulfillment.partner_check].filter(
    (check): check is FulfillmentCheckView => check !== null,
  );
  const proofs = checks.filter((check) => check.evidences.length > 0);
  return (
    <LfStack gap={5}>
      {detail.status === 'CHECKING' && detail.check_deadline_at !== null ? (
        <LfCard tone="pink">
          <LfStack gap={1}>
            <LfText variant="eyebrow">{LABEL.checkDeadline}</LfText>
            <LfText variant="bodyStrong">{formatDetailInstant(detail.check_deadline_at)}</LfText>
          </LfStack>
        </LfCard>
      ) : null}
      {disputed ? (
        <LfCard shadow={false}>
          <LfStack gap={2} center>
            <LfText variant="bodyStrong" align="center">{headline}</LfText>
            <LfText variant="meta" align="center">{LABEL.statusSubtitle.DISPUTED}</LfText>
          </LfStack>
        </LfCard>
      ) : null}
      <LfCard shadow={false}>
        <View style={styles.list}>
          <ResponseRow
            nickname={detail.creator.nickname}
            profileImageUrl={detail.creator.profile_image_url}
            submitted={fulfillment.creator_has_submitted}
            check={disputed ? null : fulfillment.creator_check}
          />
          <ResponseRow
            divided
            nickname={partnerName}
            profileImageUrl={partnerImage}
            submitted={fulfillment.partner_has_submitted}
            check={disputed ? null : fulfillment.partner_check}
            silent={detail.status === 'UNRESOLVED'}
          />
        </View>
      </LfCard>
      {disputed && checks.length > 0 ? (
        <View style={styles.claims}>
          {checks.map((check) => (
            <ClaimCard
              key={`${check.round_no}.${check.role}`}
              check={check}
              {...personOf(check.role)}
              onReportEvidence={onReportEvidence}
            />
          ))}
        </View>
      ) : null}
      {!disputed && proofs.length > 0 ? (
        <LfStack gap={3}>
          <LfText variant="eyebrow">{LABEL.evidence}</LfText>
          {proofs.map((check) => (
            <LfStack key={check.role} gap={2}>
              <LfText variant="meta">
                {`${personOf(check.role).nickname} · ${LABEL.evidenceCount(check.evidences.length)}`}
              </LfText>
              <View style={styles.evidenceRow}>
                {check.evidences.map((evidence) => (
                  <EvidenceTile
                    key={evidence.evidence_id}
                    evidence={evidence}
                    onReport={onReportEvidence}
                  />
                ))}
              </View>
            </LfStack>
          ))}
        </LfStack>
      ) : null}
      {fulfillment.history.length > 0 && (
        <LfStack gap={4}>
          <LfText variant="eyebrow">{LABEL.history}</LfText>
          {fulfillment.history.map((round) => (
            <LfStack key={round.round_no} gap={3}>
              <LfText variant="meta">{LABEL.round(round.round_no)}</LfText>
              <View style={styles.claims}>
                {[round.creator_check, round.partner_check]
                  .filter((check): check is FulfillmentCheckView => check !== null)
                  .map((check) => (
                    <ClaimCard
                      key={`${round.round_no}.${check.role}`}
                      check={check}
                      {...personOf(check.role)}
                      onReportEvidence={onReportEvidence}
                    />
                  ))}
              </View>
            </LfStack>
          ))}
        </LfStack>
      )}
    </LfStack>
  );
}

function compactStampOf(
  status: PromiseDetailResponse['status'],
): { corner?: LfStampCorner; muted?: boolean; icon?: LfIconName } {
  if (status === 'CHECKING') return { corner: 'mint' };
  if (status === 'BROKEN') return { corner: 'pink' };
  if (status === 'UNRESOLVED') return { muted: true, icon: 'hourglass_bottom' };
  return { muted: true, icon: 'remove' };
}

export default function PromiseDetailScreen(): React.JSX.Element {
  const LABEL = useLabels(SCR_A05_LABEL);
  const MOD01_LABEL = useLabels(MOD_01_LABEL);
  const { locale } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ promise_id?: string | string[] }>();
  const promiseId = promiseIdOf(params.promise_id);
  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [detail, setDetail] = useState<PromiseDetailResponse | null>(null);
  const [entitlements, setEntitlements] = useState<PromiseEntitlementsView | null>(null);
  const [actionError, setActionError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [witnessSheetOpen, setWitnessSheetOpen] = useState(false);
  const [amendSheetOpen, setAmendSheetOpen] = useState(false);
  const [versionSheetOpen, setVersionSheetOpen] = useState(false);
  const [entitlementMode, setEntitlementMode] = useState<'DURATION' | 'RETENTION' | null>(null);
  const [celebration, setCelebration] = useState<CompletionCelebrationView | null>(null);
  const [versionState, setVersionState] = useState<
    { phase: 'idle' | 'loading' | 'error' } | {
      phase: 'ready';
      value: PromiseVersionListResponse;
    }
  >({ phase: 'idle' });
  const reopenKey = useRef<string | null>(null);
  const amendRequestKey = useRef<IntentKey | null>(null);
  const amendRespondKey = useRef<IntentKey | null>(null);
  const amendWithdrawKey = useRef<string | null>(null);
  const actionPending = useRef(false);
  const claimAttemptedFor = useRef<string | null>(null);
  const shownAttemptedFor = useRef<string | null>(null);
  const activePromiseId = useRef<string | null>(promiseId);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (promiseId === null) {
      setPhase('not-found');
      return false;
    }
    setPhase('loading');
    try {
      const nextDetail = await getPromiseDetail(promiseId);
      setDetail(nextDetail);
      setPhase('ready');
      void getPromiseEntitlements(promiseId)
        .then((next) => {
          if (activePromiseId.current === promiseId) setEntitlements(next);
        })
        .catch(() => {
          if (activePromiseId.current === promiseId) setEntitlements(null);
        });
      if (
        nextDetail.status === 'COMPLETED' &&
        (nextDetail.my_role === 'CREATOR' || nextDetail.my_role === 'PARTNER') &&
        claimAttemptedFor.current !== nextDetail.promise_id
      ) {
        claimAttemptedFor.current = nextDetail.promise_id;
        void claimCompletionCelebration(nextDetail.promise_id)
          .then((nextCelebration) => {
            if (activePromiseId.current === nextDetail.promise_id) {
              setCelebration(nextCelebration);
            }
          })
          .catch(() => undefined);
      }
      return true;
    } catch (error) {
      setPhase(
        error instanceof MobileApiError && error.code === 'E_NOT_FOUND' ? 'not-found' : 'error',
      );
      return false;
    }
  }, [promiseId]);

  useEffect(() => {
    activePromiseId.current = promiseId;
    claimAttemptedFor.current = null;
    shownAttemptedFor.current = null;
    setCelebration(null);
    setEntitlements(null);
    reopenKey.current = null;
    amendRequestKey.current = null;
    amendRespondKey.current = null;
    amendWithdrawKey.current = null;
    actionPending.current = false;
    setAmendSheetOpen(false);
    setVersionSheetOpen(false);
    setEntitlementMode(null);
    setVersionState({ phase: 'idle' });
    void refresh();
    return () => {
      if (activePromiseId.current === promiseId) activePromiseId.current = null;
    };
  }, [promiseId, refresh]);

  if (phase !== 'ready' || detail === null) {
    const label =
      phase === 'loading'
        ? LABEL.loading
        : phase === 'not-found'
          ? LABEL.notFound
          : LABEL.loadError;
    return (
      <ScreenFrame onBack={() => router.back()}>
        <View style={styles.centered}>
          <LfText align="center">{label}</LfText>
          {phase === 'error' && (
            <LfButton label={LABEL.retry} variant="outlined" onPress={() => void refresh()} />
          )}
        </View>
      </ScreenFrame>
    );
  }

  const status = detailStatusOf(detail.status, locale);
  const visualMode = detailVisualModeOf(detail.status);
  const terminalReason =
    detail.status === 'DECLINED'
      ? (detail.approvals.find((approval) => approval.action === 'DECLINE')?.comment ?? null)
      : detail.status === 'CANCELED'
        ? detail.amend_request?.reason ?? null
        : null;
  const canInviteWitness =
    WITNESS_INVITE_STATUSES.has(detail.status)
    && (detail.my_role === 'CREATOR' || detail.my_role === 'PARTNER');
  const myUserId = detail.my_role === 'CREATOR'
    ? detail.creator.user_id
    : detail.my_role === 'PARTNER'
      ? detail.partner?.user_id ?? null
      : detail.witnesses.find((witness) => witness.role === 'WITNESS')?.user_id ?? null;
  const pendingAmend = detail.status === 'AMEND_PENDING' ? detail.amend_request : null;
  const isAmendRequester = pendingAmend !== null && pendingAmend.requester.user_id === myUserId;
  const isAmendResponder = pendingAmend !== null
    && !isAmendRequester
    && (detail.my_role === 'CREATOR' || detail.my_role === 'PARTNER');
  const canRequestAmend = detail.status === 'ACTIVE'
    && (detail.my_role === 'CREATOR' || detail.my_role === 'PARTNER');
  const canRequestFinish = canRequestAmend && detail.end_date === null;
  const canShowVersionHistory = !['DECLINED', 'CANCELED'].includes(detail.status)
    && detail.current_version.activated_at !== null;
  const terminal = ['COMPLETED', 'BROKEN', 'DISPUTED', 'UNRESOLVED', 'DECLINED', 'CANCELED']
    .includes(detail.status);
  const counterpart = detail.my_role === 'CREATOR' ? detail.partner : detail.creator;
  const canNotifyPartner = detail.my_role === 'CREATOR'
    && detail.partner !== null
    && !detail.counterpart_push_available
    && !terminal;

  async function reopen(): Promise<void> {
    if (promiseId === null || busy) return;
    setBusy(true);
    setActionError(false);
    reopenKey.current ??= createFulfillmentIdempotencyKey();
    try {
      await reopenFulfillment(promiseId, reopenKey.current);
      router.push({ pathname: '/fulfillment/[promise_id]', params: { promise_id: promiseId } });
    } catch {
      setActionError(true);
    } finally {
      setBusy(false);
    }
  }

  function shouldRefreshAfterAmendError(error: unknown): boolean {
    return error instanceof MobileApiError
      && (error.code === 'E_VALIDATION' || error.code === 'E_STATE_CONFLICT');
  }

  async function submitAmend(
    input: PromiseAmendCreateRequest,
  ): Promise<void | 'DURATION_ENTITLEMENT_REQUIRED'> {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setActionError(false);
    const signature = JSON.stringify(input);
    if (amendRequestKey.current?.signature !== signature) {
      amendRequestKey.current = { signature, key: createPromiseAmendIdempotencyKey() };
    }
    try {
      await requestPromiseAmend(input, amendRequestKey.current.key);
      if (await refresh()) {
        amendRequestKey.current = null;
        setAmendSheetOpen(false);
      }
    } catch (error) {
      if (error instanceof MobileApiError && error.code === 'E_END_DATE_RANGE') {
        setActionError(false);
        setEntitlementMode('DURATION');
        return 'DURATION_ENTITLEMENT_REQUIRED';
      }
      setActionError(true);
      if (shouldRefreshAfterAmendError(error)) await refresh();
      throw error;
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }

  function confirmFinish(): void {
    const detailId = detail?.promise_id;
    if (!canRequestFinish || actionPending.current || detailId === undefined) return;
    Alert.alert(LABEL.finishConfirmTitle, LABEL.finishConfirmBody, [
      { text: LABEL.cancel, style: 'cancel' },
      {
        text: LABEL.finishConfirmAction,
        onPress: () => {
          void submitAmend({ promise_id: detailId, type: 'FINISH' }).catch(() => undefined);
        },
      },
    ]);
  }

  async function respondAmend(decision: PromiseAmendDecision): Promise<void> {
    const currentDetail = detail;
    const request = currentDetail?.amend_request;
    if (currentDetail === null || request === null || request === undefined || actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setActionError(false);
    if (amendRespondKey.current?.signature !== decision) {
      amendRespondKey.current = { signature: decision, key: createPromiseAmendIdempotencyKey() };
    }
    try {
      await respondPromiseAmend({
        promise_id: currentDetail.promise_id,
        request_id: request.request_id,
        decision,
      }, amendRespondKey.current.key);
      if (await refresh()) amendRespondKey.current = null;
    } catch (error) {
      setActionError(true);
      if (shouldRefreshAfterAmendError(error)) await refresh();
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }

  async function withdrawAmend(): Promise<void> {
    const currentDetail = detail;
    const request = currentDetail?.amend_request;
    if (currentDetail === null || request === null || request === undefined || actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setActionError(false);
    amendWithdrawKey.current ??= createPromiseAmendIdempotencyKey();
    try {
      await withdrawPromiseAmend(
        currentDetail.promise_id,
        request.request_id,
        amendWithdrawKey.current,
      );
      if (await refresh()) amendWithdrawKey.current = null;
    } catch (error) {
      setActionError(true);
      if (shouldRefreshAfterAmendError(error)) await refresh();
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }

  async function openVersionHistory(): Promise<void> {
    if (promiseId === null) return;
    setVersionSheetOpen(true);
    setVersionState({ phase: 'loading' });
    try {
      setVersionState({ phase: 'ready', value: await listPromiseVersions(promiseId) });
    } catch {
      setVersionState({ phase: 'error' });
    }
  }

  function confirmCancel(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(MOD01_LABEL.cancelConfirmTitle, MOD01_LABEL.cancelConfirmBody, [
        { text: MOD01_LABEL.cancelConfirmDismiss, style: 'cancel', onPress: () => resolve(false) },
        { text: MOD01_LABEL.cancelConfirmAction, style: 'destructive', onPress: () => resolve(true) },
      ], { cancelable: false });
    });
  }

  async function hideFromList(): Promise<void> {
    const detailId = detail?.promise_id;
    if (busy || detailId === undefined) return;
    setBusy(true);
    setActionError(false);
    try {
      await hidePromiseNative(detailId, true);
      router.back();
    } catch {
      setActionError(true);
    } finally {
      setBusy(false);
    }
  }

  function confirmBlock(): void {
    const target = counterpart;
    if (target === null || busy) return;
    Alert.alert(LABEL.userBlockTitle, LABEL.userBlockBody, [
      { text: LABEL.cancel, style: 'cancel' },
      {
        text: LABEL.blockAction,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setActionError(false);
          try {
            await blockUserNative(target.user_id);
          } catch {
            setActionError(true);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  function confirmUserReport(): void {
    const target = counterpart;
    const detailId = detail?.promise_id;
    if (target === null || detailId === undefined || busy) return;
    Alert.alert(LABEL.userReportTitle, LABEL.userReportBody, [
      { text: LABEL.cancel, style: 'cancel' },
      {
        text: LABEL.reportAction,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setActionError(false);
          try {
            await reportSafetyIssueNative({
              promise_id: detailId,
              target_user_id: target.user_id,
              evidence_id: null,
              reason: 'ABUSE',
              detail: null,
            });
          } catch {
            setActionError(true);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  function confirmEvidenceReport(evidenceId: string): void {
    const detailId = detail?.promise_id;
    if (busy || detailId === undefined) return;
    Alert.alert(LABEL.evidenceReportTitle, LABEL.evidenceReportBody, [
      { text: LABEL.cancel, style: 'cancel' },
      {
        text: LABEL.reportAction,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setActionError(false);
          try {
            await reportSafetyIssueNative({
              promise_id: detailId,
              target_user_id: null,
              evidence_id: evidenceId,
              reason: 'ABUSE',
              detail: null,
            });
            await refresh();
          } catch {
            setActionError(true);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  function acknowledgeCelebrationShown(): void {
    if (celebration === null || shownAttemptedFor.current === celebration.claim_id) return;
    shownAttemptedFor.current = celebration.claim_id;
    void markCompletionCelebrationShown(
      celebration.promise_id,
      celebration.claim_id,
    ).catch(() => undefined);
  }

  function closeCelebration(): void {
    setCelebration(null);
  }

  function createAfterCelebration(): void {
    setCelebration(null);
    router.push('/promise/edit');
  }

  function shareCelebration(): void {
    if (detail === null) return;
    void Share.share({
      message: LABEL.shareMessage(
        detail.title,
        PROMISE_STATUS_LABEL_BY_LOCALE[locale].COMPLETED,
      ),
    });
  }

  const now = new Date();
  const ROLE = PARTICIPANT_ROLE_LABEL_BY_LOCALE[locale];
  const endDateLine: HeadLine = detail.end_date === null
    ? { value: LABEL.noEndDate }
    : { label: LABEL.endDate, value: formatDetailDate(detail.end_date, locale) };
  const closedLine: HeadLine = detail.closed_at === null
    ? endDateLine
    : { value: LABEL.closedOn(formatKstDate(toKstDate(new Date(detail.closed_at)), locale)) };
  const headLine: HeadLine = pendingAmend?.type === 'AMEND' && pendingAmend.proposed_version !== null
    ? { value: LABEL.proposedVersion(detail.current_version.version_no, pendingAmend.proposed_version.version_no) }
    : detail.status === 'CHECKING' && detail.check_deadline_at !== null
      ? {
          label: LABEL.checkDeadline,
          value: formatDday(ddayFrom(toKstDate(new Date(detail.check_deadline_at)), now)),
        }
      : detail.status === 'DISPUTED'
        ? { value: LABEL.disputedHint }
        : terminal ? closedLine : endDateLine;
  // 지문이 현재 버전 것이므로 시각도 같은 버전의 승인 시각이어야 짝이 맞는다 (PO 2026-08-20).
  // 최초 확정 시각은 승인 이력에 그대로 남는다.
  const recordTime = detail.current_version.activated_at === null
    ? undefined
    : formatDetailInstant(detail.current_version.activated_at);
  const closedTime = detail.closed_at === null ? recordTime : formatDetailInstant(detail.closed_at);
  const compactTime = detail.status === 'CHECKING' ? recordTime : closedTime;
  const fingerprint = fingerprintText(detail.current_version.fingerprint, locale);
  const stampApprovals = detail.approvals.map((approval) => ({
    label: `${approval.actor.nickname} · ${ROLE[approval.role]} · ${LABEL.approvalAction[approval.action]}`,
    time: formatDetailInstant(approval.acted_at),
  }));
  const amendBanner = pendingAmend === null
    ? null
    : pendingAmend.type === 'AMEND'
      ? LABEL.amendRequested(pendingAmend.requester.nickname)
      : pendingAmend.type === 'FINISH'
        ? LABEL.finishRequested(pendingAmend.requester.nickname)
        : LABEL.cancelRequested(pendingAmend.requester.nickname);
  const amendApproveLabel = pendingAmend?.type === 'AMEND'
    ? LABEL.amendApproveAction
    : pendingAmend?.type === 'FINISH'
      ? LABEL.finishApproveAction
      : LABEL.cancelApproveAction;
  const ddayText = formatDetailDday(detail.end_date, now, locale);
  const showOutcomes = ['ACTIVE', 'AMEND_PENDING', 'CHECKING', 'BROKEN'].includes(detail.status);
  const openWitness = () => setWitnessSheetOpen(true);
  const shareCompleted = () => void Share.share({
    message: LABEL.shareMessage(detail.title, PROMISE_STATUS_LABEL_BY_LOCALE[locale].COMPLETED),
  });
  // 하단 한 줄 — 보조(outlined, 내용 폭) + 주 CTA(옐로, 남는 폭). 상태마다 한 쌍만 둔다
  const secondaryAction: { label: string; onPress(): void } | null =
    detail.status === 'ACTIVE' && canRequestAmend
      ? { label: LABEL.amendRequestAction, onPress: () => setAmendSheetOpen(true) }
      : detail.status === 'PENDING'
        ? {
            label: LABEL.pendingAction,
            onPress: () => router.push({ pathname: '/invite', params: { promise_id: detail.promise_id } }),
          }
        : detail.status === 'COMPLETED'
          ? { label: LABEL.shareAction, onPress: shareCompleted }
          : detail.status === 'CHECKING' && canInviteWitness
            ? { label: LABEL.witnessInviteAction, onPress: openWitness }
            : null;
  const primaryAction: { label: string; trailing: LfIconName | null; busy: boolean; onPress(): void } | null =
    detail.status === 'CHECKING'
      ? {
          label: LABEL.checkingAction,
          trailing: 'check',
          busy: false,
          onPress: () => router.push({ pathname: '/fulfillment/[promise_id]', params: { promise_id: detail.promise_id } }),
        }
      : detail.status === 'DISPUTED'
        ? { label: LABEL.disputedAction, trailing: null, busy, onPress: () => void reopen() }
        : detail.status === 'COMPLETED'
          ? { label: LABEL.newPromiseAction, trailing: 'add', busy: false, onPress: () => router.push('/promise/edit') }
          : canInviteWitness
            ? { label: LABEL.witnessInviteAction, trailing: 'person_add', busy: false, onPress: openWitness }
            : null;

  return (
    <ScreenFrame onBack={() => router.back()} mode={visualMode}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.head}>
          <View style={styles.headMain}>
            <View style={styles.statusRow}>
              <LfChip label={status.label} tone={status.tone} kind="status" />
              <View style={styles.headDate}>
                {headLine.label === undefined ? null : <LfText variant="meta">{headLine.label}</LfText>}
                <LfText variant="meta">{headLine.value}</LfText>
              </View>
            </View>
            <View style={styles.headTitle}><LfText variant="title">{detail.title}</LfText></View>
          </View>
          {detail.status === 'ACTIVE' ? (
            <LfDday
              label={detail.end_date === null ? LABEL.infinity : ddayText}
              tone={detail.end_date === null ? 'sky' : 'yellow'}
              accessibilityLabel={detail.end_date === null ? LABEL.noEndDate : `${LABEL.dday} ${ddayText}`}
            />
          ) : null}
        </View>

        {detail.status === 'PENDING' ? (
          <LfStamp
            variant="pending"
            headline={status.headline}
            body={LABEL.statusSubtitle.PENDING}
            pair={{
              nickname: detail.creator.nickname,
              profileImageUrl: detail.creator.profile_image_url,
              accessibilityLabel: LABEL.profileImage(detail.creator.nickname),
              pendingAccessibilityLabel: LABEL.partnerPending,
            }}
          />
        ) : detail.status === 'ACTIVE' ? (
          <LfStamp
            testID="promise-stamp"
            variant="active"
            corner={detail.end_date === null ? 'sky' : 'mint'}
            headline={status.headline}
            {...(recordTime === undefined ? {} : { time: recordTime })}
            approvals={stampApprovals}
            fingerprint={fingerprint}
          />
        ) : detail.status === 'COMPLETED' ? (
          <LfStamp
            variant="completed"
            headline={status.headline}
            {...(closedTime === undefined ? {} : { time: closedTime })}
            fingerprint={fingerprint}
          />
        ) : detail.status === 'AMEND_PENDING' && amendBanner !== null ? (
          <NoteBanner
            icon={pendingAmend?.type === 'FINISH' ? 'flag' : 'sync_alt'}
            tone={pendingAmend?.type === 'AMEND' ? 'sky' : 'paper'}
            text={amendBanner}
          />
        ) : detail.status === 'DISPUTED' ? null : (
          <LfStamp
            variant="compact"
            {...compactStampOf(detail.status)}
            headline={status.headline}
            {...(compactTime === undefined ? {} : { time: compactTime })}
            fingerprint={fingerprint}
          />
        )}

        {detail.status === 'PENDING' && detail.invitation !== null ? (
          <LfCard>
            <View style={styles.infoRow}>
              <LfStatusTile icon="schedule" tone="yellow" />
              <View style={styles.infoBody}>
                <LfText variant="eyebrow">{LABEL.invitationExpires}</LfText>
                <View style={styles.infoValue}>
                  <LfText variant="bodyStrong">{formatDetailInstant(detail.invitation.expires_at)}</LfText>
                </View>
              </View>
              <LfChip label={LABEL.invitationStatus[detail.invitation.status]} tone="paper" kind="status" />
            </View>
          </LfCard>
        ) : null}

        {pendingAmend !== null ? (
          <LfCard shadow={false}>
            <LfStack gap={4}>
              <LfText variant="eyebrow">{LABEL.amend}</LfText>
              {pendingAmend.type === 'AMEND' && pendingAmend.proposed_version !== null ? (
                <ChangedVersionSection
                  before={detail.current_version}
                  after={pendingAmend.proposed_version}
                />
              ) : null}
              <CompareItem label={LABEL.amendRequester} value={pendingAmend.requester.nickname} />
              <CompareItem label={LABEL.amendRequestedAt} value={formatDetailInstant(pendingAmend.created_at)} />
              {pendingAmend.reason !== null ? (
                <CompareItem label={LABEL.amendReason} value={pendingAmend.reason} />
              ) : null}
              <View style={styles.divider} />
              {isAmendRequester && counterpart !== null ? (
                <View style={styles.listRow}>
                  <LfAvatar
                    size="row"
                    pending
                    nickname={counterpart.nickname}
                    profileImageUrl={counterpart.profile_image_url}
                    accessibilityLabel={LABEL.profileImage(counterpart.nickname)}
                  />
                  <View style={styles.rowText}>
                    <LfText variant="caption">{LABEL.amendWaiting(counterpart.nickname)}</LfText>
                  </View>
                  <LfIcon name="hourglass_empty" size={ROW_ICON} color="textMuted" />
                </View>
              ) : null}
              <RowLink
                icon="history"
                label={LABEL.versionKept(detail.current_version.version_no)}
                accessibilityLabel={LABEL.versionHistoryAction}
                {...(canShowVersionHistory ? { onPress: () => void openVersionHistory() } : {})}
              />
              <LfText variant="meta" align="center">{LABEL.statusSubtitle.AMEND_PENDING}</LfText>
              {isAmendRequester ? (
                <LfButton
                  label={LABEL.amendWithdrawAction}
                  variant="outlined"
                  block
                  disabled={busy}
                  onPress={() => void withdrawAmend()}
                />
              ) : null}
              {isAmendResponder ? (
                <View style={styles.actionRow}>
                  <LfButton
                    label={LABEL.amendDeclineAction}
                    variant="outlined"
                    size="cta"
                    disabled={busy}
                    onPress={() => void respondAmend('DECLINE')}
                  />
                  <View style={styles.actionMain}>
                    <LfButton
                      label={amendApproveLabel}
                      size="cta"
                      block
                      trailing="check"
                      disabled={busy}
                      onPress={() => void respondAmend('APPROVE')}
                    />
                  </View>
                </View>
              ) : null}
            </LfStack>
          </LfCard>
        ) : null}

        <LfCard
          {...(detail.status === 'PENDING' ? { tone: 'muted' as const } : {})}
          shadow={detail.status === 'ACTIVE' || detail.status === 'AMEND_PENDING'}
        >
          <View style={styles.content}>
            <LfText variant="eyebrow">
              {detail.status === 'PENDING' ? LABEL.contentReadonly : LABEL.content}
            </LfText>
            <LfText variant="bodySm">{detail.body}</LfText>
            <View style={styles.chips}>
              <LfChip
                label={`${LABEL.category} · ${PROMISE_CATEGORY_LABEL_BY_LOCALE[locale][detail.category]}`}
                tone={detail.status === 'PENDING' ? 'paper' : 'muted'}
              />
              <LfChip
                label={`${LABEL.keeper} · ${KEEPER_LABEL_BY_LOCALE[locale][detail.keeper]}`}
                tone={detail.status === 'PENDING' ? 'paper' : 'muted'}
              />
              {detail.status !== 'ACTIVE' && detail.end_date === null ? (
                <LfChip label={LABEL.noEndDate} tone="sky" />
              ) : null}
            </View>
          </View>
        </LfCard>

        {showOutcomes ? (
          <LfOutcomes
            reward={{ label: LABEL.reward, value: detail.reward ?? LABEL.noReward }}
            penalty={{ label: LABEL.penalty, value: detail.penalty ?? LABEL.noPenalty }}
          />
        ) : null}

        {detail.status === 'ACTIVE' && detail.end_date === null ? (
          <InfoCard
            tone="sky"
            icon="all_inclusive"
            label={LABEL.noEndDate}
            value={LABEL.noEndDateHint}
            {...(canRequestFinish
              ? {
                  action: (
                    <LfButton
                      label={LABEL.finishRequestAction}
                      variant="text"
                      disabled={busy}
                      onPress={confirmFinish}
                    />
                  ),
                }
              : {})}
          />
        ) : null}

        <LfStack gap={3}>
          <LfText variant="eyebrow">{LABEL.people}</LfText>
          <LfCard shadow={false}>
            <View style={styles.list}>
              <PersonRow person={detail.creator} />
              {detail.partner === null ? (
                <ListRow divided>
                  <LfAvatar
                    size="row"
                    pending
                    nickname="?"
                    profileImageUrl={null}
                    accessibilityLabel={LABEL.partnerPending}
                  />
                  <View style={styles.rowText}><LfText variant="label">{LABEL.partnerPending}</LfText></View>
                </ListRow>
              ) : (
                <PersonRow divided person={detail.partner} />
              )}
              {detail.witnesses.map((witness) => <PersonRow key={witness.user_id} divided person={witness} />)}
            </View>
          </LfCard>
        </LfStack>

        <FulfillmentSection detail={detail} headline={status.headline} onReportEvidence={confirmEvidenceReport} />

        {detail.status === 'COMPLETED' && detail.reward !== null ? (
          <InfoCard tone="sky" icon="redeem" label={LABEL.reward} value={detail.reward} />
        ) : null}

        {entitlements !== null && detail.current_version.activated_at !== null ? (
          <LfCard shadow={false}>
            <View style={styles.retention}>
              <LfIcon name="inventory_2" size={ROW_ICON} />
              <View style={styles.rowText}>
                <LfText variant="note">{LABEL.retention}</LfText>
                <LfText variant="meta">
                  {entitlements.retention.permanent
                    ? LABEL.retentionPermanent
                    : entitlements.retention.expires_at === null
                      ? LABEL.retentionAwaitingFinish
                      : `${LABEL.retentionExpires} · ${formatDetailInstant(entitlements.retention.expires_at)}`}
                </LfText>
              </View>
              {!entitlements.retention.permanent ? (
                <LfButton
                  label={LABEL.retentionManage}
                  variant="text"
                  onPress={() => setEntitlementMode('RETENTION')}
                />
              ) : null}
            </View>
          </LfCard>
        ) : null}

        {terminalReason !== null ? (
          <LfCard tone="muted" shadow={false}>
            <LfStack gap={2}>
              <LfText variant="eyebrow">
                {detail.status === 'DECLINED' ? LABEL.declineReason : LABEL.amendReason}
              </LfText>
              <LfText variant="bodySm">{terminalReason}</LfText>
            </LfStack>
          </LfCard>
        ) : null}

        {detail.status !== 'ACTIVE' && detail.approvals.length > 0 ? (
          <LfStack gap={3}>
            <LfText variant="eyebrow">{LABEL.approvals}</LfText>
            <LfCard shadow={false}>
              <View style={styles.list}>
                {detail.approvals.map((approval, index) => (
                  <ListRow key={`${approval.acted_at}.${approval.role}.${index}`} divided={index > 0}>
                    <LfAvatar
                      size="row"
                      nickname={approval.actor.nickname}
                      profileImageUrl={approval.actor.profile_image_url}
                      accessibilityLabel={LABEL.profileImage(approval.actor.nickname)}
                    />
                    <View style={styles.rowText}>
                      <LfText variant="label">{`${approval.actor.nickname} · ${ROLE[approval.role]}`}</LfText>
                      <LfText variant="meta">{formatDetailInstant(approval.acted_at)}</LfText>
                      {approval.comment !== null ? <LfText variant="bodySm">{approval.comment}</LfText> : null}
                    </View>
                    <LfChip label={LABEL.approvalAction[approval.action]} tone="paper" kind="status" />
                  </ListRow>
                ))}
              </View>
            </LfCard>
          </LfStack>
        ) : null}

        {canShowVersionHistory && detail.status !== 'AMEND_PENDING' ? (
          <RowLink
            label={LABEL.versionLink(detail.current_version.version_no)}
            accessibilityLabel={LABEL.versionHistoryAction}
            onPress={() => void openVersionHistory()}
          />
        ) : null}

        {canNotifyPartner ? (
          <LfCard tone="yellow">
            <LfStack gap={3}>
              <LfText variant="note">{LABEL.notifyPartnerHint}</LfText>
              <LfButton
                label={LABEL.notifyPartnerAction}
                variant="outlined"
                block
                onPress={() => void Share.share({
                  message: LABEL.notifyPartnerMessage(
                    detail.title,
                    buildParticipantPromisesWebUrl(
                      process.env['EXPO_PUBLIC_WEB_BASE_URL'] ?? '',
                    ),
                  ),
                })}
              />
            </LfStack>
          </LfCard>
        ) : null}

        {detail.status === 'ACTIVE' ? (
          <LfDisclaimer />
        ) : ['PENDING', 'AMEND_PENDING', 'DISPUTED'].includes(detail.status) ? null : (
          <LfText variant="meta" align="center">{LABEL.statusSubtitle[detail.status]}</LfText>
        )}
      </ScrollView>

      <View style={styles.actions}>
        {primaryAction !== null || secondaryAction !== null ? (
          <View style={styles.actionRow}>
            {secondaryAction !== null ? (
              <LfButton
                label={secondaryAction.label}
                variant="outlined"
                size="cta"
                {...(primaryAction === null ? { block: true } : {})}
                onPress={secondaryAction.onPress}
              />
            ) : null}
            {primaryAction !== null ? (
              <View style={styles.actionMain}>
                <LfButton
                  label={primaryAction.label}
                  size="cta"
                  block
                  {...(primaryAction.trailing === null ? {} : { trailing: primaryAction.trailing })}
                  disabled={primaryAction.busy}
                  onPress={primaryAction.onPress}
                />
              </View>
            ) : null}
          </View>
        ) : null}
        {terminal || counterpart !== null ? (
          <View style={styles.safetyRow}>
            {terminal ? (
              <LfButton
                label={LABEL.hideAction}
                variant="text"
                grow
                disabled={busy}
                onPress={() => void hideFromList()}
              />
            ) : null}
            {counterpart !== null ? (
              <>
                <LfButton
                  label={LABEL.userReport}
                  variant="text"
                  grow
                  disabled={busy}
                  onPress={confirmUserReport}
                />
                <LfButton
                  label={LABEL.userBlock}
                  variant="danger"
                  grow
                  disabled={busy}
                  onPress={confirmBlock}
                />
              </>
            ) : null}
          </View>
        ) : null}
        {actionError ? <LfText variant="error" align="center">{LABEL.actionFailed}</LfText> : null}
      </View>
      <WitnessInviteSheet
        visible={witnessSheetOpen}
        promiseId={detail.promise_id}
        onClose={() => setWitnessSheetOpen(false)}
      />
      <PromiseAmendSheet
        visible={amendSheetOpen}
        detail={detail}
        now={now}
        durationUnlimited={entitlements?.duration.unlimited === true}
        onClose={() => setAmendSheetOpen(false)}
        onSubmit={submitAmend}
        pickEndDate={openEndDatePicker}
        confirmCancel={confirmCancel}
      />
      <PromiseEntitlementSheet
        visible={entitlementMode !== null}
        promiseId={detail.promise_id}
        mode={entitlementMode ?? 'RETENTION'}
        {...(entitlementMode === 'DURATION' ? { reason: 'END_DATE_RANGE' as const } : {})}
        onClose={() => setEntitlementMode(null)}
        onChanged={setEntitlements}
      />
      <VersionHistorySheet
        visible={versionSheetOpen}
        state={versionState}
        onClose={() => setVersionSheetOpen(false)}
      />
      <CompletionCelebrationSheet
        visible={celebration !== null}
        celebration={celebration}
        onShown={acknowledgeCelebrationShown}
        onClose={closeCelebration}
        onNewPromise={createAfterCelebration}
        onShare={shareCelebration}
      />
    </ScreenFrame>
  );
}
