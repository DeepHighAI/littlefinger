import { readPendingEntry, rememberEntry } from '../lib/pending-entry.ts';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  const entry = rememberEntry(path);
  if (entry !== null) return entry;
  // OAuth URL 자체는 세션 리스너가 처리한다. 화면만 원래 초대로 복귀시킨다.
  if (path.startsWith('littlefinger://auth-callback')) return readPendingEntry() ?? path;
  return path;
}
