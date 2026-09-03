import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as fontkit from 'fontkit';
import { describe, expect, test } from 'vitest';

/**
 * 근거: 04 §5-3 (self-host) · 04 §5-4 (정적 파일 원칙) · 2026-09-03 확정안(Material Symbols Rounded).
 *
 * 생성기의 산출물 넷이 서로 어긋나면 증상이 조용하다 — 앱은 두부, 웹은 빈 칸. 그래서 표 두 벌의
 * 바이트 동일, 앱 TTF 의 정적성(fvar 없음), 표의 모든 코드포인트가 두 폰트에 실제로 있는지를
 * 여기서 잠근다. 생성기를 다시 돌리지 않고 표만 손으로 고치면 이 테스트가 막는다.
 */

const url = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const WEB_MAP = url('../apps/web/src/components/icon-codepoints.ts');
const MOBILE_MAP = url('../apps/mobile/src/theme/icon-codepoints.ts');
const WEB_FONT = url('../apps/web/src/assets/fonts/material-symbols-rounded-subset.woff2');
const MOBILE_FONT = url('../apps/mobile/assets/fonts/MaterialSymbolsRounded-subset.ttf');

function parseMap(source: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const [, name, hex] of source.matchAll(/^ {2}'([a-z0-9_]+)': 0x([0-9a-f]+),$/gm)) {
    map.set(name!, Number.parseInt(hex!, 16));
  }
  return map;
}

const webMapSource = readFileSync(WEB_MAP, 'utf8');
const codePoints = parseMap(webMapSource);

describe('아이콘 코드포인트 표', () => {
  test('웹과 앱의 표가 바이트 단위로 같다', () => {
    expect(readFileSync(MOBILE_MAP, 'utf8')).toBe(webMapSource);
  });

  test('표가 비어 있지 않고 모든 코드포인트가 PUA 에 있다', () => {
    expect(codePoints.size).toBeGreaterThan(0);
    for (const cp of codePoints.values()) {
      expect(cp).toBeGreaterThanOrEqual(0xe000);
      expect(cp).toBeLessThanOrEqual(0xf8ff);
    }
  });

  test('선언된 개수가 실제 항목 수와 같다', () => {
    const declared = /서브셋 폰트에 이 (\d+)개만/.exec(webMapSource)?.[1];
    expect(Number(declared)).toBe(codePoints.size);
  });
});

describe.each([
  ['웹 woff2', WEB_FONT],
  ['앱 TTF', MOBILE_FONT],
])('%s 서브셋', (_label, path) => {
  const font = fontkit.openSync(path);

  test('표의 모든 코드포인트에 글리프가 있다', () => {
    for (const [name, cp] of codePoints) {
      expect(font.hasGlyphForCodePoint(cp), name).toBe(true);
    }
  });

  test('표 밖의 아이콘은 들어 있지 않다', () => {
    // harfbuzz 는 .notdef 로 가는 U+0000 매핑을 항상 남기므로 PUA 범위만 비교한다.
    const icons = font.characterSet.filter((cp) => cp >= 0xe000 && cp <= 0xf8ff).sort((a, b) => a - b);
    expect(icons).toEqual([...codePoints.values()].sort((a, b) => a - b));
  });
});

describe('앱 TTF 의 정적 인스턴스', () => {
  const font = fontkit.openSync(MOBILE_FONT);

  test('가변 축이 없다 — RN 안드로이드가 축을 잘못 고를 여지를 없앤다', () => {
    expect(Object.keys(font.variationAxes)).toEqual([]);
  });

  test('TrueType/OpenType 컨테이너다 (expo-font 는 woff2 를 읽지 못한다)', () => {
    const magic = readFileSync(MOBILE_FONT).readUInt32BE(0);
    expect([0x00010000, 0x4f54544f]).toContain(magic);
  });
});
