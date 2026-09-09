import { act, renderHook } from '@testing-library/react-native';
import { Keyboard, ScrollView, TextInput, type KeyboardEvent } from 'react-native';

import { useKeyboardScroll } from './use-keyboard-scroll.ts';

afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('변경 이유가 키보드 아래에 있으면 여백 반영 뒤 위로 스크롤하고 보이는 입력은 유지한다', async () => {
  jest.useFakeTimers();
  const listeners = new Map<string, (event: KeyboardEvent) => void>();
  jest.spyOn(Keyboard, 'addListener').mockImplementation((name, callback) => {
    listeners.set(name, callback);
    return { remove: jest.fn() } as unknown as ReturnType<typeof Keyboard.addListener>;
  });
  jest.spyOn(Keyboard, 'metrics').mockReturnValue({ screenY: 480, height: 320, width: 360, screenX: 0 });
  let fieldY = 650;
  jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({
    measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => callback(20, fieldY, 320, 84),
  } as unknown as TextInput);
  const scrollTo = jest.fn();
  const { result, unmount } = await renderHook(() => useKeyboardScroll(true));
  result.current.scrollRef.current = { scrollTo } as unknown as ScrollView;
  await act(async () => listeners.get('keyboardDidShow')?.({
    endCoordinates: { height: 320, screenY: 480, width: 360, screenX: 0 }, duration: 0, easing: 'keyboard',
  }));
  expect(result.current.inset).toBe(320);
  await act(async () => result.current.reveal());
  expect(scrollTo).toHaveBeenCalledWith({ y: expect.any(Number), animated: false });
  expect(scrollTo.mock.calls[0]?.[0].y).toBeGreaterThan(254);
  fieldY = 200;
  scrollTo.mockClear();
  await act(async () => result.current.onFocus());
  expect(scrollTo).not.toHaveBeenCalled();
  await unmount();
});
