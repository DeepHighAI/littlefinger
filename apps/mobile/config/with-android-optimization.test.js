const {
  optimizeAppBuildGradle,
  optimizeGradleProperties,
} = require('./with-android-optimization.js');

describe('Android release optimization', () => {
  test.each(['"', "'"])('최적화 기본 규칙으로 바꾸고 앱 규칙은 보존한다 (%s)', (quote) => {
    const source = `proguardFiles getDefaultProguardFile(${quote}proguard-android.txt${quote}), "proguard-rules.pro"`;
    const optimized = optimizeAppBuildGradle(source);
    expect(optimized).toBe(source.replace('proguard-android.txt', 'proguard-android-optimize.txt'));
    expect(optimizeAppBuildGradle(optimized)).toBe(optimized);
  });

  test('기본 규칙이 사라진 템플릿은 조용히 통과시키지 않는다', () => {
    expect(() => optimizeAppBuildGradle('proguardFiles "custom.pro"')).toThrow('default optimized ProGuard rules');
  });

  test('중복·비활성 설정을 대체하고 나머지 속성과 주석은 보존한다', () => {
    const retained = [
      { type: 'comment', value: 'project settings' },
      { type: 'property', key: 'hermesEnabled', value: 'true' },
    ];
    const result = optimizeGradleProperties([
      ...retained,
      { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'false' },
      { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'true' },
    ]);
    expect(result).toEqual([
      ...retained,
      { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'true' },
      { type: 'property', key: 'android.enableShrinkResourcesInReleaseBuilds', value: 'true' },
      { type: 'property', key: 'android.r8.optimizedResourceShrinking', value: 'true' },
    ]);
    expect(optimizeGradleProperties(result)).toEqual(result);
  });
});
