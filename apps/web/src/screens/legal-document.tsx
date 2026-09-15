import {
  LEGAL_DISCLAIMER_BY_LOCALE,
  LEGAL_DOCUMENTS,
  type LegalDocumentKind,
} from '@littlefinger/shared';

import { LEGAL_CONTENT_BY_LOCALE } from '../legal/legal-content.ts';
import { useLocale } from '../lib/locale.tsx';
import { LEGAL_DOCUMENT_LABEL } from './legal-document-labels.ts';

export function LegalDocument({ kind }: { kind: LegalDocumentKind }): React.JSX.Element {
  const { locale } = useLocale();
  const metadata = LEGAL_DOCUMENTS[kind];
  const document = LEGAL_CONTENT_BY_LOCALE[locale][kind];

  return (
    <main className="lf-legal">
      <article className="lf-legal__document">
        <h1>{document.title}</h1>
        <p className="lf-legal__version">
          {LEGAL_DOCUMENT_LABEL[locale].versionLine(metadata.version, metadata.effective_date)}
        </p>
        {document.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((text) => <p key={text}>{text}</p>)}
          </section>
        ))}
        <p className="lf-disclaimer">{LEGAL_DISCLAIMER_BY_LOCALE[locale]}</p>
      </article>
    </main>
  );
}
