const { resolveAppLinkIntentFilters } = require('../app.config.js');
const fs = require('node:fs');
const path = require('node:path');

const EAS_DEVELOPMENT_CERT_SHA256 =
  'C1:E0:70:DE:41:70:DE:B9:0A:D4:32:C2:D5:21:99:1F:F7:8B:54:6F:CD:06:BB:90:0F:B8:46:A8:D3:97:37:BB';

// 콘솔에 표시된 지문과 실제 내부 트랙 설치본에서 추출한 지문을 함께 유지한다.
// 하나라도 빠지면 해당 키로 서명된 스토어 설치본의 App Links 가 조용히 죽는다.
const PLAY_APP_SIGNING_CERT_SHA256 =
  'CA:34:89:02:D7:AD:7D:77:22:5C:50:08:2A:08:4F:13:C2:70:39:3F:14:5F:68:E5:E6:6F:9C:89:2C:23:5D:B2';
const PLAY_INSTALLED_CERT_SHA256 =
  'B3:BD:C8:EB:67:FF:B7:25:43:04:3B:E6:AB:4E:48:A9:E1:69:42:65:F0:BB:A4:98:9E:35:CB:1C:AA:D0:A7:14';

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
    const { ANDROID_PACKAGE_NAME, APP_SCHEME } = require('../../../packages/shared/src/app-links.ts');
    const appJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../app.json'), 'utf8'),
    );
    expect(appJson.expo.android.package).toBe(ANDROID_PACKAGE_NAME);
    expect(appJson.expo.scheme).toBe(APP_SCHEME);
  });

  test('배포 자산은 앱 패키지를 EAS development·모든 Play 서명에 연결한다', () => {
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
        sha256_cert_fingerprints: [
          EAS_DEVELOPMENT_CERT_SHA256,
          PLAY_APP_SIGNING_CERT_SHA256,
          PLAY_INSTALLED_CERT_SHA256,
        ],
      },
    });
  });
});
