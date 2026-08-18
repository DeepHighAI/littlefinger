import { buildInviteWebUrl, buildParticipantPromisesWebUrl } from './invite-link.ts';

describe('EC-I01 /i App Link routing contract', () => {
  test('공개·로컬 웹 주소에 토큰을 URL-safe 경로로 보존한다', () => {
    expect(buildInviteWebUrl('https://promise.example.com/', 'a-b_c')).toBe(
      'https://promise.example.com/i/a-b_c',
    );
    expect(buildInviteWebUrl('http://localhost:5173', 'a/b')).toBe(
      'http://localhost:5173/i/a%2Fb',
    );
  });

  test.each([
    ['', 'token'],
    ['not-url', 'token'],
    ['ftp://example.com', 'token'],
    ['https://example.com', ''],
  ])('잘못된 base/token 조합은 열지 않는다', (baseUrl, token) => {
    expect(buildInviteWebUrl(baseUrl, token)).toBeNull();
  });
});

describe('EC-G01 직접 알림 링크 계약', () => {
  test('웹 참여 약속 목록 URL은 origin 아래 /promises로 고정한다', () => {
    expect(buildParticipantPromisesWebUrl('https://littlefinger.pages.dev/i/token')).toBe(
      'https://littlefinger.pages.dev/promises',
    );
    expect(buildParticipantPromisesWebUrl('http://localhost:5173')).toBe(
      'http://localhost:5173/promises',
    );
  });

  test.each(['', 'not-url', 'ftp://example.com'])('잘못된 base %s는 링크를 만들지 않는다', (baseUrl) => {
    expect(buildParticipantPromisesWebUrl(baseUrl)).toBeNull();
  });
});
