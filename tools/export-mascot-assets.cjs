'use strict';

const { execFileSync } = require('node:child_process');
const { copyFileSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const masterDir = resolve(root, 'design-reference/assets/images');
const source = resolve(root, 'docs/디자인/store/app-icon/new-2026-09-15/icon-noback.png');
const work = resolve(root, 'tmp/mascot-2026-09-15');
mkdirSync(work, { recursive: true });
const magick = (...args) => execFileSync('magick', args, { encoding: 'utf8' });
const png = (path) => ['-strip', '-depth', '8', `PNG32:${path}`];

// PO 원본의 실제 얼굴 범위만 자른다. 배경·표정·색을 다시 그리지 않는다.
magick(source, '-crop', '1200x984+184+32', '+repage', '-resize', '512x512',
  '-background', 'none', '-gravity', 'center', '-extent', '512x512',
  ...png(resolve(masterDir, 'mascot-face-e1.png')));

// 흰 몸 위 검은 손의 명도 차이로 알파를 만든다. 원본 손 픽셀과 반투명 경계는 보존한다.
for (const [name, crop, edge] of [
  ['eyes-e1.png', '540x216+514+434', '200x80'],
  ['hand-solid.png', '230x218+824+434', '804x763'],
]) {
  const part = resolve(work, name);
  const mask = resolve(work, `${name}-alpha.png`);
  magick(source, '-crop', crop, '+repage', ...png(part));
  magick(part, '-alpha', 'off', '-colorspace', 'gray', '-negate', '-level', '45%,80%', ...png(mask));
  magick(part, mask, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', '-compose', 'Over', '-resize', edge,
    '-background', 'none', '-gravity', 'center', '-extent', edge, ...png(resolve(masterDir, name)));
}
copyFileSync(resolve(masterDir, 'hand-solid.png'), resolve(masterDir, 'hand-color.png'));
copyFileSync(resolve(root, 'docs/디자인/store/app-icon/new-2026-09-15/play-icon-512.png'), resolve(masterDir, 'icon-face-e1.png'));

const names = ['mascot-face-e1.png', 'eyes-e1.png', 'hand-color.png', 'hand-solid.png'];
for (const target of ['apps/mobile/assets/images', 'apps/web/src/assets/images']) {
  for (const name of names) {
    const dest = resolve(root, target, name);
    if (target.includes('web') && name === 'hand-color.png') {
      magick(resolve(masterDir, name), '-resize', '402x382', ...png(dest));
    } else copyFileSync(resolve(masterDir, name), dest);
  }
}

const manifest = {};
for (const name of [...names, 'icon-face-e1.png']) {
  const data = readFileSync(resolve(masterDir, name));
  manifest[name] = { width: data.readUInt32BE(16), height: data.readUInt32BE(20), sha256: createHash('sha256').update(data).digest('hex') };
}
writeFileSync(resolve(root, 'docs/디자인/store/app-icon/new-2026-09-15/asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Exported transparent PO mascot, eyes and hand masters; mobile/web copies synchronized.');
