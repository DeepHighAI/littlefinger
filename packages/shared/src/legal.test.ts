import { describe, expect, it } from 'vitest';

import { LEGAL_DOCUMENTS, buildLegalDocumentUrl, legalDocumentPath } from './legal.ts';

describe('draft legal metadata', () => {
  it('publishes the approved draft versions and paths', () => {
    expect(LEGAL_DOCUMENTS).toEqual({
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
    });
  });

  it('builds canonical HTTP URLs', () => {
    expect(buildLegalDocumentUrl('https://littlefinger.pages.dev/', 'TERMS')).toBe(
      'https://littlefinger.pages.dev/legal/terms',
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
