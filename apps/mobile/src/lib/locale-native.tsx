import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  resolveInitialLocale,
  type Locale,
  type Localized,
} from '@littlefinger/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface LocaleContextValue {
  locale: Locale;
  setLocale(next: Locale): void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

// Alert 문구처럼 React 트리 밖에서 카피를 만드는 지점용. Provider 가 동기화한다.
let currentLocale: Locale = DEFAULT_LOCALE;

export function getCurrentLocale(): Locale {
  return currentLocale;
}

async function readInitialLocaleNative(): Promise<Locale> {
  let stored: string | null = null;
  try {
    stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // 저장소 장애가 앱 시작을 막아서는 안 된다 — 감지 경로로 넘어간다.
  }
  return resolveInitialLocale(
    getLocales().map((entry) => entry.languageTag),
    stored,
  );
}

export function LocaleProvider({
  onReady,
  children,
}: {
  /** 초기 로케일 확정 신호 — _layout 이 스플래시 숨김 조건에 넣는다(언어 깜빡임 방지). */
  onReady?: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let active = true;
    void readInitialLocaleNative().then((initial) => {
      if (!active) return;
      currentLocale = initial;
      setLocaleState(initial);
      onReadyRef.current?.();
    });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: (next) => {
        currentLocale = next;
        setLocaleState(next);
        // 저장 실패해도 세션 내 전환은 유지된다.
        AsyncStorage.setItem(LOCALE_STORAGE_KEY, next).catch(() => {});
      },
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

/** 카탈로그에서 현재 로케일의 라벨 묶음을 꺼낸다 — 화면은 이 한 줄만 쓴다. */
export function useLabels<T>(catalog: Localized<T>): T {
  return catalog[useContext(LocaleContext).locale];
}
