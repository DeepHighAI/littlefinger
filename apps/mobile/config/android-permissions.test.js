const fs = require('node:fs');
const path = require('node:path');

// 앱은 갤러리 선택만 쓰는데(fulfillment-native.ts) expo-image-picker 와 Expo 기본 템플릿이
// 카메라·마이크·오버레이 권한을 매니페스트에 병합한다. code 19 AAB 덤프에서 실제로 확인됐고,
// 스토어 권한 목록과 docs/setup/play-store-listing.md §7 규칙에 어긋나므로 빌드 설정에서 막는다.
const BLOCKED_UNUSED_PERMISSIONS = [
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.SYSTEM_ALERT_WINDOW',
];

// play-store-listing.md §7 "must be absent" — 하나라도 요청하면 출시 차단 요인이다.
const RELEASE_BLOCKING_PERMISSIONS = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.READ_PHONE_STATE',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.READ_CONTACTS',
  'android.permission.QUERY_ALL_PACKAGES',
];

function readAppJson() {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../app.json'), 'utf8'));
}

describe('Android 권한 — play-store-listing.md §7', () => {
  test('쓰지 않는 카메라·마이크·오버레이 권한은 blockedPermissions 로 제거한다', () => {
    const { blockedPermissions } = readAppJson().expo.android;
    expect(blockedPermissions).toEqual(expect.arrayContaining(BLOCKED_UNUSED_PERMISSIONS));
  });

  test('출시 차단 권한은 요청 목록에 없다', () => {
    const { permissions = [] } = readAppJson().expo.android;
    expect(permissions.filter((name) => RELEASE_BLOCKING_PERMISSIONS.includes(name))).toEqual([]);
  });
});
