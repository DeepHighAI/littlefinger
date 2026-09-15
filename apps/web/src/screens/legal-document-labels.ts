import type { Localized } from '@littlefinger/shared';

// 버전 줄은 문서 본문이 아니라 화면 안내이며 정적 HTML 도 같은 카탈로그를 쓴다.
const ko = {
  versionLine: (version: string, effectiveDate: string) => `버전 ${version} · 시행일 ${effectiveDate}`,
};
const en = {
  versionLine: (version: string, effectiveDate: string) => `Version ${version} · Effective ${effectiveDate}`,
} satisfies typeof ko;

export const LEGAL_DOCUMENT_LABEL: Localized<typeof ko> = { ko, en };
