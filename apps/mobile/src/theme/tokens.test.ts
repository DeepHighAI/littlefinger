import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  colors,
  duration,
  easing,
  elevation,
  fontFamily,
  gutter,
  line,
  NOT_PORTED_TOKENS,
  radius,
  size,
  space,
  type,
  weight,
} from './tokens';

/**
 * 근거: 04_AI-Agent_코딩가이드 §5-1.
 *
 * tokens.css 가 디자인 값의 유일한 정의다. 이 테스트는 tokens.ts 가 그 원본과
 * 어긋나지 않는지를 기계적으로 대조한다 — 토큰 90개를 눈으로 옮기면 반드시 하나는 틀린다.
 *
 * design-reference/ 는 읽기 전용이므로, 이 테스트가 실패하면 고쳐야 하는 쪽은 항상 tokens.ts 다.
 */

const TOKENS_CSS = join(__dirname, '../../../../design-reference/styles/tokens.css');

/** `--lf-foo-bar: value;` 를 전부 뽑아 { 'foo-bar': 'value' } 로 만든다. */
function parseCssTokens(): Map<string, string> {
  const css = readFileSync(TOKENS_CSS, 'utf8');
  const found = new Map<string, string>();

  for (const match of css.matchAll(/--lf-([a-z0-9-]+)\s*:\s*([^;]+);/gu)) {
    const name = match[1];
    const value = match[2];
    if (name === undefined || value === undefined) continue;
    // 값 뒤에 붙은 줄끝 주석은 CSS 파서가 아니므로 여기서 떼어낸다.
    found.set(name, value.replace(/\/\*.*$/u, '').trim());
  }

  return found;
}

const cssTokens = parseCssTokens();

/** `space-1` → `1`, `on-primary-container` → `onPrimaryContainer` */
function camel(kebab: string): string {
  return kebab.replace(/-([a-z0-9])/gu, (_, char: string) => char.toUpperCase());
}

/** `16px` → 16, `9999px` → 9999, `200ms` → 200 */
function unitless(value: string): number {
  return Number(value.replace(/px|ms/u, ''));
}

describe('토큰이 하나도 누락되지 않았다', () => {
  test('tokens.css 는 90개 토큰을 정의한다', () => {
    expect(cssTokens.size).toBe(90);
  });

  test('CSS 의 모든 토큰이 이식됐거나 제외 사유가 적혀 있다', () => {
    /** CSS 토큰 이름 → 어느 TS 객체의 어느 키가 되는지 */
    const groups: { prefix: string; keys: string[]; toKey: (rest: string) => string }[] = [
      { prefix: 'color-', keys: Object.keys(colors), toKey: camel },
      { prefix: 'font-', keys: Object.keys(fontFamily), toKey: camel },
      { prefix: 'type-', keys: Object.keys(type), toKey: (r) => camel(r.replace('-size', '')) },
      { prefix: 'line-', keys: Object.keys(line), toKey: camel },
      { prefix: 'weight-', keys: Object.keys(weight), toKey: camel },
      { prefix: 'radius-', keys: Object.keys(radius), toKey: (r) => r },
      { prefix: 'space-', keys: Object.keys(space), toKey: (r) => r },
      { prefix: 'gutter-', keys: Object.keys(gutter), toKey: camel },
      { prefix: 'elevation-', keys: Object.keys(elevation), toKey: camel },
      { prefix: 'easing-', keys: Object.keys(easing), toKey: camel },
      { prefix: 'duration-', keys: Object.keys(duration), toKey: camel },
    ];
    const sizeKeys = Object.keys(size);

    const unaccounted: string[] = [];
    for (const name of cssTokens.keys()) {
      if (NOT_PORTED_TOKENS.some((entry) => entry.token === name)) continue;

      const group = groups.find((g) => name.startsWith(g.prefix));
      const isPorted = group
        ? group.keys.includes(group.toKey(name.slice(group.prefix.length)))
        : // size 그룹만 접두사가 없다 (touch-min, cta-height …)
          sizeKeys.includes(camel(name));

      if (!isPorted) unaccounted.push(`--lf-${name}`);
    }

    expect(unaccounted).toEqual([]);
  });

  test('제외한 토큰은 실제로 CSS 에 있는 것들이다', () => {
    // 존재하지 않는 토큰을 제외 목록에 넣어 검사를 우회할 수 없게 한다.
    const missing = NOT_PORTED_TOKENS.filter((e) => !cssTokens.has(e.token)).map((e) => e.token);
    expect(missing).toEqual([]);
  });

  test('제외한 토큰에는 전부 사유가 붙어 있다', () => {
    const withoutReason = NOT_PORTED_TOKENS.filter((e) => e.reason.trim().length < 10).map(
      (e) => e.token,
    );
    expect(withoutReason).toEqual([]);
    expect(NOT_PORTED_TOKENS.length).toBe(6);
  });
});

describe('색상은 문자열 그대로 옮긴다', () => {
  test.each(
    [...cssTokens.entries()]
      .filter(([name]) => name.startsWith('color-') && name !== 'color-frame-border')
      .map(([name, value]) => [name, value] as const),
  )('--lf-%s = %s', (name, expected) => {
    const key = camel(name.replace('color-', '')) as keyof typeof colors;
    expect(colors[key]).toBe(expected);
  });
});

describe('치수는 px 를 뗀 숫자다 — CSS px 값이 곧 RN dp 다', () => {
  test.each([...cssTokens.entries()].filter(([n]) => n.startsWith('type-')))(
    '--lf-%s = %s',
    (name, expected) => {
      const key = camel(name.replace('type-', '').replace('-size', '')) as keyof typeof type;
      expect(type[key]).toBe(unitless(expected));
    },
  );

  test.each([...cssTokens.entries()].filter(([n]) => n.startsWith('line-')))(
    '--lf-%s = %s',
    (name, expected) => {
      expect(line[camel(name.replace('line-', '')) as keyof typeof line]).toBe(unitless(expected));
    },
  );

  test.each([...cssTokens.entries()].filter(([n]) => n.startsWith('space-')))(
    '--lf-%s = %s',
    (name, expected) => {
      expect(space[name.replace('space-', '') as unknown as keyof typeof space]).toBe(
        unitless(expected),
      );
    },
  );

  test.each([...cssTokens.entries()].filter(([n]) => n.startsWith('gutter-')))(
    '--lf-%s = %s',
    (name, expected) => {
      expect(gutter[name.replace('gutter-', '') as keyof typeof gutter]).toBe(unitless(expected));
    },
  );

  test.each([...cssTokens.entries()].filter(([n]) => n.startsWith('radius-')))(
    '--lf-%s = %s',
    (name, expected) => {
      expect(radius[name.replace('radius-', '') as keyof typeof radius]).toBe(unitless(expected));
    },
  );

  test.each([...cssTokens.entries()].filter(([n]) => n.startsWith('duration-')))(
    '--lf-%s = %s',
    (name, expected) => {
      expect(duration[name.replace('duration-', '') as keyof typeof duration]).toBe(
        unitless(expected),
      );
    },
  );
});

describe('RN 에서 모양이 달라지는 토큰', () => {
  test('웨이트는 문자열이다 — RN fontWeight 가 문자열을 받는다', () => {
    expect(weight).toEqual({ regular: '400', medium: '600', bold: '700', heavy: '800' });
    for (const value of Object.values(weight)) {
      expect(typeof value).toBe('string');
    }
  });

  test('radius.pill 은 9999 다', () => {
    expect(radius.pill).toBe(9999);
  });

  test('그림자는 box-shadow 대신 객체다', () => {
    // --lf-elevation-card: 0 1px 3px rgba(34, 25, 26, 0.06);
    expect(elevation.card).toEqual({
      shadowColor: '#22191A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    });
    // --lf-elevation-fab: 0 8px 20px rgba(199, 75, 100, 0.4);
    expect(elevation.fab.shadowOffset).toEqual({ width: 0, height: 8 });
    expect(elevation.fab.shadowRadius).toBe(20);
    expect(elevation.fab.shadowOpacity).toBe(0.4);
    // --lf-elevation-sheet: 0 -8px 28px rgba(34, 25, 26, 0.16); — 위로 뜨는 그림자
    expect(elevation.sheet.shadowOffset).toEqual({ width: 0, height: -8 });
    expect(elevation.sheet.shadowRadius).toBe(28);
  });

  test('이징은 베지어 계수 배열이다', () => {
    // cubic-bezier 인자를 그대로 옮긴다. Easing.bezier 로 만드는 건 애니메이션 쪽 몫이고,
    // 여기서 만들면 tokens.ts 가 react-native-reanimated 를 import 하게 된다.
    expect(easing.standard).toEqual([0.2, 0, 0, 1]);
    expect(easing.emphasizedDecelerate).toEqual([0.05, 0.7, 0.1, 1]);
  });

  test.each([...cssTokens.entries()].filter(([n]) => n.startsWith('easing-')))(
    '--lf-%s 계수가 CSS 의 cubic-bezier 인자와 같다',
    (name, css) => {
      const args = css.match(/cubic-bezier\(([^)]+)\)/u)?.[1]?.split(',').map(Number);
      expect(easing[camel(name.replace('easing-', '')) as keyof typeof easing]).toEqual(args);
    },
  );
});

describe('접근성 하한', () => {
  test('터치 타깃 최소치는 48 이고 줄이지 않는다', () => {
    // 04 §5-1: "touchMin: 48 은 접근성 하한. 줄이지 않는다"
    expect(size.touchMin).toBe(48);
    expect(size.touchMin).toBe(unitless(cssTokens.get('touch-min') ?? ''));
  });

  test('주요 높이가 CSS 와 일치한다', () => {
    expect(size.ctaHeight).toBe(unitless(cssTokens.get('cta-height') ?? ''));
    expect(size.actionHeight).toBe(unitless(cssTokens.get('action-height') ?? ''));
    expect(size.appbarHeight).toBe(unitless(cssTokens.get('appbar-height') ?? ''));
    expect(size.fabHeight).toBe(unitless(cssTokens.get('fab-height') ?? ''));
    expect(size.tabHeight).toBe(unitless(cssTokens.get('tab-height') ?? ''));
    expect(size.iconButton).toBe(unitless(cssTokens.get('icon-button') ?? ''));
  });
});
