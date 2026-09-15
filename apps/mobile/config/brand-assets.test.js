const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

/**
 * PO 투명 마스코트 자산 — 2026-09-15 교체(ADR 0028). 기존 파일명은 소비 경로를 보존한다.
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
    sha256: '953412d85ec50c6085b81c4597890cad9a6b00810c52d6509dbf56cf830e543c',
  },
  'eyes-e1.png': {
    width: 200,
    height: 80,
    sha256: 'a620538de1c3b8272f7435ceae62d79cf45ddef5e5637d27ffc1640ee700f840',
  },
  'hand-color.png': {
    width: 804,
    height: 763,
    sha256: 'd1e12aac277951dc3c3cd0b94363d8492cf0ba29beb3fb1371ffa15693f75bf1',
  },
  'hand-solid.png': {
    width: 804,
    height: 763,
    sha256: 'd1e12aac277951dc3c3cd0b94363d8492cf0ba29beb3fb1371ffa15693f75bf1',
  },
  'icon-face-e1.png': {
    width: 512,
    height: 512,
    sha256: '0fc3725cc58e2c25f14973203e46bce8911be470198f02393bd57fcfaa1fd976',
  },
};

// 앱은 런처 원본(icon-face-e1)을 직접 그리지 않는다 — 런처는 export-brand-icons 가 파생한다.
const MOBILE_COPIES = ['mascot-face-e1.png', 'eyes-e1.png', 'hand-color.png', 'hand-solid.png'];
// 웹의 hand-color 는 3초 예산 때문에 402px 파생물이라 바이트 복사 대상이 아니다.
const WEB_COPIES = ['mascot-face-e1.png', 'eyes-e1.png', 'hand-solid.png'];
const WEB_HAND_COLOR = {
  width: 402,
  height: 382,
  sha256: '6cbd1eb5b5700be9be8c238c7f297893a2ccbf85f87abbcb794f7b85819f158d',
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
