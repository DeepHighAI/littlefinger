import { ADS_ENABLED_DEFAULT } from '@littlefinger/shared';

import { adsEnabledFrom, loadAdsEnabled } from './ads-config.ts';

describe('F-12 ads_enabled config boundary', () => {
  test.each([
    [true, true],
    [false, false],
    ['true', ADS_ENABLED_DEFAULT],
    [1, ADS_ENABLED_DEFAULT],
    [null, ADS_ENABLED_DEFAULT],
    [{ enabled: true }, ADS_ENABLED_DEFAULT],
  ])('accepts only a literal boolean: %p', (value, expected) => {
    expect(adsEnabledFrom(value)).toBe(expected);
  });

  test('reads only ads_enabled and returns its strict boolean value', async () => {
    const read = jest.fn().mockResolvedValue({ data: { value: true }, error: null });

    await expect(loadAdsEnabled({ read })).resolves.toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith('ads_enabled');
  });

  test.each([
    [{ data: null, error: null }],
    [{ data: { value: 'true' }, error: null }],
    [{ data: { value: true }, error: new Error('network') }],
  ])('fails closed without blocking home: %p', async (result) => {
    const read = jest.fn().mockResolvedValue(result);
    await expect(loadAdsEnabled({ read })).resolves.toBe(ADS_ENABLED_DEFAULT);
  });

  test('fails closed when the config read rejects', async () => {
    const read = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(loadAdsEnabled({ read })).resolves.toBe(ADS_ENABLED_DEFAULT);
  });
});
