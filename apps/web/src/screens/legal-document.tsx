import { LEGAL_DISCLAIMER, LEGAL_DOCUMENTS, type LegalDocumentKind } from '@littlefinger/shared';

import { LEGAL_DRAFT_CONTENT, LEGAL_DRAFT_LABELS } from '../legal/legal-content.ts';

export function LegalDocument({ kind }: { kind: LegalDocumentKind }): React.JSX.Element {
  const metadata = LEGAL_DOCUMENTS[kind];
  const document = LEGAL_DRAFT_CONTENT[kind];

  return (
    <main className="lf-legal">
      <article className="lf-legal__document">
        <p className="lf-legal__draft">{LEGAL_DRAFT_LABELS.draftBadge}</p>
        <h1>{document.title}</h1>
        <p className="lf-legal__notice">{LEGAL_DRAFT_LABELS.draftNotice}</p>
        <p className="lf-legal__version">
          {`버전 ${metadata.version} · 시행 예정일 ${metadata.effective_date}`}
        </p>
        {document.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((text) => <p key={text}>{text}</p>)}
          </section>
        ))}
        <p className="lf-disclaimer">{LEGAL_DISCLAIMER}</p>
      </article>
    </main>
  );
}
