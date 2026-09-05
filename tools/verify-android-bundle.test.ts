import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const { verifyAndroidBundle } = require('./verify-android-bundle.js') as {
  verifyAndroidBundle(sourceMap: unknown): { sourceCount: number };
};
const sources = [
  '../../apps/mobile/src/lib/query-string-safe.js',
  '../../apps/mobile/src/lib/ads-consent-native.ts',
  '../../node_modules/react-native-google-mobile-ads/src/index.ts',
  '../../node_modules/expo-iap/src/index.ts',
];

describe('Android bundle module verification', () => {
  test('accepts required production modules', () => {
    expect(verifyAndroidBundle({ version: 3, sources })).toEqual({ sourceCount: 4 });
  });
  test('normalizes Windows paths', () => {
    expect(verifyAndroidBundle({ version: 3, sources: sources.map((s) => s.replaceAll('/', '\\')) }))
      .toEqual({ sourceCount: 4 });
  });
  test.each([null, {}, { version: 3, sources: [] }, { version: 3, sources: [null] }])(
    'rejects malformed maps: %j', (sourceMap) => {
      expect(() => verifyAndroidBundle(sourceMap)).toThrow('source map');
    },
  );
  test.each(sources)('rejects a missing required module: %s', (missing) => {
    expect(() => verifyAndroidBundle({ version: 3, sources: sources.filter((s) => s !== missing) }))
      .toThrow('필수 번들 모듈 누락');
  });
  test.each([
    '../../node_modules/decode-uri-component/index.js',
    '../../node_modules/expo-router/node_modules/query-string/index.js',
    '../../dist/readiness-qa.entry.js',
    '../../apps/mobile/__mocks__/admob.js',
  ])('rejects unsafe or fixture modules: %s', (extra) => {
    expect(() => verifyAndroidBundle({ version: 3, sources: [...sources, extra] }))
      .toThrow('구형 쿼리 파서 또는 QA');
  });
});
