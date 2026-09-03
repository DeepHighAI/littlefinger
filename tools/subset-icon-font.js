// Material Symbols Rounded 서브셋 + 이름→코드포인트 표 생성기 (웹 woff2 · 앱 TTF · 표 두 벌).
//
// npm 패키지 원본은 **5.35 MB**(가변 폰트, 아이콘 약 3,000개)다. 수락 웹의 3초 예산에 그대로
// 올릴 수 없고, Google CDN 으로 되돌리면 04 §5-3 의 self-host 요구를 어긴다. 앱은 Expo 에
// Rounded 가 없어서 같은 서브셋을 TTF 로 구워 직접 등록한다(C-2 종결, 2026-09-03 확정안).
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
// 앱 TTF 는 **정적 인스턴스**로 굽는다. RN 안드로이드는 가변 축 선택이 불안정해서(04 §5-4,
// Pretendard 를 정적 파일로 나눈 이유와 같다) 확정안 캔버스의 font-variation-settings
// 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24 를 그대로 핀한다.
//
// 산출물 넷 다 커밋한다. 아이콘이 늘 때만 다시 돌린다:
//   node tools/subset-icon-font.js
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import * as fontkit from 'fontkit';
import subsetFont from 'subset-font';

// 확정안(파스텔 스티커) 아트보드 + 수락 웹 + 앱 호출처의 합집합. 앱의 LfIconName 은 이 표로
// 닫혀 있으므로, 새 아이콘은 여기 추가하고 다시 돌린 뒤에야 쓸 수 있다.
export const ICONS = [
  'add', 'ads_click', 'alarm', 'arrow_back', 'arrow_forward', 'block', 'bookmark', 'cancel',
  'check', 'check_circle', 'close', 'description', 'draw', 'east', 'edit', 'event',
  'expand_more', 'fingerprint', 'forum', 'history', 'home', 'hourglass_empty', 'image', 'info',
  'inventory_2', 'link_off', 'mail', 'more_horiz', 'more_vert', 'notification_important',
  'notifications', 'person', 'person_add', 'photo_camera', 'privacy_tip',
  'radio_button_checked', 'radio_button_unchecked', 'redeem', 'refresh', 'schedule', 'sell',
  'send', 'settings', 'share', 'sync_alt', 'trending_up', 'visibility',
];

// 확정안 캔버스의 font-variation-settings 와 같다. 넷을 모두 핀하면 fvar 가 사라진 정적 폰트가 된다.
export const STATIC_INSTANCE = { wght: 400, FILL: 0, GRAD: 0, opsz: 24 };

const url = (p) => fileURLToPath(new URL(p, import.meta.url));

export const SOURCE = url('../node_modules/material-symbols/material-symbols-rounded.woff2');
export const WEB_FONT_OUT = url('../apps/web/src/assets/fonts/material-symbols-rounded-subset.woff2');
export const MOBILE_FONT_OUT = url('../apps/mobile/assets/fonts/MaterialSymbolsRounded-subset.ttf');
// 표는 두 앱에 같은 내용으로 복사한다. packages/shared 에 두면 폰트 없는 패키지가 아이콘 이름을
// 알게 되고, 생성 파일을 손으로 고칠 유혹만 늘어난다. 바이트 동일은 테스트가 지킨다.
export const MAP_OUTS = [
  url('../apps/web/src/components/icon-codepoints.ts'),
  url('../apps/mobile/src/theme/icon-codepoints.ts'),
];

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
const text = [...codePoints.values()].map((c) => String.fromCodePoint(c)).join('');
const webSubset = await subsetFont(original, text, { targetFormat: 'woff2' });
const mobileSubset = await subsetFont(original, text, {
  targetFormat: 'sfnt',
  variationAxes: STATIC_INSTANCE,
});
await writeFile(WEB_FONT_OUT, webSubset);
await writeFile(MOBILE_FONT_OUT, mobileSubset);

const entries = [...codePoints.entries()]
  .map(([name, cp]) => `  '${name}': 0x${cp.toString(16)},`)
  .join('\n');

const map = `// 생성 파일 — 손으로 고치지 않는다. \`node tools/subset-icon-font.js\` 가 만든다.
// 이름 → Material Symbols Rounded 의 코드포인트. 서브셋 폰트에 이 ${codePoints.size}개만 들어 있다.
export const ICON_CODEPOINT = {
${entries}
} as const;

export type IconName = keyof typeof ICON_CODEPOINT;
`;
for (const out of MAP_OUTS) await writeFile(out, map);

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
console.log(
  `아이콘 ${codePoints.size}개: ${kb(original.length)} → 웹 woff2 ${kb(webSubset.length)} · 앱 TTF ${kb(mobileSubset.length)}`,
);
