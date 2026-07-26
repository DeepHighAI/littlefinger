import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

/**
 * 배포 번들이 성립하는지 본다.
 *
 * 이 저장소에는 Deno 도 Docker 도 없어서 `supabase functions serve` 로 확인할 수 없다. 대신
 * **Supabase CLI 번들러가 하는 일을 그대로 흉내낸다** — 진입점에서 상대 import 를 따라가며
 * 파일을 모은다. CLI 의 그 워커는 모듈 해석기가 아니라 텍스트 스캐너라서, 없는 파일을 만나면
 * `WARN:` 을 찍고 **조용히 건너뛴다**. 그래서 배포는 성공한 것처럼 보이고 번들만 깨진다.
 *
 * 구체적으로 이 테스트가 막는 것: `packages/shared` 안의 지정자를 `./config.js` 로 되돌리는
 * 변경. tsc(`moduleResolution: bundler`)도 vitest 도 그건 통과시키므로, 이 테스트가 없으면
 * 배포 전에 알려 줄 것이 아무것도 없다.
 */

const REPO_ROOT = resolve(__dirname, '../..');
const FUNCTIONS_DIR = resolve(REPO_ROOT, 'supabase/functions');

const ENTRYPOINTS = [
  'invite-resolve/index.ts',
  'promise-approve/index.ts',
  'promise-decline/index.ts',
  'promise-amend/index.ts',
];

/** `from '…'` / `import '…'` 의 지정자. CLI 워커와 같은 수준의 텍스트 스캔이다. */
const SPECIFIER = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

function specifiersOf(file: string): string[] {
  return [...readFileSync(file, 'utf8').matchAll(SPECIFIER)].map((match) => match[1] ?? '');
}

function isRelative(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

/** 블록·줄 주석 제거. 문자열 리터럴 안의 `//` 까지 지우지만 이 검사에는 영향이 없다. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

interface Walk {
  files: string[];
  missing: { from: string; specifier: string }[];
}

/** 진입점에서 상대 import 를 따라 모든 파일을 모은다. */
function walk(entrypoint: string): Walk {
  const seen = new Set<string>();
  const missing: { from: string; specifier: string }[] = [];
  const queue = [resolve(FUNCTIONS_DIR, entrypoint)];

  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);

    for (const specifier of specifiersOf(current)) {
      if (!isRelative(specifier)) continue;

      const target = join(dirname(current), specifier);
      if (!existsSync(target)) {
        missing.push({ from: relative(REPO_ROOT, current), specifier });
        continue;
      }
      queue.push(target);
    }
  }

  return { files: [...seen], missing };
}

describe('Edge Function 번들 그래프', () => {
  test.each(ENTRYPOINTS)('%s 의 상대 import 가 전부 실재하는 파일을 가리킨다', (entrypoint) => {
    const { missing } = walk(entrypoint);
    expect(missing).toEqual([]);
  });

  test('그래프가 packages/shared 를 상대경로로 끌어온다 — 복사본이 아니다', () => {
    const { files } = walk('promise-approve/index.ts');
    const shared = files.filter((file) => file.includes('packages'));

    // 에러 표는 packages/shared 의 것 하나뿐이어야 한다. 껍데기가 자기 표를 들고 있으면
    // 코드 수가 어긋난 상태가 실패 경로에서만 드러난다.
    expect(shared.some((file) => file.endsWith('errors.ts'))).toBe(true);
    expect(existsSync(join(FUNCTIONS_DIR, '_shared/error-codes.ts'))).toBe(false);
  });

  test('errors.ts 의 전이 의존까지 모은다 — config 를 놓치면 배포가 죽는다', () => {
    // packages/shared/src/errors.ts 는 config 에서 INVITE_TTL_HOURS·WITNESS_MAX 를 읽는다.
    // 이 한 칸이 `.js` 로 적혀 있으면 CLI 가 건너뛰고 번들이 Module not found 로 깨진다.
    const { files } = walk('invite-resolve/index.ts');
    expect(files.some((file) => file.endsWith(join('packages', 'shared', 'src', 'config.ts')))).toBe(
      true,
    );
  });

  test('runtime.ts 는 진입점에서만 닿고 handler.ts 에서는 닿지 않는다', () => {
    // 닿는 순간 vitest 가 handler 를 import 할 때 Deno 전역에서 죽는다.
    for (const entrypoint of ENTRYPOINTS) {
      const handler = resolve(FUNCTIONS_DIR, entrypoint.replace('index.ts', 'handler.ts'));
      const { files } = walk(relative(FUNCTIONS_DIR, handler));
      expect(files.filter((file) => file.endsWith('runtime.ts'))).toEqual([]);
    }
  });

  test('Deno 전역과 npm: 지정자는 runtime.ts 와 index.ts 에만 있다', () => {
    const { files } = walk('promise-approve/index.ts');

    for (const file of files) {
      // 주석은 빼고 본다. 주석에 적힌 `Deno.env` 는 실행되지 않는다 — 오히려 이 규칙이
      // 왜 있는지 적어 두는 자리라서, 주석까지 금지하면 설명을 못 남긴다.
      const source = stripComments(readFileSync(file, 'utf8'));
      if (file.endsWith('runtime.ts') || file.endsWith('index.ts')) continue;

      expect(source, `${relative(REPO_ROOT, file)} 이 Deno 전역을 쓴다`).not.toMatch(/\bDeno\./);
      expect(source, `${relative(REPO_ROOT, file)} 이 npm: 지정자를 쓴다`).not.toContain("'npm:");
    }
  });
});
