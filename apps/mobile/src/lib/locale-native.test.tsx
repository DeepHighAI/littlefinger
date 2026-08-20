import { Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import {
  LocaleProvider,
  getCurrentLocale,
  useLabels,
  useLocale,
} from './locale-native';

import type { Localized } from '@littlefinger/shared';

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

const mockGetLocales = jest.fn();
jest.mock('expo-localization', () => ({ getLocales: () => mockGetLocales() }));

const CATALOG: Localized<{ greeting: string }> = {
  ko: { greeting: '안녕하세요' },
  en: { greeting: 'Hello' },
};

function Consumer(): React.JSX.Element {
  const labels = useLabels(CATALOG);
  const { setLocale } = useLocale();
  return <Text onPress={() => setLocale('en')}>{labels.greeting}</Text>;
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 4; index += 1) await Promise.resolve();
  });
}

describe('LocaleProvider', () => {
  beforeEach(() => {
    mockGetItem.mockReset().mockResolvedValue(null);
    mockSetItem.mockReset().mockResolvedValue(undefined);
    mockGetLocales.mockReset().mockReturnValue([{ languageTag: 'en-US' }]);
  });

  test('영어 기기는 영어로 시작하고 준비 신호를 보낸다', async () => {
    const onReady = jest.fn();
    const view = await render(
      <LocaleProvider onReady={onReady}>
        <Consumer />
      </LocaleProvider>,
    );
    await settle();

    expect(view.getByText('Hello')).toBeTruthy();
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(getCurrentLocale()).toBe('en');
  });

  test('한국어 기기는 한국어로 시작한다', async () => {
    mockGetLocales.mockReturnValue([{ languageTag: 'ko-KR' }]);
    const view = await render(
      <LocaleProvider>
        <Consumer />
      </LocaleProvider>,
    );
    await settle();

    expect(view.getByText('안녕하세요')).toBeTruthy();
    expect(getCurrentLocale()).toBe('ko');
  });

  test('수동 전환은 즉시 반영되고 저장되며 getCurrentLocale 도 따라간다', async () => {
    mockGetLocales.mockReturnValue([{ languageTag: 'ko-KR' }]);
    const view = await render(
      <LocaleProvider>
        <Consumer />
      </LocaleProvider>,
    );
    await settle();

    await fireEvent.press(view.getByText('안녕하세요'));
    expect(view.getByText('Hello')).toBeTruthy();
    expect(mockSetItem).toHaveBeenCalledWith('littlefinger.locale.v1', 'en');
    expect(getCurrentLocale()).toBe('en');
  });

  test('저장된 수동 전환이 기기 언어를 이긴다', async () => {
    mockGetItem.mockResolvedValue('en');
    mockGetLocales.mockReturnValue([{ languageTag: 'ko-KR' }]);
    const view = await render(
      <LocaleProvider>
        <Consumer />
      </LocaleProvider>,
    );
    await settle();

    expect(view.getByText('Hello')).toBeTruthy();
  });
});
