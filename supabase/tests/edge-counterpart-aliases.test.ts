import { expect, test, vi } from 'vitest';
import { createCounterpartAliasGetHandler } from '../functions/counterpart-alias-get/handler.ts';
import { createCounterpartAliasUpdateHandler } from '../functions/counterpart-alias-update/handler.ts';
import { ApiError } from '../functions/_shared/errors.ts';
import type { Deps } from '../functions/_shared/deps.ts';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const PROMISE = '22222222-2222-4222-8222-222222222222';
const TARGET = '33333333-3333-4333-8333-333333333333';
const KEY = '44444444-4444-4444-8444-444444444444';
const payload = { target_user_id: TARGET, nickname: '친구', alias: null };
function fixture() {
  const rpc = vi.fn().mockResolvedValue(payload);
  const deps: Deps = {
    authenticate: async () => ACTOR, rpc,
    secrets: { invitePepper: 'unused', piiSalt: 'unused' },
    log: { error: vi.fn() }, now: () => new Date(),
  };
  return { rpc, deps };
}
function request(body: unknown, key = KEY) {
  return new Request('https://example.test', { method: 'POST',
    headers: { authorization: 'Bearer token', 'idempotency-key': key, 'content-type': 'application/json' },
    body: JSON.stringify(body) });
}
test('read and reset derive actor from auth, only writes use idempotency', async () => {
  const { rpc, deps } = fixture();
  const response = await createCounterpartAliasGetHandler(deps)(request({ promise_id: PROMISE }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(payload);
  expect(rpc).toHaveBeenLastCalledWith('lf_counterpart_alias_get', { p_actor: ACTOR, p_promise_id: PROMISE });
  expect((await createCounterpartAliasUpdateHandler(deps)(request({ promise_id: PROMISE, alias: null }))).status).toBe(200);
  expect(rpc).toHaveBeenLastCalledWith('lf_counterpart_alias_update', {
    p_actor: ACTOR, p_promise_id: PROMISE, p_alias: null, p_idempotency_key: KEY,
  });
});
test('forged owner/target and malformed aliases cannot reach RPC', async () => {
  const { rpc, deps } = fixture();
  for (const body of [{ promise_id: PROMISE, alias: false }, { promise_id: PROMISE, alias: 'a', p_actor: TARGET },
    { target_user_id: TARGET, alias: 'a' }, { promise_id: PROMISE }]) {
    expect((await createCounterpartAliasUpdateHandler(deps)(request(body))).status).toBe(422);
  }
  expect(rpc).not.toHaveBeenCalled();
});
test('authorization failures remain private and unknown DB errors are flattened', async () => {
  const { rpc, deps } = fixture();
  rpc.mockRejectedValueOnce(new ApiError('E_NOT_FOUND'));
  expect((await createCounterpartAliasGetHandler(deps)(request({ promise_id: PROMISE }))).status).toBe(404);
  rpc.mockRejectedValueOnce(new Error('user_aliases internal SQL detail'));
  const failed = await createCounterpartAliasGetHandler(deps)(request({ promise_id: PROMISE }));
  expect(failed.status).toBe(500);
  expect(await failed.text()).not.toContain('user_aliases');
});
