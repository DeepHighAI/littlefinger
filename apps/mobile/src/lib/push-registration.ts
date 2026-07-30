export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined';
export type PushRegistrationResult = 'REGISTERED' | 'SKIPPED';

interface FetchResponse {
  ok: boolean;
  status: number;
}

export interface PushRegistrationDeps {
  platform: string;
  projectId: string | null;
  functionUrl: string;
  setAndroidChannel(): Promise<void>;
  getPermission(): Promise<PushPermissionStatus>;
  requestPermission(): Promise<PushPermissionStatus>;
  getExpoPushToken(projectId: string): Promise<string>;
  fetch(
    url: string,
    init: {
      method: 'POST';
      headers: Record<string, string>;
      body: string;
    },
  ): Promise<FetchResponse>;
}

/**
 * Android 푸시 등록의 순서를 한곳에 고정한다.
 *
 * Android 13은 채널이 먼저 있어야 권한 창이 나타난다. 권한 거부는 사용자의 선택이라
 * 로그인 실패가 아니고, 토큰 조회·서버 오류만 호출자에게 던져 다음 로그인에서 재시도한다.
 */
export async function registerAndroidPushToken(
  accessToken: string,
  deps: PushRegistrationDeps,
): Promise<PushRegistrationResult> {
  if (deps.platform !== 'android') return 'SKIPPED';

  await deps.setAndroidChannel();

  let permission = await deps.getPermission();
  if (permission !== 'granted') {
    permission = await deps.requestPermission();
  }
  if (permission !== 'granted') return 'SKIPPED';

  if (deps.projectId === null || deps.projectId.length === 0) {
    throw new Error('EAS projectId가 필요하다.');
  }

  const expoPushToken = await deps.getExpoPushToken(deps.projectId);
  const response = await deps.fetch(deps.functionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expo_push_token: expoPushToken }),
  });

  if (!response.ok) {
    throw new Error('푸시 토큰 등록에 실패했다.');
  }

  return 'REGISTERED';
}
