// device-token-register — 앱 로그인 뒤 Expo Push Service 토큰 등록(02 §4-1-3.5).

import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, noContentResponse } from '../_shared/http.ts';
import { jsonBody, requiredString } from '../_shared/request.ts';

export function createDeviceTokenRegisterHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();

    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'expo_push_token' });
      }

      const userId = await deps.authenticate(request.headers.get('authorization'));
      const body = await jsonBody(request, 'expo_push_token');
      const expoPushToken = requiredString(body, 'expo_push_token', 'expo_push_token');
      if (expoPushToken.trim().length === 0) {
        throw new ApiError('E_VALIDATION', { field: 'expo_push_token' });
      }

      await deps.rpc('lf_device_token_register', {
        p_user_id: userId,
        p_expo_push_token: expoPushToken,
      });

      return noContentResponse();
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
