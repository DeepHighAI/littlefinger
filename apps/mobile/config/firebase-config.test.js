const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
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

test('Android 배포 이미지는 승인된 브랜드 내보내기와 일치한다', () => {
  const approvedHashes = {
    'assets/images/icon.png': 'ed0e202bc0b4405b290dd6232eb18b0cc8ab71ec3ef25a5c71f1e7d7a5c6b127',
    'assets/images/android-icon-foreground.png':
      'fb33bec0d0a5bc5b49028444027f4c6b02855bcf5fbe76c9a11adf339f243ac2',
    'assets/images/android-icon-background.png':
      'c9b29551a25aa3ee9361eeea19c80d5b9fd8e05aa224999fe16de24288518d0e',
    'assets/images/android-icon-monochrome.png':
      '3bf8be742fb62f437e2b427a0d859cebb4fd13e0a96f7eb20a9b635b1b187ffa',
    'assets/images/splash-icon.png':
      '66d76badca6b915833ec119f32e9c65c9b18cba5c68ce381b5818d745bdd547f',
  };

  for (const [relativePath, expectedHash] of Object.entries(approvedHashes)) {
    const bytes = readFileSync(resolve(mobileRoot, relativePath));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(expectedHash);
  }
});

test('Play 스토어 아이콘은 PO가 저장한 512×512 불투명 RGBA 원본이다', () => {
  const png = readFileSync(resolve(
    mobileRoot,
    '../../docs/디자인/store/app-icon/littlefinger-icon-512.png',
  ));
  expect(png.readUInt32BE(16)).toBe(512);
  expect(png.readUInt32BE(20)).toBe(512);
  expect(png[25]).toBe(6);
  expect(createHash('sha256').update(png).digest('hex')).toBe(
    '657517bed18910cb1c7927607a8be02ded7f86be767d8291056f521ca83ef6de',
  );
});

test('Android 런처·스플래시·알림은 승인한 버터·크림 색을 따른다', () => {
  const splashPlugin = appConfig.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  );
  const notificationPlugin = appConfig.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications',
  );

  expect(appConfig.expo.android.adaptiveIcon.backgroundColor).toBe('#FFE59A');
  expect(splashPlugin[1].backgroundColor).toBe('#F3ECDC');
  expect(notificationPlugin[1].color).toBe('#FFE59A');
});
