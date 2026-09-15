'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const mobile = resolve(root, 'apps/mobile/assets/images');
const output = resolve(root, 'docs/디자인/store/app-icon/new-2026-09-15');
const edge = 1024;
const safeRadius = edge * 33 / 108;
const alpha = execFileSync('magick', [resolve(mobile, 'android-icon-foreground.png'), '-alpha', 'extract', '-depth', '8', 'gray:-']);
assert.equal(alpha.length, edge * edge);
let maxRadius = 0;
let visiblePixels = 0;
for (let y = 0; y < edge; y += 1) {
  for (let x = 0; x < edge; x += 1) {
    if (alpha[y * edge + x] === 0) continue;
    visiblePixels += 1;
    maxRadius = Math.max(maxRadius, Math.hypot(x - (edge - 1) / 2, y - (edge - 1) / 2));
  }
}
assert.ok(visiblePixels > 0);
assert.ok(maxRadius <= safeRadius, `${maxRadius} > ${safeRadius}`);
const mono = execFileSync('magick', [resolve(mobile, 'android-icon-monochrome.png'), '-depth', '8', 'rgba:-'], { maxBuffer: 8 * 1024 * 1024 });
let monoVisiblePixels = 0;
for (let i = 0; i < mono.length; i += 4) {
  if (mono[i + 3] === 0) continue;
  monoVisiblePixels += 1;
  assert.equal(mono[i], 255);
  assert.equal(mono[i + 1], 255);
  assert.equal(mono[i + 2], 255);
}
assert.ok(monoVisiblePixels > 0);
const play = readFileSync(resolve(output, 'play-icon-512.png'));
assert.equal(play.readUInt32BE(16), 512);
assert.equal(play.readUInt32BE(20), 512);
assert.equal(play[25], 6);
assert.ok(play.length <= 1024 * 1024);
const result = { maxRadius, safeRadius, visiblePixels, monoVisiblePixels, playBytes: play.length };
writeFileSync(resolve(output, 'verification.json'), JSON.stringify(result, null, 2) + '\n');

const data = (name) => `data:image/png;base64,${readFileSync(resolve(mobile, name)).toString('base64')}`;
const face = data('mascot-face-e1.png');
const foreground = data('android-icon-foreground.png');
const background = data('android-icon-background.png');
const cards = ['circle', 'squircle', 'square'].map((shape) => `<figure><div class="mask ${shape}"><img class="layer" src="${background}"><img class="layer" src="${foreground}"></div><figcaption>Adaptive ${shape}</figcaption></figure>`).join('');
// 검토 전용 문서이며 제품 화면의 토큰이나 레이아웃을 바꾸지 않는다.
writeFileSync(resolve(output, 'asset-preview.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Littlefinger mascot assets</title><style>body{margin:24px;background:#FBF8F1;color:#221C13;font:16px system-ui}main{display:flex;flex-wrap:wrap;gap:24px}figure{margin:0;padding:16px;border:1px solid #EFE9DC}figcaption{margin-top:12px}.mask{position:relative;width:192px;height:192px;overflow:hidden}.circle{border-radius:50%}.squircle{border-radius:25%}.square{border-radius:10%}.layer{position:absolute;width:288px;height:288px;left:-48px;top:-48px}.backdrop{display:flex;align-items:center;justify-content:center;width:220px;height:200px}.backdrop img{width:100%;height:100%;object-fit:contain}.sizes{display:flex;align-items:center;gap:24px}</style><h1>Littlefinger mascot replacement</h1><p>PO source; existing app layout preserved. Adaptive previews show the central 72dp mask of a 108dp layer.</p><main>${cards}${['#FBF8F1','#FFD43B','#221C13'].map(color=>`<figure><div class="backdrop" style="background:${color}"><img src="${face}"></div><figcaption>Alpha on ${color}</figcaption></figure>`).join('')}<figure><div class="sizes">${[28,34,46].map(size=>`<img width="${size}" height="${size}" src="${face}">`).join('')}</div><figcaption>28 / 34 / 46 pixels</figcaption></figure><figure><div class="backdrop" style="background:#221C13"><img src="${data('android-icon-monochrome.png')}"></div><figcaption>Monochrome alpha</figcaption></figure></main></html>`);
console.log(`PASS: adaptive alpha radius ${maxRadius.toFixed(2)} <= ${safeRadius.toFixed(2)}; monochrome RGB is white; Play PNG ${play.length} bytes.`);
