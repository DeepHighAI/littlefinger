import type { Endpoint } from '@littlefinger/shared';
import { processLock, type SupabaseClient } from '@supabase/supabase-js';

import {
  LargeSecureStore,
  type LargeSecureStoreDeps,
} from './large-secure-store.ts';

interface MobileStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface MobileClientOptions {
  auth: {
    storage: MobileStorage;
    autoRefreshToken?: boolean;
    persistSession?: boolean;
    detectSessionInUrl?: boolean;
    lock?: typeof processLock;
  };
}

export interface MobileSupabaseClientDeps {
  anonKey: string;
  createClient(url: string, key: string, options: MobileClientOptions): SupabaseClient;
  storage: MobileStorage;
  url: string;
}

export function mobileFunctionUrl(url: string, slug: Endpoint): string {
  return `${url.replace(/\/+$/u, '')}/functions/v1/${slug}`;
}

interface RefreshAuth {
  startAutoRefresh(): unknown;
  stopAutoRefresh(): unknown;
}

interface AppStateLike {
  addEventListener(
    event: 'change',
    listener: (state: string) => void,
  ): { remove(): void };
}

export interface MobileSupabaseRuntimeDeps extends LargeSecureStoreDeps {
  anonKey: string;
  appState: AppStateLike;
  createClient(url: string, key: string, options: MobileClientOptions): SupabaseClient;
  url: string;
}

export interface MobileSupabaseRuntime {
  functionUrl(slug: Endpoint): string;
  getClient(): SupabaseClient;
}

export function registerSessionAutoRefresh(
  auth: RefreshAuth,
  appState: AppStateLike,
): () => void {
  const subscription = appState.addEventListener('change', (state) => {
    if (state === 'active') {
      void auth.startAutoRefresh();
    } else {
      void auth.stopAutoRefresh();
    }
  });
  return () => subscription.remove();
}

export function createMobileSupabaseClient(deps: MobileSupabaseClientDeps): SupabaseClient {
  return deps.createClient(deps.url, deps.anonKey, {
    auth: {
      storage: deps.storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  });
}

export function createMobileSupabaseRuntime(
  deps: MobileSupabaseRuntimeDeps,
): MobileSupabaseRuntime {
  let client: SupabaseClient | null = null;

  return {
    functionUrl(slug) {
      if (deps.url.length === 0) {
        throw new Error('EXPO_PUBLIC_SUPABASE_URL 이 필요하다.');
      }
      return mobileFunctionUrl(deps.url, slug);
    },
    getClient() {
      if (client !== null) return client;
      if (deps.url.length === 0 || deps.anonKey.length === 0) {
        throw new Error(
          'EXPO_PUBLIC_SUPABASE_URL 과 EXPO_PUBLIC_SUPABASE_ANON_KEY 가 필요하다.',
        );
      }

      const storage = new LargeSecureStore(deps);
      client = createMobileSupabaseClient({
        anonKey: deps.anonKey,
        createClient: deps.createClient,
        storage,
        url: deps.url,
      });
      registerSessionAutoRefresh(client.auth, deps.appState);
      return client;
    },
  };
}
