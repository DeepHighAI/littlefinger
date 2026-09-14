import { act, fireEvent, render } from '@testing-library/react-native';
import { Button, Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { PromiseTutorialProvider, TUTORIAL_COMPLETED_KEY, usePromiseTutorial } from './promise-tutorial';

const mockFocus = { current: true };
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => mockFocus.current ? effect() : undefined, [effect, mockFocus.current]);
  },
}));

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));

function Consumer(): React.JSX.Element {
  const tutorial = usePromiseTutorial();
  return <>
    <Text>{tutorial.available ? 'available' : 'completed'}</Text>
    <Text>{tutorial.started ? 'started' : 'idle'}</Text>
    <Button title="start" onPress={tutorial.start} />
    <Button title="complete" onPress={() => void tutorial.complete()} />
  </>;
}
function Fixture(): React.JSX.Element {
  return <PromiseTutorialProvider><Consumer /></PromiseTutorialProvider>;
}
beforeEach(() => {
  jest.resetAllMocks();
  mockFocus.current = true;
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue();
});

test('처음에는 안내하고 시작만 했을 때는 완료를 저장하지 않는다', async () => {
  const view = await render(<Fixture />);
  await act(async () => {});
  expect(view.getByText('available')).toBeTruthy();
  await fireEvent.press(view.getByText('start'));
  expect(view.getByText('started')).toBeTruthy();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  await view.unmount();
  const reopened = await render(<Fixture />);
  await act(async () => {});
  expect(reopened.getByText('available')).toBeTruthy();
});

test('완료한 기기는 반복하지 않고 재설치로 저장값이 사라지면 다시 안내한다', async () => {
  const view = await render(<Fixture />);
  await act(async () => {});
  await fireEvent.press(view.getByText('complete'));
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TUTORIAL_COMPLETED_KEY, '1');
  expect(view.getByText('completed')).toBeTruthy();
  await view.unmount();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('1');
  const reopened = await render(<Fixture />);
  await act(async () => {});
  expect(reopened.getByText('completed')).toBeTruthy();
  await reopened.unmount();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  const reinstalled = await render(<Fixture />);
  await act(async () => {});
  expect(reinstalled.getByText('available')).toBeTruthy();
});

test('완료 저장 실패도 현재 화면의 안내를 닫는다', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.mocked(SecureStore.setItemAsync).mockRejectedValue(new Error('storage unavailable'));
  const view = await render(<Fixture />);
  await act(async () => {});
  await fireEvent.press(view.getByText('complete'));
  expect(view.getByText('completed')).toBeTruthy();
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});


test('포커스를 잃은 화면의 안내는 숨기고 돌아오면 이어진다', async () => {
  const view = await render(<Fixture />);
  await act(async () => {});
  await fireEvent.press(view.getByText('start'));
  expect(view.getByText('started')).toBeTruthy();
  mockFocus.current = false;
  await view.rerender(<Fixture />);
  expect(view.getByText('idle')).toBeTruthy();
  mockFocus.current = true;
  await view.rerender(<Fixture />);
  expect(view.getByText('started')).toBeTruthy();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});
