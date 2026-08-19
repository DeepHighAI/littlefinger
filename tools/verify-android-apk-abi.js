'use strict';

const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');

function verifyPhysicalDeviceAbi(entries) {
  const nativeAbis = new Set(
    [...entries.matchAll(/^lib\/([^/]+)\//gm)].map((match) => match[1]),
  );
  const detected = nativeAbis.size === 0 ? '없음' : [...nativeAbis].sort().join(', ');
  if (!nativeAbis.has('arm64-v8a')) {
    throw new Error(
      `실기기 설치용 APK에는 arm64-v8a가 필요하다. 감지된 ABI: ${detected}`,
    );
  }
  return [...nativeAbis].sort();
}

module.exports = { verifyPhysicalDeviceAbi };

if (require.main === module) {
  const apkPath = process.argv[2];

  if (!apkPath || !existsSync(apkPath)) {
    console.error('검증할 APK 경로를 지정해야 한다.');
    process.exit(1);
  }

  try {
    const entries = execFileSync('jar', ['tf', apkPath], { encoding: 'utf8' });
    const nativeAbis = verifyPhysicalDeviceAbi(entries);
    console.log(`실기기 APK ABI 검증 통과: ${nativeAbis.join(', ')}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : `APK 파일을 읽을 수 없다: ${apkPath}`;
    console.error(message);
    process.exit(1);
  }
}
