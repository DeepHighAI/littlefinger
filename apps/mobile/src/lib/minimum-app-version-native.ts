import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

import { loadMinimumAppVersion } from './minimum-app-version.ts';
import { getMobileSupabaseClient } from './supabase-native.ts';

const ANDROID_PACKAGE = 'com.littlefinger.app';

export async function loadMinimumAppVersionNative(): Promise<boolean> {
  const currentVersion = Constants.expoConfig?.version ?? '';
  return await loadMinimumAppVersion(currentVersion, async () => {
    const { data, error } = await getMobileSupabaseClient()
      .from('app_configs')
      .select('value')
      .eq('key', 'min_app_version')
      .maybeSingle();
    if (error !== null) throw error;
    if (data === null || typeof data !== 'object') return null;
    return data;
  });
}

export async function openAndroidStore(): Promise<void> {
  try {
    await Linking.openURL(`market://details?id=${ANDROID_PACKAGE}`);
  } catch {
    await Linking.openURL(`https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`);
  }
}
