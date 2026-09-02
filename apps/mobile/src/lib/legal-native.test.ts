import { Linking } from 'react-native';

import { openLegalDocument } from './legal-native.ts';

describe('native legal document links', () => {
  test('opens the terms page from the configured web origin', async () => {
    const openUrl = jest.fn().mockResolvedValue(undefined);

    await openLegalDocument('TERMS', {
      baseUrl: 'https://littlefinger-app.web.app/',
      openUrl,
    });

    expect(openUrl).toHaveBeenCalledWith('https://littlefinger-app.web.app/legal/terms');
  });

  test('rejects a missing web origin without opening anything', async () => {
    const openUrl = jest.fn().mockResolvedValue(undefined);
    await expect(openLegalDocument('PRIVACY', { baseUrl: '', openUrl })).rejects.toThrow(
      'INVALID_LEGAL_BASE_URL',
    );
    expect(openUrl).not.toHaveBeenCalled();
  });

  test('keeps the React Native Linking receiver when using production defaults', async () => {
    const originalBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL;
    process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://littlefinger-app.web.app';
    const openUrl = jest.spyOn(Linking, 'openURL').mockImplementation(function (this: typeof Linking, url) {
      expect(this).toBe(Linking);
      expect(url).toBe('https://littlefinger-app.web.app/legal/terms');
      return Promise.resolve();
    });

    try {
      await openLegalDocument('TERMS');
      expect(openUrl).toHaveBeenCalledTimes(1);
    } finally {
      openUrl.mockRestore();
      if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_WEB_BASE_URL;
      else process.env.EXPO_PUBLIC_WEB_BASE_URL = originalBaseUrl;
    }
  });
});
