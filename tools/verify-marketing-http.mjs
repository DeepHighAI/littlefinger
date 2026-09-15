import assert from 'node:assert/strict';

// 상태 코드만 검사하면 SPA 셸을 robots·sitemap으로 오인하므로 본문과 헤더도 검증한다.
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:5107');
const origin = 'https://littlefinger-app.web.app';
let checks = 0;

async function request(path) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, `${path}: HTTP status`);
  return { response, body: await response.text() };
}

const robots = await request('/robots.txt');
assert.match(robots.response.headers.get('content-type') ?? '', /text\/plain/i);
assert.match(robots.body, /User-agent:\s*\*/i);
assert.match(robots.body, /^Allow:\s*\/$/m);
assert.ok(robots.body.includes(`Sitemap: ${origin}/sitemap.xml`));
assert.ok(!robots.body.includes('<html'));
checks++;

const sitemap = await request('/sitemap.xml');
assert.match(sitemap.response.headers.get('content-type') ?? '', /xml/i);
assert.match(sitemap.body, /<urlset[^>]+sitemaps\.org\/schemas\/sitemap\/0\.9/);
assert.deepEqual([...sitemap.body.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]), [
  `${origin}/`, `${origin}/guides/promise-record`,
]);
checks++;

for (const path of ['/guides/promise-record', '/promise-guide.html']) {
  const { response, body } = await request(path);
  assert.match(body, /<h1[^>]*>둘이 정한 약속/);
  assert.match(body, /utm_campaign=promise_record/);
  assert.equal(response.headers.get('link'), `<${origin}/guides/promise-record>; rel="canonical"`);
  assert.ok(!/noindex/i.test(response.headers.get('x-robots-tag') ?? ''));
  checks++;
}

for (const path of ['/', '/?utm_source=verification', '/index.html']) {
  const { response, body } = await request(path);
  assert.match(body, /<h1[^>]*>리틀핑거<\/h1>/);
  assert.equal(response.headers.get('link'), `<${origin}/>; rel="canonical"`, `${path}: canonical`);
  assert.ok(!/noindex/i.test(response.headers.get('x-robots-tag') ?? ''), `${path}: public indexing`);
  checks++;
}

for (const path of ['/legal/privacy', '/legal/terms', '/account-deletion']) {
  const { response } = await request(path);
  assert.ok(!/noindex/i.test(response.headers.get('x-robots-tag') ?? ''), `${path}: public indexing`);
  assert.equal(response.headers.get('link'), null, `${path}: no inherited home canonical`);
  checks++;
}

// 합성 경로만 요청하며 실제 초대 토큰이나 참여자 정보는 사용하지 않는다.
for (const path of ['/i', '/i/', '/i/marketing-probe', '/i/marketing-probe/review',
  '/witness', '/witness/', '/witness/marketing-probe', '/promises', '/promises/',
  '/promises?utm_source=verification', '/auth', '/auth/', '/auth/callback', '/app.html']) {
  const { response } = await request(path);
  assert.match(response.headers.get('x-robots-tag') ?? '', /\bnoindex\b/i, `${path}: private indexing`);
  assert.equal(response.headers.get('link'), null, `${path}: no home canonical`);
  checks++;
}

const verification = await request('/googleb324b92c6f5d9c19.html');
assert.equal(verification.body.trim(), 'google-site-verification: googleb324b92c6f5d9c19.html');
checks++;
console.log(`Marketing HTTP verification: ${checks} checks passed (${base.origin})`);
