import { expect, test, vi } from 'vitest';
import { createInviteDeclinePublicHandler } from '../functions/invite-decline-public/handler.ts';
import { createWitnessPreviewHandler } from '../functions/witness-preview/handler.ts';
import type { Deps } from '../functions/_shared/deps.ts';
function deps(): Deps { return { rpc: vi.fn(async () => ({ status: 'DECLINED', target_role: 'PARTNER' })), authenticate: vi.fn(async () => { throw new Error('E_AUTH_REQUIRED'); }), secrets: { invitePepper: 'pepper', piiSalt: 'salt' }, log: { error: vi.fn() }, now: () => new Date() }; }
test('public decline rate limits before lookup, hashes token and never authenticates', async () => {
  const d = deps(); const token = 'a'.repeat(43);
  const r = await createInviteDeclinePublicHandler(d)(new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }));
  expect(r.status).toBe(200); expect(d.authenticate).not.toHaveBeenCalled();
  expect(d.rpc).toHaveBeenNthCalledWith(1, 'lf_rate_limit_hit', expect.any(Object));
  expect(d.rpc).toHaveBeenNthCalledWith(2, 'lf_invite_decline_public', expect.objectContaining({ p_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  expect(JSON.stringify(vi.mocked(d.rpc).mock.calls)).not.toContain(token);
});
test('invalid token is rejected before the mutation', async () => {
  const d = deps(); const r = await createInviteDeclinePublicHandler(d)(new Request('https://example.test', { method:'POST', body:JSON.stringify({token:'short'}) }));
  expect(r.status).toBe(422); expect(d.rpc).toHaveBeenCalledTimes(1);
});
test('GET cannot consume a link preview', async () => {
  const d=deps(); expect((await createInviteDeclinePublicHandler(d)(new Request('https://example.test'))).status).toBe(422); expect(d.rpc).not.toHaveBeenCalled();
});
test('witness content requires verified identity', async () => {
  const d=deps(); const r=await createWitnessPreviewHandler(d)(new Request('https://example.test',{method:'POST',body:JSON.stringify({token:'a'.repeat(43)})}));
  expect(r.status).toBe(401); expect(d.rpc).not.toHaveBeenCalled();
});
