import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { textFontFamily } from '../theme/fonts';
import { colors, border, elevation, line, radius, size, space, type, weight } from '../theme/tokens';
import { LfBlob } from './LfBlob';
import { LfChip } from './LfChip';
import { LfPinkyLoop } from './LfPinkyLoop';
import { LfInkContext, LfText } from './LfText';

export type LfStampVariant = 'active' | 'completed' | 'pending';

export interface LfStampProps extends Omit<ViewProps, 'style' | 'children'> {
  variant: LfStampVariant;
  headline: string;
  /** 헤드라인 아래 한 줄 설명 — 초대 대기(A04) "카톡으로 초대장을 보내면…" */
  body?: string;
  time?: string;
  participants?: readonly string[];
  fingerprint?: string;
}

/** README 스탬프 패딩 22 18 16 — 토큰 없음, ADR 0020 예외 */
const TOP_PADDING = 22;
const SIDE_PADDING = 18;

/** 확정 스탬프 — 틸트·pop-in 없음, r14 + 5px, 모서리 파스텔 블롭. COMPLETED 는 카드 전체가 민트 */
export function LfStamp({
  variant,
  headline,
  body,
  time,
  participants = [],
  fingerprint,
  ...rest
}: LfStampProps): React.JSX.Element {
  const completed = variant === 'completed';
  return (
    <View {...rest} style={[styles.stamp, completed && styles.completed]}>
      <LfInkContext.Provider value={completed}>
        <View pointerEvents="none" style={styles.corner}>
          <LfBlob variant={variant === 'pending' ? 'cornerYellow' : 'cornerMint'} />
        </View>
        <View style={[styles.pill, completed && styles.completedPill]}>
          <LfPinkyLoop size="sm" spark />
        </View>
        <LfText variant="stamp" align="center">{headline}</LfText>
        {body === undefined ? null : <Text style={styles.body}>{body}</Text>}
        {time === undefined ? null : (
          <LfText variant={completed ? 'chip' : 'meta'} align="center">{time}</LfText>
        )}
        {participants.length === 0 ? null : (
          <View style={styles.participants}>
            {participants.map((participant) => (
              <LfChip key={participant} label={participant} tone="paper" kind="meta" dot />
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
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: border.card,
    borderColor: colors.text,
    borderRadius: radius.xl,
    ...elevation.card,
  },
  completed: { backgroundColor: colors.successContainer },
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
  // `.lf-stamp__body` 12.5/18/500 보조 — LfText 에 같은 조합이 없어 토큰으로 직접 짠다
  body: {
    fontSize: type.caption,
    lineHeight: line.caption,
    fontFamily: textFontFamily(weight.medium),
    color: colors.textSecondary,
    textAlign: 'center',
  },
  participants: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space[2],
    marginTop: space[1],
  },
});
