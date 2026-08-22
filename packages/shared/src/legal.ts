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

/**
 * 확정판(PO 2026-08-22) — 실제 사업자 정보(주식회사 딥하이)가 들어간 배포판. 외부 법무 검토 완료.
 * .2 는 Codex 검증이 잡은 사실관계 수정(웹 세션 저장소 고지, 닉네임 선택 항목 분류),
 * .3 은 개인정보 보호책임자 이메일(task@deephigh.ai) 추가.
 * 버전 문자열은 DB 의 `lf_current_terms_version()`·`lf_current_privacy_version()` 과 항상
 * 함께 올린다 — 드리프트는 supabase/tests/user-provisioning.test.ts 가 잡는다.
 */
export const LEGAL_DOCUMENTS = {
  TERMS: {
    kind: 'TERMS',
    status: 'FINAL',
    version: '2026-08-22.3',
    path: '/legal/terms',
    effective_date: '2026-08-22',
  },
  PRIVACY: {
    kind: 'PRIVACY',
    status: 'FINAL',
    version: '2026-08-22.3',
    path: '/legal/privacy',
    effective_date: '2026-08-22',
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
