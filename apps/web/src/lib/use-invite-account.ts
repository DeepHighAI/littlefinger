import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { safeProfileName } from '@littlefinger/shared';

import { getSupabase } from './supabase.ts';

/** 확인은 현재 화면과 사용자 ID에만 유효하고 다른 계정으로 바뀌면 즉시 해제된다. */
export function useInviteAccount() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let changed = false;
    const client = getSupabase();
    const subscription = client.auth.onAuthStateChange((_event, next) => {
      changed = true;
      if (active) { setSession(next); setError(false); }
    });
    void client.auth.getSession().then(({ data, error: failure }) => {
      if (!active || changed) return;
      if (failure !== null) { setError(true); return; }
      setSession(data.session);
    }).catch(() => { if (active && !changed) setError(true); });
    return () => { active = false; subscription.data.subscription.unsubscribe(); };
  }, [attempt]);
  const userId = session?.user.id;
  useEffect(() => {
    setConfirmedId(null);
    setNickname(null);
    setProfileUserId(null);
    if (userId === undefined) return;
    let active = true;
    void Promise.resolve(getSupabase().from('users').select('nickname').eq('id', userId).single())
      .then(({ data, error: failure }) => {
        if (!active) return;
        if (failure !== null) { setError(true); return; }
        setNickname(safeProfileName(data?.nickname));
        setProfileUserId(userId);
      }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [userId, attempt]);
  const provider: unknown = session?.user.app_metadata['provider'];
  const providerKey: 'google' | 'kakao' | 'other' = provider === 'google' || provider === 'kakao' ? provider : 'other';
  return {
    session, nickname, error, setError,
    ready: userId !== undefined && profileUserId === userId,
    provider: providerKey,
    confirmed: userId !== undefined && confirmedId === userId,
    confirm: () => setConfirmedId(userId ?? null),
    retry: () => { setError(false); setAttempt((value) => value + 1); },
  };
}
