import { openLegalDocument } from './legal-native.ts';

describe('native legal document links', () => {
  test('opens the terms page from the configured web origin', async () => {
    const openUrl = jest.fn().mockResolvedValue(undefined);

    await openLegalDocument('TERMS', {
      baseUrl: 'https://littlefinger.pages.dev/',
      openUrl,
    });

    expect(openUrl).toHaveBeenCalledWith('https://littlefinger.pages.dev/legal/terms');
  });

  test('rejects a missing web origin without opening anything', async () => {
    const openUrl = jest.fn().mockResolvedValue(undefined);
    await expect(openLegalDocument('PRIVACY', { baseUrl: '', openUrl })).rejects.toThrow(
      'INVALID_LEGAL_BASE_URL',
    );
    expect(openUrl).not.toHaveBeenCalled();
  });
});
