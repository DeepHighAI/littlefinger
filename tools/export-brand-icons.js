'use strict';

const { execFileSync } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const images = resolve(root, 'apps/mobile/assets/images');
const face = resolve(images, 'mascot-face-e1.png');
const launcher = resolve(root, 'docs/디자인/store/app-icon/littlefinger-icon-new.png');
const eyes = resolve(images, 'eyes-e1.png');
const webBrand = resolve(root, 'apps/web/public/brand');
const launcherButter = '#FFE59A';
const canvasCream = '#F3ECDC';
const magick = (args) => execFileSync('magick', args, { cwd: root, encoding: 'utf8' });
const png = (path) => ['-strip', '-depth', '8', `PNG32:${path}`];

// 승인된 새 원본의 구도는 일반 아이콘에 보존하고 적응형 레이어는 별도로 내보낸다.
magick([
  launcher, '-filter', 'Lanczos', '-resize', '1024x1024',
  ...png(resolve(images, 'icon.png')),
]);
magick(['-size', '1024x1024', `xc:${launcherButter}`, ...png(resolve(images, 'android-icon-background.png'))]);

// 실제 알파 픽셀의 반경을 재서 108dp 안의 66dp 안전 원에 맞춘다.
const alpha = execFileSync('magick', [face, '-alpha', 'extract', '-depth', '8', 'gray:-']);
const masterEdge = 512;
let artworkRadius = 0;
for (let y = 0; y < masterEdge; y += 1) {
  for (let x = 0; x < masterEdge; x += 1) {
    if (alpha[y * masterEdge + x] > 0) {
      artworkRadius = Math.max(artworkRadius, Math.hypot(x - (masterEdge - 1) / 2, y - (masterEdge - 1) / 2));
    }
  }
}
const safeRadius = 1024 * 33 / 108;
const foregroundEdge = Math.floor(masterEdge * (safeRadius - 4) / artworkRadius);
magick([
  face, '-filter', 'Lanczos', '-resize', `${foregroundEdge}x${foregroundEdge}`, '-background', 'none',
  '-gravity', 'center', '-extent', '1024x1024',
  ...png(resolve(images, 'android-icon-foreground.png')),
]);
magick([
  eyes, '-filter', 'Lanczos', '-resize', '280x', '-channel', 'RGB', '-fill', '#FFFFFF',
  '-colorize', '100', '+channel', '-background', 'none', '-gravity', 'center',
  '-extent', '1024x1024', ...png(resolve(images, 'android-icon-monochrome.png')),
]);
magick([face, '-filter', 'Lanczos', '-resize', '512x512', ...png(resolve(images, 'splash-icon.png'))]);

mkdirSync(webBrand, { recursive: true });
for (const [name, size] of [
  ['favicon-32.png', 32],
  ['favicon-192.png', 192],
  ['apple-touch-icon-180.png', 180],
]) {
  magick([
    resolve(images, 'icon.png'), '-filter', 'Lanczos', '-resize', `${size}x${size}`,
    ...png(resolve(webBrand, name)),
  ]);
}
magick([
  '-size', '1200x630', `xc:${canvasCream}`,
  '(', resolve(images, 'icon.png'), '-filter', 'Lanczos', '-resize', '480x480',
  '(', '-size', '480x480', 'xc:none', '-fill', 'white',
  '-draw', 'roundrectangle 0,0 479,479 106,106', ')',
  '-alpha', 'set', '-compose', 'CopyOpacity', '-composite', ')',
  '-gravity', 'center', '-compose', 'over', '-composite', '-alpha', 'remove',
  ...png(resolve(webBrand, 'og-image.png')),
]);

console.log(`PO mascot launcher, splash and web brand exports regenerated; adaptive foreground ${foregroundEdge}px inside the 66dp safe circle.`);
