import { describe, expect, it } from 'vitest';

import {
  LEGAL_DOCUMENT_LABELS,
  LEGAL_DOCUMENTS,
  buildLegalDocumentUrl,
  legalDocumentPath,
} from './legal.ts';

describe('legal metadata', () => {
  it('publishes the final versions and paths', () => {
    expect(LEGAL_DOCUMENTS).toEqual({
      TERMS: {
        kind: 'TERMS',
        status: 'FINAL',
        version: '2026-08-30.1',
        path: '/legal/terms',
        effective_date: '2026-08-30',
      },
      PRIVACY: {
        kind: 'PRIVACY',
        status: 'FINAL',
        version: '2026-08-30.1',
        path: '/legal/privacy',
        effective_date: '2026-08-30',
      },
    });
    expect(LEGAL_DOCUMENT_LABELS).toEqual({
      TERMS: '이용약관',
      PRIVACY: '개인정보 처리방침',
    });
  });

  it('builds canonical HTTP URLs', () => {
    expect(buildLegalDocumentUrl('https://littlefinger-app.web.app/', 'TERMS')).toBe(
      'https://littlefinger-app.web.app/legal/terms',
    );
    expect(buildLegalDocumentUrl('http://localhost:4174/promises', 'PRIVACY')).toBe(
      'http://localhost:4174/legal/privacy',
    );
    expect(legalDocumentPath('PRIVACY')).toBe('/legal/privacy');
  });

  it.each(['', 'javascript:alert(1)', 'ftp://littlefinger.example']) (
    'rejects an unsafe base URL: %s',
    (baseUrl) => {
      expect(() => buildLegalDocumentUrl(baseUrl, 'TERMS')).toThrow('INVALID_LEGAL_BASE_URL');
    },
  );
});
