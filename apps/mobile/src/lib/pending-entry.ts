let pendingEntry: string | null = null;

/** 토큰은 디스크에 복제하지 않고 로그인/온보딩 동안만 메모리에 보관한다. */
export function rememberEntry(path: string): string | null {
  try {
    const url = new URL(path, 'https://littlefinger-app.web.app');
    if (url.protocol !== 'littlefinger:' &&
      !(url.protocol === 'https:' && ['littlefinger-app.web.app', 'littlefinger-app-philwoo.web.app'].includes(url.host))) return null;
    const pathname = url.protocol === 'littlefinger:' ? `/${url.host}${url.pathname}` : url.pathname;
    if (!/^\/i\/[A-Za-z0-9_-]+$/u.test(pathname) && !/^\/promise\/[A-Za-z0-9-]+$/u.test(pathname)) return null;
    pendingEntry = pathname;
    return pathname;
  } catch { return null; }
}

export function readPendingEntry(): string | null { return pendingEntry; }
export function clearPendingEntry(): void { pendingEntry = null; }
