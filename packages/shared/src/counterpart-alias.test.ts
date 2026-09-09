import { expect, test } from 'vitest';
import { asCounterpartAliasResponse } from './account-safety.ts';
import { COUNTERPART_ALIAS_MAX_LENGTH } from './config.ts';

const response = { target_user_id: '11111111-1111-4111-8111-111111111111', nickname: '원래 이름', alias: null };
test('alias responses accept reset and reject malformed or excessive values', () => {
  expect(asCounterpartAliasResponse(response)).toEqual(response);
  expect(asCounterpartAliasResponse({ ...response, alias: '😀'.repeat(COUNTERPART_ALIAS_MAX_LENGTH) })).not.toBeNull();
  for (const alias of ['', false, {}, 'a'.repeat(COUNTERPART_ALIAS_MAX_LENGTH + 1)]) {
    expect(asCounterpartAliasResponse({ ...response, alias })).toBeNull();
  }
  expect(asCounterpartAliasResponse({ ...response, owner_id: 'leaked' })).toBeNull();
  expect(asCounterpartAliasResponse({ ...response, target_user_id: 'bad' })).toBeNull();
});
