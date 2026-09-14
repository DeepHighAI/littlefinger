import { validateEndDate } from '@littlefinger/shared';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';

import { DAYS_PER_WEEK, calendarWeeks, closeEndDatePicker, endDateRange, getEndDateRequest, shiftCalendarMonth, subscribeEndDatePicker } from '../lib/end-date-picker';
import { useLabels, useLocale } from '../lib/locale-native';
import { END_DATE_PICKER_LABEL } from '../screens/end-date-picker-labels';
import { border, colors, radius, size, space } from '../theme/tokens';
import { LfButton } from './LfButton';
import { LfIconButton } from './LfIconButton';
import { LfSheet } from './LfSheet';
import { LfText } from './LfText';

export function EndDatePickerHost(): React.JSX.Element | null {
  const request = useSyncExternalStore(subscribeEndDatePicker, getEndDateRequest, getEndDateRequest);
  const pathname = usePathname();
  useEffect(() => closeEndDatePicker, [pathname]);
  return request === null ? null : <EndDatePicker key={request.id} value={request.value} onSelect={request.onSelect} />;
}

export function EndDatePicker({ value, onSelect }: { value: string; onSelect(value: string): void }): React.JSX.Element {
  const LABEL = useLabels(END_DATE_PICKER_LABEL);
  const { locale } = useLocale();
  const [selected, setSelected] = useState(value);
  const [month, setMonth] = useState(value.slice(0, 7));
  const [dateChanged, setDateChanged] = useState(false);
  const { minimum, maximum } = endDateRange(new Date());
  const format = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  function confirm(): void {
    // 자정이 지난 채 열린 달력도 오늘 하한을 다시 검사한다.
    if (!validateEndDate(selected, new Date()).valid) {
      const today = endDateRange(new Date()).minimum;
      setSelected(today); setMonth(today.slice(0, 7)); setDateChanged(true);
      return;
    }
    closeEndDatePicker();
    onSelect(selected);
  }
  return <LfSheet visible title={LABEL.title} closeLabel={LABEL.close} onClose={closeEndDatePicker} testID="end-date-sheet">
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.selection}><LfText variant="bodyStrong" align="center">{format(selected, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</LfText></View>
      <View style={styles.navigation}>
        <LfIconButton icon="arrow_back" accessibilityLabel={LABEL.previousMonth} disabled={month <= minimum.slice(0, 7)} onPress={() => setMonth(shiftCalendarMonth(month, -1))} />
        <View style={styles.month}><LfText variant="heading" align="center">{format(`${month}-01`, { year: 'numeric', month: 'long' })}</LfText></View>
        <LfIconButton icon="arrow_forward" accessibilityLabel={LABEL.nextMonth} disabled={month >= maximum.slice(0, 7)} onPress={() => setMonth(shiftCalendarMonth(month, 1))} />
      </View>
      <View style={styles.calendar}>
        <View style={styles.row}>{LABEL.weekdays.map((day) => <View key={day} style={styles.weekday}><LfText variant="meta" align="center" secondary>{day}</LfText></View>)}</View>
        {calendarWeeks(month).map((week, index) => <View key={index} style={styles.row}>{week.map((day, column) => {
          if (day === null) return <View key={column} style={styles.cell} />;
          const disabled = day < minimum || day > maximum;
          return <Pressable key={day} testID={`calendar-${day}`} accessibilityRole="button"
            accessibilityLabel={format(day, { year: 'numeric', month: 'long', day: 'numeric' })}
            accessibilityState={{ selected: day === selected, disabled }} disabled={disabled}
            onPress={() => { setSelected(day); setDateChanged(false); }}
            style={[styles.cell, styles.day, day === minimum && styles.today, day === selected && styles.selected]}>
            <LfText variant={day === selected ? 'bodyStrong' : 'body'} secondary={disabled} align="center">{Number(day.slice(-2))}</LfText>
          </Pressable>;
        })}</View>)}
      </View>
      <LfButton label={LABEL.today} variant="text" onPress={() => { setSelected(minimum); setMonth(minimum.slice(0, 7)); setDateChanged(false); }} />
      <LfText variant={dateChanged ? 'error' : 'caption'} secondary={!dateChanged} align="center">{dateChanged ? LABEL.rangeChanged : LABEL.hint}</LfText>
    </ScrollView>
    <View style={styles.actions}>
      <View style={styles.action}><LfButton label={LABEL.cancel} variant="outlined" onPress={closeEndDatePicker} /></View>
      <View style={styles.action}><LfButton label={LABEL.confirm} onPress={confirm} /></View>
    </View>
  </LfSheet>;
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1, marginHorizontal: -space[6] }, content: { gap: space[5], paddingHorizontal: space[1] },
  selection: { padding: space[5], borderWidth: border.chip, borderColor: colors.text, borderRadius: radius.sm, backgroundColor: colors.primaryContainer },
  navigation: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: size.touchMin }, month: { flex: 1 },
  calendar: { alignSelf: 'stretch' }, row: { flexDirection: 'row' },
  weekday: { width: `${100 / DAYS_PER_WEEK}%`, minHeight: size.chipMetaHeight, justifyContent: 'center' },
  cell: { width: `${100 / DAYS_PER_WEEK}%`, minHeight: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  day: { borderWidth: border.chip, borderColor: colors.surface, borderRadius: radius.sm },
  today: { borderColor: colors.text }, selected: { backgroundColor: colors.primaryContainer, borderColor: colors.text },
  actions: { flexDirection: 'row', gap: space[5] }, action: { flex: 1 },
});
