import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const TUTORIAL_COMPLETED_KEY = 'littlefinger.promise-tutorial-completed.v1';

interface PromiseTutorial {
  available: boolean;
  started: boolean;
  start(): void;
  complete(): Promise<void>;
}

const TutorialContext = createContext<PromiseTutorial>({
  available: false, started: false, start() {}, async complete() {},
});

export function PromiseTutorialProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [available, setAvailable] = useState(false);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    let active = true;
    // SecureStore는 Android 백업에서 제외되므로 재설치 시 안내가 다시 시작된다.
    void SecureStore.getItemAsync(TUTORIAL_COMPLETED_KEY).then((value) => {
      if (active) setAvailable(value !== '1');
    }).catch((error: unknown) => {
      console.error('따라하기 완료 여부를 읽지 못했습니다.', error);
    });
    return () => { active = false; };
  }, []);

  async function complete(): Promise<void> {
    setAvailable(false);
    setStarted(false);
    try {
      await SecureStore.setItemAsync(TUTORIAL_COMPLETED_KEY, '1');
    } catch (error) {
      // 저장 실패가 초대 공유를 막아서는 안 된다. 다음 실행에서 다시 안내한다.
      console.error('따라하기 완료 여부를 저장하지 못했습니다.', error);
    }
  }

  return <TutorialContext.Provider value={{ available, started, start: () => setStarted(true), complete }}>
    {children}
  </TutorialContext.Provider>;
}

export function usePromiseTutorial(): PromiseTutorial {
  const tutorial = useContext(TutorialContext);
  const [focused, setFocused] = useState(false);
  // 스택에 남은 화면의 모달이 알림·딥링크로 열린 다른 화면을 덮지 않게 한다.
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  return { ...tutorial, available: tutorial.available && focused, started: tutorial.started && focused };
}
