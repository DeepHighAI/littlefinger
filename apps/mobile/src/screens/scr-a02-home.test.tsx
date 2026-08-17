import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { readAdsEnabled } from '../lib/ads-config-native.ts';
import { deleteDraft, listHomePromises } from '../lib/home-promises-native.ts';
import HomeScreen from '../app/home';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock(
  '../lib/ads-config-native.ts',
  () => ({ readAdsEnabled: jest.fn() }),
  { virtual: true },
);
jest.mock('../components/LfAdSlot', () => {
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    LfAdSlot: ({ enabled }: { enabled: boolean }) => (
      enabled ? <View testID="lf-ad-slot" /> : null
    ),
  };
});
jest.mock(
  '../lib/home-promises-native.ts',
  () => ({
    deleteDraft: jest.fn(),
    listHomePromises: jest.fn(),
  }),
  { virtual: true },
);
jest.mock(
  '../lib/fulfillment-native.ts',
  () => ({ listParticipantPromises: jest.fn().mockResolvedValue([]) }),
  { virtual: true },
);

const NOW = new Date('2026-08-16T00:00:00Z');
const ACTIVE_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_ID = '22222222-2222-4222-8222-222222222222';
const THIRD_ID = '33333333-3333-4333-8333-333333333333';

const listHomePromisesMock = jest.mocked(listHomePromises);
const deleteDraftMock = jest.mocked(deleteDraft);
const readAdsEnabledMock = jest.mocked(readAdsEnabled);
const push = jest.fn();

function card(input: {
  id: string;
  title: string;
  status?: string;
  endDate?: string | null;
  role?: string;
  witness?: boolean;
  needsResponse?: boolean;
  partner?: { nickname: string; profile_image_url: string | null } | null;
}) {
  return {
    promise_id: input.id,
    title: input.title,
    status: input.status ?? 'ACTIVE',
    end_date: input.endDate === undefined ? '2026-08-30' : input.endDate,
    updated_at: '2026-08-16T00:00:00Z',
    closed_at: null,
    my_role: input.role ?? 'CREATOR',
    creator: { nickname: '지우', profile_image_url: null },
    partner:
      input.partner === undefined
        ? { nickname: '민준', profile_image_url: null }
        : input.partner,
    has_witness: input.witness ?? false,
    needs_response: input.needsResponse ?? false,
  } as any;
}

function response(input: {
  items?: any[];
  pinned?: any[];
  counts?: { ACTIVE: number; WAITING: number; COMPLETED: number };
  nextCursor?: any;
} = {}) {
  return {
    items: input.items ?? [],
    pinned: input.pinned ?? [],
    counts: input.counts ?? { ACTIVE: 0, WAITING: 0, COMPLETED: 0 },
    next_cursor: input.nextCursor ?? null,
  };
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

describe('SCR-A02 F-10 홈 목록', () => {
  beforeEach(() => {
    push.mockReset();
    jest.mocked(useRouter).mockReturnValue({ push } as never);
    deleteDraftMock.mockReset();
    deleteDraftMock.mockResolvedValue(undefined);
    listHomePromisesMock.mockReset();
    listHomePromisesMock.mockResolvedValue(response());
    readAdsEnabledMock.mockReset();
    readAdsEnabledMock.mockResolvedValue(false);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  test('첫 진입은 ACTIVE 첫 페이지만 읽고 3탭·빈 상태·단일 FAB를 광고 자리 없이 보여준다', async () => {
    const view = await render(<HomeScreen now={NOW} />);
    await settle();

    expect(listHomePromisesMock).toHaveBeenCalledWith({ tab: 'ACTIVE' });
    expect(view.getByRole('tab', { name: '진행 중 0' }).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(view.getByRole('tab', { name: '대기 0' })).toBeTruthy();
    expect(view.getByRole('tab', { name: '완료 0' })).toBeTruthy();
    expect(view.getByText('아직 약속이 없어요. 첫 약속을 만들어보세요')).toBeTruthy();
    expect(view.getAllByRole('button', { name: '약속 만들기' })).toHaveLength(1);
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
    expect(readAdsEnabledMock).toHaveBeenCalledTimes(1);
  });

  test('원격 플래그가 true일 때만 목록 하단에 광고 슬롯 1개를 붙인다', async () => {
    readAdsEnabledMock.mockResolvedValue(true);
    const view = await render(<HomeScreen now={NOW} />);
    await settle();

    expect(view.getAllByTestId('lf-ad-slot')).toHaveLength(1);
    expect(readAdsEnabledMock).toHaveBeenCalledTimes(1);
  });

  test('앱바는 알림과 마이 프로필을 분리하고 프로필 버튼은 SCR-A08로 이동한다', async () => {
    const view = await render(<HomeScreen now={NOW} />);
    await settle();

    const notification = view.getByRole('button', { name: '알림' });
    const profile = view.getByRole('button', { name: '마이 프로필' });
    expect(notification).toHaveStyle({ minHeight: 48, minWidth: 48 });
    expect(profile).toHaveStyle({ minHeight: 48, minWidth: 48 });
    await fireEvent.press(profile);
    expect(push).toHaveBeenCalledWith('/profile');
  });

  test('각 탭은 48dp이고 최초 선택할 때만 지연 조회하며 돌아와도 cache를 유지한다', async () => {
    listHomePromisesMock.mockImplementation(async ({ tab }) =>
      tab === 'ACTIVE'
        ? response({ items: [card({ id: ACTIVE_ID, title: '진행 약속' })] })
        : response({
            items: [card({ id: SECOND_ID, title: '대기 약속', status: 'DRAFT', endDate: null })],
          }),
    );
    const view = await render(<HomeScreen now={NOW} />);
    await settle();

    const waitingTab = view.getByRole('tab', { name: '대기 0' });
    expect(waitingTab.props.style.minHeight).toBe(48);
    await fireEvent.press(waitingTab);
    await settle();
    expect(view.getByText('대기 약속')).toBeTruthy();
    expect(listHomePromisesMock).toHaveBeenNthCalledWith(2, { tab: 'WAITING' });

    await fireEvent.press(view.getByRole('tab', { name: '진행 중 0' }));
    await settle();
    expect(view.getByText('진행 약속')).toBeTruthy();
    expect(listHomePromisesMock).toHaveBeenCalledTimes(2);
  });

  test('ACTIVE 임박 영역은 탭 상단에만 보이고 같은 약속을 일반 목록에 중복하지 않는다', async () => {
    listHomePromisesMock.mockResolvedValue(
      response({
        items: [
          card({ id: ACTIVE_ID, title: '내일까지 약속', endDate: '2026-08-17' }),
          card({ id: SECOND_ID, title: '일반 약속' }),
        ],
        pinned: [card({ id: ACTIVE_ID, title: '내일까지 약속', endDate: '2026-08-17' })],
        counts: { ACTIVE: 2, WAITING: 1, COMPLETED: 3 },
      }),
    );
    const view = await render(<HomeScreen now={NOW} />);
    await settle();

    expect(view.getByText('임박한 약속')).toBeTruthy();
    expect(view.getAllByText('내일까지 약속')).toHaveLength(1);
    expect(view.getByText('일반 약속')).toBeTruthy();
    expect(view.getByRole('tab', { name: '진행 중 2' })).toBeTruthy();
    expect(view.getByRole('tab', { name: '대기 1' })).toBeTruthy();
    expect(view.getByRole('tab', { name: '완료 3' })).toBeTruthy();
  });

  test('일반 카드는 상태·D-Day·종료일·당사자·증인 정보를 색 외 텍스트로 표시한다', async () => {
    listHomePromisesMock.mockResolvedValue(
      response({
        items: [
          card({ id: ACTIVE_ID, title: '함께 걷기', witness: true, endDate: '2026-08-30' }),
        ],
        counts: { ACTIVE: 1, WAITING: 0, COMPLETED: 0 },
      }),
    );
    const view = await render(<HomeScreen now={NOW} />);
    await settle();

    expect(view.getByText('진행 중')).toBeTruthy();
    expect(view.getByText('D-14')).toBeTruthy();
    expect(view.getByText('종료일 2026-08-30 (일)')).toBeTruthy();
    expect(view.getByText('지우 — 민준')).toBeTruthy();
    expect(view.getByText('증인')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '함께 걷기 열기' }));
    expect(push).toHaveBeenCalledWith({
      pathname: '/promise/[promise_id]',
      params: { promise_id: ACTIVE_ID },
    });
  });

  test('CHECKING 임박 카드도 상세를 먼저 열고 응답 CTA는 SCR-A05가 소유한다', async () => {
    listHomePromisesMock.mockResolvedValue(
      response({
        pinned: [
          card({
            id: ACTIVE_ID,
            title: '확인할 약속',
            status: 'CHECKING',
            endDate: '2026-08-15',
            needsResponse: true,
          }),
        ],
        counts: { ACTIVE: 1, WAITING: 0, COMPLETED: 0 },
      }),
    );
    const view = await render(<HomeScreen now={NOW} />);
    await settle();

    expect(view.getByText('이행 확인 필요')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '지켜졌나요? 답하기' }));
    expect(push).toHaveBeenCalledWith({
      pathname: '/promise/[promise_id]',
      params: { promise_id: ACTIVE_ID },
    });
  });

  test('WAITING의 DRAFT만 A03으로 가고 PENDING은 SCR-A05로 이동하며 DRAFT 삭제는 2회 확인한다', async () => {
    listHomePromisesMock.mockImplementation(async ({ tab }) =>
      tab === 'ACTIVE'
        ? response({ counts: { ACTIVE: 0, WAITING: 2, COMPLETED: 0 } })
        : response({
            items: [
              card({ id: ACTIVE_ID, title: '초안', status: 'DRAFT', endDate: null }),
              card({ id: SECOND_ID, title: '승인 대기', status: 'PENDING' }),
            ],
            counts: { ACTIVE: 0, WAITING: 2, COMPLETED: 0 },
          }),
    );
    const alert = jest.spyOn(Alert, 'alert');
    const view = await render(<HomeScreen now={NOW} />);
    await settle();
    await fireEvent.press(view.getByRole('tab', { name: '대기 2' }));
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '초안 열기' }));
    await fireEvent.press(view.getByRole('button', { name: '승인 대기 열기' }));
    expect(push).toHaveBeenNthCalledWith(1, {
      pathname: '/promise/edit',
      params: { promise_id: ACTIVE_ID },
    });
    expect(push).toHaveBeenNthCalledWith(2, {
      pathname: '/promise/[promise_id]',
      params: { promise_id: SECOND_ID },
    });

    await fireEvent.press(view.getByRole('button', { name: '초안 초안 삭제' }));
    alert.mock.calls[0]?.[2]?.find((button) => button.text === '계속')?.onPress?.();
    await act(async () => {
      await alert.mock.calls[1]?.[2]?.find((button) => button.text === '삭제')?.onPress?.();
    });
    expect(deleteDraftMock).toHaveBeenCalledWith(ACTIVE_ID);
    expect(view.queryByText('초안')).toBeNull();
    expect(view.getByRole('tab', { name: '대기 1' })).toBeTruthy();
  });

  test('ACTIVE·AMEND_PENDING·종결 카드는 모두 SCR-A05를 연다', async () => {
    listHomePromisesMock.mockImplementation(async ({ tab }) =>
      tab === 'ACTIVE'
        ? response({
            items: [
              card({ id: ACTIVE_ID, title: '활성 약속' }),
              card({ id: SECOND_ID, title: '변경 중', status: 'AMEND_PENDING' }),
            ],
            counts: { ACTIVE: 2, WAITING: 0, COMPLETED: 1 },
          })
        : response({
            items: [
              card({
                id: THIRD_ID,
                title: '완료 약속',
                status: 'COMPLETED',
                endDate: '2026-08-01',
              }),
            ],
            counts: { ACTIVE: 2, WAITING: 0, COMPLETED: 1 },
          }),
    );
    const view = await render(<HomeScreen now={NOW} />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '활성 약속 열기' }));
    await fireEvent.press(view.getByRole('button', { name: '변경 중 열기' }));

    await fireEvent.press(view.getByRole('tab', { name: '완료 1' }));
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '완료 약속 열기' }));
    expect(push).toHaveBeenNthCalledWith(1, {
      pathname: '/promise/[promise_id]', params: { promise_id: ACTIVE_ID },
    });
    expect(push).toHaveBeenNthCalledWith(2, {
      pathname: '/promise/[promise_id]', params: { promise_id: SECOND_ID },
    });
    expect(push).toHaveBeenNthCalledWith(3, {
      pathname: '/promise/[promise_id]', params: { promise_id: THIRD_ID },
    });
  });

  test('목록 끝 중복 호출은 cursor page를 한 번만 요청하고 새 카드만 append한다', async () => {
    const cursor = {
      tab: 'ACTIVE',
      status_rank: 1,
      end_date: '2026-08-30',
      promise_id: ACTIVE_ID,
    } as const;
    let finishPage: ((value: any) => void) | undefined;
    listHomePromisesMock
      .mockResolvedValueOnce(
        response({ items: [card({ id: ACTIVE_ID, title: '첫 페이지' })], nextCursor: cursor }),
      )
      .mockImplementationOnce(
        async () => await new Promise((resolve) => { finishPage = resolve; }),
      );
    const view = await render(<HomeScreen now={NOW} />);
    await settle();

    const list = view.getByTestId('home-list');
    await act(async () => {
      list.props.onEndReached();
      list.props.onEndReached();
      await Promise.resolve();
    });
    expect(listHomePromisesMock).toHaveBeenCalledTimes(2);
    expect(listHomePromisesMock).toHaveBeenNthCalledWith(2, { tab: 'ACTIVE', cursor });

    await act(async () =>
      finishPage?.(response({ items: [card({ id: SECOND_ID, title: '다음 페이지' })] })),
    );
    expect(view.getByText('다음 페이지')).toBeTruthy();
  });

  test('page 실패는 기존 목록을 보존하고 다시 시도하면 같은 cursor를 재요청한다', async () => {
    const cursor = {
      tab: 'ACTIVE',
      status_rank: 1,
      end_date: '2026-08-30',
      promise_id: ACTIVE_ID,
    } as const;
    listHomePromisesMock
      .mockResolvedValueOnce(
        response({ items: [card({ id: ACTIVE_ID, title: '보존할 약속' })], nextCursor: cursor }),
      )
      .mockRejectedValueOnce(new Error('page sql detail'))
      .mockResolvedValueOnce(
        response({ items: [card({ id: SECOND_ID, title: '복구된 약속' })] }),
      );
    const view = await render(<HomeScreen now={NOW} />);
    await settle();
    await act(async () => {
      view.getByTestId('home-list').props.onEndReached();
      await Promise.resolve();
    });

    expect(view.getByText('보존할 약속')).toBeTruthy();
    expect(view.queryByText(/sql detail/u)).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: '목록 더 불러오기 다시 시도' }));
    await settle();
    expect(listHomePromisesMock).toHaveBeenNthCalledWith(3, { tab: 'ACTIVE', cursor });
    expect(view.getByText('복구된 약속')).toBeTruthy();
  });

  test('당겨서 새로고침은 선택 탭만 첫 페이지로 교체하고 다른 탭 cache를 유지한다', async () => {
    listHomePromisesMock
      .mockResolvedValueOnce(response({ items: [card({ id: ACTIVE_ID, title: '활성 cache' })] }))
      .mockResolvedValueOnce(
        response({
          items: [card({ id: SECOND_ID, title: '대기 이전', status: 'DRAFT', endDate: null })],
        }),
      )
      .mockResolvedValueOnce(
        response({ items: [card({ id: THIRD_ID, title: '대기 새로고침', status: 'PENDING' })] }),
      );
    const view = await render(<HomeScreen now={NOW} />);
    await settle();
    await fireEvent.press(view.getByRole('tab', { name: '대기 0' }));
    await settle();

    await act(async () => {
      view.getByTestId('home-list').props.refreshControl.props.onRefresh();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(listHomePromisesMock).toHaveBeenNthCalledWith(3, { tab: 'WAITING' });
    expect(view.getByText('대기 새로고침')).toBeTruthy();

    await fireEvent.press(view.getByRole('tab', { name: '진행 중 0' }));
    expect(view.getByText('활성 cache')).toBeTruthy();
    expect(listHomePromisesMock).toHaveBeenCalledTimes(3);
  });

  test('첫 page 실패는 내부 오류 대신 탭별 재시도 안내를 보여준다', async () => {
    listHomePromisesMock
      .mockRejectedValueOnce(new Error('relation public.promises'))
      .mockResolvedValueOnce(
        response({ items: [card({ id: ACTIVE_ID, title: '재시도 성공' })] }),
      );
    const view = await render(<HomeScreen now={NOW} />);
    await settle();

    expect(
      view.getByText('약속을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'),
    ).toBeTruthy();
    expect(view.queryByText(/public\.promises/u)).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: '약속 목록 다시 시도' }));
    await settle();
    expect(view.getByText('재시도 성공')).toBeTruthy();
  });

  test('알림함과 새 약속 경로는 기존 보호 경로를 유지한다', async () => {
    const view = await render(<HomeScreen now={NOW} />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '알림' }));
    await fireEvent.press(view.getByRole('button', { name: '약속 만들기' }));

    expect(push).toHaveBeenNthCalledWith(1, '/notifications');
    expect(push).toHaveBeenNthCalledWith(2, '/promise/edit');
  });
});
