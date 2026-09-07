import { Image, StyleSheet, Text, View, type ViewProps } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, border, elevation, line, radius, size, space, type, weight } from '../theme/tokens';
import { LfAvatar } from './LfAvatar';
import { LfBlob, type LfBlobVariant } from './LfBlob';
import { LfChip } from './LfChip';
import { LfIcon, type LfIconName } from './LfIcon';
import { LfPinkyLoop } from './LfPinkyLoop';
import { LfInkContext, LfText } from './LfText';

export type LfStampVariant = 'active' | 'completed' | 'pending' | 'compact';
export type LfStampCorner = 'mint' | 'yellow' | 'sky' | 'pink';

export interface LfStampApproval {
  label: string;
  time?: string;
}

/** 대기 스탬프의 짝 그림 — 내 아바타 · 검은 손 · 점선 · 흐린 손 · 점선 아바타 (A05 PENDING) */
export interface LfStampPair {
  nickname: string;
  profileImageUrl: string | null;
  accessibilityLabel: string;
  pendingAccessibilityLabel: string;
}

export interface LfStampProps extends Omit<ViewProps, 'style' | 'children'> {
  variant: LfStampVariant;
  headline: string;
  /** 헤드라인 아래 한 줄 설명 — 초대 대기(A04) "카톡으로 초대장을 보내면…" */
  body?: string;
  time?: string;
  approvals?: readonly LfStampApproval[];
  fingerprint?: string;
  /** 모서리 파스텔 블롭 — 기본은 active 민트 · pending 옐로(짝 그림이 없을 때). completed·compact 는 없음 */
  corner?: LfStampCorner;
  /** compact 뮤트 면 — 미확정 종결·거절처럼 중립인 종결 (`.lf-stamp--neutral`) */
  muted?: boolean;
  /** compact 에서 손 루프 대신 상태 아이콘 (`.lf-stamp__icon`) */
  icon?: LfIconName;
  pair?: LfStampPair;
}

/** README 스탬프 패딩 22 18 16 · 아이콘 34 · 짝 손 30×28 · 점선 20 · 흐린 손 .25 — 토큰 없음, ADR 0020 예외 */
const TOP_PADDING = 22;
const SIDE_PADDING = 18;
const STAMP_ICON = 34;
const HAND_WIDTH = 30;
const HAND_HEIGHT = 28;
const GAP_WIDTH = 20;
const FAINT_OPACITY = 0.25;
const HAND_SOLID = require('../../assets/images/hand-solid.png') as number;

const cornerBlob: Record<LfStampCorner, LfBlobVariant> = {
  mint: 'cornerMint',
  yellow: 'cornerYellow',
  sky: 'cornerSky',
  pink: 'cornerPink',
};

function defaultCorner(variant: LfStampVariant, pair: LfStampPair | undefined): LfStampCorner | null {
  if (variant === 'active') return 'mint';
  if (variant === 'pending' && pair === undefined) return 'yellow';
  return null;
}

function PairArt({ pair }: { pair: LfStampPair }): React.JSX.Element {
  return (
    <View style={styles.pair}>
      <LfAvatar
        size="lg"
        nickname={pair.nickname}
        profileImageUrl={pair.profileImageUrl}
        accessibilityLabel={pair.accessibilityLabel}
      />
      <Image source={HAND_SOLID} resizeMode="contain" style={[styles.hand, styles.mirror]} />
      <View style={styles.gap} />
      <Image source={HAND_SOLID} resizeMode="contain" style={[styles.hand, styles.faint]} />
      <LfAvatar
        size="lg"
        pending
        nickname="?"
        profileImageUrl={null}
        accessibilityLabel={pair.pendingAccessibilityLabel}
      />
    </View>
  );
}

/** 확정 스탬프 — 틸트·pop-in 없음, r14 + 5px, 모서리 파스텔 블롭. COMPLETED 는 카드 전체가 민트 */
export function LfStamp({
  variant,
  headline,
  body,
  time,
  approvals = [],
  fingerprint,
  corner,
  muted = false,
  icon,
  pair,
  ...rest
}: LfStampProps): React.JSX.Element {
  const completed = variant === 'completed';
  const compact = variant === 'compact';
  const cornerVariant = corner ?? defaultCorner(variant, pair);
  return (
    <View
      {...rest}
      style={[
        styles.stamp,
        compact && styles.compact,
        variant === 'pending' && styles.pending,
        cornerVariant !== null && styles.clipped,
        completed && styles.completed,
        muted && styles.muted,
      ]}
    >
      <LfInkContext.Provider value={completed}>
        {cornerVariant === null ? null : (
          <View pointerEvents="none" style={styles.corner}>
            <LfBlob variant={cornerBlob[cornerVariant]} />
          </View>
        )}
        {pair !== undefined ? (
          <PairArt pair={pair} />
        ) : icon !== undefined ? (
          <LfIcon name={icon} size={STAMP_ICON} />
        ) : compact ? null : (
          <View style={[styles.pill, completed && styles.completedPill]}>
            <LfPinkyLoop size="sm" spark />
          </View>
        )}
        {compact ? (
          <Text style={styles.compactHeadline}>{headline}</Text>
        ) : (
          <LfText variant="stamp" align="center">{headline}</LfText>
        )}
        {body === undefined ? null : <Text style={styles.body}>{body}</Text>}
        {time === undefined ? null : (
          <LfText variant={completed ? 'chip' : 'meta'} align="center">{time}</LfText>
        )}
        {approvals.length === 0 ? null : (
          <View style={styles.approvals}>
            {approvals.map((approval, index) => (
              <View key={`${approval.label}.${index}`} style={styles.approval}>
                <LfChip label={approval.label} tone="paper" kind="meta" dot />
                {approval.time === undefined ? null : <LfText variant="meta">{approval.time}</LfText>}
              </View>
            ))}
          </View>
        )}
        {fingerprint === undefined ? null : (
          <LfText variant="meta" align="center">{fingerprint}</LfText>
        )}
      </LfInkContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    position: 'relative',
    alignItems: 'center',
    gap: space[2],
    paddingTop: TOP_PADDING,
    paddingHorizontal: SIDE_PADDING,
    paddingBottom: size.cardPadding,
    backgroundColor: colors.surface,
    borderWidth: border.card,
    borderColor: colors.text,
    borderRadius: radius.xl,
    ...elevation.card,
  },
  // `.lf-stamp--compact` 16 18 · gap 4 — 손 루프 없이 헤드라인과 시각만
  compact: { paddingVertical: space[7], gap: space[1] },
  pending: { gap: space[4] },
  // 모서리 블롭은 카드 밖으로 나가지 않는다 — 블롭이 없으면 자르지 않는다 (짝 그림의 아바타 테두리)
  clipped: { overflow: 'hidden' },
  completed: { backgroundColor: colors.successContainer },
  muted: { backgroundColor: colors.surfaceMuted },
  corner: { position: 'absolute', top: -space[4], left: -space[6] },
  pill: {
    width: size.stampPillWidth,
    height: size.stampPillHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: border.chip,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedPill: { backgroundColor: colors.surface },
  // `.lf-stamp--compact .lf-stamp__headline` 15/900 — LfText 에 같은 조합이 없어 토큰으로 직접 짠다
  compactHeadline: {
    fontSize: type.body,
    lineHeight: line.body,
    fontFamily: textFontFamily(weight.heavy),
    color: colors.text,
    textAlign: 'center',
  },
  // `.lf-stamp__body` 12.5/18/500 보조
  body: {
    fontSize: type.caption,
    lineHeight: line.caption,
    fontFamily: textFontFamily(weight.medium),
    color: colors.textSecondary,
    textAlign: 'center',
  },
  approvals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space[2],
    marginTop: space[1],
  },
  approval: { alignItems: 'center', gap: space[1] },
  pair: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  hand: { width: HAND_WIDTH, height: HAND_HEIGHT },
  mirror: { transform: [{ scaleX: -1 }] },
  faint: { opacity: FAINT_OPACITY },
  gap: {
    width: GAP_WIDTH,
    borderTopWidth: border.chip,
    borderStyle: 'dashed',
    borderColor: colors.outlineStrong,
  },
});
