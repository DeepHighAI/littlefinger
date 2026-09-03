import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

/**
 * CLS·SEO 가드 (F 항목 K, 2026-08-20).
 *
 * 수락 웹은 카카오톡 인앱 브라우저에서 3초 예산으로 열린다. 폰트가 CSS 뒤에서야
 * 발견되면 늦게 스왑되며 레이아웃이 밀리고(CLS), 메타 태그가 없으면 카카오톡 공유
 * 미리보기가 빈 카드가 된다. 이 파일은 그 두 가지가 조용히 사라지는 것을 막는다.
 */

const WEB_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(WEB_ROOT, '../..');
const INDEX_HTML = readFileSync(resolve(WEB_ROOT, 'index.html'), 'utf8');

// ADR 0005 — 도메인을 사지 않고 기존 Firebase Hosting 을 쓴다.
const CANONICAL_ORIGIN = 'https://littlefinger-app.web.app';

describe('Google Search Console 소유권 파일', () => {
  test('검증 파일이 public 에 그대로 있다 — 사라지면 OAuth 브랜드 인증의 도메인 소유권이 끊긴다', () => {
    // 2026-09-03, Google 인증 플랫폼 브랜드 인증(문제 1: 홈페이지 도메인 미등록). Google 은
    // 소유권을 주기적으로 재확인하므로 파일은 한 줄짜리 원문 그대로 남아 있어야 한다.
    const name = 'googleb324b92c6f5d9c19.html';
    const file = resolve(WEB_ROOT, `public/${name}`);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8').trim()).toBe(`google-site-verification: ${name}`);
  });
});

describe('두 개의 HTML 셸 — 홈은 index.html, 나머지 경로는 app.html', () => {
  test('app.html 은 index.html 과 바이트 단위로 같다 — 홈 본문은 빌드 플러그인이 index 에만 넣는다', () => {
    // 하나만 고치면(메타·프리로드) 다른 셸이 조용히 뒤처진다.
    expect(readFileSync(resolve(WEB_ROOT, 'app.html'), 'utf8')).toBe(INDEX_HTML);
  });

  test('Firebase 는 딥 경로를 app.html 로 재작성한다 — index.html 이면 초대 화면에 홈 문구가 깜빡인다', () => {
    const firebase = JSON.parse(readFileSync(resolve(REPO_ROOT, 'firebase.json'), 'utf8')) as {
      hosting: { target: string; rewrites?: { source: string; destination: string }[] }[];
    };
    const web = firebase.hosting.find((site) => site.target === 'web');
    expect(web?.rewrites).toEqual([{ source: '**', destination: '/app.html' }]);
  });

  test('HTML 셸은 매번 재검증하고 해시 자산만 길게 캐시한다', () => {
    // Firebase 기본값(max-age=3600)이면 배포 뒤 최대 1시간 동안 CDN 과 크롤러가 옛 index.html 을
    // 읽는다 — 2026-09-03 브랜드 검사가 그 사이 묵은 홈을 보고 실패했다. Vite 자산은 해시가
    // 이름에 있어 영구 캐시가 안전하다.
    const firebase = JSON.parse(readFileSync(resolve(REPO_ROOT, 'firebase.json'), 'utf8')) as {
      hosting: { target: string; headers?: { source: string; headers: { key: string; value: string }[] }[] }[];
    };
    const rules = firebase.hosting.find((site) => site.target === 'web')?.headers ?? [];
    const cacheOf = (source: string): string | undefined =>
      rules.find((rule) => rule.source === source)?.headers.find((h) => h.key === 'Cache-Control')?.value;
    expect(cacheOf('**')).toBe('public, max-age=0, must-revalidate');
    expect(cacheOf('/assets/**')).toBe('public, max-age=31536000, immutable');
    expect(rules.findIndex((rule) => rule.source === '**')).toBeLessThan(
      rules.findIndex((rule) => rule.source === '/assets/**'),
    );
  });
});

describe('폰트 CLS 하드닝', () => {
  test('브랜드 폰트는 public 에 있고 preload 와 @font-face 가 같은 경로를 가리킨다', () => {
    // preload 는 URL 이 글자 하나만 달라도 폰트를 **두 번** 내려받는다. 경로를 한 곳에서
    // 비교해 그 사고를 막는다.
    const fontPath = '/fonts/PretendardVariable.woff2';
    expect(existsSync(resolve(WEB_ROOT, `public${fontPath}`))).toBe(true);

    const preload = INDEX_HTML.match(
      /<link rel="preload" href="([^"]+)" as="font" type="font\/woff2" crossorigin/u,
    );
    expect(preload?.[1]).toBe(fontPath);

    const tokensCss = readFileSync(resolve(WEB_ROOT, 'src/styles/tokens.css'), 'utf8');
    expect(tokensCss).toContain(`src: url('${fontPath}') format('woff2-variations')`);
    expect(tokensCss).not.toContain('../assets/fonts/PretendardVariable.woff2');
  });

  test('Pretendard Fallback 은 fontaine 이 실측한 메트릭을 그대로 쓴다', () => {
    // 값의 출처: fontaine readMetrics(PretendardVariable.woff2) ÷ Arial(capsize metrics).
    // 눈대중 보정은 CLS 를 되레 키운다 — 바꾸려면 다시 계산해서 통째로 바꾼다.
    const fallback = readFileSync(resolve(WEB_ROOT, 'src/styles/font-fallback.css'), 'utf8');
    expect(fallback).toContain("font-family: 'Pretendard Fallback'");
    expect(fallback).toContain("src: local('Arial')");
    expect(fallback).toContain('size-adjust: 100.8762%');
    expect(fallback).toContain('ascent-override: 94.3878%');
    expect(fallback).toContain('descent-override: 23.9116%');
    expect(fallback).toContain('line-gap-override: 0%');
  });

  test('--lf-font-brand 는 design-reference 와 웹이 문자 그대로 같다', () => {
    const brandLine = (file: string): string | undefined =>
      readFileSync(file, 'utf8')
        .split('\n')
        .find((line) => line.includes('--lf-font-brand:'))
        ?.trim();

    const web = brandLine(resolve(WEB_ROOT, 'src/styles/tokens.css'));
    const reference = brandLine(resolve(REPO_ROOT, 'design-reference/styles/tokens.css'));
    expect(web).toBeDefined();
    expect(web).toBe(reference);
    expect(web).toContain("'Pretendard Fallback'");
  });
});

describe('메타·공유 태그', () => {
  test('description·theme-color·og 태그가 있다', () => {
    expect(INDEX_HTML).toMatch(/<meta\s+name="description"\s+content="[^"]{20,}"/u);
    expect(INDEX_HTML).toMatch(/<meta\s+name="theme-color"\s+content="#[0-9A-Fa-f]{6}"/u);
    expect(INDEX_HTML).toMatch(/<meta\s+property="og:title"\s+content="리틀핑거"/u);
    expect(INDEX_HTML).toMatch(/<meta\s+property="og:description"\s+content="[^"]{20,}"/u);
    expect(INDEX_HTML).toMatch(/<meta\s+property="og:type"\s+content="website"/u);
  });

  test('og:url 은 ADR 0005 의 오리진이다', () => {
    // 다른 오리진이 박히면 카카오톡 공유 카드가 엉뚱한 주소를 들고 다닌다.
    const ogUrl = INDEX_HTML.match(/<meta property="og:url" content="([^"]+)"/u);
    expect(ogUrl?.[1]).toBe(`${CANONICAL_ORIGIN}/`);
  });
});
