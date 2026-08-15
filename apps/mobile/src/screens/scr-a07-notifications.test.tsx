import type { NotificationInboxItem } from '@littlefinger/shared';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import {
  createNotificationReadIdempotencyKey,
  listNotificationInbox,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notification-inbox-native.ts';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock(
  '../lib/notification-inbox-native.ts',
  () => ({
    createNotificationReadIdempotencyKey: jest.fn(),
    listNotificationInbox: jest.fn(),
    markAllNotificationsRead: jest.fn(),
    markNotificationRead: jest.fn(),
  }),
  { virtual: true },
);

const NOW = new Date('2026-08-15T04:00:00.000Z');
const FIRST_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_ID = '22222222-2222-4222-8222-222222222222';
const THIRD_ID = '33333333-3333-4333-8333-333333333333';
const PROMISE_ID = '44444444-4444-4444-8444-444444444444';
const push = jest.fn();
const back = jest.fn();
const listNotificationInboxMock = jest.mocked(listNotificationInbox);
const markNotificationReadMock = jest.mocked(markNotificationRead);
const markAllNotificationsReadMock = jest.mocked(markAllNotificationsRead);
const createNotificationReadIdempotencyKeyMock = jest.mocked(
  createNotificationReadIdempotencyKey,
);
let NotificationInboxScreen: React.ComponentType;

try {
  NotificationInboxScreen = require('../app/notifications').default as React.ComponentType;
} catch {
  NotificationInboxScreen = () => <Text>알림함 화면이 아직 없어요</Text>;
}

function item(overrides: Partial<NotificationInboxItem> = {}): NotificationInboxItem {
  return {
    notification_id: FIRST_ID,
    promise_id: PROMISE_ID,
    event: 'NT-01',
    title: '민준님이 손가락 걸었어요! 약속 성립',
    body: '매주 화·목 아침 러닝 같이 하기',
    deeplink: 'SCR-A05',
    created_at: '2026-08-15T03:59:00.000Z',
    read_at: null,
    ...overrides,
  };
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('SCR-A07 알림함', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    push.mockReset();
    back.mockReset();
    jest.mocked(useRouter).mockReturnValue({ push, back } as never);
    listNotificationInboxMock.mockReset();
    listNotificationInboxMock.mockResolvedValue({
      items: [],
      unread_count: 0,
      next_cursor: null,
    });
    markNotificationReadMock.mockReset();
    markNotificationReadMock.mockResolvedValue({
      notification_id: FIRST_ID,
      read_at: '2026-08-15T04:00:00.000Z',
    });
    markAllNotificationsReadMock.mockReset();
    markAllNotificationsReadMock.mockResolvedValue({ read_count: 0 });
    createNotificationReadIdempotencyKeyMock.mockReset();
    createNotificationReadIdempotencyKeyMock.mockReturnValue(SECOND_ID);
  });

  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
  });

  test('목록을 기다리는 동안 로딩 문구를 보여준다', async () => {
    let resolveList: ((value: { items: []; unread_count: number; next_cursor: null }) => void) | undefined;
    listNotificationInboxMock.mockImplementation(
      async () =>
        await new Promise((resolve) => {
          resolveList = resolve;
        }),
    );

    const view = await render(<NotificationInboxScreen />);

    expect(view.getByText('알림을 불러오는 중이에요')).toBeTruthy();
    await act(async () => resolveList?.({ items: [], unread_count: 0, next_cursor: null }));
  });

  test('알림이 없으면 빈 상태를 보여준다', async () => {
    const view = await render(<NotificationInboxScreen />);
    await settle();

    expect(view.getByText('알림이 없어요')).toBeTruthy();
    expect(view.getByText('새로운 알림이 오면 여기에 보여요')).toBeTruthy();
  });

  test('불러오기 실패는 내부 오류를 숨기고 재시도할 수 있다', async () => {
    listNotificationInboxMock
      .mockRejectedValueOnce(new Error('relation notifications failed'))
      .mockResolvedValueOnce({ items: [], unread_count: 0, next_cursor: null });
    const view = await render(<NotificationInboxScreen />);
    await settle();

    expect(view.getByText('알림을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')).toBeTruthy();
    expect(view.queryByText(/relation notifications/u)).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: '다시 시도' }));
    await settle();
    expect(listNotificationInboxMock).toHaveBeenCalledTimes(2);
  });

  test('최신순으로 정렬하고 KST 오늘·어제·이전 날짜 구역과 상대 시간을 표시한다', async () => {
    listNotificationInboxMock.mockResolvedValue({
      items: [
        item({ notification_id: THIRD_ID, created_at: '2026-08-12T15:00:00.000Z', read_at: NOW.toISOString() }),
        item({ notification_id: SECOND_ID, created_at: '2026-08-13T23:00:00.000Z', title: '어제 알림' }),
        item({ created_at: '2026-08-15T02:00:00.000Z', title: '두 시간 전 알림' }),
        item({ notification_id: '55555555-5555-4555-8555-555555555555', created_at: '2026-08-15T03:59:30.000Z', title: '방금 알림' }),
      ],
      unread_count: 3,
      next_cursor: null,
    });
    const view = await render(<NotificationInboxScreen />);
    await settle();

    expect(view.getByText('오늘')).toBeTruthy();
    expect(view.getByText('어제')).toBeTruthy();
    expect(view.getByText('8월 13일')).toBeTruthy();
    expect(view.getByText('매주 화·목 아침 러닝 같이 하기 · 방금')).toBeTruthy();
    expect(view.getByText('매주 화·목 아침 러닝 같이 하기 · 2시간 전')).toBeTruthy();
    expect(view.getByText('매주 화·목 아침 러닝 같이 하기 · 어제 08:00')).toBeTruthy();
    expect(view.getByText('매주 화·목 아침 러닝 같이 하기 · 8월 13일 00:00')).toBeTruthy();

    const rows = view.getAllByTestId(/^notification-(?!dot-)/u);
    expect(rows.map((row) => row.props.testID)).toEqual([
      'notification-55555555-5555-4555-8555-555555555555',
      `notification-${FIRST_ID}`,
      `notification-${SECOND_ID}`,
      `notification-${THIRD_ID}`,
    ]);
  });

  test('읽지 않은 항목은 점과 읽지 않음 텍스트로 강조한다', async () => {
    listNotificationInboxMock.mockResolvedValue({
      items: [item(), item({ notification_id: SECOND_ID, read_at: NOW.toISOString() })],
      unread_count: 1,
      next_cursor: null,
    });
    const view = await render(<NotificationInboxScreen />);
    await settle();

    expect(view.getByText('읽지 않음')).toBeTruthy();
    expect(view.getByTestId(`notification-dot-${FIRST_ID}`)).toBeTruthy();
    expect(view.queryByTestId(`notification-dot-${SECOND_ID}`)).toBeNull();
    expect(view.getByRole('button', { name: /민준님이 손가락 걸었어요! 약속 성립 읽지 않음/u })).toBeTruthy();
  });

  test('항목 탭은 즉시 읽음으로 보이고 한 번만 서버에 기록한 뒤 허용된 목적지로 이동한다', async () => {
    let resolveRead: ((value: { notification_id: string; read_at: string }) => void) | undefined;
    markNotificationReadMock.mockImplementation(
      async () =>
        await new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    listNotificationInboxMock.mockResolvedValue({ items: [item()], unread_count: 1, next_cursor: null });
    const view = await render(<NotificationInboxScreen />);
    await settle();

    const target = view.getByRole('button', { name: /민준님이 손가락 걸었어요! 약속 성립 읽지 않음/u });
    await fireEvent.press(target);
    await fireEvent.press(target);

    expect(view.queryByText('읽지 않음')).toBeNull();
    expect(markNotificationReadMock).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith({ pathname: '/home' });
    expect(push).toHaveBeenCalledTimes(1);
    await act(async () => resolveRead?.({ notification_id: FIRST_ID, read_at: NOW.toISOString() }));
  });

  test('전체 읽음은 읽지 않은 항목을 즉시 정리하고 중복 요청을 막는다', async () => {
    let resolveAll: ((value: { read_count: number }) => void) | undefined;
    markAllNotificationsReadMock.mockImplementation(
      async () =>
        await new Promise((resolve) => {
          resolveAll = resolve;
        }),
    );
    listNotificationInboxMock.mockResolvedValue({ items: [item()], unread_count: 1, next_cursor: null });
    const view = await render(<NotificationInboxScreen />);
    await settle();

    const action = view.getByRole('button', { name: '모두 읽음' });
    await fireEvent.press(action);
    await fireEvent.press(action);

    expect(view.queryByText('읽지 않음')).toBeNull();
    expect(markAllNotificationsReadMock).toHaveBeenCalledTimes(1);
    await act(async () => resolveAll?.({ read_count: 1 }));
  });

  test('읽음 요청이 실패해도 현재 화면을 되돌리지 않고 다음 새로고침에서 서버 상태를 따른다', async () => {
    const failure = new Error('server state unknown');
    markNotificationReadMock.mockRejectedValue(failure);
    listNotificationInboxMock
      .mockResolvedValueOnce({ items: [item()], unread_count: 1, next_cursor: null })
      .mockResolvedValueOnce({ items: [item()], unread_count: 1, next_cursor: null });
    const view = await render(<NotificationInboxScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: /읽지 않음/u }));
    await settle();
    expect(view.queryByText('읽지 않음')).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: '새로고침' }));
    await settle();
    expect(view.getByText('읽지 않음')).toBeTruthy();
  });
});
