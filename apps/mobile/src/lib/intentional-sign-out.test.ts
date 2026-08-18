import {
  consumeIntentionalSignOut,
  runIntentionalSignOut,
} from './intentional-sign-out.ts';

describe('의도적인 로그아웃 신호', () => {
  beforeEach(() => {
    consumeIntentionalSignOut();
  });

  test('사용자가 요청한 로그아웃 이벤트는 세션 만료 안내에서 제외한다', async () => {
    await runIntentionalSignOut(async () => undefined);

    expect(consumeIntentionalSignOut()).toBe(true);
    expect(consumeIntentionalSignOut()).toBe(false);
  });

  test('로그아웃 실패는 다음 실제 세션 만료를 가리지 않는다', async () => {
    await expect(
      runIntentionalSignOut(async () => {
        throw new Error('sign out failed');
      }),
    ).rejects.toThrow('sign out failed');

    expect(consumeIntentionalSignOut()).toBe(false);
  });
});
