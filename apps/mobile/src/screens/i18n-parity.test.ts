import * as fs from 'fs';
import * as path from 'path';

import { catalogKeyPaths, LOCALES } from '@littlefinger/shared';

import { MOBILE_LABEL_CATALOGS } from './labels-registry.ts';

/**
 * 카탈로그 구조 패리티 가드 — 웹 `apps/web/src/i18n-parity.test.ts` 의 앱 쪽 거울.
 *
 * `satisfies typeof ko` 는 같은 파일 안의 드리프트만 잡는다. 여기서는 (1) ko/en 리프 키
 * 경로 동형, (2) `*-labels.ts` 를 만들고 레지스트리 등록을 잊는 것 — 파일 시스템을 실제로
 * 읽어 대조하므로 등록 없는 카탈로그는 패리티 검사를 빠져나갈 수 없다.
 */

function isLocalizedShape(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && 'ko' in value && 'en' in value;
}

describe('앱 라벨 레지스트리 패리티', () => {
  it('모든 카탈로그가 ko/en 두 로케일 키만 가진다', () => {
    const keysByName = Object.fromEntries(
      Object.entries(MOBILE_LABEL_CATALOGS).map(([name, catalog]) => [
        name,
        Object.keys(catalog).sort(),
      ]),
    );
    const expected = Object.fromEntries(
      Object.keys(MOBILE_LABEL_CATALOGS).map((name) => [name, [...LOCALES].sort()]),
    );
    expect(keysByName).toEqual(expected);
  });

  it('모든 카탈로그의 ko/en 리프 키 경로가 동형이다', () => {
    const koPaths = Object.fromEntries(
      Object.entries(MOBILE_LABEL_CATALOGS).map(([name, catalog]) => [
        name,
        catalogKeyPaths(catalog.ko),
      ]),
    );
    const enPaths = Object.fromEntries(
      Object.entries(MOBILE_LABEL_CATALOGS).map(([name, catalog]) => [
        name,
        catalogKeyPaths(catalog.en),
      ]),
    );
    for (const paths of Object.values(koPaths)) expect(paths.length).toBeGreaterThan(0);
    expect(enPaths).toEqual(koPaths);
  });

  it('screens 아래 모든 *-labels.ts 의 카탈로그가 레지스트리에 등록돼 있다', () => {
    const files = fs.readdirSync(__dirname).filter((file) => file.endsWith('-labels.ts'));
    expect(files.length).toBeGreaterThan(0);

    const registered = new Set<unknown>(Object.values(MOBILE_LABEL_CATALOGS));
    const missing: string[] = [];
    for (const file of files) {
      // 동적 import() 는 이 jest 하네스에서 금지 플래그로 죽는다 — require 만 동작한다.
      const moduleExports = require(path.join(__dirname, file)) as Record<string, unknown>;
      const localizedExports = Object.entries(moduleExports).filter(([, value]) =>
        isLocalizedShape(value),
      );
      if (localizedExports.length === 0) missing.push(`${file} (Localized export 없음)`);
      for (const [exportName, value] of localizedExports) {
        if (!registered.has(value)) missing.push(`${file}#${exportName}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
