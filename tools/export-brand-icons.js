'use strict';

const { execFileSync } = require('node:child_process');
const { readFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const images = resolve(root, 'apps/mobile/assets/images');
const master = resolve(images, 'brand-symbol.png');
const tokens = readFileSync(resolve(root, 'design-reference/styles/tokens.css'), 'utf8');
const color = (name) => {
  const value = tokens.match(new RegExp(`--lf-color-${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1];
  if (!value) throw new Error(`Missing brand token: ${name}`);
  return value;
};
const ink = color('brand-symbol');
const butter = color('primary-container');
const magick = (args) => execFileSync('magick', args, { cwd: root, encoding: 'utf8' });
const png = (path) => ['-strip', '-depth', '8', `PNG32:${path}`];
const silhouette = (width, fill) => [
  master, '-trim', '+repage',
  // 작은 마스크의 경계 픽셀이 런처 확대 시 계단처럼 보이지 않도록 알파만 정리한다.
  '-channel', 'A', '-blur', '0x1', '-level', '15%,85%', '+channel',
  '-filter', 'Lanczos', '-resize', `${width}x`,
  '-channel', 'RGB', '-fill', fill, '-colorize', '100', '+channel',
];

// 플랫폼이 바깥 모서리를 자르므로 런처에는 둥근 모서리·목업 그림자를 넣지 않는다.
magick([
  ...silhouette(800, ink), '-background', butter, '-gravity', 'center',
  '-extent', '1024x1024', '-alpha', 'remove', ...png(resolve(images, 'icon.png')),
]);
magick(['-size', '1024x1024', `xc:${butter}`, ...png(resolve(images, 'android-icon-background.png'))]);

// 108dp 레이어 안의 66dp 안전 원을 지켜 모든 런처 마스크에서 손가락이 남는다.
for (const [name, fill] of [['foreground', ink], ['monochrome', '#FFFFFF']]) {
  const target = resolve(images, `android-icon-${name}.png`);
  magick([
    ...silhouette(600, fill), '-background', 'none', '-gravity', 'center',
    '-extent', '1024x1024', ...png(target),
  ]);
  const outside = magick([
    target, '-alpha', 'extract', '-fx', 'hypot(i-511.5,j-511.5)>1024*33/108?u:0',
    '-format', '%[fx:maxima]', 'info:',
  ]);
  if (Number(outside) !== 0) throw new Error(`${name} exceeds the Android safe circle`);
}

magick([
  master, '-channel', 'RGB', '-fill', ink, '-colorize', '100', '+channel',
  ...png(resolve(images, 'brand-symbol-in-app.png')),
]);
magick([
  '-size', '512x512', 'xc:none', '-fill', butter, '-draw', 'circle 256,256 256,4',
  '(', ...silhouette(380, ink), ')', '-gravity', 'center', '-compose', 'over', '-composite',
  ...png(resolve(images, 'splash-icon.png')),
]);
const store = resolve(root, 'docs/디자인/store');
mkdirSync(store, { recursive: true });
magick([
  resolve(images, 'icon.png'), '-resize', '512x512', '-alpha', 'off',
  '-strip', '-depth', '8', `PNG24:${resolve(store, 'store-icon-512.png')}`,
]);
console.log('Brand exports regenerated; adaptive foreground and monochrome are inside the 66dp safe circle.');
