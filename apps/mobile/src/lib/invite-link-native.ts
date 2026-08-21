import * as WebBrowser from 'expo-web-browser';

import { buildInviteWebUrl } from '@littlefinger/shared';

export async function openInviteInBrowserNative(token: string): Promise<void> {
  const url = buildInviteWebUrl(process.env['EXPO_PUBLIC_WEB_BASE_URL'] ?? '', token);
  if (url === null) throw new Error('Invite web URL is unavailable.');
  await WebBrowser.openBrowserAsync(url);
}
