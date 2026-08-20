import type { Localized } from './i18n.ts';
import type { IsoDate } from './promise.ts';

export type LegalDocumentStatus = 'DRAFT' | 'FINAL';
export type LegalDocumentKind = 'TERMS' | 'PRIVACY';

export interface LegalDocumentMetadata {
  kind: LegalDocumentKind;
  status: LegalDocumentStatus;
  version: string;
  path: '/legal/terms' | '/legal/privacy';
  effective_date: IsoDate;
}

export const LEGAL_DOCUMENTS = {
  TERMS: {
    kind: 'TERMS',
    status: 'DRAFT',
    version: '2026-08-16-draft.1',
    path: '/legal/terms',
    effective_date: '2026-08-16',
  },
  PRIVACY: {
    kind: 'PRIVACY',
    status: 'DRAFT',
    version: '2026-08-16-draft.1',
    path: '/legal/privacy',
    effective_date: '2026-08-16',
  },
} as const satisfies Record<LegalDocumentKind, LegalDocumentMetadata>;

export const LEGAL_DOCUMENT_LABELS = {
  TERMS: '이용약관',
  PRIVACY: '개인정보 처리방침',
} as const satisfies Record<LegalDocumentKind, string>;

export const LEGAL_DOCUMENT_LABELS_BY_LOCALE: Localized<Record<LegalDocumentKind, string>> = {
  ko: LEGAL_DOCUMENT_LABELS,
  en: { TERMS: 'Terms of Service', PRIVACY: 'Privacy Policy' },
};

export function legalDocumentPath(kind: LegalDocumentKind): LegalDocumentMetadata['path'] {
  return LEGAL_DOCUMENTS[kind].path;
}

export function buildLegalDocumentUrl(baseUrl: string, kind: LegalDocumentKind): string {
  let url: URL;
  try {
    url = new URL(legalDocumentPath(kind), baseUrl);
  } catch {
    throw new Error('INVALID_LEGAL_BASE_URL');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('INVALID_LEGAL_BASE_URL');
  }
  return url.toString();
}
