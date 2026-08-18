const { resolveAppLinkIntentFilters } = require('../app.config.js');

describe('EC-I01 Android App Links', () => {
  test('공개 웹 /i 경로만 앱으로 검증한다', () => {
    expect(resolveAppLinkIntentFilters('https://promise.example.com')).toEqual([
      {
        action: 'VIEW',
        autoVerify: true,
        category: ['BROWSABLE', 'DEFAULT'],
        data: [{ scheme: 'https', host: 'promise.example.com', pathPrefix: '/i/' }],
      },
    ]);
  });

  test.each(['', 'http://localhost:5173', 'not-url'])('잘못되거나 비공개 주소 %p는 빌드 설정에 넣지 않는다', (value) => {
    expect(resolveAppLinkIntentFilters(value)).toEqual([]);
  });
});
