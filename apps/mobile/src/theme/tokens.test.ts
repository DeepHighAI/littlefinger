import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  border,
  colors,
  duration,
  easing,
  elevation,
  fontFamily,
  gutter,
  letterSpacing,
  line,
  NOT_PORTED_TOKENS,
  radius,
  size,
  space,
  tilt,
  type,
  weight,
} from './tokens';

/**
 * 근거: 04_AI-Agent_코딩가이드 §5-1.
 *
 * canonical tokens.css 가 디자인 값의 유일한 정의다. 이 테스트는 tokens.ts 가 그 원본과
 * 어긋나지 않는지를 기계적으로 대조한다 — 토큰을 눈으로 옮기면 반드시 하나는 틀린다.
 *
 * design-reference/ 는 읽기 전용이므로, 이 테스트가 실패하면 고쳐야 하는 쪽은 항상 tokens.ts 다.
 */

const TOKENS_CSS = join(
  __dirname,
  '../../../../design-reference/styles/tokens.css',
);
const WEB_TOKENS_CSS = join(__dirname, '../../../web/src/styles/tokens.css');
const WEB_COMPONENTS_CSS = join(__dirname, '../../../web/src/styles/components.css');
const REFERENCE_COMPONENTS_CSS = join(
  __dirname,
  '../../../../design-reference/styles/components.css',
);
const REFERENCE_APP_CREATE_CSS = join(
  __dirname,
  '../../../../design-reference/styles/screens/app-create.css',
);
const REFERENCE_APP_DETAIL_CSS = join(
  __dirname,
  '../../../../design-reference/styles/screens/app-detail.css',
);
const REFERENCE_APP_SUPPORT_CSS = join(
  __dirname,
  '../../../../design-reference/styles/screens/app-support.css',
);
const REFERENCE_WEB_SCREEN_CSS = join(
  __dirname,
  '../../../../design-reference/styles/screens/web.css',
);
const WEB_SCREEN_CSS = join(__dirname, '../../../web/src/styles/screens/web.css');

/** `--lf-foo-bar: value;` 를 전부 뽑아 { 'foo-bar': 'value' } 로 만든다. */
function parseCssTokens(path: string): Map<string, string> {
  const css = readFileSync(path, 'utf8');
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

const cssTokens = parseCssTokens(TOKENS_CSS);
const webCssTokens = parseCssTokens(WEB_TOKENS_CSS);

/** `space-1` → `1`, `on-primary-container` → `onPrimaryContainer` */
function camel(kebab: string): string {
  return kebab.replace(/-([a-z0-9])/gu, (_, char: string) => char.toUpperCase());
}

/** `16px` → 16, `9999px` → 9999, `200ms` → 200 */
function unitless(value: string): number {
  return Number(value.replace(/px|ms/u, ''));
}

function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = hex
      .slice(1)
      .match(/.{2}/gu)
      ?.map((channel) => Number.parseInt(channel, 16) / 255);
    if (channels === undefined) throw new Error(`Invalid color: ${hex}`);

    const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };

  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('토큰이 하나도 누락되지 않았다', () => {
  test('canonical tokens.css 는 P7 소비자 정리 후 토큰 176개를 정의한다', () => {
    // 2026-09-03: 117 + 타이포 13 + 자간 4 + 테두리 5 + 기울기 4 + 치수 40 + 모션 2.
    expect(cssTokens.size).toBe(176);
  });

  test('CSS 의 모든 토큰이 이식됐거나 제외 사유가 적혀 있다', () => {
    /** CSS 토큰 이름 → 어느 TS 객체의 어느 키가 되는지 */
    const groups: { prefix: string; keys: string[]; toKey: (rest: string) => string }[] = [
      { prefix: 'color-', keys: Object.keys(colors), toKey: camel },
      { prefix: 'font-', keys: Object.keys(fontFamily), toKey: camel },
      { prefix: 'type-', keys: Object.keys(type), toKey: (r) => camel(r.replace('-size', '')) },
      { prefix: 'line-', keys: Object.keys(line), toKey: camel },
      { prefix: 'weight-', keys: Object.keys(weight), toKey: camel },
      { prefix: 'letter-spacing-', keys: Object.keys(letterSpacing), toKey: camel },
      { prefix: 'radius-', keys: Object.keys(radius), toKey: camel },
      { prefix: 'tilt-', keys: Object.keys(tilt), toKey: camel },
      { prefix: 'border-', keys: Object.keys(border), toKey: camel },
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

describe('잉크&스티커 웹 토큰도 같은 계약을 쓴다', () => {
  test('수락 웹의 모든 토큰 값이 확정안과 일치한다', () => {
    for (const [name, expected] of cssTokens) {
      expect(webCssTokens.get(name)).toBe(expected);
    }
    expect(webCssTokens.get('color-primary')).toBe('#221C13');
    expect(webCssTokens.get('color-primary-hover')).toBe('#16120C');
    expect(webCssTokens.get('color-primary-pressed')).toBe('#0B0906');
    // 파스텔 위 글자는 잉크 — 색 글자는 폐지됐다 (PO 2026-09-03, D7).
    expect(webCssTokens.get('color-record')).toBe('#221C13');
    expect(webCssTokens.get('color-attention')).toBe('#221C13');
    expect(webCssTokens.get('color-primary-container')).toBe('#FFE59A');
    expect(webCssTokens.get('color-success-container')).toBe('#B7E1D1');
  });

  test('안내·응답·안읽음 상태가 역할 기반 색을 쓴다', () => {
    const css = readFileSync(WEB_COMPONENTS_CSS, 'utf8');

    // 잉크&스티커: notice 는 잉크 밑줄 스타일 — 본문 색은 text-secondary (ADR 0012)
    expect(css).toMatch(
      /\.lf-notice\s*\{[^}]*color:\s*var\(--lf-color-text-secondary\)/su,
    );
    expect(css).toMatch(
      /\.lf-card--container\s+\.lf-dday\s*\{[^}]*color:\s*var\(--lf-color-success\)/su,
    );
    // 읽지 않은 알림은 옐로 스티커 카드다 — 헤드라인 색이 아니라 배경으로 구분한다 (2026-09-03)
    expect(css).toMatch(
      /\.lf-list-item--unread\s*\{[^}]*background:\s*var\(--lf-color-primary-container\)/su,
    );
  });

  test('수락 웹의 components.css 는 레퍼런스와 바이트 단위로 같다', () => {
    // 웹 전용 규칙은 screens/web.css 의 WEB ONLY 구획에만 둔다. 여기가 어긋나면 드리프트다.
    expect(readFileSync(WEB_COMPONENTS_CSS, 'utf8')).toBe(
      readFileSync(REFERENCE_COMPONENTS_CSS, 'utf8'),
    );
  });

  test.each([REFERENCE_COMPONENTS_CSS, WEB_COMPONENTS_CSS])(
    '디스클레이머와 보조 안내는 큰 볼드 보조문으로 읽힌다: %s',
    (path) => {
      const css = readFileSync(path, 'utf8');
      const disclaimer = /\.lf-disclaimer\s*\{(?<body>[^}]*)\}/su.exec(css)?.groups?.body;

      expect(disclaimer).toContain('font-size: var(--lf-type-caption-size)');
      expect(disclaimer).toContain('line-height: var(--lf-line-caption)');
      expect(disclaimer).toContain('font-weight: var(--lf-weight-bold)');
      expect(disclaimer).toContain('color: var(--lf-color-text-secondary)');
    },
  );

  test.each([REFERENCE_COMPONENTS_CSS, WEB_COMPONENTS_CSS])(
    '입력 포커스는 잉크 테두리 밖에 별도 포커스 링으로 표시된다: %s',
    (path) => {
      const css = readFileSync(path, 'utf8');
      const focus = /\.lf-input:focus-visible\s*\{(?<body>[^}]*)\}/su.exec(css)?.groups?.body;

      expect(focus).toContain('outline: 2px solid var(--lf-color-focus-ring)');
      expect(focus).toContain('outline-offset: var(--lf-space-1)');
    },
  );

  test.each([REFERENCE_COMPONENTS_CSS, WEB_COMPONENTS_CSS])(
    '보조 본문은 14/22 보조색, 메타는 12 뮤트, 필드 라벨은 eyebrow 다 (파스텔 스티커 계층): %s',
    (path) => {
      const css = readFileSync(path, 'utf8');
      const bodyOf = (selector: string) =>
        new RegExp(`\\.${selector}\\s*\\{(?<body>[^}]*)\\}`, 'su').exec(css)?.groups?.body;

      for (const selector of ['lf-body--secondary', 'lf-caption']) {
        const body = bodyOf(selector);
        expect(body).toContain('font-size: var(--lf-type-label-size)');
        expect(body).toContain('line-height: var(--lf-line-body)');
        expect(body).toContain('color: var(--lf-color-text-secondary)');
      }
      for (const selector of ['lf-list-item__supporting', 'lf-card__meta']) {
        const body = bodyOf(selector);
        expect(body).toContain('font-size: var(--lf-type-meta-size)');
        expect(body).toContain('line-height: var(--lf-line-caption)');
      }
      const label = bodyOf('lf-field__label');
      expect(label).toContain('font-size: var(--lf-type-eyebrow-size)');
      expect(label).toContain('letter-spacing: var(--lf-letter-spacing-wide)');
      expect(label).toContain('font-weight: var(--lf-weight-bold)');
      expect(label).toContain('color: var(--lf-color-text-muted)');
    },
  );

  test.each([REFERENCE_COMPONENTS_CSS, WEB_COMPONENTS_CSS])(
    '필드 힌트는 12.5/18 볼드 보조문이고 증빙 타일은 고대비 잉크다: %s',
    (path) => {
      const css = readFileSync(path, 'utf8');
      const hint = /\.lf-field__hint\s*\{(?<body>[^}]*)\}/su.exec(css)?.groups?.body;
      const proof = /\.lf-proof\s*\{(?<body>[^}]*)\}/su.exec(css)?.groups?.body;

      for (const body of [hint, proof]) {
        expect(body).toContain('font-size: var(--lf-type-caption-size)');
        expect(body).toContain('line-height: var(--lf-line-caption)');
        expect(body).toContain('font-weight: var(--lf-weight-bold)');
      }
      expect(hint).toContain('color: var(--lf-color-text-secondary)');
      expect(proof).toContain('color: var(--lf-color-text)');
    },
  );

  test('앱 전용 보조 문구도 같은 가독성 계층을 쓴다', () => {
    const create = readFileSync(REFERENCE_APP_CREATE_CSS, 'utf8');
    const detail = readFileSync(REFERENCE_APP_DETAIL_CSS, 'utf8');
    const support = readFileSync(REFERENCE_APP_SUPPORT_CSS, 'utf8');

    expect(create).toMatch(
      /\.lf-field__optional\s*\{[^}]*font-weight:\s*var\(--lf-weight-bold\)[^}]*color:\s*var\(--lf-color-text-secondary\)/su,
    );
    expect(create).toMatch(
      /\.lf-proof--thumb \.lf-proof__filename\s*\{[^}]*font-size:\s*var\(--lf-type-caption-size\)[^}]*font-weight:\s*var\(--lf-weight-bold\)[^}]*color:\s*var\(--lf-color-text\)/su,
    );
    expect(detail).toMatch(
      /\.lf-photo__caption\s*\{[^}]*font-size:\s*var\(--lf-type-caption-size\)[^}]*font-weight:\s*var\(--lf-weight-bold\)[^}]*color:\s*var\(--lf-color-text\)/su,
    );
    expect(support).toMatch(
      /\.lf-trust-card__note\s*\{[^}]*font-size:\s*var\(--lf-type-caption-size\)[^}]*font-weight:\s*var\(--lf-weight-bold\)[^}]*color:\s*var\(--lf-color-primary-ink\)/su,
    );
  });

  test.each([REFERENCE_WEB_SCREEN_CSS, WEB_SCREEN_CSS])(
    '증빙 추가 타일 라벨은 12.5/18 볼드 보조문이다: %s',
    (path) => {
      const css = readFileSync(path, 'utf8');
      expect(css).toMatch(
        /\.lf-attach-btn__label\s*\{[^}]*font-size:\s*var\(--lf-type-caption-size\)[^}]*line-height:\s*var\(--lf-line-caption\)[^}]*font-weight:\s*var\(--lf-weight-bold\)/su,
      );
      expect(css).toMatch(
        /\.lf-diff-old\s*\{[^}]*color:\s*var\(--lf-color-text-secondary\)/su,
      );
    },
  );
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
      expect(radius[camel(name.replace('radius-', '')) as keyof typeof radius]).toBe(
        unitless(expected),
      );
    },
  );

  test.each([...cssTokens.entries()].filter(([n]) => n.startsWith('border-')))(
    '--lf-%s = %s',
    (name, expected) => {
      expect(border[camel(name.replace('border-', '')) as keyof typeof border]).toBe(
        unitless(expected),
      );
    },
  );

  test.each([...cssTokens.entries()].filter(([n]) => n.startsWith('letter-spacing-')))(
    '--lf-%s = %s (em 은 LfText 가 fontSize 로 환산한다)',
    (name, expected) => {
      const key = camel(name.replace('letter-spacing-', '')) as keyof typeof letterSpacing;
      expect(letterSpacing[key]).toBe(Number(expected.replace('em', '')));
    },
  );

  test.each([...cssTokens.entries()].filter(([n]) => n.startsWith('tilt-')))(
    '--lf-%s = %s (RN rotate 는 deg 문자열 그대로)',
    (name, expected) => {
      expect(tilt[camel(name.replace('tilt-', '')) as keyof typeof tilt]).toBe(expected);
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
  test('한국어·영어와 모든 텍스트 역할은 Pretendard 한 패밀리를 쓴다', () => {
    expect(fontFamily).toEqual({ brand: 'Pretendard', mono: 'Pretendard' });
  });

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
    // 스티커식 오프셋 섀도(블러 0) — 안드로이드는 elevation 근사로 그린다 (ADR 0012).
    expect(elevation.card).toEqual({
      shadowColor: '#221C13',
      shadowOffset: { width: 3, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 0,
      elevation: 1,
    });
    expect(elevation.fab.shadowOffset).toEqual({ width: 3, height: 4 });
    expect(elevation.fab.shadowRadius).toBe(0);
    expect(elevation.fab.shadowOpacity).toBe(0.22);
    expect(elevation.sheet.shadowColor).toBe('#221C13');
    expect(elevation.sheet.shadowOffset).toEqual({ width: 0, height: -6 });
    expect(elevation.sheet.shadowRadius).toBe(24);
    expect(elevation.sheet.shadowOpacity).toBe(0.12);
  });

  test('이징은 베지어 계수 배열이다', () => {
    // cubic-bezier 인자를 그대로 옮긴다. Easing.bezier 로 만드는 건 애니메이션 쪽 몫이고,
    // 여기서 만들면 tokens.ts 가 react-native-reanimated 를 import 하게 된다.
    expect(easing.standard).toEqual([0, 0, 0, 1]);
    expect(easing.emphasizedDecelerate).toEqual([0.05, 0.7, 0.1, 1]);
    expect(easing.pinky).toEqual([0.32, 0.72, 0, 1]);
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
  test.each([
    ['보조문/크림 바탕', colors.textSecondary, colors.background],
    ['보조문/종이 표면', colors.textSecondary, colors.surface],
    ['뮤트문/크림 바탕', colors.textMuted, colors.background],
    ['뮤트문/종이 표면', colors.textMuted, colors.surface],
    ['희미문/크림 바탕', colors.textFaint, colors.background],
    ['희미문/종이 표면', colors.textFaint, colors.surface],
    ['증빙문/뮤트 표면', colors.text, colors.surfaceMuted],
    ['지킴율 설명/옐로 카드', colors.primaryInk, colors.primaryContainer],
    // 파스텔 4면 위 글자는 언제나 잉크 — 스티커 톤이 늘어도 이 쌍은 그대로 통과해야 한다.
    ['잉크/옐로 스티커', colors.text, colors.primaryContainer],
    ['잉크/민트 스티커', colors.text, colors.successContainer],
    ['잉크/핑크 스티커', colors.text, colors.attentionContainer],
    ['잉크/스카이 스티커', colors.text, colors.recordContainer],
    ['보조문/옐로 스티커 (읽지 않음 알림 부제)', colors.textSecondary, colors.primaryContainer],
  ] as const)('%s 텍스트 대비는 WCAG AA 4.5:1 이상이다', (_, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  test.each([
    ['크림 바탕', colors.background],
    ['종이 표면', colors.surface],
    ['옐로 스티커', colors.primaryContainer],
    ['민트 스티커', colors.successContainer],
    ['핑크 스티커', colors.attentionContainer],
    ['스카이 스티커', colors.recordContainer],
  ] as const)('포커스 링/%s 대비는 WCAG 비텍스트 기준 3:1 이상이다', (_, background) => {
    expect(contrastRatio(colors.focusRing, background)).toBeGreaterThanOrEqual(3);
    expect(colors.focusRing).not.toBe(colors.text);
  });

  test.each([
    ['default', colors.primary],
    ['hover', colors.primaryHover],
    ['pressed', colors.primaryPressed],
  ] as const)('primary 액션 %s 상태의 텍스트 대비는 WCAG AA 4.5:1 이상이다', (_, background) => {
    expect(contrastRatio(colors.onPrimary, background)).toBeGreaterThanOrEqual(4.5);
  });

  test.each([
    ['default', colors.actionFill],
    ['pressed', colors.actionFillPressed],
  ] as const)('소프트 액션 %s 상태의 텍스트 대비는 WCAG AA 4.5:1 이상이다', (_, background) => {
    expect(contrastRatio(colors.onAction, background)).toBeGreaterThanOrEqual(4.5);
  });

  test('정보·주의·위험 역할이 서로 다른 스티커 면을 쓴다', () => {
    // 글자는 셋 다 잉크로 합쳐졌으므로(D7) 역할 구분은 컨테이너가 진다.
    expect(
      new Set([colors.recordContainer, colors.attentionContainer, colors.errorContainer]).size,
    ).toBe(3);
    expect(colors.recordContainer).toBe('#A9D3FF');
    expect(colors.attentionContainer).toBe('#FFB5C1');
    expect(colors.errorContainer).toBe('#F8DFDB');
    // 진행·완료(민트)는 브랜드(옐로)와도 구분된다 — 상태 도트가 색+텍스트로 읽히는 전제.
    expect(colors.successContainer).not.toBe(colors.primaryContainer);
  });

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
    expect(size.appbarIcon).toBe(unitless(cssTokens.get('appbar-icon') ?? ''));
    expect(size.inputHeight).toBe(unitless(cssTokens.get('input-height') ?? ''));
    expect(size.iconCircle).toBe(unitless(cssTokens.get('icon-circle') ?? ''));
    expect(size.kakaoHeight).toBe(unitless(cssTokens.get('kakao-height') ?? ''));
    expect(size.trustRing).toBe(unitless(cssTokens.get('trust-ring') ?? ''));
    expect(size.switchWidth).toBe(unitless(cssTokens.get('switch-width') ?? ''));
  });
});
