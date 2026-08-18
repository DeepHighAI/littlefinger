import { describe, expect, test } from 'vitest';

import { asMinimumAppVersion, isAppVersionOutdated } from './app-version.ts';

describe('EC-I04 최소 앱 버전', () => {
  test('숫자 점 버전만 받아들이고 잘못된 원격 값은 fail-open 한다', () => {
    expect(asMinimumAppVersion({ value: '1.2.3' })).toBe('1.2.3');
    expect(asMinimumAppVersion({ value: '1.2' })).toBeNull();
    expect(asMinimumAppVersion({ value: 123 })).toBeNull();
    expect(asMinimumAppVersion(null)).toBeNull();
  });

  test('각 숫자 조각을 비교해 현재 버전이 낮을 때만 차단한다', () => {
    expect(isAppVersionOutdated('0.1.0', '0.1.1')).toBe(true);
    expect(isAppVersionOutdated('0.10.0', '0.2.9')).toBe(false);
    expect(isAppVersionOutdated('1.0.0', '1.0.0')).toBe(false);
    expect(isAppVersionOutdated('잘못됨', '1.0.0')).toBe(false);
  });
});
