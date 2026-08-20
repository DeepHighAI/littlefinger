import { ENDPOINT } from '@littlefinger/shared';

import {
  approveInvite,
  declineInvite,
  previewInvite,
  resolveInvite,
  suggestInviteAmend,
} from './invite-review-api.ts';

const call = jest.fn();
const callPublic = jest.fn();
const deps = { call, callPublic };

const RESOLVED = {
  creator_nickname: '지우',
  title: '매일 걷기',
  expires_at: '2026-08-23T00:00:00Z',
  target_role: 'PARTNER',
};

describe('앱 내 초대 검토 API', () => {
  beforeEach(() => {
    call.mockReset();
    callPublic.mockReset();
  });

  test('resolve 는 공개 경로로 나가고 응답 형태를 검증한다', async () => {
    callPublic.mockResolvedValue(RESOLVED);
    await expect(resolveInvite('tok-1', deps)).resolves.toEqual(RESOLVED);
    expect(callPublic).toHaveBeenCalledWith(ENDPOINT.inviteResolve, { token: 'tok-1' });
    expect(call).not.toHaveBeenCalled();
  });

  test('형태가 어긋난 resolve 응답은 성공으로 그리지 않는다', async () => {
    callPublic.mockResolvedValue({ creator_nickname: '지우' });
    await expect(resolveInvite('tok-1', deps)).rejects.toMatchObject({ code: null });
  });

  test('preview 는 인증 경로다', async () => {
    call.mockResolvedValue({ title: '매일 걷기' });
    await previewInvite('tok-1', deps);
    expect(call).toHaveBeenCalledWith(
      ENDPOINT.invitePreview,
      { token: 'tok-1' },
      { idempotent: false },
    );
  });

  test('승인·거절·수정 제안은 엔드포인트별 멱등 키를 그대로 싣는다', async () => {
    call.mockResolvedValue({});
    await approveInvite('tok-1', 'key-a', deps);
    await declineInvite('tok-1', '  ', 'key-d', deps);
    await suggestInviteAmend('tok-1', '종료일을 바꿔 주세요', 'key-m', deps);

    expect(call).toHaveBeenNthCalledWith(
      1,
      ENDPOINT.promiseApprove,
      { token: 'tok-1' },
      { idempotencyKey: 'key-a' },
    );
    // 공백뿐인 사유는 보내지 않는다 — 0자 사유가 "있는" 것으로 저장되면 안 된다(§5-3).
    expect(call).toHaveBeenNthCalledWith(
      2,
      ENDPOINT.promiseDecline,
      { token: 'tok-1' },
      { idempotencyKey: 'key-d' },
    );
    expect(call).toHaveBeenNthCalledWith(
      3,
      ENDPOINT.promiseAmend,
      { token: 'tok-1', comment: '종료일을 바꿔 주세요' },
      { idempotencyKey: 'key-m' },
    );
  });

  test('실제 거절 사유는 다듬어 싣는다', async () => {
    call.mockResolvedValue({});
    await declineInvite('tok-1', ' 지금은 어려워요 ', 'key-d', deps);
    expect(call).toHaveBeenCalledWith(
      ENDPOINT.promiseDecline,
      { token: 'tok-1', reason: '지금은 어려워요' },
      { idempotencyKey: 'key-d' },
    );
  });
});
