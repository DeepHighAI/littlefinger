import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { EndDatePickerHost } from './EndDatePicker';
import { calendarWeeks, closeEndDatePicker, endDateRange, openEndDatePicker, shiftCalendarMonth } from '../lib/end-date-picker';

jest.mock('expo-router', () => ({ usePathname: () => '/promise/edit' }));
beforeEach(() => { jest.useFakeTimers().setSystemTime(new Date('2026-09-14T03:00:00Z')); });
afterEach(async () => { await cleanup(); closeEndDatePicker(); jest.useRealTimers(); });

test('오늘은 허용하고 어제는 비활성화하며 확인을 눌러야 선택값을 반영한다', async () => {
  const onSelect = jest.fn();
  openEndDatePicker('', onSelect);
  const view = await render(<EndDatePickerHost />);
  expect(view.getByTestId('calendar-2026-09-13').props.accessibilityState.disabled).toBe(true);
  expect(view.getByTestId('calendar-2026-09-14').props.accessibilityState).toEqual({ selected: true, disabled: false });
  await fireEvent.press(view.getByTestId('calendar-2026-09-15'));
  expect(onSelect).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: '확인' }));
  expect(onSelect).toHaveBeenCalledWith('2026-09-15');
  expect(view.queryByTestId('end-date-sheet')).toBeNull();
});
test('월 이동 뒤 취소나 닫기로 입력값을 변경하지 않고 다시 열 수 있다', async () => {
  const onSelect = jest.fn();
  openEndDatePicker('2026-09-14', onSelect);
  const view = await render(<EndDatePickerHost />);
  expect(view.getByRole('button', { name: '이전 달' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(view.getByRole('button', { name: '다음 달' }));
  await fireEvent.press(view.getByTestId('calendar-2026-10-03'));
  await fireEvent.press(view.getByRole('button', { name: '취소' }));
  expect(onSelect).not.toHaveBeenCalled();
  await act(async () => openEndDatePicker('2026-09-14', onSelect));
  await fireEvent.press(view.getByRole('button', { name: '닫기' }));
  expect(onSelect).not.toHaveBeenCalled();
});
test('정책 상한 다음 날짜는 비활성이고 다음 달로 넘어갈 수 없다', async () => {
  const maximum = endDateRange(new Date()).maximum;
  openEndDatePicker(maximum, jest.fn());
  const view = await render(<EndDatePickerHost />);
  expect(view.getByTestId(`calendar-${maximum}`).props.accessibilityState.disabled).toBe(false);
  const afterMaximum = new Date(Date.parse(`${maximum}T00:00:00Z`) + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  expect(view.getByTestId(`calendar-${afterMaximum}`).props.accessibilityState.disabled).toBe(true);
  expect(view.getByRole('button', { name: '다음 달' }).props.accessibilityState.disabled).toBe(true);
});
test('달력을 연 채 KST 자정을 넘기면 어제 날짜를 확정하지 않는다', async () => {
  const onSelect = jest.fn();
  openEndDatePicker('2026-09-14', onSelect);
  const view = await render(<EndDatePickerHost />);
  jest.setSystemTime(new Date('2026-09-14T15:00:00Z'));
  await fireEvent.press(view.getByRole('button', { name: '확인' }));
  expect(onSelect).not.toHaveBeenCalled();
  expect(view.getByText('날짜가 바뀌었어요. 종료일을 다시 확인해 주세요.')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: '확인' }));
  expect(onSelect).toHaveBeenCalledWith('2026-09-15');
});
test('윤년과 연도 경계, 여섯 주 달력을 정확히 생성한다', () => {
  expect(calendarWeeks('2028-02').flat().filter(Boolean)).toHaveLength(29);
  expect(calendarWeeks('2026-08')).toHaveLength(6);
  expect(shiftCalendarMonth('2026-12', 1)).toBe('2027-01');
  expect(shiftCalendarMonth('2027-01', -1)).toBe('2026-12');
});
