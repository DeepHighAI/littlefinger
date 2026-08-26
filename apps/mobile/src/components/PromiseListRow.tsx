import {
  PROMISE_STATUS_LABEL_BY_LOCALE,
  ddayFrom,
  formatDday,
  formatKstDate,
  type PromiseHomeCard,
} from '@littlefinger/shared';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLabels } from '../lib/locale-native';
import { SCR_A02_LABEL } from '../screens/scr-a02-labels.ts';
import { colors, gutter, radius, space } from '../theme/tokens';
import { LfButton } from './LfButton';
import { LfCard } from './LfCard';
import { LfChip } from './LfChip';
import { LfRow } from './LfRow';
import { LfText } from './LfText';

export interface PromiseListRowProps {
  item: PromiseHomeCard;
  now: Date;
  onOpen: (item: PromiseHomeCard) => void;
  onDelete?: (item: PromiseHomeCard) => void;
}

// 잉크 테두리 스티커 카드 행 (.lf-home__row) + 라벤더 원형 D-Day 뱃지 (ADR 0012)
const ROW_BORDER_WIDTH = 2.2;
const DDAY_BADGE_SIZE = 46;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[5],
    paddingVertical: space[6],
    paddingHorizontal: space[7],
    marginHorizontal: gutter.app,
    marginBottom: space[5],
    borderWidth: ROW_BORDER_WIDTH,
    borderColor: colors.text,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  responseContainer: { paddingHorizontal: gutter.app, paddingVertical: space[3] },
  containedRow: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginHorizontal: 0,
    marginBottom: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  main: { flex: 1, gap: space[2] },
  response: { marginTop: space[3], gap: space[3] },
  dday: {
    minWidth: DDAY_BADGE_SIZE,
    height: DDAY_BADGE_SIZE,
    paddingHorizontal: space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.rewardContainer,
    borderWidth: ROW_BORDER_WIDTH,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** 스티커 카드 행 (ADR 0012). 상태는 색뿐 아니라 텍스트로 항상 드러낸다. */
export function PromiseListRow({
  item,
  now,
  onOpen,
  onDelete,
}: PromiseListRowProps): React.JSX.Element {
  const LABEL = useLabels(SCR_A02_LABEL);
  const STATUS_LABEL = useLabels(PROMISE_STATUS_LABEL_BY_LOCALE);
  const partnerName = item.partner?.nickname ?? LABEL.partnerFallback;
  const needsResponse = item.status === 'CHECKING' && item.needs_response;
  const content = (
    <View style={[styles.row, needsResponse && styles.containedRow]}>
      <View style={styles.main}>
        <LfText variant="listTitle">{item.title}</LfText>
        <LfRow gap={2} wrap>
          <LfText variant="listStatus">{STATUS_LABEL[item.status]}</LfText>
          {item.end_date !== null && (
            <>
              <LfText variant="listMeta">·</LfText>
              <LfText variant="listMeta">{LABEL.endDate(formatKstDate(item.end_date))}</LfText>
            </>
          )}
          <LfText variant="listMeta">·</LfText>
          <LfText variant="listMeta">
            {LABEL.parties(item.creator.nickname, partnerName)}
          </LfText>
          {item.has_witness && <LfChip label={LABEL.witness} tone="neutral" />}
        </LfRow>
        {needsResponse && (
          <View style={styles.response}>
            <LfText variant="sectionTitle">{LABEL.needsResponse}</LfText>
            <LfButton label={LABEL.answerFulfillment} onPress={() => onOpen(item)} block />
          </View>
        )}
        {item.status === 'DRAFT' && onDelete !== undefined && (
          <LfButton
            accessibilityLabel={LABEL.deleteDraft(item.title)}
            label={LABEL.delete}
            variant="text"
            onPress={() => onDelete(item)}
          />
        )}
      </View>
      {item.end_date !== null && (
        <View style={styles.dday}>
          <LfText variant="dday">{formatDday(ddayFrom(item.end_date, now))}</LfText>
        </View>
      )}
    </View>
  );

  // 내부 CTA와 중첩 Pressable을 만들지 않는다.
  if (needsResponse) {
    return (
      <View style={styles.responseContainer}>
        <LfCard testID={`promise-response-${item.promise_id}`} variant="emphasis">
          {content}
        </LfCard>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={LABEL.open(item.title)}
      onPress={() => onOpen(item)}
    >
      {content}
    </Pressable>
  );
}
