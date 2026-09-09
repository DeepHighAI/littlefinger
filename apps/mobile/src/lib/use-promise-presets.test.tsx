import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import type { PromiseFeaturedPresets } from '@littlefinger/shared';

import { DEFAULT_FEATURED_PRESETS } from './promise-draft.ts';
import { readFeaturedPresets, subscribeFeaturedPresets } from './promise-presets-native.ts';
import { usePromisePresets } from './use-promise-presets.ts';

jest.mock('./promise-presets-native.ts', () => ({
  readFeaturedPresets: jest.fn(),
  subscribeFeaturedPresets: jest.fn(() => jest.fn()),
}));

test('loads remote bilingual choices after initially showing safe defaults', async () => {
  const remote = {
    ...DEFAULT_FEATURED_PRESETS,
    reward: { ko: ['첫 번째 보상', '두 번째 보상', '세 번째 보상'], en: ['First', 'Second', 'Third'] },
  };
  jest.mocked(readFeaturedPresets).mockResolvedValue(remote);
  const view = await renderHook(() => usePromisePresets());
  await waitFor(() => expect(view.result.current).toEqual(remote));
});

test.each(['network', 'invalid'])('keeps usable defaults on %s failure', async (kind) => {
  if (kind === 'network') jest.mocked(readFeaturedPresets).mockRejectedValue(new Error('offline'));
  else jest.mocked(readFeaturedPresets).mockResolvedValue(null);
  const view = await renderHook(() => usePromisePresets());
  await act(async () => { await Promise.resolve(); });
  expect(view.result.current).toEqual(DEFAULT_FEATURED_PRESETS);
});

test('receives changes on the open screen and retains the last valid value on failure', async () => {
  jest.mocked(readFeaturedPresets).mockResolvedValue(DEFAULT_FEATURED_PRESETS);
  const view = await renderHook(() => usePromisePresets());
  const refresh = jest.mocked(subscribeFeaturedPresets).mock.calls.at(-1)?.[0];
  const remote = {
    ...DEFAULT_FEATURED_PRESETS,
    reward: { ko: ['새 보상 하나', '새 보상 둘', '새 보상 셋'], en: ['New A', 'New B', 'New C'] },
  };
  jest.mocked(readFeaturedPresets).mockResolvedValue(remote);
  await act(async () => { refresh?.(); });
  expect(view.result.current).toEqual(remote);
  jest.mocked(readFeaturedPresets).mockResolvedValue(null);
  await act(async () => { refresh?.(); });
  expect(view.result.current).toEqual(remote);
});

test('an older request cannot overwrite a newer remote change', async () => {
  let resolveOld: (value: PromiseFeaturedPresets) => void = () => {};
  jest.mocked(readFeaturedPresets).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
  const view = await renderHook(() => usePromisePresets());
  const refresh = jest.mocked(subscribeFeaturedPresets).mock.calls.at(-1)?.[0];
  const remote = {
    ...DEFAULT_FEATURED_PRESETS,
    penalty: { ko: ['새 벌칙 하나', '새 벌칙 둘', '새 벌칙 셋'], en: ['New A', 'New B', 'New C'] },
  };
  jest.mocked(readFeaturedPresets).mockResolvedValue(remote);
  await act(async () => { refresh?.(); });
  await act(async () => { resolveOld(DEFAULT_FEATURED_PRESETS); });
  expect(view.result.current).toEqual(remote);
});

test('refreshes on foreground and releases the realtime subscription on unmount', async () => {
  const listener = jest.spyOn(AppState, 'addEventListener');
  const unsubscribe = jest.fn();
  jest.mocked(subscribeFeaturedPresets).mockReturnValueOnce(unsubscribe);
  jest.mocked(readFeaturedPresets).mockResolvedValue(DEFAULT_FEATURED_PRESETS);
  const view = await renderHook(() => usePromisePresets());
  const calls = jest.mocked(readFeaturedPresets).mock.calls.length;
  await act(async () => { listener.mock.calls.at(-1)?.[1]('active'); });
  expect(readFeaturedPresets).toHaveBeenCalledTimes(calls + 1);
  await view.unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  listener.mockRestore();
});
