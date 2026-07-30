import * as Linking from 'expo-linking';

import { completeKakaoSignIn } from './kakao-auth-native.ts';
import { registerPushForSession } from './push-registration-native.ts';
import {
  startMobileSessionGate,
  type MobileSessionGateEvents,
} from './session-gate.ts';
import { getMobileSupabaseClient } from './supabase-native.ts';

export function startMobileSessionGateNative(events: MobileSessionGateEvents): () => void {
  const client = getMobileSupabaseClient();

  return startMobileSessionGate(
    {
      getSession: async () => {
        const { data, error } = await client.auth.getSession();
        if (error !== null) throw error;
        return data.session;
      },
      onAuthStateChange: (listener) => {
        const { data } = client.auth.onAuthStateChange((_event, session) => {
          listener(session);
        });
        return { unsubscribe: () => data.subscription.unsubscribe() };
      },
      getInitialUrl: () => Linking.getInitialURL(),
      addUrlListener: (listener) => {
        const subscription = Linking.addEventListener('url', ({ url }) => listener(url));
        return { remove: () => subscription.remove() };
      },
      completeKakaoSignIn,
      registerPush: registerPushForSession,
      // 인증은 이미 성공했으므로 푸시 등록 장애는 기록만 남기고 화면 전환을 유지한다.
      logError: (error) => console.error('모바일 세션 후처리에 실패했습니다.', error),
    },
    events,
  );
}
