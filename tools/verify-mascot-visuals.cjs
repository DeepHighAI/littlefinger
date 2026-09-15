'use strict';

const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInThisContext } = require('node:vm');

// 기존 픽스처 캡처를 재사용해 실제 수락 웹과 기준 화면을 같은 브라우저에서 확인한다.
async function main() {
  const playwright = require(process.env.LF_PLAYWRIGHT_MODULE || 'playwright-core');
  const browser = await playwright.chromium.connectOverCDP(process.env.LF_CDP_URL);
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const root = resolve(__dirname, '..');
  const output = resolve(root, '.playwright-mcp/mascot-2026-09-15');
  mkdirSync(output, { recursive: true });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const captures = [];
  for (const name of ['scr-a00-onboarding', 'scr-a01-login', 'scr-a02-home-empty', 'scr-a09-history', 'scr-a04-invite-sent']) {
    const response = await page.goto(`http://localhost:4173/screens/app/${name}.html`);
    if (!response?.ok()) throw Error(`Reference page failed: ${name}`);
    await page.evaluate(async () => { await document.fonts.ready; });
    // 갤러리의 바깥 기기 프레임만 제거해 360dp 화면 자체를 비교한다.
    await page.addStyleTag({ content: '.lf-page{padding:0!important;display:block!important}.lf-device{width:360px!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}.lf-device__viewport{width:360px!important;border-radius:0!important}' });
    await page.screenshot({ path: resolve(output, `${name}-1.png`) });
    captures.push(name);
    await page.evaluate(() => {
      for (const element of document.querySelectorAll('body *')) {
        if (!(element instanceof HTMLElement) || !Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) continue;
        const style = getComputedStyle(element);
        const font = parseFloat(style.fontSize);
        const line = parseFloat(style.lineHeight);
        element.style.fontSize = `${font * 1.5}px`;
        if (Number.isFinite(line)) element.style.lineHeight = `${line * 1.5}px`;
      }
    });
    await page.screenshot({ path: resolve(output, `${name}-1.5.png`) });
  }
  let captureSource = readFileSync(resolve(root, 'tools/capture-web-screens.js'), 'utf8');
  captureSource = captureSource.replace('http://localhost:4174', process.env.LF_WEB_BASE || 'http://localhost:4174');
  captureSource = captureSource.replace('C:/DEV/littlefinger/.playwright-mcp/captures/', `${output.replaceAll('\\', '/')}/`);
  const capture = runInThisContext(`(${captureSource})`);
  const result = await capture(page);
  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ captures, result, errors, fontScaleNote: 'Reference 1.5 captures scale DOM text; this is not native Android font-scale verification.' }, null, 2));
  console.log(result);
  console.log(`Reference screens: ${captures.length} at 1.0/1.5; page errors: ${errors.length}`);
  await context.close();
  if (errors.length > 0) throw Error(errors.join('\n'));
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
