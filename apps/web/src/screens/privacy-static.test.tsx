// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

import { LegalDocument } from './legal-document.tsx';
import { renderPrivacyStaticMarkup } from './privacy-static.ts';

it('정적 개인정보처리방침은 화면과 동일한 문구·버전·마크업을 제공한다', () => {
  const staticDocument = document.createElement('div');
  staticDocument.innerHTML = renderPrivacyStaticMarkup();
  const renderedDocument = document.createElement('div');
  renderedDocument.innerHTML = renderToStaticMarkup(<LegalDocument kind="PRIVACY" />);
  expect(staticDocument.innerHTML).toBe(renderedDocument.innerHTML);
});
