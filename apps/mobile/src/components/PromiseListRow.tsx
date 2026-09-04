import {
  PROMISE_STATUS_LABEL_BY_LOCALE,
  ddayFrom,
  formatDday,
  formatKstDate,
  type PromiseHomeCard,
} from '@littlefinger/shared';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLabels, useLocale } from '../lib/locale-native';
import { SCR_A02_LABEL } from '../screens/scr-a02-labels.ts';
import { statusToneOf } from '../screens/status-tone';
import { gutter, space } from '../theme/tokens';
import { LfButton } from './LfButton';
import { LfCard } from './LfCard';
import { LfChip } from './LfChip';
import { LfRow } from './LfRow';
import { LfStatusDot } from './LfStatusDot';
import { LfText } from './LfText';

export interface PromiseListRowProps {
  item: PromiseHomeCard;
  now: Date;
  onOpen: (item: PromiseHomeCard) => void;
  onDelete?: (item: PromiseHomeCard) => void;
}

export function PromiseListRow({
  item,
  now,
  onOpen,
  onDelete,
}: PromiseListRowProps): React.JSX.Element {
  const LABEL = useLabels(SCR_A02_LABEL);
  const STATUS_LABEL = useLabels(PROMISE_STATUS_LABEL_BY_LOCALE);
  const { locale } = useLocale();
  const partnerName = item.partner?.nickname ?? LABEL.partnerFallback;
  const needsResponse = item.status === 'CHECKING' && item.needs_response;
  const tone = statusToneOf(item.status);
  const copy = (
    <View style={needsResponse ? styles.response : styles.row}>
      <LfStatusDot tone={tone} />
      <View style={styles.main}>
        <LfText variant="bodyStrong">{item.title}</LfText>
        <LfRow gap={2} wrap>
          <LfText variant="meta">{STATUS_LABEL[item.status]}</LfText>
          {item.end_date === null ? null : (
            <LfText variant="meta">{LABEL.endDate(formatKstDate(item.end_date, locale))}</LfText>
          )}
          <LfText variant="meta">{LABEL.parties(item.creator.nickname, partnerName)}</LfText>
          {item.has_witness ? <LfChip label={LABEL.witness} tone="paper" kind="meta" /> : null}
        </LfRow>
      </View>
      {!needsResponse && item.end_date !== null ? (
        <LfChip
          label={formatDday(ddayFrom(item.end_date, now))}
          tone="cream"
          kind="meta"
        />
      ) : null}
      {needsResponse ? (
        <LfButton
          accessibilityLabel={LABEL.answerFulfillment}
          label={LABEL.answerFulfillment}
          variant="outlined"
          size="compact"
          trailing="arrow_forward"
          trailingBorder={false}
          onPress={() => onOpen(item)}
          block
        />
      ) : null}
      {(item.status === 'DRAFT' || item.status === 'PENDING') && onDelete !== undefined ? (
        <LfButton
          accessibilityLabel={
            item.status === 'DRAFT'
              ? LABEL.deleteDraft(item.title)
              : LABEL.deletePending(item.title)
          }
          label={LABEL.delete}
          variant="text"
          onPress={() => onDelete(item)}
        />
      ) : null}
    </View>
  );

  const card = (
    <LfCard
      testID={needsResponse ? `promise-response-${item.promise_id}` : undefined}
      tone={needsResponse ? 'pink' : 'paper'}
      shape="list"
    >
      {copy}
    </LfCard>
  );

  return (
    <View style={styles.container}>
      {needsResponse ? card : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={LABEL.open(item.title)}
          onPress={() => onOpen(item)}
        >
          {card}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: gutter.app, marginBottom: space[5] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[5] },
  response: { gap: space[4] },
  main: { flex: 1, gap: space[2] },
});
