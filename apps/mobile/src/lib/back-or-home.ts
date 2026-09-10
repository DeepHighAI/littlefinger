import type { router as expoRouter } from 'expo-router';

/** 초대 수락·딥링크처럼 이전 화면이 없는 진입도 약속 목록으로 나갈 수 있어야 한다. */
export function backOrHome(router: Pick<typeof expoRouter, 'canGoBack' | 'back' | 'replace'>): void {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}
