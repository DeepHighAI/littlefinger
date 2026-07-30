import { ENDPOINT, type PromiseInviteResponse } from '@littlefinger/shared';

import { EMPTY_PROMISE_DRAFT } from './promise-draft.ts';
import { submitPromiseDraft } from './promise-editor-api.ts';

const completeDraft = {
  ...EMPTY_PROMISE_DRAFT,
  title: '주 3회 달리기',
  body: '매주 세 번 함께 달린다.',
  category: 'HABIT' as const,
  end_date: '2026-08-10',
};

const call = jest.fn();

describe('SCR-A03 서버 DRAFT 저장·발송', () => {
  beforeEach(() => {
    call.mockReset();
  });

  test('새 초안은 promise-create로 저장한다', async () => {
    call.mockResolvedValue({ promise_id: 'promise-1', status: 'DRAFT' });

    await submitPromiseDraft(completeDraft, null, false, { call });

    expect(call).toHaveBeenCalledWith(
      ENDPOINT.promiseCreate,
      { ...completeDraft, send: false },
      { idempotent: true },
    );
  });

  test('기존 초안은 같은 promise_id를 promise-draft-update로 보내 버전 1을 유지한다', async () => {
    call.mockResolvedValue({ promise_id: 'promise-1', status: 'DRAFT' });

    await submitPromiseDraft(completeDraft, 'promise-1', false, { call });

    expect(call).toHaveBeenCalledWith(
      ENDPOINT.promiseDraftUpdate,
      { ...completeDraft, promise_id: 'promise-1', send: false },
      { idempotent: true },
    );
  });

  test('[상대에게 보내기]는 내용 저장과 초대 발급을 한 요청으로 처리한다', async () => {
    const response: PromiseInviteResponse = {
      promise_id: 'promise-1',
      status: 'PENDING',
      invitation_id: 'invite-1',
      expires_at: '2026-08-02T01:00:00.000Z',
      resend_count: 0,
      title: '주 3회 달리기',
      token: 'raw-invite-token',
    };
    call.mockResolvedValue(response);

    await expect(
      submitPromiseDraft(completeDraft, null, true, { call }),
    ).resolves.toEqual(response);
    expect(call).toHaveBeenCalledWith(
      ENDPOINT.promiseCreate,
      { ...completeDraft, send: true },
      { idempotent: true },
    );
  });
});
