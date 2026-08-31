const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const appConfig = require('../app.json');
const mobileRoot = resolve(__dirname, '..');
const googleServicesPath = resolve(__dirname, '../google-services.json');
const brandSymbolPath = resolve(__dirname, '../assets/images/brand-symbol.png');
const inAppBrandSymbolPath = resolve(
  __dirname,
  '../assets/images/brand-symbol-in-app.png',
);
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

test('Android 배포 이미지는 승인된 브랜드 내보내기와 일치한다', () => {
  const approvedHashes = {
    'assets/images/icon.png': '2a3303aa19e25f0179091c3451c0be8c0500b20c1736c380897de21d4866e69b',
    'assets/images/android-icon-foreground.png':
      '172097fdfe55504dfa44edf82ecbe0a47fc0e81594677178e44d56e17347c0ed',
    'assets/images/android-icon-background.png':
      'ba2424e36e59cd6e6ce0e032122d5ab1f905db64aedef102882ec317e0a06a5b',
    'assets/images/android-icon-monochrome.png':
      'ab479a68f4d61145c43b7c60bd597d45cbb6f724836caa17591fa94939ed1282',
    'assets/images/splash-icon.png':
      '51cdd85d5cb84fd9ede1b66c94ea158b2956b49a8541b032cea823a67ffd3073',
  };

  for (const [relativePath, expectedHash] of Object.entries(approvedHashes)) {
    const bytes = readFileSync(resolve(mobileRoot, relativePath));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(expectedHash);
  }
});

test('보정된 UI 브랜드 마스크는 세 대상이 공유하는 730×458 RGBA PNG다', () => {
  const png = readFileSync(brandSymbolPath);

  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(730);
  expect(png.readUInt32BE(20)).toBe(458);
  // IHDR color type 6은 checkerboard 그림이 아니라 실제 RGBA 투명도를 뜻한다.
  expect(png[25]).toBe(6);
  expect(readFileSync(webBrandSymbolPath)).toEqual(png);
  expect(readFileSync(referenceBrandSymbolPath)).toEqual(png);
  expect(createHash('sha256').update(png).digest('hex')).toBe(
    '3db3a6d4f1e6e788e7b29f393ec7993d4e3f03517627d1d417fd6f54cf8c2672',
  );

  const onAction = readFileSync(webBrandSymbolOnActionPath);
  expect(onAction.readUInt32BE(16)).toBe(730);
  expect(onAction.readUInt32BE(20)).toBe(458);
  expect(onAction[25]).toBe(6);
  expect(createHash('sha256').update(onAction).digest('hex')).toBe(
    'c669d6218f95b38c1c19e7eb237d0ccac1da4a19e2db6a6c9c5db996408804f4',
  );
});

test('앱 내부 브랜드 심볼은 승인된 잉크 단색 투명 자산이다', () => {
  const png = readFileSync(inAppBrandSymbolPath);

  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(730);
  expect(png.readUInt32BE(20)).toBe(458);
  expect(png[25]).toBe(6);
  expect(createHash('sha256').update(png).digest('hex')).toBe(
    'e897fc00f99be4e24cd1e873c6f42def3eebee75bdda2cfb649a61ceeead029b',
  );
});

test('Play 스토어 아이콘은 승인된 512×512 불투명 RGB 내보내기다', () => {
  const png = readFileSync(resolve(mobileRoot, '../../docs/디자인/store/store-icon-512.png'));
  expect(png.readUInt32BE(16)).toBe(512);
  expect(png.readUInt32BE(20)).toBe(512);
  expect(png[25]).toBe(2);
  expect(createHash('sha256').update(png).digest('hex')).toBe(
    '14c800ad68f58f60ce49323c3758369768879ead37c2fa16f53582f975a3847e',
  );
});

test('Android 런처·스플래시·알림은 승인한 버터·크림 색을 따른다', () => {
  const splashPlugin = appConfig.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  );
  const notificationPlugin = appConfig.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications',
  );

  expect(appConfig.expo.android.adaptiveIcon.backgroundColor).toBe('#F6E7A3');
  expect(splashPlugin[1].backgroundColor).toBe('#F3ECDC');
  expect(notificationPlugin[1].color).toBe('#F6E7A3');
});
