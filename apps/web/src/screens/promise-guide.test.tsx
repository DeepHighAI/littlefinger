// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

import { PromiseGuide } from './promise-guide.tsx';
import { PROMISE_GUIDE_URL, renderPromiseGuideHtml, renderPromiseGuideStaticMarkup } from './promise-guide-static.ts';

it('검색용 정적 본문과 실제 안내 화면은 같다', () => {
  const staticRoot = document.createElement('div');
  staticRoot.innerHTML = renderPromiseGuideStaticMarkup();
  const reactRoot = document.createElement('div');
  reactRoot.innerHTML = renderToStaticMarkup(<PromiseGuide />);
  expect(staticRoot.innerHTML).toBe(reactRoot.innerHTML);
});

it('빌드 문서는 고유 제목·설명·공유 URL과 실제 본문을 제공한다', () => {
  const html = renderPromiseGuideHtml(readFileSync(resolve(__dirname, '../../app.html'), 'utf8'));
  const doc = new DOMParser().parseFromString(html, 'text/html');
  expect(doc.title).toContain('둘이 정한 약속');
  expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toContain('확인 기준');
  expect(doc.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(PROMISE_GUIDE_URL);
  expect(doc.querySelector('h1')?.textContent).toContain('둘이 정한 약속');
  expect(doc.querySelector('a[href*="play.google.com"]')?.getAttribute('href')).toContain('utm_campaign=promise_record');
});
