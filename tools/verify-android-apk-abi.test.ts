import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const { verifyPhysicalDeviceAbi } = require('./verify-android-apk-abi.js') as {
  verifyPhysicalDeviceAbi(entries: string): string[];
};

describe('physical Android APK ABI verification', () => {
  test('accepts an APK containing arm64-v8a native libraries', () => {
    expect(verifyPhysicalDeviceAbi('lib/arm64-v8a/libfixture.so\n')).toEqual(['arm64-v8a']);
  });

  test('rejects an x86_64-only emulator APK', () => {
    expect(() => verifyPhysicalDeviceAbi('lib/x86_64/libfixture.so\n')).toThrow(
      'arm64-v8a가 필요하다. 감지된 ABI: x86_64',
    );
  });
});
