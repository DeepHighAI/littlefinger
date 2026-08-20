/**
 * 앱·스토어·초대 링크의 문자열 빌더 — 순수 함수만. RN·웹·Deno 어디서든 안전하다.
 *
 * 패키지명과 `/i/{token}` 형태가 네 곳 넘게 중복돼 있었다(SCR-W03, 강제 업데이트,
 * invite-flow, invite-link). 서버는 발송된 URL 을 기록하지 않으므로 형태가 흩어져
 * 어긋나면 이미 뿌려진 링크가 통째로 죽는다 — 그래서 전부 여기 한 곳으로 모은다.
 */

export const ANDROID_PACKAGE_NAME = 'com.littlefinger.app';

export const PLAY_STORE_BASE_URL =
  `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`;

/** 설치 전환 KPI 측정용 UTM 부착 스토어 URL (02 §4-4-4). */
export function buildPlayStoreUrl(utm: { source: string; medium: string }): string {
  return `${PLAY_STORE_BASE_URL}&utm_source=${encodeURIComponent(utm.source)}&utm_medium=${encodeURIComponent(utm.medium)}`;
}

/** `/i/{token}` — 초대 경로 형태의 유일한 정의처. */
export function invitePathOf(token: string): string {
  return `/i/${encodeURIComponent(token)}`;
}

export function buildInviteWebUrl(baseUrl: string, token: string): string | null {
  if (token.length === 0) return null;
  try {
    const base = new URL(baseUrl);
    // dev 는 http://localhost 로 돌므로 http 를 막지 않는다. 프로덕션 강제는
    // invite-flow 의 throwing 빌더가 맡는다.
    if (base.protocol !== 'https:' && base.protocol !== 'http:') return null;
    base.pathname = invitePathOf(token);
    base.search = '';
    base.hash = '';
    return base.toString().replace(/\/$/u, '');
  } catch {
    return null;
  }
}

export function buildParticipantPromisesWebUrl(baseUrl: string): string | null {
  try {
    const base = new URL(baseUrl);
    if (base.protocol !== 'https:' && base.protocol !== 'http:') return null;
    base.pathname = '/promises';
    base.search = '';
    base.hash = '';
    return base.toString().replace(/\/$/u, '');
  } catch {
    return null;
  }
}

/**
 * 카톡 인앱 브라우저 탈출용 Android 인텐트 URI.
 *
 * 카카오톡 WebView 는 App Links 검증을 타지 않아 앱이 설치돼 있어도 링크가 웹으로만
 * 열린다. 이 URI 하나가 두 경우를 가른다 — 설치면 앱이 열리고, 미설치면
 * `S.browser_fallback_url` 의 스토어로 간다 (PO 2026-08-20: 스토어 강한 유도).
 * https 오리진에서만 의미가 있으므로 dev(http)에서는 null 을 돌려 CTA 를 숨긴다.
 */
export function buildInviteAppIntentUri(
  baseUrl: string,
  token: string,
  storeFallbackUrl: string,
): string | null {
  if (token.length === 0) return null;
  try {
    const base = new URL(baseUrl);
    if (base.protocol !== 'https:') return null;
    return (
      `intent://${base.host}${invitePathOf(token)}` +
      `#Intent;scheme=https;package=${ANDROID_PACKAGE_NAME};` +
      `S.browser_fallback_url=${encodeURIComponent(storeFallbackUrl)};end`
    );
  } catch {
    return null;
  }
}
