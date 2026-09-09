import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView, TextInput, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { duration, space } from '../theme/tokens.ts';

/** Modal은 작성 화면과 별도 창이므로 자체 키보드 좌표와 스크롤 여백을 사용한다. */
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
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [reveal, visible]);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    offset.current = event.nativeEvent.contentOffset.y;
  };
  return { scrollRef, inset, onFocus, onScroll, reveal };
}
