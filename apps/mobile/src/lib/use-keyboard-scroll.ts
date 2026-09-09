import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView, TextInput, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { duration, space } from '../theme/tokens.ts';

/** 키보드가 덮는 높이만큼 여백을 확보하고 현재 입력란을 창 좌표로 다시 측정한다. */
export function useKeyboardScroll(visible: boolean) {
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inset, setInset] = useState(0);
  const reveal = useCallback((keyboardY = Keyboard.metrics()?.screenY) => {
    if (keyboardY === undefined) return;
    TextInput.State.currentlyFocusedInput()?.measureInWindow((_x, y, _width, height) => {
      const overlap = y + height + space[6] - keyboardY;
      if (overlap <= 0) return;
      offset.current += overlap;
      scrollRef.current?.scrollTo({ y: offset.current, animated: false });
    });
  }, []);
  const onFocus = useCallback(() => {
    reveal();
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(reveal, duration.long);
  }, [reveal]);
  useEffect(() => {
    if (!visible) { setInset(0); return; }
    const show = Keyboard.addListener('keyboardDidShow', ({ endCoordinates }) => {
      setInset(endCoordinates.height);
      // 느린 키보드는 최초 포커스 타이머 뒤에 열리므로 표시 완료 때도 다시 예약한다.
      onFocus();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [onFocus, visible]);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    offset.current = event.nativeEvent.contentOffset.y;
  };
  return { scrollRef, inset, onFocus, onScroll, reveal };
}
