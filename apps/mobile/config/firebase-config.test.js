const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const appConfig = require('../app.json');
const mobileRoot = resolve(__dirname, '..');
const googleServicesPath = resolve(__dirname, '../google-services.json');
const brandSymbolPath = resolve(__dirname, '../assets/images/brand-symbol.png');
const webBrandSymbolPath = resolve(__dirname, '../../web/src/assets/images/brand-symbol.png');
const referenceBrandSymbolPath = resolve(
  __dirname,
  '../../../design-reference/assets/images/brand-symbol.png',
);
const webBrandSymbolOnActionPath = resolve(
  __dirname,
  '../../web/src/assets/images/brand-symbol-on-action.png',
);

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

test('Android 배포 이미지는 승인된 타입 A 내보내기와 일치한다', () => {
  const approvedHashes = {
    'assets/images/icon.png': '337200a7e2c2907bcf8e7a0213a6d75ff7752ccb2c29924801df05ae212d6f51',
    'assets/images/android-icon-foreground.png':
      '54e54142ad620c0a1f63e3a1c5574b5fbcd1b33f25452a55116281f4ef9dfbae',
    'assets/images/android-icon-background.png':
      '5981d12f8d6cabbf57843f542c25ef57f9bbd6ce1f727f2e06149e3d149e4bc1',
    'assets/images/android-icon-monochrome.png':
      'b7c65ac0b9392253fda3c116d6075c771303a8b6ebe3924936caa565ea5464ce',
    'assets/images/splash-icon.png':
      'f64b475778220b3e8a917f4df2739a02801c1f1784b7efd0af4506294fad27b8',
  };

  for (const [relativePath, expectedHash] of Object.entries(approvedHashes)) {
    const bytes = readFileSync(resolve(mobileRoot, relativePath));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(expectedHash);
  }
});

test('타입 A UI 브랜드 심볼은 세 대상이 공유하는 730×458 RGBA PNG다', () => {
  const png = readFileSync(brandSymbolPath);

  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(730);
  expect(png.readUInt32BE(20)).toBe(458);
  // IHDR color type 6은 checkerboard 그림이 아니라 실제 RGBA 투명도를 뜻한다.
  expect(png[25]).toBe(6);
  expect(readFileSync(webBrandSymbolPath)).toEqual(png);
  expect(readFileSync(referenceBrandSymbolPath)).toEqual(png);
  expect(createHash('sha256').update(png).digest('hex')).toBe(
    '762d335854457469fa5e56522dfeaa02b594394ffc761c0ca0dbb660dab705ec',
  );

  const onAction = readFileSync(webBrandSymbolOnActionPath);
  expect(onAction.readUInt32BE(16)).toBe(730);
  expect(onAction.readUInt32BE(20)).toBe(458);
  expect(onAction[25]).toBe(6);
});

test('Android 런처·스플래시·알림은 승인한 잉크·버터 색을 따른다', () => {
  const splashPlugin = appConfig.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  );
  const notificationPlugin = appConfig.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications',
  );

  expect(appConfig.expo.android.adaptiveIcon.backgroundColor).toBe('#221C13');
  expect(splashPlugin[1].backgroundColor).toBe('#F3ECDC');
  expect(notificationPlugin[1].color).toBe('#F6E7A3');
});
