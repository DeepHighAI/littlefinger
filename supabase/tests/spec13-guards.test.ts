import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { ENDPOINT } from '../../packages/shared/src/api.ts';

/**
 * `02` §13 수용 체크리스트의 "없어야 한다" 항목들.
 *
 * 기능 테스트는 있는 것만 지킨다 — 금지 항목은 어기는 순간을 알려 줄 것이 없다.
 * 확정 기록 수정·삭제 경로(P3), 수락 웹 광고(하드 제약 1), 결제·에스크로(하드 제약 6),
 * 이메일 발송(PO 2026-07-26 미수집 결정)은 의존성이 하나 추가되는 것만으로 무너지므로
 * 여기서 저장소 자체를 스캔한다.
 */

const REPO_ROOT = resolve(__dirname, '../..');
const FUNCTIONS_DIR = resolve(REPO_ROOT, 'supabase/functions');

// 클라이언트 엔드포인트가 아닌 서버 내부 함수 — pg_cron 배치와 서버 간 호출 전용.
const INTERNAL_FUNCTIONS = new Set([
  'push-send',
  'evidence-purge',
  'purchase-reconcile',
  'account-delete-retry',
]);

function dependencyNames(packageJsonPath: string): string[] {
  const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, packageJsonPath), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
}

function tsFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsFilesUnder(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

/** `from '…'` / `import('…')` 지정자. 주석 속 언급은 걸리지 않도록 지정자만 본다. */
const SPECIFIER = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

describe('spec §13 금지 항목 가드', () => {
  test('확정 기록을 고치거나 지우는 엔드포인트가 없다 (P3)', () => {
    const slugs = Object.values(ENDPOINT) as string[];
    for (const forbidden of ['promise-update', 'promise-delete']) {
      expect(slugs, `${forbidden} 는 존재해선 안 된다`).not.toContain(forbidden);
      expect(existsSync(join(FUNCTIONS_DIR, forbidden)), `${forbidden}/ 디렉터리가 있다`).toBe(
        false,
      );
    }
  });

  test('수락 웹에는 광고 의존성도 광고 스크립트도 없다 (하드 제약 1)', () => {
    const adLike = dependencyNames('apps/web/package.json').filter((name) =>
      /admob|adsense|mobile-ads|advert/iu.test(name),
    );
    expect(adLike).toEqual([]);

    const html = readFileSync(resolve(REPO_ROOT, 'apps/web/index.html'), 'utf8');
    expect(html).not.toMatch(/adsbygoogle|googlesyndication/iu);
  });

  test('네 package.json 어디에도 결제·에스크로 의존성이 없다 (하드 제약 6)', () => {
    const packages = [
      'package.json',
      'packages/shared/package.json',
      'apps/mobile/package.json',
      'apps/web/package.json',
    ];
    for (const packageJson of packages) {
      const paymentLike = dependencyNames(packageJson).filter((name) =>
        /stripe|portone|iamport|toss|bootpay|payment|purchase|revenuecat|escrow/iu.test(name),
      );
      expect(paymentLike, packageJson).toEqual([]);
    }
  });

  test('Edge Functions 는 이메일 발송 라이브러리를 가져오지 않는다', () => {
    // 이 제품은 카카오톡 링크로만 사람을 부른다 — 이메일 발송 의존성이 하나라도 들어오면
    // 미수집 결정(§6-1)이 코드 레벨에서 무너지기 시작한다.
    const emailLibrary =
      /^(nodemailer|resend|postmark|mailgun|emailjs|smtp|@sendgrid\/|@aws-sdk\/client-ses)/iu;
    for (const file of tsFilesUnder(FUNCTIONS_DIR)) {
      const source = readFileSync(file, 'utf8');
      const external = [...source.matchAll(SPECIFIER)]
        .map((match) => match[1] ?? '')
        .filter((specifier) => !specifier.startsWith('./') && !specifier.startsWith('../'))
        .map((specifier) => specifier.replace(/^(npm|jsr):/u, ''));
      expect(
        external.filter((specifier) => emailLibrary.test(specifier)),
        relative(REPO_ROOT, file),
      ).toEqual([]);
    }
  });

  test('ENDPOINT 슬러그와 함수 디렉터리가 1:1 이다', () => {
    // 어긋나는 두 방향 모두 조용히 죽는다: 슬러그만 있으면 클라이언트가 404 를 만나고,
    // 디렉터리만 있으면 계약 밖 엔드포인트가 배포된다.
    const dirs = readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== '_shared')
      .map((entry) => entry.name);
    const slugs = Object.values(ENDPOINT) as string[];

    expect(slugs.filter((slug) => !dirs.includes(slug))).toEqual([]);
    expect(
      dirs.filter((dir) => !slugs.includes(dir) && !INTERNAL_FUNCTIONS.has(dir)),
    ).toEqual([]);
  });
});
