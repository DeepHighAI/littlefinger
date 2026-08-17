import { getMobileSupabaseClient } from './supabase-native.ts';
import { readAdsEnabled } from './ads-config-native.ts';

jest.mock('./supabase-native.ts', () => ({ getMobileSupabaseClient: jest.fn() }));

const getClientMock = jest.mocked(getMobileSupabaseClient);

describe('native F-12 app config query', () => {
  test('queries the public config row by exact key and projects only value', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: { value: true }, error: null });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });
    getClientMock.mockReturnValue({ from } as never);

    await expect(readAdsEnabled()).resolves.toBe(true);
    expect(from).toHaveBeenCalledWith('app_configs');
    expect(select).toHaveBeenCalledWith('value');
    expect(eq).toHaveBeenCalledWith('key', 'ads_enabled');
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });
});
