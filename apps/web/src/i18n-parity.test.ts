import { catalogKeyPaths, LOCALES } from '@littlefinger/shared';
import { describe, expect, it } from 'vitest';

import { WEB_LABEL_CATALOGS } from './labels-registry.ts';

/**
 * 카탈로그 구조 패리티 가드.
 *
 * `satisfies typeof ko` 는 같은 파일 안의 드리프트만 잡는다. 이 테스트는 그 밖을 잡는다:
 * (1) ko/en 리프 키 경로 동형 — 한쪽에만 문구를 추가하면 여기서 깨진다.
 * (2) `*-labels.ts` 를 만들고 레지스트리 등록을 잊는 것 — glob 이 실제 파일 목록을 읽어
 *     레지스트리와 대조하므로, 등록 없는 카탈로그는 패리티 검사 자체를 받지 못한 채
 *     남을 수 없다.
 */

const labelModules = import.meta.glob('./**/*-labels.ts', { eager: true }) as Record<
  string,
  Record<string, unknown>
>;

function isLocalizedShape(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && 'ko' in value && 'en' in value;
}

describe('웹 라벨 레지스트리 패리티', () => {
  it('모든 카탈로그의 ko/en 리프 키 경로가 동형이다', () => {
    for (const [name, catalog] of Object.entries(WEB_LABEL_CATALOGS)) {
      expect(Object.keys(catalog).sort(), name).toEqual([...LOCALES].sort());
      const koPaths = catalogKeyPaths(catalog.ko);
      expect(koPaths.length, name).toBeGreaterThan(0);
      expect(catalogKeyPaths(catalog.en), name).toEqual(koPaths);
    }
  });

  it('src 아래 모든 *-labels.ts 의 카탈로그가 레지스트리에 등록돼 있다', () => {
    expect(Object.keys(labelModules).length).toBeGreaterThan(0);
    const registered = new Set<unknown>(Object.values(WEB_LABEL_CATALOGS));
    for (const [path, module] of Object.entries(labelModules)) {
      const localizedExports = Object.entries(module).filter(([, value]) =>
        isLocalizedShape(value),
      );
      expect(localizedExports.length, path).toBeGreaterThan(0);
      for (const [exportName, value] of localizedExports) {
        expect(registered.has(value), `${path}#${exportName}`).toBe(true);
      }
    }
  });
});
