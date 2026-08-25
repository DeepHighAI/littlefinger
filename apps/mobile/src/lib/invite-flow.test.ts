import { INVITE_RESEND_MAX, type PromiseInviteResponse } from '@littlefinger/shared';

import {
  InviteRepository,
  buildInviteLink,
  ensureInviteToken,
  formatInviteCountdown,
  inviteShareMessage,
  isInviteExpired,
  type InviteWithToken,
} from './invite-flow.ts';

const invite: InviteWithToken = {
  promise_id: 'promise-1',
  status: 'PENDING',
  invitation_id: 'invite-1',
  expires_at: '2026-08-02T01:00:00.000Z',
  resend_count: 0,
  title: '주 3회 달리기',
  token: 'raw_token-123',
};

const encryptedStore = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

describe('SCR-A04 초대 링크와 암호화 토큰', () => {
  beforeEach(() => {
    encryptedStore.getItem.mockReset();
    encryptedStore.setItem.mockReset();
    encryptedStore.removeItem.mockReset();
  });

  test('초대 응답은 SecureStore 허용 문자 키로 사용자별 암호화 저장한다', async () => {
    encryptedStore.setItem.mockResolvedValue(undefined);
    const repository = new InviteRepository(encryptedStore);

    await repository.save('user-1', invite);

    expect(encryptedStore.setItem).toHaveBeenCalledWith(
      'lf.invite.user-1.promise-1',
      JSON.stringify(invite),
    );
  });

  test('공유 링크는 웹 기준 URL로 조립하고 공유 문구에는 제목과 링크만 넣는다', () => {
    const link = buildInviteLink('https://littlefinger-app.web.app/', invite.token);

    expect(link).toBe('https://littlefinger-app.web.app/i/raw_token-123');
    expect(inviteShareMessage(invite.title, link)).toBe(
      '주 3회 달리기\nhttps://littlefinger-app.web.app/i/raw_token-123',
    );
    expect(inviteShareMessage(invite.title, link)).not.toContain('보상');
    expect(inviteShareMessage(invite.title, link)).not.toContain('벌칙');
  });

  test('남은 시간은 72시간형 시:분:초로 표시하고 만료 뒤 0으로 고정한다', () => {
    expect(
      formatInviteCountdown(
        '2026-08-02T01:00:00.000Z',
        new Date('2026-07-30T01:00:28.000Z'),
      ),
    ).toBe('71:59:32');
    expect(
      formatInviteCountdown(
        '2026-08-02T01:00:00.000Z',
        new Date('2026-08-02T01:00:01.000Z'),
      ),
    ).toBe('00:00:00');
    expect(
      isInviteExpired(
        '2026-08-02T01:00:00.000Z',
        new Date('2026-08-02T01:00:00.000Z'),
      ),
    ).toBe(true);
  });

  test('멱등 캐시 응답에 토큰이 없으면 새 초대를 한 번 발급한다', async () => {
    const issue = jest.fn().mockResolvedValue(invite);
    const { token: _token, ...cached } = invite;

    await expect(ensureInviteToken(cached, issue)).resolves.toEqual(invite);
    expect(issue).toHaveBeenCalledWith('promise-1');

    issue.mockClear();
    await expect(ensureInviteToken(invite, issue)).resolves.toEqual(invite);
    expect(issue).not.toHaveBeenCalled();
  });

  test('재발송 횟수 상수는 열 번째 응답 이후 추가 발급을 막는 기준이다', () => {
    expect(INVITE_RESEND_MAX).toBe(10);
    expect({ ...invite, resend_count: INVITE_RESEND_MAX }.resend_count).toBe(10);
  });
});
