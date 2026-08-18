import { loadMinimumAppVersion } from './minimum-app-version.ts';

describe('EC-I04 시작 버전 게이트', () => {
  test('원격 설정이 현재 버전보다 높을 때만 업데이트를 요구한다', async () => {
    await expect(loadMinimumAppVersion('0.1.0', async () => ({ value: '0.1.1' }))).resolves.toBe(true);
    await expect(loadMinimumAppVersion('0.1.0', async () => ({ value: '0.1.0' }))).resolves.toBe(false);
  });

  test('조회 실패와 잘못된 값은 fail-open 한다', async () => {
    await expect(loadMinimumAppVersion('0.1.0', async () => { throw new Error('offline'); })).resolves.toBe(false);
    await expect(loadMinimumAppVersion('0.1.0', async () => ({ value: 'bad' }))).resolves.toBe(false);
  });
});
