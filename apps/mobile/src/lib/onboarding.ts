export const ONBOARDING_COMPLETED_KEY = 'littlefinger.onboarding-completed.v1';

export interface OnboardingStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export async function readOnboardingCompletion(storage: OnboardingStorage): Promise<boolean> {
  try {
    return await storage.getItem(ONBOARDING_COMPLETED_KEY) === '1';
  } catch {
    // 로컬 저장소 장애가 로그인 자체를 막아서는 안 된다.
    return true;
  }
}

export async function completeOnboarding(storage: OnboardingStorage): Promise<void> {
  await storage.setItem(ONBOARDING_COMPLETED_KEY, '1');
}
