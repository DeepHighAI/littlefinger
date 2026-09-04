'use strict';

const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const images = resolve(root, 'apps/mobile/assets/images');
const face = resolve(images, 'mascot-face-e1.png');
const eyes = resolve(images, 'eyes-e1.png');
const launcherButter = '#FFE59A';
const magick = (args) => execFileSync('magick', args, { cwd: root, encoding: 'utf8' });
const png = (path) => ['-strip', '-depth', '8', `PNG32:${path}`];

// E-1 얼굴은 런처 전용이다. 플랫폼 마스크가 바깥 모서리를 마지막에 자른다.
magick([
  '-size', '1024x1024', `xc:${launcherButter}`,
  '(', face, '-filter', 'Lanczos', '-resize', '1024x1024', ')',
  '-gravity', 'center', '-compose', 'over', '-composite', '-alpha', 'remove',
  ...png(resolve(images, 'icon.png')),
]);
magick(['-size', '1024x1024', `xc:${launcherButter}`, ...png(resolve(images, 'android-icon-background.png'))]);

// 108dp 레이어 안의 66dp 안전 원에 흰 얼굴과 손을 함께 넣어 마스크에서 표정이 잘리지 않게 한다.
magick([
  face, '-filter', 'Lanczos', '-resize', '668x668', '-background', 'none',
  '-gravity', 'center', '-extent', '1024x1024',
  ...png(resolve(images, 'android-icon-foreground.png')),
]);
magick([
  eyes, '-filter', 'Lanczos', '-resize', '280x', '-channel', 'RGB', '-fill', '#FFFFFF',
  '-colorize', '100', '+channel', '-background', 'none', '-gravity', 'center',
  '-extent', '1024x1024', ...png(resolve(images, 'android-icon-monochrome.png')),
]);
magick([face, '-filter', 'Lanczos', '-resize', '512x512', ...png(resolve(images, 'splash-icon.png'))]);

console.log('E-1 launcher and splash exports regenerated; Play listing assets remain PO-curated files.');
