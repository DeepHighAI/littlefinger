import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  resolveInitialLocale,
  type Locale,
  type Localized,
} from '@littlefinger/shared';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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

// localStorage 는 동기라 첫 렌더부터 확정 로케일로 그린다 — 언어 깜빡임이 없다.
function readInitialLocale(): Locale {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // 시크릿 모드 등 저장소 접근 실패는 감지 경로로 넘어간다.
  }
  return resolveInitialLocale(window.navigator.languages ?? [], stored);
}

export function LocaleProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  useEffect(() => {
    // index.html 은 lang="ko" 고정이므로 실제 로케일을 문서에 반영한다.
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: (next) => {
        setLocaleState(next);
        try {
          window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
        } catch {
          // 저장 실패해도 세션 내 전환은 유지된다.
        }
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
