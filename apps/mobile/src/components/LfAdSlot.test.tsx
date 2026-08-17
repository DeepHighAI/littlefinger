import { act, cleanup, render } from '@testing-library/react-native';
import {
  destroyNativeAd,
  loadNativeAd,
  type LittlefingerNativeAd,
} from '../lib/admob-native.tsx';
import { LfAdSlot } from './LfAdSlot';

jest.mock('../lib/admob-native.tsx', () => ({
  destroyNativeAd: jest.fn(),
  loadNativeAd: jest.fn(),
  NativeAdCard: ({ ad }: { ad: LittlefingerNativeAd }) => {
    const React = jest.requireActual('react') as typeof import('react');
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return React.createElement(View, { testID: `native-ad-${String(ad)}` });
  },
}), { virtual: true });

const loadNativeAdMock = jest.mocked(loadNativeAd);
const destroyNativeAdMock = jest.mocked(destroyNativeAd);

async function settle(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 4; index += 1) await Promise.resolve();
  });
}

describe('LfAdSlot', () => {
  beforeEach(() => {
    loadNativeAdMock.mockReset();
    destroyNativeAdMock.mockReset();
  });

  afterEach(async () => await cleanup());

  test('disabled means no native work, no view, and no reserved space', async () => {
    const view = await render(<LfAdSlot enabled={false} />);
    expect(view.toJSON()).toBeNull();
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
    expect(loadNativeAdMock).not.toHaveBeenCalled();
  });

  test('an enabled slot stays absent until a consent-safe native ad is loaded', async () => {
    let resolveAd!: (ad: LittlefingerNativeAd | null) => void;
    loadNativeAdMock.mockReturnValue(
      new Promise((resolve) => {
        resolveAd = resolve;
      }),
    );
    const view = await render(<LfAdSlot enabled />);
    expect(view.toJSON()).toBeNull();

    await act(async () => resolveAd('loaded' as unknown as LittlefingerNativeAd));
    expect(view.getByTestId('lf-ad-slot')).toBeTruthy();
    expect(view.getByTestId('native-ad-loaded')).toBeTruthy();
  });

  test.each([
    ['consent denied', () => Promise.resolve(null)],
    ['consent or load failure', () => Promise.reject(new Error('ad unavailable'))],
  ])('%s remains fail-closed', async (_name, result) => {
    loadNativeAdMock.mockReturnValue(result());
    const view = await render(<LfAdSlot enabled />);
    await settle();
    expect(view.toJSON()).toBeNull();
  });

  test('destroys a loaded ad on unmount', async () => {
    const ad = 'loaded' as unknown as LittlefingerNativeAd;
    loadNativeAdMock.mockResolvedValue(ad);
    const view = await render(<LfAdSlot enabled />);
    await settle();
    await view.unmount();
    expect(destroyNativeAdMock).toHaveBeenCalledTimes(1);
    expect(destroyNativeAdMock).toHaveBeenCalledWith(ad);
  });

  test('an ad resolved after unmount is destroyed without mounting UI', async () => {
    let resolveAd!: (ad: LittlefingerNativeAd | null) => void;
    loadNativeAdMock.mockReturnValue(new Promise((resolve) => { resolveAd = resolve; }));
    const view = await render(<LfAdSlot enabled />);
    await view.unmount();

    await act(async () => resolveAd('late' as unknown as LittlefingerNativeAd));
    expect(destroyNativeAdMock).toHaveBeenCalledWith('late');
  });

  test('disabling destroys and clears the previous ad before a later re-enable', async () => {
    const first = 'first' as unknown as LittlefingerNativeAd;
    let resolveSecond!: (ad: LittlefingerNativeAd | null) => void;
    loadNativeAdMock
      .mockResolvedValueOnce(first)
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }));
    const view = await render(<LfAdSlot enabled />);
    await settle();
    expect(view.getByTestId('native-ad-first')).toBeTruthy();

    await view.rerender(<LfAdSlot enabled={false} />);
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
    expect(destroyNativeAdMock).toHaveBeenCalledWith(first);

    await view.rerender(<LfAdSlot enabled />);
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
    await act(async () => resolveSecond(null));
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
  });
});
