import { LEGAL_DOCUMENTS } from '../../../../packages/shared/src/legal.ts';
import { LEGAL_DISCLAIMER_BY_LOCALE } from '../../../../packages/shared/src/promise.ts';
import { LEGAL_CONTENT_BY_LOCALE } from '../legal/legal-content.ts';
import { escapeHtml } from './home-static.ts';
import { LEGAL_DOCUMENT_LABEL } from './legal-document-labels.ts';

// 한국어 정본을 재사용해 JavaScript 없는 검토 도구에도 동일한 법무 문서를 제공한다.
export function renderPrivacyStaticMarkup(): string {
  const document = LEGAL_CONTENT_BY_LOCALE.ko.PRIVACY;
  const metadata = LEGAL_DOCUMENTS.PRIVACY;
  return (
    '<main class="lf-legal"><article class="lf-legal__document">' +
    `<h1>${escapeHtml(document.title)}</h1>` +
    `<p class="lf-legal__version">${escapeHtml(LEGAL_DOCUMENT_LABEL.ko.versionLine(metadata.version, metadata.effective_date))}</p>` +
    document.sections.map((section) =>
      `<section><h2>${escapeHtml(section.title)}</h2>` +
      section.paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('') +
      '</section>',
    ).join('') +
    `<p class="lf-disclaimer">${escapeHtml(LEGAL_DISCLAIMER_BY_LOCALE.ko)}</p>` +
    '</article></main>'
  );
}
