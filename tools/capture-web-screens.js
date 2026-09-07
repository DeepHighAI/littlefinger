/*
  수락 웹 8경로 캡처 — 백엔드 없이 잉크 & 블록 화면을 360×800 으로 찍는다 (P7, 2026-09-07).

  실행:
    1. cd apps/web && npm run build && npx vite preview --port 4174 --strictPort --host 127.0.0.1
    2. Playwright MCP `browser_run_code_unsafe` 에 filename 으로 이 파일을 준다
       (허용 루트가 저장소 안이라 여기 둔다). 결과는 .playwright-mcp/captures/*.png (gitignore).

  함수 슬러그마다 픽스처를 route 로 돌려주고, 로그인 뒤 화면은 localStorage 의 supabase 세션 키에
  서명 없는 JWT 를 넣어 getSession() 만 통과시킨다 — 실제 서버는 한 번도 부르지 않는다.
  W03 은 라우터 state 를 pushState + popstate 로 밀어 넣는다. 샌드박스에 Buffer·btoa 가 없어
  base64url 은 손으로 짠다. 파일 자체는 Playwright 가 page 를 넘겨 부르는 함수 하나다.
*/
async (page) => {
  const BASE = 'http://localhost:4174';
  const OUT = 'C:/DEV/littlefinger/.playwright-mcp/captures/';
  const REF = 'vepnrrmxvsytguocicfe';
  const TOKEN = 'a-b_c-d_e';
  const CREATOR_ID = '22222222-2222-4222-8222-222222222222';
  const PARTNER_ID = '33333333-3333-4333-8333-333333333333';
  const P_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const P_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const P_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const P_D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const DAY = 86400000;
  const plusDays = (n) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);
  const plusMs = (ms) => new Date(Date.now() + ms).toISOString();

  const b64 = (obj) => {
    const str = JSON.stringify(obj);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let out = '';
    for (let i = 0; i < str.length; i += 3) {
      const a = str.charCodeAt(i);
      const b = str.charCodeAt(i + 1);
      const c = str.charCodeAt(i + 2);
      const n = (a << 16) | ((Number.isNaN(b) ? 0 : b) << 8) | (Number.isNaN(c) ? 0 : c);
      out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63]
        + (Number.isNaN(b) ? '' : chars[(n >> 6) & 63])
        + (Number.isNaN(c) ? '' : chars[n & 63]);
    }
    return out;
  };
  const nowSec = Math.floor(Date.now() / 1000);
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: PARTNER_ID, aud: 'authenticated', role: 'authenticated', exp: nowSec + 7200, iat: nowSec })}.sig`;
  const session = {
    access_token: jwt,
    refresh_token: 'capture-refresh',
    token_type: 'bearer',
    expires_in: 7200,
    expires_at: nowSec + 7200,
    user: {
      id: PARTNER_ID, aud: 'authenticated', role: 'authenticated', email: null,
      app_metadata: { provider: 'kakao' }, user_metadata: {}, created_at: '2026-07-01T00:00:00Z',
    },
  };
  const STORAGE_KEY = `sb-${REF}-auth-token`;

  const INVITE = { creator_nickname: '지우', title: '매주 화·목 아침 러닝 같이 하기', expires_at: plusMs((47 * 3600 + 12 * 60 + 8) * 1000), target_role: 'PARTNER' };
  const PREVIEW = {
    title: '매주 화·목 아침 러닝 같이 하기',
    body: '8월 11일까지 매주 화·목 아침 7시, 반포한강공원에서 함께 러닝한다. 우천 시 다음 날로 순연.',
    category: 'HABIT', end_date: plusDays(17), keeper: 'BOTH',
    reward: '성공하면 오마카세 사주기', penalty: '한 달 커피 셔틀', witness_enabled: true,
    creator: { nickname: '지우', profile_image_url: null },
  };
  const RESULT = {
    promise_id: '11111111-1111-4111-8111-111111111111', status: 'ACTIVE', activated_at: '2026-07-12T12:04:00.000Z',
    creator_id: CREATOR_ID, title: '매주 화·목 아침 러닝 같이 하기',
    partner: { user_id: PARTNER_ID, nickname: '민준', profile_image_url: null }, version_no: 1, fingerprint: 'A3F9-77C2-01',
    approvals: [
      { role: 'CREATOR', nickname: '지우', acted_at: '2026-07-12T11:58:00.000Z' },
      { role: 'PARTNER', nickname: '민준', acted_at: '2026-07-12T12:04:00.000Z' },
    ],
  };
  const summary = (patch) => ({
    promise_id: P_A, title: '매주 화·목 아침 러닝 같이 하기', status: 'CHECKING', end_date: '2026-08-11', keeper: 'BOTH',
    updated_at: '2026-08-12T01:00:00.000Z', check_deadline_at: plusMs(6 * DAY), check_round_no: 1,
    needs_response: true, waiting_for_partner: false, ...patch,
  });
  const detail = (patch) => ({
    promise_id: P_A, title: '매주 화·목 아침 러닝 같이 하기', body: '8월 11일까지 매주 화·목 아침 7시, 반포한강공원에서 함께 러닝한다.',
    category: 'HABIT', end_date: '2026-08-11', keeper: 'BOTH', reward: '성공하면 오마카세 사주기', penalty: '한 달 커피 셔틀',
    status: 'CHECKING', checking_started_at: '2026-08-11T15:00:00.000Z', check_deadline_at: plusMs(6 * DAY), check_round_no: 1,
    creator: { user_id: CREATOR_ID, nickname: '지우', profile_image_url: null },
    partner: { user_id: PARTNER_ID, nickname: '민준', profile_image_url: null },
    my_role: 'PARTNER', my_check: null, creator_has_submitted: false, partner_has_submitted: false, partner_check: null, history: [],
    ...patch,
  });
  const version = (patch) => ({
    version_no: 1, title: '월말까지 야식 끊기', body: '이번 달 말까지 야식을 끊는다.', category: 'HABIT', end_date: '2026-07-31', keeper: 'BOTH',
    reward: '성공하면 야식 쿠폰', penalty: '한 달 커피 셔틀', content_hash: 'a'.repeat(64), fingerprint: 'AAAA-AAAA-AA',
    activated_at: '2026-07-01T00:00:00Z', superseded_at: null, change_reason: null, ...patch,
  });
  const agreement = (promiseId, type, ver, proposedPatch, reason) => ({
    promise_id: promiseId, status: 'AMEND_PENDING', title: ver.title, body: ver.body, category: ver.category, end_date: ver.end_date, keeper: ver.keeper,
    reward: ver.reward, penalty: ver.penalty, witness_enabled: false, activated_at: ver.activated_at, closed_at: null, checking_started_at: null,
    check_deadline_at: null, check_round_no: 1, my_role: 'PARTNER', counterpart_push_available: true,
    creator: { user_id: CREATOR_ID, nickname: '지우', profile_image_url: null, role: 'CREATOR', status: 'JOINED', joined_at: ver.activated_at },
    partner: { user_id: PARTNER_ID, nickname: '민준', profile_image_url: null, role: 'PARTNER', status: 'JOINED', joined_at: ver.activated_at },
    witnesses: [], approvals: [], current_version: ver, invitation: null, fulfillment: null,
    amend_request: {
      request_id: '99999999-9999-4999-8999-999999999999', type, status: 'PENDING',
      requester: { user_id: CREATOR_ID, nickname: '지우', profile_image_url: null },
      reason, created_at: '2026-07-25T00:12:00Z', expires_at: plusMs(7 * DAY),
      proposed_version: type === 'AMEND' ? { ...ver, version_no: 2, activated_at: null, ...proposedPatch } : null,
    },
  });
  const witnessFull = (patch) => ({
    promise_id: P_A, status: 'ACTIVE', visibility: 'FULL', title: '매주 화·목 아침 러닝 같이 하기',
    creator: { user_id: CREATOR_ID, nickname: '지우', profile_image_url: null },
    partner: { user_id: PARTNER_ID, nickname: '민준', profile_image_url: null },
    activated_at: '2026-07-12T12:04:00Z', signed_at: null,
    content: { body: '8월 11일까지 매주 화·목 아침 7시, 반포한강공원에서 함께 러닝한다. 우천 시 다음 날로 순연.', category: 'HABIT', end_date: '2026-08-11', keeper: 'BOTH', reward: '성공하면 오마카세 사주기', penalty: '한 달 커피 셔틀' },
    fulfillment: null, ...patch,
  });

  let fixtures = {};
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type, idempotency-key, apikey, x-client-info',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
  };
  await page.route('**/functions/v1/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const slug = request.url().split('/').pop().split('?')[0];
    let body = {};
    try { body = JSON.parse(request.postData() ?? '{}'); } catch { body = {}; }
    const handler = fixtures[slug];
    if (!handler) return route.fulfill({ status: 500, headers: cors, contentType: 'application/json', body: JSON.stringify({ code: 'E_INTERNAL' }) });
    const [status, payload] = handler(body);
    return route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await page.route('**/auth/v1/**', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(session.user) });
  });

  await page.setViewportSize({ width: 360, height: 800 });
  const setSession = async (on) => {
    await page.goto(`${BASE}/terms`, { waitUntil: 'load' });
    await page.evaluate(([key, value]) => {
      if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value);
      window.sessionStorage.clear();
    }, [STORAGE_KEY, on ? JSON.stringify(session) : null]);
  };
  const shot = async (name, waitFor, full = false) => {
    await page.waitForSelector(waitFor, { timeout: 15000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}${name}.png`, fullPage: false });
    if (full) await page.screenshot({ path: `${OUT}${name}-full.png`, fullPage: true });
  };
  const results = [];
  const step = async (name, fn) => {
    try { await fn(); results.push(`${name}: ok`); } catch (error) { results.push(`${name}: FAIL ${String(error).slice(0, 200)}`); }
  };

  // W01 — 로그인 전 랜딩
  await step('w01', async () => {
    fixtures = { 'invite-resolve': () => [200, INVITE] };
    await setSession(false);
    await page.goto(`${BASE}/i/${TOKEN}`, { waitUntil: 'networkidle' });
    await shot('scr-w01-invite-landing', 'h1');
  });
  // W06 — 만료
  await step('w06', async () => {
    fixtures = { 'invite-resolve': () => [410, { code: 'E_INVITE_EXPIRED', message: null }] };
    await page.goto(`${BASE}/i/${TOKEN}`, { waitUntil: 'networkidle' });
    await shot('scr-w06-link-expired', 'h1');
  });
  // W02 — 검토 (로그인 후)
  await step('w02', async () => {
    fixtures = { 'invite-resolve': () => [200, INVITE], 'invite-preview': () => [200, PREVIEW] };
    await setSession(true);
    await page.goto(`${BASE}/i/${TOKEN}/review`, { waitUntil: 'networkidle' });
    await shot('scr-w02-promise-review', 'h1', true);
  });
  // W03 — 승인 완료 (라우터 state)
  await step('w03', async () => {
    await page.goto(`${BASE}/i/${TOKEN}/done`, { waitUntil: 'networkidle' });
    await page.evaluate(([path, state]) => {
      window.history.pushState({ usr: state, key: 'lf-capture', idx: (window.history.state && window.history.state.idx) || 0 }, '', path);
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    }, [`/i/${TOKEN}/done`, RESULT]);
    await shot('scr-w03-approval-complete', '.lf-stamp', true);
  });
  // W04 — 참여 약속 (CHECKING + AMEND)
  await step('w04', async () => {
    const detailA = detail({});
    const verB = version({});
    const detailB = detail({ promise_id: P_B, title: verB.title, body: verB.body, end_date: verB.end_date, reward: verB.reward, penalty: verB.penalty, status: 'AMEND_PENDING', checking_started_at: null, check_deadline_at: null });
    const agreementB = agreement(P_B, 'AMEND', verB, { end_date: '2026-08-14' }, '휴가 기간은 쉬는 걸로!');
    fixtures = {
      'participant-promise-list': () => [200, [summary({}), summary({ promise_id: P_B, title: verB.title, status: 'AMEND_PENDING', end_date: verB.end_date, check_deadline_at: null, updated_at: plusMs(-DAY) })]],
      'promise-fulfillment-detail': (body) => [200, body.promise_id === P_B ? detailB : detailA],
      'promise-detail': () => [200, agreementB],
    };
    await page.goto(`${BASE}/promises`, { waitUntil: 'networkidle' });
    await shot('scr-w04-participant-view', '.lf-card', true);
  });
  // W04 — 마무리 요청 + 무기한 ACTIVE
  await step('w04-finish', async () => {
    const verC = version({ title: '매주 일요일 부모님께 안부 전화하기', body: '매주 일요일 저녁에 각자 부모님께 안부 전화를 한다.', end_date: null, reward: null, penalty: null });
    const detailC = detail({ promise_id: P_C, title: verC.title, body: verC.body, end_date: null, reward: null, penalty: null, status: 'AMEND_PENDING', checking_started_at: null, check_deadline_at: null });
    const detailD = detail({ promise_id: P_D, title: '매달 1일 함께 가계부 정리하기', body: '매달 1일 저녁에 함께 가계부를 정리한다.', end_date: null, reward: null, penalty: null, status: 'ACTIVE', checking_started_at: null, check_deadline_at: null });
    const agreementC = agreement(P_C, 'FINISH', verC, {}, '이제 습관이 됐으니 여기서 마무리하고 결과를 남기자!');
    fixtures = {
      'participant-promise-list': () => [200, [
        summary({ promise_id: P_C, title: verC.title, status: 'AMEND_PENDING', end_date: null, check_deadline_at: null }),
        summary({ promise_id: P_D, title: detailD.title, status: 'ACTIVE', end_date: null, check_deadline_at: null, needs_response: false }),
      ]],
      'promise-fulfillment-detail': (body) => [200, body.promise_id === P_C ? detailC : detailD],
      'promise-detail': () => [200, agreementC],
    };
    await page.goto(`${BASE}/promises`, { waitUntil: 'networkidle' });
    await shot('scr-w04-participant-view-finish', '.lf-card', true);
  });
  // W05 — 증인 확인
  await step('w05', async () => {
    fixtures = { 'witness-detail': () => [200, witnessFull({})] };
    await page.goto(`${BASE}/witness/${P_A}`, { waitUntil: 'networkidle' });
    await shot('scr-w05-witness-confirm', '.lf-card', true);
  });
  await step('w05-no-end', async () => {
    fixtures = { 'witness-detail': () => [200, witnessFull({ title: '매주 일요일 부모님께 안부 전화하기', activated_at: '2026-07-05T11:31:00Z', content: { body: '매주 일요일 저녁에 각자 부모님께 안부 전화를 한다. 못 한 주는 다음 날 안에 한다.', category: 'HABIT', end_date: null, keeper: 'BOTH', reward: null, penalty: null } })] };
    await page.goto(`${BASE}/witness/${P_A}`, { waitUntil: 'networkidle' });
    await shot('scr-w05-witness-confirm-no-end', '.lf-card', true);
  });
  return results.join('\n');
}
