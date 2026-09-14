import { closeEndDatePicker, getEndDateRequest } from './end-date-picker';
import { openEndDatePicker } from './promise-editor-native.ts';
jest.mock('./mobile-api-native.ts', () => ({}));
jest.mock('./supabase-native.ts', () => ({}));
afterEach(() => { closeEndDatePicker(); jest.useRealTimers(); });
test('KST 오늘을 앱 달력에 전달하고 취소하면 입력값을 유지한다', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-14T15:00:00Z'));
  const onSelect = jest.fn();
  openEndDatePicker('', onSelect);
  expect(getEndDateRequest()?.value).toBe('2026-09-15');
  closeEndDatePicker();
  expect(onSelect).not.toHaveBeenCalled();
});
