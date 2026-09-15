import { buildPlayStoreUrl } from '../../../../packages/shared/src/app-links.ts';
import { escapeHtml } from './home-static.ts';
import { PROMISE_GUIDE_LABEL } from './promise-guide-labels.ts';

export const PROMISE_GUIDE_PATH = '/guides/promise-record';
export const PROMISE_GUIDE_URL = `https://littlefinger-app.web.app${PROMISE_GUIDE_PATH}`;
export const PROMISE_GUIDE_STORE_URL = buildPlayStoreUrl({
  source: 'web', medium: 'guide', campaign: 'promise_record',
});

// 검색 도구가 JavaScript 없이도 실제 화면과 같은 설명을 읽게 한다.
export function renderPromiseGuideStaticMarkup(): string {
  const l = PROMISE_GUIDE_LABEL.ko;
  const items = (values: readonly string[]) => values.map((v) => `<li>${escapeHtml(v)}</li>`).join('');
  return '<main class="lf-legal"><article class="lf-legal__document">' +
    `<h1>${escapeHtml(l.title)}</h1><p>${escapeHtml(l.reviewed)}</p><p>${escapeHtml(l.intro)}</p>` +
    `<section><h2>${escapeHtml(l.prepareTitle)}</h2><ul>${items(l.checklist)}</ul></section>` +
    `<section><h2>${escapeHtml(l.exampleTitle)}</h2><p>${escapeHtml(l.example)}</p></section>` +
    `<section><h2>${escapeHtml(l.flowTitle)}</h2><ol>${items(l.steps)}</ol></section>` +
    `<section><h2>${escapeHtml(l.limitsTitle)}</h2><p>${escapeHtml(l.limits)}</p></section>` +
    `<p><a class="lf-btn lf-btn--filled" href="${escapeHtml(PROMISE_GUIDE_STORE_URL)}">${escapeHtml(l.store)}</a></p>` +
    `<p><a href="/">${escapeHtml(l.home)}</a> · <a href="/legal/privacy">${escapeHtml(l.privacy)}</a></p>` +
    '</article></main>';
}

export function renderPromiseGuideHtml(shell: string): string {
  const l = PROMISE_GUIDE_LABEL.ko;
  return shell
    .replace(/<title>[^<]*<\/title>/u, `<title>${escapeHtml(l.title)}</title>`)
    .replace(/(<meta\s+(?:name="description"|property="og:description")\s+content=")[^"]*("\s*\/>)/gu, `$1${escapeHtml(l.description)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*/u, `$1${escapeHtml(l.title)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/u, `$1${PROMISE_GUIDE_URL}`)
    .replace('<div id="root"></div>', `<div id="root">${renderPromiseGuideStaticMarkup()}</div>`);
}
