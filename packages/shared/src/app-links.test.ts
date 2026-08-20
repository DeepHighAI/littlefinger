import { describe, expect, test } from 'vitest';

import {
  ANDROID_PACKAGE_NAME,
  PLAY_STORE_BASE_URL,
  buildInviteAppIntentUri,
  buildInviteWebUrl,
  buildParticipantPromisesWebUrl,
  buildPlayStoreUrl,
  invitePathOf,
} from './app-links.ts';

const BASE = 'https://littlefinger-app-philwoo.web.app';

describe('스토어 URL', () => {
  test('SCR-W03 이 쓰던 UTM 부착 URL 과 문자 그대로 같다', () => {
    expect(
      buildPlayStoreUrl({ source: 'littlefinger_web', medium: 'approval_complete' }),
    ).toBe(
      'https://play.google.com/store/apps/details?id=com.littlefinger.app&utm_source=littlefinger_web&utm_medium=approval_complete',
    );
  });

  test('패키지명과 기본 URL 은 한 곳에서 온다', () => {
    expect(ANDROID_PACKAGE_NAME).toBe('com.littlefinger.app');
    expect(PLAY_STORE_BASE_URL).toContain(`id=${ANDROID_PACKAGE_NAME}`);
  });
});

describe('초대 경로', () => {
  test('/i/{token} 형태는 여기 한 곳에서만 만든다', () => {
    expect(invitePathOf('tok en')).toBe('/i/tok%20en');
  });

  test('buildInviteWebUrl 은 기존 계약 그대로다 — null 반환, http 허용(dev)', () => {
    expect(buildInviteWebUrl(BASE, 'tok-1')).toBe(`${BASE}/i/tok-1`);
    expect(buildInviteWebUrl('http://localhost:5173', 'tok-1')).toBe(
      'http://localhost:5173/i/tok-1',
    );
    expect(buildInviteWebUrl(BASE, '')).toBeNull();
    expect(buildInviteWebUrl('ftp://x', 'tok-1')).toBeNull();
    expect(buildInviteWebUrl('not a url', 'tok-1')).toBeNull();
  });

  test('buildParticipantPromisesWebUrl 도 이관됐다', () => {
    expect(buildParticipantPromisesWebUrl(BASE)).toBe(`${BASE}/promises`);
  });
});

describe('앱 인텐트 URI — 카톡 인앱 브라우저 탈출 + 미설치 스토어 폴백', () => {
  test('설치 시 앱, 미설치 시 스토어로 가는 단일 URI 형태를 고정한다', () => {
    const store = buildPlayStoreUrl({ source: 'littlefinger_web', medium: 'invite_landing' });
    expect(buildInviteAppIntentUri(BASE, 'tok-1', store)).toBe(
      'intent://littlefinger-app-philwoo.web.app/i/tok-1' +
        '#Intent;scheme=https;package=com.littlefinger.app;' +
        `S.browser_fallback_url=${encodeURIComponent(store)};end`,
    );
  });

  test('토큰과 폴백 URL 은 인코딩된다', () => {
    const uri = buildInviteAppIntentUri(BASE, 'tok en', 'https://play.example/?a=1&b=2');
    expect(uri).toContain('/i/tok%20en#Intent');
    expect(uri).toContain(
      `S.browser_fallback_url=${encodeURIComponent('https://play.example/?a=1&b=2')};end`,
    );
  });

  test('https 가 아니거나 토큰이 없으면 null — dev(http)에서는 CTA 를 숨긴다', () => {
    expect(buildInviteAppIntentUri('http://localhost:5173', 'tok-1', 'https://s')).toBeNull();
    expect(buildInviteAppIntentUri(BASE, '', 'https://s')).toBeNull();
    expect(buildInviteAppIntentUri('not a url', 'tok-1', 'https://s')).toBeNull();
  });
});
