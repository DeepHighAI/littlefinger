import { getMobileSupabaseClient } from './supabase-native.ts';
import { loadMinimumAppVersionNative } from './minimum-app-version-native.ts';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '0.1.0' } },
}));
jest.mock('expo-linking', () => ({ openURL: jest.fn() }));
jest.mock('./supabase-native.ts', () => ({ getMobileSupabaseClient: jest.fn() }));

const getClientMock = jest.mocked(getMobileSupabaseClient);

describe('EC-I04 native min_app_version query', () => {
  test('Supabase config row value is compared with the installed version', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: { value: '0.1.1' }, error: null });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });
    getClientMock.mockReturnValue({ from } as never);

    await expect(loadMinimumAppVersionNative()).resolves.toBe(true);
    expect(from).toHaveBeenCalledWith('app_configs');
    expect(select).toHaveBeenCalledWith('value');
    expect(eq).toHaveBeenCalledWith('key', 'min_app_version');
  });
});
