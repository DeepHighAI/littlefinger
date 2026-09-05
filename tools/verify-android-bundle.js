'use strict';

const { readFileSync } = require('node:fs');

function verifyAndroidBundle(sourceMap) {
  if (!sourceMap || sourceMap.version !== 3 || !Array.isArray(sourceMap.sources)
    || sourceMap.sources.length === 0
    || !sourceMap.sources.every((source) => typeof source === 'string')) {
    throw new Error('유효한 Android 번들 source map이 필요합니다.');
  }
  const sources = sourceMap.sources.map((source) => source.replaceAll('\\', '/'));
  const required = [
    'apps/mobile/src/lib/query-string-safe.js',
    'apps/mobile/src/lib/ads-consent-native.ts',
    'node_modules/react-native-google-mobile-ads/',
    'node_modules/expo-iap/',
  ];
  for (const source of required) {
    if (!sources.some((entry) => entry.includes(source))) {
      throw new Error(`필수 번들 모듈 누락: ${source}`);
    }
  }
  // 번들 원문에는 SDK의 테스트 상수도 있으므로 실행 여부를 문자열 검색으로 판단하지 않는다.
  const forbidden = /(?:^|\/)(?:node_modules\/(?:decode-uri-component|query-string)\/|dist\/readiness-|__mocks__\/)/u;
  if (sources.some((source) => forbidden.test(source))) {
    throw new Error('구형 쿼리 파서 또는 QA 대체 모듈이 번들에 포함되어 있습니다.');
  }
  return { sourceCount: sources.length };
}

module.exports = { verifyAndroidBundle };

if (require.main === module) {
  try {
    const sourceMap = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    const result = verifyAndroidBundle(sourceMap);
    console.log(`Android 번들 모듈 검증 통과: ${result.sourceCount}개 소스`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : '번들 검증 실패');
    process.exit(1);
  }
}
