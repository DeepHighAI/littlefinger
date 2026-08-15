import {
  listNotificationInbox,
  markAllNotificationsRead,
  markNotificationRead,
} from './notification-inbox-api.ts';

const NOTIFICATION_ID = '11111111-1111-4111-8111-111111111111';
const KEY = '22222222-2222-4222-8222-222222222222';

describe('모바일 알림함 API', () => {
  test('조회는 멱등 키 없이 목록 endpoint와 요청 형태를 그대로 호출한다', async () => {
    const call = jest.fn().mockResolvedValue({ items: [], unread_count: 0, next_cursor: null });

    await expect(
      listNotificationInbox(
        {
          cursor: { created_at: '2026-08-14T00:00:00Z', notification_id: NOTIFICATION_ID },
          limit: 20,
        },
        { call },
      ),
    ).resolves.toEqual({ items: [], unread_count: 0, next_cursor: null });
    expect(call).toHaveBeenCalledWith(
      'notification-inbox',
      {
        cursor: { created_at: '2026-08-14T00:00:00Z', notification_id: NOTIFICATION_ID },
        limit: 20,
      },
      { idempotent: false },
    );
  });

  test('단건과 전체 읽음은 호출자가 보존한 멱등 키를 그대로 사용한다', async () => {
    const call = jest
      .fn()
      .mockResolvedValueOnce({ notification_id: NOTIFICATION_ID, read_at: '2026-08-15T00:00:00Z' })
      .mockResolvedValueOnce({ read_count: 1 });

    await markNotificationRead(NOTIFICATION_ID, KEY, { call });
    await markAllNotificationsRead(KEY, { call });

    expect(call).toHaveBeenNthCalledWith(
      1,
      'notification-read',
      { notification_id: NOTIFICATION_ID },
      { idempotent: true, idempotencyKey: KEY },
    );
    expect(call).toHaveBeenNthCalledWith(
      2,
      'notification-read-all',
      {},
      { idempotent: true, idempotencyKey: KEY },
    );
  });

  test.each(['단건 읽음', '전체 읽음'] as const)(
    '%s 실패를 성공 상태로 바꾸지 않고 그대로 전파한다',
    async (operation) => {
      const failure = new Error('server state unknown');
      const call = jest.fn().mockRejectedValue(failure);
      const result =
        operation === '단건 읽음'
          ? markNotificationRead(NOTIFICATION_ID, KEY, { call })
          : markAllNotificationsRead(KEY, { call });

      await expect(result).rejects.toBe(failure);
    },
  );
});
