import * as fs from 'fs';
import * as path from 'path';

import { describe, expect, it } from 'vitest';

/**
 * ko 전용 라벨 맵이 화면으로 되돌아오는 것을 막는 가드.
 *
 * 카탈로그 전환 뒤에도 몇 화면이 `PROMISE_STATUS_LABEL` 같은 **한국어 전용** 상수를 그대로
 * 읽고 있었고, 영어 로케일에서만 한국어가 섞여 나왔다 — 한국어로 테스트하는 한 절대 보이지
 * 않는 실패다. 렌더 경로는 `*_BY_LOCALE[locale]` 만 쓴다.
 *
 * 키 열거(`Object.keys(...)`)와 존재 확인(`value in ...`)은 로케일과 무관하므로 허용한다.
 * 카탈로그 파일(`*-labels.ts`)의 `ko` 블록도 허용한다 — 그 안에서는 ko 맵이 정답이다.
 */

const KO_ONLY_MAPS = [
  'PROMISE_STATUS_LABEL',
  'PROMISE_CATEGORY_LABEL',
  'PARTICIPANT_ROLE_LABEL',
  'KEEPER_LABEL',
  'LEGAL_DISCLAIMER',
  'LEGAL_DOCUMENT_LABELS',
  'INTERNAL_MESSAGE',
] as const;

const SCREEN_DIRS = ['screens', 'components'];

function collectFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(full);
    if (!/\.tsx?$/u.test(entry.name)) return [];
    // 테스트는 한국어 리터럴을 단언해야 하고, 카탈로그의 ko 블록도 ko 맵이 정답이다.
    if (entry.name.includes('.test.') || entry.name.endsWith('-labels.ts')) return [];
    return [full];
  });
}

// 주석은 렌더가 아니다. 라벨 출처를 설명하는 줄까지 막으면 가드가 문서를 지우게 된다.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (block) => block.replace(/[^\n]/gu, ' '))
    .replace(/\/\/[^\n]*/gu, (line) => ' '.repeat(line.length));
}

function koOnlyRenderUses(rawSource: string): string[] {
  const source = stripComments(rawSource);
  const found: string[] = [];
  for (const name of KO_ONLY_MAPS) {
    // `_BY_LOCALE` 접미가 붙지 않은 사용만 본다.
    const pattern = new RegExp(`\\b${name}\\b(?!_BY_LOCALE)`, 'gu');
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split('\n').length;
      const text = source.split('\n')[line - 1] ?? '';
      const allowed =
        text.includes('Object.keys(') || / in \w/u.test(text) || text.trimStart().startsWith('//');
      if (!allowed) found.push(`${name} @ line ${line}`);
    }
  }
  return found;
}

describe('ko 전용 라벨 맵 가드', () => {
  it('웹 화면·컴포넌트는 렌더에 ko 전용 맵을 쓰지 않는다', () => {
    const offenders: Record<string, string[]> = {};
    for (const dir of SCREEN_DIRS) {
      for (const file of collectFiles(path.join(__dirname, dir))) {
        const uses = koOnlyRenderUses(fs.readFileSync(file, 'utf8'));
        if (uses.length > 0) offenders[path.relative(__dirname, file)] = uses;
      }
    }
    expect(offenders).toEqual({});
  });
});
