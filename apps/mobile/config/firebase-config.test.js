const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const appConfig = require('../app.json');
const googleServicesPath = resolve(__dirname, '../google-services.json');

test('Android 네이티브 빌드가 커밋된 Firebase 클라이언트 설정을 사용한다', () => {
  expect(appConfig.expo.android.googleServicesFile).toBe('./google-services.json');
  expect(existsSync(googleServicesPath)).toBe(true);
});

test('Firebase 클라이언트 설정은 리틀핑거 앱만 가리키고 서버 키를 포함하지 않는다', () => {
  const exists = existsSync(googleServicesPath);
  expect(exists).toBe(true);
  if (!exists) return;

  const googleServices = JSON.parse(readFileSync(googleServicesPath, 'utf8'));
  const packages = googleServices.client.map(
    (client) => client.client_info.android_client_info.package_name,
  );

  expect(googleServices.project_info.project_id).toBe('littlefinger-app-philwoo');
  expect(packages).toEqual(['com.littlefinger.app']);
  expect(JSON.stringify(googleServices)).not.toContain('private_key');
});
