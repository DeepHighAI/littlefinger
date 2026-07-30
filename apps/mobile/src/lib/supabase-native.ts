import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Endpoint } from '@littlefinger/shared';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

import { createMobileSupabaseRuntime } from './supabase.ts';

function randomEncryptionKey(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}

const runtime = createMobileSupabaseRuntime({
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  appState: AppState,
  asyncStorage: AsyncStorage,
  createClient: (url, key, options) => createClient(url, key, options),
  randomBytes: randomEncryptionKey,
  secureStore: SecureStore,
  url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
});

export function getMobileSupabaseClient(): SupabaseClient {
  return runtime.getClient();
}

export function getMobileFunctionUrl(slug: Endpoint): string {
  return runtime.functionUrl(slug);
}
