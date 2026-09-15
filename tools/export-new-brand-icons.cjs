'use strict';

const { execFileSync } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const output = resolve(root, 'docs/디자인/store/app-icon/new-2026-09-15');
const source = resolve(root, 'docs/디자인/store/app-icon/littlefinger-icon-new.png');
mkdirSync(output, { recursive: true });
const magick = (...args) => execFileSync('magick', args, { encoding: 'utf8' });

// 원본의 표정과 구도를 보존하고 플랫폼별 픽셀 규격만 변환한다.
for (const [name, edge] of [['icon-1024.png', 1024], ['play-icon-512.png', 512]]) {
  magick(source, '-filter', 'Lanczos', '-resize', `${edge}x${edge}`, '-strip', '-depth', '8',
    `PNG32:${resolve(output, name)}`);
}

console.log('Exported icon-1024.png and play-icon-512.png (RGBA8, opaque).');
