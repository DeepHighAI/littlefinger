import {
  LEGAL_DISCLAIMER_BY_LOCALE,
  LEGAL_DOCUMENTS,
  type LegalDocumentKind,
  type Localized,
} from '@littlefinger/shared';

import {
  LEGAL_DRAFT_CONTENT_BY_LOCALE,
  LEGAL_DRAFT_LABELS_BY_LOCALE,
} from '../legal/legal-content.ts';
import { useLabels, useLocale } from '../lib/locale.tsx';

// 버전 줄은 문서 본문이 아니라 화면 크롬이다 — 문서 카탈로그가 아닌 여기서 로케일을 탄다.
const VERSION_LINE: Localized<(version: string, effectiveDate: string) => string> = {
  ko: (version, effectiveDate) => `버전 ${version} · 시행 예정일 ${effectiveDate}`,
  en: (version, effectiveDate) => `Version ${version} · Planned effective date ${effectiveDate}`,
};

export function LegalDocument({ kind }: { kind: LegalDocumentKind }): React.JSX.Element {
  const { locale } = useLocale();
  const labels = useLabels(LEGAL_DRAFT_LABELS_BY_LOCALE);
  const metadata = LEGAL_DOCUMENTS[kind];
  const document = LEGAL_DRAFT_CONTENT_BY_LOCALE[locale][kind];

  return (
    <main className="lf-legal">
      <article className="lf-legal__document">
        <p className="lf-legal__draft">{labels.draftBadge}</p>
        <h1>{document.title}</h1>
        <p className="lf-legal__notice">{labels.draftNotice}</p>
        <p className="lf-legal__version">
          {VERSION_LINE[locale](metadata.version, metadata.effective_date)}
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
