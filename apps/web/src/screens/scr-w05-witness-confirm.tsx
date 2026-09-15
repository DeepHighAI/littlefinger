import { APP_SCHEME, ANDROID_PACKAGE_NAME, buildPlayStoreUrl } from '@littlefinger/shared';
import { useParams } from 'react-router-dom';
import { useLabels } from '../lib/locale.tsx';
import { PinkyBadge } from './scr-w01-invite-landing.tsx';
import { SCR_W01_LABEL } from './scr-w01-labels.ts';
import { SCR_W05_LABEL } from './scr-w05-labels.ts';

export function ScrW05WitnessConfirm(): React.JSX.Element {
  const { promise_id = '' } = useParams<{ promise_id: string }>();
  const L = useLabels(SCR_W01_LABEL); const W = useLabels(SCR_W05_LABEL);
  const store = buildPlayStoreUrl({ source: 'witness', medium: 'web', campaign: 'app-handoff' });
  const android = /Android/iu.test(navigator.userAgent);
  const uri = `intent://witness/${encodeURIComponent(promise_id)}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE_NAME};S.browser_fallback_url=${encodeURIComponent(store)};end`;
  return <div className="lf-screen lf-invite-landing">
    <main className="lf-screen__body lf-screen__body--web lf-invite-landing__body">
      <PinkyBadge /><h1 className="lf-title">{W.title}</h1><p className="lf-body--secondary">{W.role}</p>
    </main>
    <section className="lf-screen__actions lf-screen__actions--web lf-invite-landing__actions">
      <a className="lf-btn lf-btn--filled lf-btn--cta lf-btn--block" href={android ? uri : store}>{L.continueInApp}</a>
      <p className="lf-caption lf-text-center">{android ? <a href={store}>{L.installHint}</a> : L.androidHint}</p>
    </section>
  </div>;
}
