import { buildLegalDocumentUrl, type LegalDocumentKind } from '@littlefinger/shared';
import { Linking } from 'react-native';

interface LegalNativeDeps {
  baseUrl: string;
  openUrl: (url: string) => Promise<unknown>;
}

export async function openLegalDocument(
  kind: LegalDocumentKind,
  deps: LegalNativeDeps = {
    baseUrl: process.env.EXPO_PUBLIC_WEB_BASE_URL ?? '',
    openUrl: Linking.openURL,
  },
): Promise<void> {
  await deps.openUrl(buildLegalDocumentUrl(deps.baseUrl, kind));
}
