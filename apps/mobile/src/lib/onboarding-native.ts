import AsyncStorage from '@react-native-async-storage/async-storage';

import { completeOnboarding, readOnboardingCompletion } from './onboarding.ts';

export async function readOnboardingCompletionNative(): Promise<boolean> {
  return await readOnboardingCompletion(AsyncStorage);
}

export async function completeOnboardingNative(): Promise<void> {
  await completeOnboarding(AsyncStorage);
}
