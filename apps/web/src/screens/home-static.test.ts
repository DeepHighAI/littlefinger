import { buildPlayStoreUrl } from '@littlefinger/shared';
import { describe, expect, it } from 'vitest';

import { ROUTE } from '../routes.ts';
import { HOME_LABEL } from './home-labels.ts';
import { HOME_STATIC_LINKS, renderHomeStaticMarkup } from './home-static.ts';

describe('공개 홈 정적 HTML — JS 없는 크롤러가 보는 첫 화면', () => {
  it('앱 이름·목적·기능을 담고 로그인 컨트롤이 없다', () => {
    const html = renderHomeStaticMarkup();
    expect(html).toContain('<h1>리틀핑거</h1>');
    expect(html).toContain('상호 약속 관리 서비스');
    for (const text of HOME_LABEL.ko.how) expect(html).toContain(`<li>${text.replaceAll('"', '&quot;')}</li>`);
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<script');
  });

  it('리터럴 경로는 ROUTE·공유 스토어 URL 빌더와 같다 — vite.config 가 shared 를 못 읽어 따로 적었다', () => {
    expect(HOME_STATIC_LINKS.privacy).toBe(ROUTE.privacy);
    expect(HOME_STATIC_LINKS.terms).toBe(ROUTE.terms);
    expect(HOME_STATIC_LINKS.accountDeletion).toBe(ROUTE.accountDeletion);
    expect(HOME_STATIC_LINKS.playStore).toBe(buildPlayStoreUrl({ source: 'web', medium: 'home' }));
  });
});
