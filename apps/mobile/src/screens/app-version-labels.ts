import type { Localized } from '@littlefinger/shared';

const ko = {
  version: (version: string, build: string) => `버전 ${version} · 빌드 ${build}`,
  unavailable: '확인할 수 없음',
};

const en = {
  version: (version: string, build: string) => `Version ${version} · Build ${build}`,
  unavailable: 'Unavailable',
} satisfies typeof ko;

export const APP_VERSION_LABEL: Localized<typeof ko> = { ko, en };
