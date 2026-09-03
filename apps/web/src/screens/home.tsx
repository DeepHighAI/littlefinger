import { buildPlayStoreUrl } from '@littlefinger/shared';
import { Link } from 'react-router-dom';

import { useLabels } from '../lib/locale.tsx';
import { ROUTE } from '../routes.ts';
import { HOME_LABEL } from './home-labels.ts';

/**
 * 공개 홈(/) — 인증·토큰 없이 열리는 페이지. Google OAuth 브랜드 인증의 홈페이지 검사 대상이라
 * 로그인 버튼을 두지 않고, 법무 문서와 같은 lf-legal 레이아웃으로 앱의 목적만 설명한다.
 */
export function Home(): React.JSX.Element {
  const labels = useLabels(HOME_LABEL);

  return (
    <main className="lf-legal">
      <article className="lf-legal__document">
        <h1>{labels.name}</h1>
        <p>
          <strong>{labels.tagline}</strong> · {labels.motto}
        </p>
        {labels.purpose.map((text) => <p key={text}>{text}</p>)}
        <p>
          <a
            className="lf-btn lf-btn--filled"
            href={buildPlayStoreUrl({ source: 'web', medium: 'home' })}
          >
            {labels.playLink}
          </a>
        </p>
        <section>
          <h2>{labels.howTitle}</h2>
          <ul>
            {labels.how.map((text) => <li key={text}>{text}</li>)}
          </ul>
        </section>
        <section>
          <h2>{labels.principlesTitle}</h2>
          <ul>
            {labels.principles.map((text) => <li key={text}>{text}</li>)}
          </ul>
        </section>
        <section>
          <h2>{labels.linksTitle}</h2>
          <p>
            <Link to={ROUTE.privacy}>{labels.privacyLink}</Link>
            {' · '}
            <Link to={ROUTE.terms}>{labels.termsLink}</Link>
            {' · '}
            <Link to={ROUTE.accountDeletion}>{labels.accountDeletionLink}</Link>
          </p>
          <p>{labels.contact}</p>
          <p>{labels.company}</p>
        </section>
      </article>
    </main>
  );
}
