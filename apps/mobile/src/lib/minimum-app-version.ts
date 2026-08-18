import { asMinimumAppVersion, isAppVersionOutdated } from '@littlefinger/shared';

export async function loadMinimumAppVersion(
  currentVersion: string,
  readConfig: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const minimum = asMinimumAppVersion(await readConfig());
    return minimum === null ? false : isAppVersionOutdated(currentVersion, minimum);
  } catch {
    // 원격 설정 장애가 모든 사용자의 앱을 막는 단일 장애점이 되지 않게 한다.
    return false;
  }
}
