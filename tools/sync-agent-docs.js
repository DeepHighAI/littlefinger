/**
 * CLAUDE.md → AGENTS.md 동기화.
 *
 * 두 파일은 헤더 3줄만 다르고 SYNC-START 마커 아래는 완전히 같아야 한다.
 * Claude Code 는 CLAUDE.md 를, Codex Agent 는 AGENTS.md 를 읽기 때문에
 * 한쪽만 고치면 두 에이전트가 서로 다른 지침으로 움직이게 된다.
 *
 *   node tools/sync-agent-docs.js         # AGENTS.md 재생성
 *   node tools/sync-agent-docs.js --check  # 어긋나 있으면 exit 1 (커밋 전 검사용)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'CLAUDE.md');
const TARGET = path.join(ROOT, 'AGENTS.md');
const MARKER = '<!-- SYNC-START';

const AGENTS_HEADER = [
  '# AGENTS.md',
  '',
  'This file provides guidance to coding agents (Codex CLI, Claude Code) when working with code in',
  'this repository. It is generated from CLAUDE.md — do not edit it by hand.',
  '',
].join('\n');

const source = fs.readFileSync(SOURCE, 'utf8');
const markerAt = source.indexOf(MARKER);

if (markerAt === -1) {
  console.error(`CLAUDE.md 에 '${MARKER}' 마커가 없다. 동기화할 범위를 정할 수 없다.`);
  process.exit(1);
}

const expected = AGENTS_HEADER + source.slice(markerAt);
const checkOnly = process.argv.includes('--check');
const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : null;

if (current === expected) {
  console.log('AGENTS.md 는 CLAUDE.md 와 동기화되어 있다.');
  process.exit(0);
}

if (checkOnly) {
  console.error('AGENTS.md 가 CLAUDE.md 와 어긋나 있다. `npm run sync:agents` 를 실행하라.');
  process.exit(1);
}

fs.writeFileSync(TARGET, expected);
console.log('AGENTS.md 를 CLAUDE.md 기준으로 다시 만들었다.');
