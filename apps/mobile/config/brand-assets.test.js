const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

/**
 * E-1 마스코트 자산 — 2026-09-03 확정안(파스텔 × 잉크 & 스티커).
 *
 * 마스터는 design-reference 에 있고 앱·웹은 바이트 복사본을 쓴다. 한쪽만 다시 내보내면 세 표면의
 * 마스코트가 미세하게 달라지고 아무도 눈치채지 못하므로 해시로 잠근다. 바꿀 때는 마스터를 먼저
 * 갈고, 복사본을 다시 만든 뒤, 여기 해시를 같은 커밋에서 옮긴다.
 */

const referenceDir = resolve(__dirname, '../../../design-reference/assets/images');
const mobileDir = resolve(__dirname, '../assets/images');
const webDir = resolve(__dirname, '../../web/src/assets/images');

const PNG_RGBA = 6;

const MASTERS = {
  'mascot-face-e1.png': {
    width: 512,
    height: 512,
    sha256: 'e08498091f8aebfc15385baf8d7bb8a03bd8ebcfe6006fd68dd33dd8c473a988',
  },
  'eyes-e1.png': {
    width: 200,
    height: 80,
    sha256: '1df3d13008dcfa73f84f20573fa7ef14e947e90f426da17f30cf3435ac6abdeb',
  },
  'hand-color.png': {
    width: 804,
    height: 763,
    sha256: '63f3a4c83dcfbe5a11d29a476bddde4d041ad260ffe2956a072418a9f573cd7c',
  },
  'hand-solid.png': {
    width: 804,
    height: 763,
    sha256: 'e5c869d06057133d7ca4a3a7304951e3195df9baf86fe1f429e48af9cb3ed4b3',
  },
  'icon-face-e1.png': {
    width: 512,
    height: 512,
    sha256: '6470a60d64effefa5c2b9f7d9f326cfcbfc3651aa4e1c868c7acdeae53928250',
  },
};

// 앱은 런처 원본(icon-face-e1)을 직접 그리지 않는다 — 런처는 export-brand-icons 가 파생한다.
const MOBILE_COPIES = ['mascot-face-e1.png', 'eyes-e1.png', 'hand-color.png', 'hand-solid.png'];
// 웹의 hand-color 는 3초 예산 때문에 402px 파생물이라 바이트 복사 대상이 아니다.
const WEB_COPIES = ['mascot-face-e1.png', 'eyes-e1.png', 'hand-solid.png'];
const WEB_HAND_COLOR = {
  width: 402,
  height: 382,
  sha256: 'aad32d68101980081d951d6c7cf3dd1c7b7fe5ab1f9da2fef96a0e44ebc8ee77',
};

function readPng(path) {
  const buffer = readFileSync(path);
  return {
    buffer,
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

describe('E-1 마스코트 마스터 (design-reference)', () => {
  test.each(Object.entries(MASTERS))('%s 는 승인된 크기·알파·해시다', (file, expected) => {
    const png = readPng(resolve(referenceDir, file));
    expect(png.width).toBe(expected.width);
    expect(png.height).toBe(expected.height);
    expect(png.colorType).toBe(PNG_RGBA);
    expect(png.sha256).toBe(expected.sha256);
  });
});

describe('앱 복사본', () => {
  test.each(MOBILE_COPIES)('%s 는 마스터와 바이트 단위로 같다', (file) => {
    expect(readPng(resolve(mobileDir, file)).buffer.equals(readPng(resolve(referenceDir, file)).buffer)).toBe(
      true,
    );
  });
});

describe('웹 복사본', () => {
  test.each(WEB_COPIES)('%s 는 마스터와 바이트 단위로 같다', (file) => {
    expect(readPng(resolve(webDir, file)).buffer.equals(readPng(resolve(referenceDir, file)).buffer)).toBe(
      true,
    );
  });

  test('hand-color.png 는 402px 폭 파생물이다', () => {
    const png = readPng(resolve(webDir, 'hand-color.png'));
    expect(png.width).toBe(WEB_HAND_COLOR.width);
    expect(png.height).toBe(WEB_HAND_COLOR.height);
    expect(png.colorType).toBe(PNG_RGBA);
    expect(png.sha256).toBe(WEB_HAND_COLOR.sha256);
  });
});
