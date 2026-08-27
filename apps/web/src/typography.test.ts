import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '../../..');

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

describe('Pretendard 단일 서체 계약', () => {
  it('기준·웹 토큰의 모든 텍스트 패밀리가 Pretendard로 시작한다', () => {
    for (const path of [
      'design-reference/styles/tokens.css',
      'apps/web/src/styles/tokens.css',
    ]) {
      const css = read(path);
      expect(css).toMatch(/--lf-font-brand:\s*'Pretendard'/u);
      expect(css).toMatch(/--lf-font-mono:\s*'Pretendard'/u);
      expect(css).not.toMatch(/Gaegu|Roboto Mono/u);
    }
  });

  it('웹 진입점과 앱·웹 패키지에 이전 텍스트 폰트 의존성이 없다', () => {
    const sources = [
      read('apps/web/src/main.tsx'),
      read('apps/web/package.json'),
      read('apps/mobile/package.json'),
    ].join('\n');

    expect(sources).not.toMatch(/@fontsource\/(?:gaegu|roboto-mono)|@expo-google-fonts\/gaegu/u);
  });

  it('굵기 토큰은 Pretendard 400·600·700·800과 일치한다', () => {
    const css = read('design-reference/styles/tokens.css');
    expect(css).toMatch(/--lf-weight-regular:\s*400;/u);
    expect(css).toMatch(/--lf-weight-medium:\s*600;/u);
    expect(css).toMatch(/--lf-weight-bold:\s*700;/u);
    expect(css).toMatch(/--lf-weight-heavy:\s*800;/u);
  });
});
