import { HOME_LABEL } from './home-labels.ts';

/**
 * 공개 홈(/)의 **정적 HTML** — 빌드 시 `index.html`의 `#root` 안에 미리 넣는다(vite.config.ts).
 *
 * Google OAuth 브랜드 인증의 자동 검사는 JavaScript 를 실행하지 않고 HTML 만 읽는다.
 * 2026-09-03, React 가 그린 홈을 배포한 뒤에도 "홈페이지에 앱 목적 설명이 없음 · 로그인 페이지가
 * 먼저 보임"이 그대로 남았다 — SPA 셸의 본문이 비어 있었기 때문이다. 그래서 크롤러가 보는
 * 첫 HTML 에 home.tsx 와 같은 문구를 담는다. 문구의 정본은 home-labels.ts 하나다.
 *
 * vite.config.ts 가 이 파일을 import 하므로 여기서는 `@littlefinger/shared` 의 런타임 값을
 * 쓰지 않는다(설정 번들러가 bare import 를 외부화해 TS 소스를 Node 가 직접 읽게 된다).
 * 아래 경로·URL 리터럴은 home-static.test.ts 가 ROUTE / buildPlayStoreUrl 과 대조한다.
 */
export const HOME_STATIC_LINKS = {
  privacy: '/legal/privacy',
  terms: '/legal/terms',
  accountDeletion: '/account-deletion',
  playStore:
    'https://play.google.com/store/apps/details?id=com.littlefinger.app&utm_source=web&utm_medium=home',
} as const;

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function list(items: readonly string[]): string {
  return `<ul>${items.map((text) => `<li>${escapeHtml(text)}</li>`).join('')}</ul>`;
}

export function renderHomeStaticMarkup(): string {
  const labels = HOME_LABEL.ko;
  const purpose = labels.purpose.map((text) => `<p>${escapeHtml(text)}</p>`).join('');
  return (
    `<main class="lf-legal"><article class="lf-legal__document">` +
    `<h1>${escapeHtml(labels.name)}</h1>` +
    `<p><strong>${escapeHtml(labels.tagline)}</strong> · ${escapeHtml(labels.motto)}</p>` +
    purpose +
    `<section><h2>${escapeHtml(labels.howTitle)}</h2>${list(labels.how)}</section>` +
    `<section><h2>${escapeHtml(labels.principlesTitle)}</h2>${list(labels.principles)}</section>` +
    `<p><a class="lf-btn lf-btn--filled" href="${HOME_STATIC_LINKS.playStore}">${escapeHtml(labels.playLink)}</a></p>` +
    `<section><h2>${escapeHtml(labels.linksTitle)}</h2>` +
    `<p><a href="${HOME_STATIC_LINKS.privacy}">${escapeHtml(labels.privacyLink)}</a> · ` +
    `<a href="${HOME_STATIC_LINKS.terms}">${escapeHtml(labels.termsLink)}</a> · ` +
    `<a href="${HOME_STATIC_LINKS.accountDeletion}">${escapeHtml(labels.accountDeletionLink)}</a></p>` +
    `<p>${escapeHtml(labels.contact)}</p><p>${escapeHtml(labels.company)}</p></section>` +
    `</article></main>`
  );
}
