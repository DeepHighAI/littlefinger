import { ENDPOINT } from '@littlefinger/shared';

import {
  blockUser,
  hidePromise,
  listBlockedUsers,
  reportSafetyIssue,
  unblockUser,
  updateProfileNickname,
  withdrawAccount,
} from './account-safety-api.ts';

const KEY = '11111111-1111-4111-8111-111111111111';
const PROMISE_ID = '22222222-2222-4222-8222-222222222222';
const TARGET_ID = '33333333-3333-4333-8333-333333333333';

test('account and safety client uses the five dedicated idempotent endpoints', async () => {
  const call = jest.fn()
    .mockResolvedValueOnce({ status: 'WITHDRAWN' })
    .mockResolvedValueOnce({ nickname: '새 이름' })
    .mockResolvedValueOnce({ promise_id: PROMISE_ID, hidden: true })
    .mockResolvedValueOnce({ target_user_id: TARGET_ID, blocked: true })
    .mockResolvedValueOnce({ target_user_id: TARGET_ID, blocked: false })
    .mockResolvedValueOnce({ items: [] })
    .mockResolvedValueOnce({ report_id: TARGET_ID, status: 'RECEIVED', evidence_blinded: false });
  const deps = { call };

  await withdrawAccount(KEY, deps);
  await updateProfileNickname('새 이름', KEY, deps);
  await hidePromise(PROMISE_ID, true, KEY, deps);
  await blockUser(TARGET_ID, KEY, deps);
  await unblockUser(TARGET_ID, KEY, deps);
  await listBlockedUsers(deps);
  await reportSafetyIssue({
    promise_id: PROMISE_ID,
    target_user_id: TARGET_ID,
    evidence_id: null,
    reason: 'WRONG_PARTNER',
    detail: null,
  }, KEY, deps);

  expect(call.mock.calls).toEqual([
    [ENDPOINT.accountWithdraw, {}, { idempotent: true, idempotencyKey: KEY }],
    [ENDPOINT.profileNicknameUpdate, { nickname: '새 이름' }, { idempotent: true, idempotencyKey: KEY }],
    [ENDPOINT.promiseHide, { promise_id: PROMISE_ID, hidden: true }, { idempotent: true, idempotencyKey: KEY }],
    [ENDPOINT.userBlock, { target_user_id: TARGET_ID }, { idempotent: true, idempotencyKey: KEY }],
    [ENDPOINT.userUnblock, { target_user_id: TARGET_ID }, { idempotent: true, idempotencyKey: KEY }],
    [ENDPOINT.userBlockList, {}, { idempotent: false }],
    [ENDPOINT.safetyReport, {
      promise_id: PROMISE_ID,
      target_user_id: TARGET_ID,
      evidence_id: null,
      reason: 'WRONG_PARTNER',
      detail: null,
    }, { idempotent: true, idempotencyKey: KEY }],
  ]);
});
