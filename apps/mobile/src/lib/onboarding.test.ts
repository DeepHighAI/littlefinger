import { completeOnboarding, readOnboardingCompletion } from './onboarding.ts';

describe('SCR-A00 최초 실행 저장 경계', () => {
  test('완료 전은 false이고 완료 뒤에는 true다', async () => {
    let value: string | null = null;
    const storage = {
      getItem: async () => value,
      setItem: async (_key: string, next: string) => { value = next; },
    };
    await expect(readOnboardingCompletion(storage)).resolves.toBe(false);
    await completeOnboarding(storage);
    await expect(readOnboardingCompletion(storage)).resolves.toBe(true);
  });

  test('저장소 읽기 실패는 로그인 진입을 막지 않도록 완료로 취급한다', async () => {
    await expect(readOnboardingCompletion({
      getItem: async () => { throw new Error('storage'); },
      setItem: async () => undefined,
    })).resolves.toBe(true);
  });
});
