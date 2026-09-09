import { redirectSystemPath } from '../app/+native-intent.tsx';
import { clearPendingEntry, readPendingEntry, rememberEntry } from './pending-entry.ts';

beforeEach(clearPendingEntry);
test('초대와 약속 상세가 OAuth 왕복 중 보존된다', () => {
  for (const path of ['https://littlefinger-app.web.app/i/test-token', 'littlefinger://promise/abc-123']) {
    const target = redirectSystemPath({ path, initial: true });
    expect(redirectSystemPath({ path: 'littlefinger://auth-callback?code=secret', initial: false })).toBe(target);
    expect(readPendingEntry()).toBe(target);
  }
});
test('외부 주소나 인증 코드는 복귀 경로로 저장하지 않는다', () => {
  expect(rememberEntry('https://evil.example/i/test-token')).toBeNull();
  expect(rememberEntry('littlefinger://auth-callback?code=secret')).toBeNull();
  expect(readPendingEntry()).toBeNull();
});
