import { Link } from 'react-router-dom';

import { useLabels } from '../lib/locale.tsx';
import { ROUTE } from '../routes.ts';
import { ACCOUNT_DELETION_LABEL } from './account-deletion-labels.ts';

/**
 * 계정 삭제 안내 — 인증·토큰 없이 열리는 공개 페이지.
 * Play 데이터 보안 양식에 이 URL 을 제출한다. 법무 문서와 같은 lf-legal 레이아웃을 쓴다.
 */
export function AccountDeletion(): React.JSX.Element {
  const labels = useLabels(ACCOUNT_DELETION_LABEL);

  return (
    <main className="lf-legal">
      <article className="lf-legal__document">
        <h1>{labels.title}</h1>
        <p>{labels.intro}</p>
        {labels.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((text) => <p key={text}>{text}</p>)}
          </section>
        ))}
        <p>
          <Link to={ROUTE.privacy}>{labels.privacyLink}</Link>
        </p>
      </article>
    </main>
  );
}
