export function buildInviteWebUrl(baseUrl: string, token: string): string | null {
  if (token.length === 0) return null;
  try {
    const base = new URL(baseUrl);
    if (base.protocol !== 'https:' && base.protocol !== 'http:') return null;
    base.pathname = `/i/${encodeURIComponent(token)}`;
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
