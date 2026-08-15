import type { NotificationInboxItem } from '@littlefinger/shared';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import {
  createNotificationReadIdempotencyKey,
  listNotificationInbox,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notification-inbox-native.ts';
import { notificationAppearance } from './scr-a07-notification-presentation.ts';
import {
  INITIAL_NOTIFICATION_INBOX_STATE,
  notificationInboxReducer,
} from './scr-a07-notification-state.ts';

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
const PAGE_CURSOR = {
  created_at: '2026-08-14T00:00:00.000Z',
  notification_id: '99999999-9999-4999-8999-999999999999',
} as const;
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
  test('전체 읽음 성공은 서버 시각을 만들지 않고 대상의 로컬 읽음 상태를 목록에 합친다', () => {
    const loaded = notificationInboxReducer(INITIAL_NOTIFICATION_INBOX_STATE, {
      type: 'REFRESH_SUCCEEDED',
      loadId: 0,
      items: [item()],
      nextCursor: null,
      startedRevision: 0,
    });
    const pending = notificationInboxReducer(loaded, {
      type: 'READ_ALL_STARTED',
      notificationIds: [FIRST_ID],
    });
    const succeeded = notificationInboxReducer(pending, {
      type: 'READ_ALL_SUCCEEDED',
      notificationIds: [FIRST_ID],
    });

    expect(succeeded.items?.[0]).toMatchObject({ read_at: null, locallyRead: true });
  });

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

    const rows = view.getAllByTestId(/^notification-[0-9a-f-]{36}$/u);
    expect(rows.map((row) => row.props.testID)).toEqual([
      'notification-55555555-5555-4555-8555-555555555555',
      `notification-${FIRST_ID}`,
      `notification-${SECOND_ID}`,
      `notification-${THIRD_ID}`,
    ]);
  });

  test('읽지 않은 항목은 점·토큰 텍스트로 강조하고 본문·시각·상태를 함께 읽어준다', async () => {
    listNotificationInboxMock.mockResolvedValue({
      items: [item(), item({ notification_id: SECOND_ID, read_at: NOW.toISOString() })],
      unread_count: 1,
      next_cursor: null,
    });
    const view = await render(<NotificationInboxScreen />);
    await settle();

    const unreadLabel = view.getByTestId(`notification-unread-${FIRST_ID}`);
    expect(unreadLabel).toBeTruthy();
    expect(StyleSheet.flatten(unreadLabel.props.style).fontFamily).toBe('Pretendard-Regular');
    expect(view.getByTestId(`notification-dot-${FIRST_ID}`)).toBeTruthy();
    expect(view.queryByTestId(`notification-dot-${SECOND_ID}`)).toBeNull();
    expect(
      view.getByRole('button', {
        name: '민준님이 손가락 걸었어요! 약속 성립 매주 화·목 아침 러닝 같이 하기 1분 전 읽지 않음',
      }),
    ).toBeTruthy();
    const body = view.getByTestId(`notification-body-${FIRST_ID}`);
    expect(body.props.numberOfLines).toBe(1);
    expect(body.props.ellipsizeMode).toBe('tail');
    expect(StyleSheet.flatten(body.parent?.props.style).minWidth).toBe(0);
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

    const target = view.getByTestId(`notification-${FIRST_ID}`);
    await fireEvent.press(target);
    await fireEvent.press(target);

    expect(view.queryByText('읽지 않음')).toBeNull();
    expect(markNotificationReadMock).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith({ pathname: '/home' });
    expect(push).toHaveBeenCalledTimes(1);
    await act(async () => resolveRead?.({ notification_id: FIRST_ID, read_at: NOW.toISOString() }));

    await fireEvent.press(view.getByTestId(`notification-${FIRST_ID}`));
    expect(push).toHaveBeenCalledTimes(2);
    expect(markNotificationReadMock).toHaveBeenCalledTimes(1);
  });

  test('읽음 성공과 겹친 오래된 새로고침은 읽지 않음 상태를 되살리지 않는다', async () => {
    let resolveRead: ((value: { notification_id: string; read_at: string }) => void) | undefined;
    let resolveRefresh:
      | ((value: { items: NotificationInboxItem[]; unread_count: number; next_cursor: null }) => void)
      | undefined;
    markNotificationReadMock.mockImplementation(
      async () =>
        await new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    listNotificationInboxMock
      .mockResolvedValueOnce({ items: [item()], unread_count: 1, next_cursor: null })
      .mockImplementationOnce(
        async () =>
          await new Promise((resolve) => {
            resolveRefresh = resolve;
          }),
      );
    const view = await render(<NotificationInboxScreen />);
    await settle();

    await fireEvent.press(view.getByTestId(`notification-${FIRST_ID}`));
    await fireEvent.press(view.getByRole('button', { name: '새로고침' }));
    await act(async () =>
      resolveRead?.({ notification_id: FIRST_ID, read_at: NOW.toISOString() }),
    );
    await act(async () =>
      resolveRefresh?.({ items: [item()], unread_count: 1, next_cursor: null }),
    );

    expect(view.queryByTestId(`notification-unread-${FIRST_ID}`)).toBeNull();
    expect(view.getByTestId(`notification-${FIRST_ID}`).props.accessibilityLabel).toMatch(/읽음/u);
  });

  test('뒤늦은 이전 목록 성공은 최신 권위 목록과 읽음 상태를 덮어쓰지 않는다', async () => {
    type ListResponse = {
      items: NotificationInboxItem[];
      unread_count: number;
      next_cursor: null;
    };
    let resolveLoadA: ((value: ListResponse) => void) | undefined;
    let resolveLoadB: ((value: ListResponse) => void) | undefined;
    listNotificationInboxMock
      .mockResolvedValueOnce({ items: [item()], unread_count: 1, next_cursor: null })
      .mockImplementationOnce(
        async () =>
          await new Promise((resolve) => {
            resolveLoadA = resolve;
          }),
      )
      .mockImplementationOnce(
        async () =>
          await new Promise((resolve) => {
            resolveLoadB = resolve;
          }),
      );
    const view = await render(<NotificationInboxScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '새로고침' }));
    await fireEvent.press(view.getByTestId(`notification-${FIRST_ID}`));
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '새로고침' }));
    await act(async () =>
      resolveLoadB?.({
        items: [item({ body: '최신 권위 목록', read_at: NOW.toISOString() })],
        unread_count: 0,
        next_cursor: null,
      }),
    );
    await act(async () =>
      resolveLoadA?.({
        items: [item({ body: '뒤늦은 이전 목록' })],
        unread_count: 1,
        next_cursor: null,
      }),
    );

    expect(view.getByText(/최신 권위 목록/u)).toBeTruthy();
    expect(view.queryByText(/뒤늦은 이전 목록/u)).toBeNull();
    expect(view.queryByTestId(`notification-unread-${FIRST_ID}`)).toBeNull();
  });

  test('뒤늦은 이전 목록 실패는 최신 성공 뒤 오류를 표시하거나 항목을 지우지 않는다', async () => {
    type ListResponse = {
      items: NotificationInboxItem[];
      unread_count: number;
      next_cursor: null;
    };
    let rejectLoadA: ((reason: Error) => void) | undefined;
    let resolveLoadB: ((value: ListResponse) => void) | undefined;
    listNotificationInboxMock
      .mockResolvedValueOnce({ items: [item()], unread_count: 1, next_cursor: null })
      .mockImplementationOnce(
        async () =>
          await new Promise((_, reject) => {
            rejectLoadA = reject;
          }),
      )
      .mockImplementationOnce(
        async () =>
          await new Promise((resolve) => {
            resolveLoadB = resolve;
          }),
      );
    const view = await render(<NotificationInboxScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '새로고침' }));
    await fireEvent.press(view.getByTestId(`notification-${FIRST_ID}`));
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '새로고침' }));
    await act(async () =>
      resolveLoadB?.({
        items: [item({ body: '최신 성공 목록', read_at: NOW.toISOString() })],
        unread_count: 0,
        next_cursor: null,
      }),
    );
    await act(async () => rejectLoadA?.(new Error('stale load failed')));

    expect(view.getByText(/최신 성공 목록/u)).toBeTruthy();
    expect(
      view.queryByText('알림을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'),
    ).toBeNull();
    expect(view.queryByTestId(`notification-unread-${FIRST_ID}`)).toBeNull();
  });

  test('21개 이상 알림은 복합 cursor를 그대로 보내 다음 페이지를 최신순 뒤에 붙인다', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) =>
      item({
        notification_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        title: `첫 페이지 ${index + 1}`,
        created_at: new Date(NOW.getTime() - index * 60_000).toISOString(),
      }),
    );
    const last = item({
      notification_id: '00000000-0000-4000-8000-000000000021',
      title: '스물한 번째 알림',
      created_at: '2026-08-14T00:00:00.000Z',
    });
    listNotificationInboxMock
      .mockResolvedValueOnce({ items: firstPage, unread_count: 21, next_cursor: PAGE_CURSOR })
      .mockResolvedValueOnce({ items: [last], unread_count: 21, next_cursor: null });
    const view = await render(<NotificationInboxScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '알림 더 보기' }));
    await settle();

    expect(listNotificationInboxMock).toHaveBeenNthCalledWith(2, { cursor: PAGE_CURSOR });
    expect(view.getAllByTestId(/^notification-[0-9a-f-]{36}$/u)).toHaveLength(21);
    expect(view.getByText('스물한 번째 알림')).toBeTruthy();
    expect(view.queryByRole('button', { name: '알림 더 보기' })).toBeNull();
  });

  test('다음 페이지의 중복 notification_id는 한 번만 유지한다', async () => {
    listNotificationInboxMock
      .mockResolvedValueOnce({ items: [item()], unread_count: 2, next_cursor: PAGE_CURSOR })
      .mockResolvedValueOnce({
        items: [
          item({ title: '중복 응답' }),
          item({ notification_id: SECOND_ID, title: '새 응답' }),
        ],
        unread_count: 2,
        next_cursor: null,
      });
    const view = await render(<NotificationInboxScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '알림 더 보기' }));
    await settle();

    expect(view.getAllByTestId(`notification-${FIRST_ID}`)).toHaveLength(1);
    expect(view.getByTestId(`notification-${SECOND_ID}`)).toBeTruthy();
    expect(view.queryByText('중복 응답')).toBeNull();
  });

  test('다음 페이지 요청 중 중복 탭은 같은 cursor 호출을 늘리지 않는다', async () => {
    let resolvePage:
      | ((value: { items: NotificationInboxItem[]; unread_count: number; next_cursor: null }) => void)
      | undefined;
    listNotificationInboxMock
      .mockResolvedValueOnce({ items: [item()], unread_count: 1, next_cursor: PAGE_CURSOR })
      .mockImplementationOnce(
        async () =>
          await new Promise((resolve) => {
            resolvePage = resolve;
          }),
      );
    const view = await render(<NotificationInboxScreen />);
    await settle();
    const loadMore = view.getByRole('button', { name: '알림 더 보기' });

    await fireEvent.press(loadMore);
    await fireEvent.press(loadMore);

    expect(listNotificationInboxMock).toHaveBeenCalledTimes(2);
    await act(async () => resolvePage?.({ items: [], unread_count: 1, next_cursor: null }));
  });

  test('새로고침 뒤 도착한 이전 세대 페이지는 최신 권위 목록에 붙지 않는다', async () => {
    let resolvePage:
      | ((value: { items: NotificationInboxItem[]; unread_count: number; next_cursor: null }) => void)
      | undefined;
    listNotificationInboxMock
      .mockResolvedValueOnce({ items: [item()], unread_count: 1, next_cursor: PAGE_CURSOR })
      .mockImplementationOnce(
        async () =>
          await new Promise((resolve) => {
            resolvePage = resolve;
          }),
      )
      .mockResolvedValueOnce({
        items: [item({ title: '새로고침 권위 항목', read_at: NOW.toISOString() })],
        unread_count: 0,
        next_cursor: null,
      });
    const view = await render(<NotificationInboxScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '알림 더 보기' }));
    await fireEvent.press(view.getByRole('button', { name: '새로고침' }));
    await settle();
    await act(async () =>
      resolvePage?.({
        items: [item({ notification_id: SECOND_ID, title: '뒤늦은 페이지' })],
        unread_count: 1,
        next_cursor: null,
      }),
    );

    expect(view.getByText('새로고침 권위 항목')).toBeTruthy();
    expect(view.queryByText('뒤늦은 페이지')).toBeNull();
  });

  test('다음 페이지 실패는 기존 항목을 보존하고 다시 시도할 수 있다', async () => {
    listNotificationInboxMock
      .mockResolvedValueOnce({ items: [item()], unread_count: 1, next_cursor: PAGE_CURSOR })
      .mockRejectedValueOnce(new Error('page failed'))
      .mockResolvedValueOnce({
        items: [item({ notification_id: SECOND_ID, title: '재시도 페이지' })],
        unread_count: 1,
        next_cursor: null,
      });
    const view = await render(<NotificationInboxScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '알림 더 보기' }));
    await settle();

    expect(view.getByTestId(`notification-${FIRST_ID}`)).toBeTruthy();
    expect(view.getByText('알림을 더 불러오지 못했어요. 다시 시도해 주세요.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '알림 더 보기' }));
    await settle();
    expect(view.getByText('재시도 페이지')).toBeTruthy();
  });

  test('첫 응답이 마지막 페이지면 더 보기 control을 렌더링하지 않는다', async () => {
    listNotificationInboxMock.mockResolvedValue({
      items: [item()],
      unread_count: 1,
      next_cursor: null,
    });
    const view = await render(<NotificationInboxScreen />);
    await settle();

    expect(view.queryByRole('button', { name: '알림 더 보기' })).toBeNull();
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

    await fireEvent.press(view.getByTestId(`notification-${FIRST_ID}`));
    await fireEvent.press(action);
    expect(push).toHaveBeenCalledTimes(1);
    expect(markNotificationReadMock).not.toHaveBeenCalled();
    expect(markAllNotificationsReadMock).toHaveBeenCalledTimes(1);
  });

  test('읽지 않은 항목이 없으면 모두 읽음 요청을 보내지 않는다', async () => {
    listNotificationInboxMock.mockResolvedValue({
      items: [item({ read_at: NOW.toISOString() })],
      unread_count: 0,
      next_cursor: null,
    });
    const view = await render(<NotificationInboxScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '모두 읽음' }));

    expect(markAllNotificationsReadMock).not.toHaveBeenCalled();
  });

  test('promise_id가 없는 매개변수형 deeplink는 읽음만 처리하고 이동하지 않는다', async () => {
    listNotificationInboxMock.mockResolvedValue({
      items: [item({ promise_id: null, event: 'NT-08', deeplink: 'SCR-A06' })],
      unread_count: 1,
      next_cursor: null,
    });
    const view = await render(<NotificationInboxScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: /읽지 않음/u }));

    expect(push).not.toHaveBeenCalled();
    expect(markNotificationReadMock).toHaveBeenCalledTimes(1);
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

  test.each([
    ['NT-01', { semanticType: 'CONFIRMATION', icon: 'pinky', tone: 'accent', label: '약속 확정' }],
    ['NT-02', { semanticType: 'APPROVAL', icon: 'person-off', tone: 'default', label: '승인 응답' }],
    ['NT-03', { semanticType: 'AMEND', icon: 'sync-alt', tone: 'default', label: '변경 요청' }],
    ['NT-04', { semanticType: 'REMINDER', icon: 'alarm', tone: 'default', label: '리마인드' }],
    ['NT-05', { semanticType: 'REMINDER', icon: 'alarm', tone: 'default', label: '리마인드' }],
    ['NT-06', { semanticType: 'REMINDER', icon: 'alarm', tone: 'default', label: '리마인드' }],
    ['NT-07', { semanticType: 'REMINDER', icon: 'alarm', tone: 'default', label: '리마인드' }],
    ['NT-08', { semanticType: 'FULFILLMENT', icon: 'notification-important', tone: 'urgent', label: '이행 확인' }],
    ['NT-09', { semanticType: 'FULFILLMENT', icon: 'notification-important', tone: 'urgent', label: '이행 확인' }],
    ['NT-10', { semanticType: 'FULFILLMENT', icon: 'notification-important', tone: 'urgent', label: '이행 확인' }],
    ['NT-11', { semanticType: 'RESULT', icon: 'fact-check', tone: 'default', label: '이행 결과' }],
    ['NT-12', { semanticType: 'RESULT', icon: 'fact-check', tone: 'default', label: '이행 결과' }],
    ['NT-13', { semanticType: 'RESULT', icon: 'fact-check', tone: 'default', label: '이행 결과' }],
    ['NT-14', { semanticType: 'RESULT', icon: 'fact-check', tone: 'default', label: '이행 결과' }],
    ['NT-19', { semanticType: 'FULFILLMENT', icon: 'notification-important', tone: 'urgent', label: '이행 확인' }],
  ] as const)('%s는 승인된 의미 유형과 아이콘을 사용한다', (event, expected) => {
    expect(notificationAppearance(event)).toEqual(expected);
  });
});
