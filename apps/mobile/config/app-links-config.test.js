const { resolveAppLinkIntentFilters } = require('../app.config.js');
const fs = require('node:fs');
const path = require('node:path');

const EAS_DEVELOPMENT_CERT_SHA256 =
  'C1:E0:70:DE:41:70:DE:B9:0A:D4:32:C2:D5:21:99:1F:F7:8B:54:6F:CD:06:BB:90:0F:B8:46:A8:D3:97:37:BB';

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

  test('app.json 의 패키지명은 공유 상수와 같다 — 흩어지면 App Links 가 끊긴다', () => {
    const { ANDROID_PACKAGE_NAME } = require('../../../packages/shared/src/app-links.ts');
    const appJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../app.json'), 'utf8'),
    );
    expect(appJson.expo.android.package).toBe(ANDROID_PACKAGE_NAME);
  });

  test('배포 자산은 앱 패키지와 EAS development 서명을 연결한다', () => {
    const assetPath = path.resolve(
      __dirname,
      '../../web/public/.well-known/assetlinks.json',
    );
    const [statement] = JSON.parse(fs.readFileSync(assetPath, 'utf8'));

    expect(statement).toEqual({
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.littlefinger.app',
        sha256_cert_fingerprints: [EAS_DEVELOPMENT_CERT_SHA256],
      },
    });
  });
});
