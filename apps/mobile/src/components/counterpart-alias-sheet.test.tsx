import { act, fireEvent, render } from '@testing-library/react-native';

import { createCounterpartAliasKey, loadCounterpartAliasNative, updateCounterpartAliasNative } from '../lib/counterpart-alias-native.ts';
import { CounterpartAliasSheet } from './counterpart-alias-sheet.tsx';

jest.mock('../lib/counterpart-alias-native.ts', () => ({
  createCounterpartAliasKey: jest.fn(),
  loadCounterpartAliasNative: jest.fn(),
  updateCounterpartAliasNative: jest.fn(),
}));

const record = { target_user_id: 'counterpart', nickname: '민준', alias: '학교 친구' };
const load = jest.mocked(loadCounterpartAliasNative);
const update = jest.mocked(updateCounterpartAliasNative);

beforeEach(() => {
  jest.clearAllMocks();
  load.mockResolvedValue(record);
  update.mockResolvedValue(record);
  jest.mocked(createCounterpartAliasKey).mockReturnValue('intent-1');
});

test('원래 이름과 개인 범위를 보여주고 공백은 입력 중 보존한 뒤 저장 시 정리한다', async () => {
  const saved = jest.fn();
  const view = await render(<CounterpartAliasSheet promiseId="promise-1" onClose={jest.fn()} onSaved={saved} />);
  expect(await view.findByText('민준')).toBeTruthy();
  expect(view.getByText(/나에게만 보여요/)).toBeTruthy();
  const input = view.getByLabelText('내가 부를 이름');
  await fireEvent.changeText(input, '  우리 반 친구 ');
  expect(input.props.value).toBe('  우리 반 친구 ');
  await fireEvent.press(view.getByRole('button', { name: '저장' }));
  expect(update).toHaveBeenCalledWith('promise-1', '우리 반 친구', 'intent-1');
  expect(saved).toHaveBeenCalledTimes(1);
});

test.each(['blank', 'reset'])('%s로 원래 프로필 이름을 복원한다', async (method) => {
  const view = await render(<CounterpartAliasSheet promiseId="promise-1" onClose={jest.fn()} onSaved={jest.fn()} />);
  await view.findByText('민준');
  if (method === 'blank') await fireEvent.changeText(view.getByLabelText('내가 부를 이름'), '   ');
  await fireEvent.press(view.getByRole('button', { name: method === 'blank' ? '저장' : '원래 이름으로 되돌리기' }));
  expect(update).toHaveBeenCalledWith('promise-1', null, 'intent-1');
});

test('실패 후 같은 입력 재시도는 같은 멱등 키를 재사용하고 중복 저장을 막는다', async () => {
  let fail: ((error: Error) => void) | undefined;
  update.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
  const saved = jest.fn();
  const view = await render(<CounterpartAliasSheet promiseId="promise-1" onClose={jest.fn()} onSaved={saved} />);
  await view.findByText('민준');
  await fireEvent.press(view.getByRole('button', { name: '저장' }));
  await fireEvent.press(view.getByRole('button', { name: '저장 중' }));
  expect(update).toHaveBeenCalledTimes(1);
  await act(async () => fail?.(new Error('offline')));
  expect(view.getByText('별칭을 저장하지 못했어요. 다시 시도해주세요.')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: '저장' }));
  expect(update).toHaveBeenLastCalledWith('promise-1', '학교 친구', 'intent-1');
  expect(createCounterpartAliasKey).toHaveBeenCalledTimes(1);
  expect(saved).toHaveBeenCalledTimes(1);
});

test('조회 실패는 저장 UI를 열지 않으며 재조회로 복구한다', async () => {
  load.mockRejectedValueOnce(new Error('offline'));
  const view = await render(<CounterpartAliasSheet promiseId="promise-1" onClose={jest.fn()} onSaved={jest.fn()} />);
  await view.findByText('이름을 불러오지 못했어요.');
  expect(view.queryByLabelText('내가 부를 이름')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: '다시 시도' }));
  expect(await view.findByText('민준')).toBeTruthy();
});

test('40자를 넘는 별칭은 저장하지 않고 한글 조합 문자는 정규화해 센다', async () => {
  const view = await render(<CounterpartAliasSheet promiseId="promise-1" onClose={jest.fn()} onSaved={jest.fn()} />);
  await view.findByText('민준');
  await fireEvent.changeText(view.getByLabelText('내가 부를 이름'), '가'.repeat(41));
  await fireEvent.press(view.getByRole('button', { name: '저장' }));
  expect(update).not.toHaveBeenCalled();
  await fireEvent.changeText(view.getByLabelText('내가 부를 이름'), '가'.repeat(40));
  await fireEvent.press(view.getByRole('button', { name: '저장' }));
  expect(update).toHaveBeenCalledWith('promise-1', '가'.repeat(40), 'intent-1');
});
