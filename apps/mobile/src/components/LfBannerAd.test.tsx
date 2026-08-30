import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../lib/admob-native.tsx', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { Pressable, View } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    ensureAdsReady: jest.fn(),
    AdaptiveBanner: ({ onLoaded, onFailed }: { onLoaded(): void; onFailed(): void }) => (
      <View testID="adaptive-banner">
        <Pressable accessibilityRole="button" accessibilityLabel="load" onPress={onLoaded} />
        <Pressable accessibilityRole="button" accessibilityLabel="fail" onPress={onFailed} />
      </View>
    ),
  };
});

import { ensureAdsReady } from '../lib/admob-native.tsx';
import { LfBannerAd } from './LfBannerAd.tsx';

const readyMock = jest.mocked(ensureAdsReady);

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  readyMock.mockReset().mockResolvedValue(true);
});

describe('LfBannerAd', () => {
  test('광고가 꺼지면 SDK와 빈 공간을 모두 렌더하지 않는다', async () => {
    const view = await render(<LfBannerAd enabled={false} />);
    await settle();
    expect(view.toJSON()).toBeNull();
    expect(view.queryByTestId('adaptive-banner')).toBeNull();
    expect(readyMock).not.toHaveBeenCalled();
  });

  test('동의 관문이 닫히면 BannerAd 를 올리지 않고 자리도 남기지 않는다', async () => {
    readyMock.mockResolvedValue(false);
    const view = await render(<LfBannerAd enabled />);
    await settle();
    expect(readyMock).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('adaptive-banner')).toBeNull();
    expect(view.toJSON()).toBeNull();
  });

  test('관문이 열리기 전에는 아무것도 없고, 열린 뒤 로드 전에는 높이 0, 로드가 끝나면 노출한다', async () => {
    let open: ((ok: boolean) => void) | undefined;
    readyMock.mockImplementation(async () => await new Promise<boolean>((resolve) => { open = resolve; }));
    const view = await render(<LfBannerAd enabled />);
    await settle();
    expect(view.toJSON()).toBeNull();
    await act(async () => open?.(true));
    await settle();
    expect(view.getByTestId('adaptive-banner')).toBeTruthy();
    expect(view.getByTestId('lf-banner-ad').props.style).toMatchObject({ height: 0 });
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'load' })));
    expect(view.getByTestId('lf-banner-ad').props.style).toBeUndefined();
  });

  test('no-fill 또는 로드 실패 시 슬롯 자체를 제거한다', async () => {
    const view = await render(<LfBannerAd enabled />);
    await settle();
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'fail' })));
    expect(view.toJSON()).toBeNull();
  });
});
