import { ENDPOINT } from '@littlefinger/shared';

import { fetchCounterpartAlias, updateCounterpartAlias } from './counterpart-alias-api.ts';
import { MobileApiError } from './mobile-api.ts';

const response = { target_user_id: '00000000-0000-4000-8000-000000000001', nickname: '민준', alias: '학교 친구' };

test('약속 권한으로 상대방을 결정하며 클라이언트 target user id를 보내지 않는다', async () => {
  const call = jest.fn().mockResolvedValue(response);
  await expect(fetchCounterpartAlias('promise-1', { call })).resolves.toEqual(response);
  expect(call).toHaveBeenCalledWith(ENDPOINT.counterpartAliasGet, { promise_id: 'promise-1' }, { idempotent: false });
  await updateCounterpartAlias('promise-1', null, 'intent-1', { call });
  expect(call).toHaveBeenLastCalledWith(ENDPOINT.counterpartAliasUpdate, { promise_id: 'promise-1', alias: null }, { idempotent: true, idempotencyKey: 'intent-1' });
});

test('깨진 응답을 정상 저장으로 취급하지 않는다', async () => {
  const call = jest.fn().mockResolvedValue({ nickname: '민준' });
  await expect(fetchCounterpartAlias('promise-1', { call })).rejects.toBeInstanceOf(MobileApiError);
  await expect(updateCounterpartAlias('promise-1', '친구', 'intent-1', { call })).rejects.toBeInstanceOf(MobileApiError);
});
