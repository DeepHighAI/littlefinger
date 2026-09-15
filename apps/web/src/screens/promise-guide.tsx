import { useLabels } from '../lib/locale.tsx';
import { PROMISE_GUIDE_LABEL } from './promise-guide-labels.ts';
import { PROMISE_GUIDE_STORE_URL } from './promise-guide-static.ts';

export function PromiseGuide(): React.JSX.Element {
  const l = useLabels(PROMISE_GUIDE_LABEL);
  return (
    <main className="lf-legal"><article className="lf-legal__document">
      <h1>{l.title}</h1><p>{l.reviewed}</p><p>{l.intro}</p>
      <section><h2>{l.prepareTitle}</h2><ul>{l.checklist.map((v) => <li key={v}>{v}</li>)}</ul></section>
      <section><h2>{l.exampleTitle}</h2><p>{l.example}</p></section>
      <section><h2>{l.flowTitle}</h2><ol>{l.steps.map((v) => <li key={v}>{v}</li>)}</ol></section>
      <section><h2>{l.limitsTitle}</h2><p>{l.limits}</p></section>
      <p><a className="lf-btn lf-btn--filled" href={PROMISE_GUIDE_STORE_URL}>{l.store}</a></p>
      {/* 페이지별 메타 정보도 새 문서에서 읽도록 공개 안내는 전체 탐색한다. */}
      <p><a href="/">{l.home}</a>{' · '}<a href="/legal/privacy">{l.privacy}</a></p>
    </article></main>
  );
}
