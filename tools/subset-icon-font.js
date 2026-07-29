// Material Symbols Rounded 서브셋 + 이름→코드포인트 표 생성기.
//
// npm 패키지 원본은 **5.35 MB**(가변 폰트, 아이콘 약 3,000개)다. 수락 웹의 3초 예산에 그대로
// 올릴 수 없고, Google CDN 으로 되돌리면 04 §5-3 의 self-host 요구를 어긴다.
//
// **리가처 이름으로는 서브셋이 되지 않는다.** 아이콘 이름이 전부 a-z 와 _ 로만 이뤄져 있어서,
// 그 글자들을 남기면 harfbuzz 의 liga 클로저가 "그 글자들로 만들 수 있는 모든 리가처" —
// 곧 아이콘 전량 — 을 함께 남긴다. 실측 5220 KB → 4655 KB, 11%.
//
// 그래서 이름을 **코드포인트로 먼저 바꾼다.** PUA 문자는 어떤 리가처의 입력도 아니므로
// 클로저가 번지지 않고, 서브셋이 실제로 줄어든다. 대신 마크업이 'link_off' 라는 글자열 대신
// 코드포인트를 써야 하므로, 화면은 언제나 LfIcon 을 거친다(CLAUDE.md §5-4 가 앱 쪽에 이미
// 요구하는 규칙과 같다 — "Screens never import icons directly").
//
// 부수 효과 하나가 공짜로 따라온다: 폰트가 늦게 오면 리가처 방식은 'link_off' 라는 **낱말**이
// 그대로 보인다. 링크가 끊겼다고 알려 주는 화면에서 그건 최악이다. 코드포인트는 두부(tofu)로
// 보이고, 낱말로 오해될 여지가 없다.
//
// 산출물 둘 다 커밋한다. 아이콘이 늘 때만 다시 돌린다:
//   node tools/subset-icon-font.js
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import * as fontkit from 'fontkit';
import subsetFont from 'subset-font';

// design-reference/screens/**/*.html 의 .material-symbols-rounded 리가처 전량(앱 화면 포함).
// 웹이 나중에 어느 화면을 더 가져올지 지금 좁힐 이유가 없다.
const ICONS = [
  'add', 'ads_click', 'alarm', 'arrow_back', 'check', 'close', 'description', 'draw', 'east',
  'edit', 'event', 'expand_more', 'fingerprint', 'forum', 'history', 'image', 'info', 'link_off',
  'mail', 'more_vert', 'notification_important', 'notifications', 'person', 'person_add',
  'photo_camera', 'refresh', 'schedule', 'sell', 'send', 'settings', 'share', 'sync_alt',
  'trending_up', 'visibility',
];

const url = (p) => fileURLToPath(new URL(p, import.meta.url));

const SOURCE = url('../node_modules/material-symbols/material-symbols-rounded.woff2');
const FONT_OUT = url('../apps/web/src/assets/fonts/material-symbols-rounded-subset.woff2');
const MAP_OUT = url('../apps/web/src/components/icon-codepoints.ts');

const font = fontkit.openSync(SOURCE);

// glyph id → 코드포인트. cmap 을 뒤집는다.
const byGlyph = new Map();
for (const codePoint of font.characterSet) {
  const glyph = font.glyphForCodePoint(codePoint);
  if (glyph && !byGlyph.has(glyph.id)) byGlyph.set(glyph.id, codePoint);
}

const codePoints = new Map();
for (const name of ICONS) {
  const glyphs = font.layout(name).glyphs;
  // 리가처가 걸리면 이름 전체가 글리프 하나가 된다. 둘 이상이면 그 이름은 이 폰트에 없다 —
  // 조용히 넘기면 화면에 낱말이 그대로 찍히므로 여기서 멈춘다.
  if (glyphs.length !== 1) {
    throw new Error(`'${name}' 은 이 폰트의 아이콘이 아니다 (글리프 ${glyphs.length}개).`);
  }
  const codePoint = byGlyph.get(glyphs[0].id);
  if (codePoint === undefined) {
    throw new Error(`'${name}' 의 글리프에 코드포인트가 없다.`);
  }
  codePoints.set(name, codePoint);
}

const original = await readFile(SOURCE);
const subset = await subsetFont(original, [...codePoints.values()].map((c) => String.fromCodePoint(c)).join(''), {
  targetFormat: 'woff2',
});
await writeFile(FONT_OUT, subset);

const entries = [...codePoints.entries()]
  .map(([name, cp]) => `  '${name}': 0x${cp.toString(16)},`)
  .join('\n');

await writeFile(
  MAP_OUT,
  `// 생성 파일 — 손으로 고치지 않는다. \`node tools/subset-icon-font.js\` 가 만든다.
// 이름 → Material Symbols Rounded 의 코드포인트. 서브셋 폰트에 이 ${codePoints.size}개만 들어 있다.
export const ICON_CODEPOINT = {
${entries}
} as const;

export type IconName = keyof typeof ICON_CODEPOINT;
`,
);

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
console.log(`아이콘 ${codePoints.size}개: ${kb(original.length)} → ${kb(subset.length)}`);
