const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const appConfig = require('../app.json');
const mobileRoot = resolve(__dirname, '..');
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

test('Expo 네이티브 빌드 이미지가 존재하고 EAS 업로드에서 제외되지 않는다', () => {
  const splashPlugin = appConfig.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  );
  const imagePaths = [
    appConfig.expo.icon,
    ...Object.values(appConfig.expo.android.adaptiveIcon).filter((value) =>
      value.endsWith('.png'),
    ),
    splashPlugin[1].image,
  ];

  for (const imagePath of imagePaths) {
    const relativePath = imagePath.replace(/^\.\//, '');
    expect(existsSync(resolve(mobileRoot, relativePath))).toBe(true);
    expect(
      spawnSync('git', ['check-ignore', '-q', '--', relativePath], {
        cwd: mobileRoot,
      }).status,
    ).toBe(1);
  }
});
