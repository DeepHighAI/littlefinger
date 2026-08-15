import {
  act,
  fireEvent,
  render,
} from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import {
  deleteDraft,
  listWaitingPromises,
} from '../lib/home-promises-native.ts';
import { listParticipantPromises } from '../lib/fulfillment-native.ts';
import HomeScreen from '../app/home';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));
jest.mock(
  '../lib/home-promises-native.ts',
  () => ({
    deleteDraft: jest.fn(),
    listWaitingPromises: jest.fn(),
  }),
  { virtual: true },
);
jest.mock(
  '../lib/fulfillment-native.ts',
  () => ({
    listParticipantPromises: jest.fn(),
  }),
  { virtual: true },
);

const deleteDraftMock = jest.mocked(deleteDraft);
const listWaitingPromisesMock = jest.mocked(listWaitingPromises);
const listParticipantPromisesMock = jest.mocked(listParticipantPromises);
const push = jest.fn();

jest.setTimeout(15_000);

async function settlePromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('SCR-A02 홈·약속 목록 — M1 범위', () => {
  beforeEach(() => {
    push.mockReset();
    jest.mocked(useRouter).mockReturnValue({ push } as never);
    deleteDraftMock.mockReset();
    deleteDraftMock.mockResolvedValue(undefined);
    listWaitingPromisesMock.mockReset();
    listWaitingPromisesMock.mockResolvedValue([]);
    listParticipantPromisesMock.mockReset();
    listParticipantPromisesMock.mockResolvedValue([]);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('빈 홈은 명세 문구와 단일 약속 만들기 CTA를 보여주고 광고 자리를 남기지 않는다', async () => {
    const view = await render(<HomeScreen />);
    await settlePromises();

    expect(view.getByText('아직 약속이 없어요. 첫 약속을 만들어보세요')).toBeTruthy();
    expect(view.getByText('진행 중 0')).toBeTruthy();
    expect(view.getByText('대기 0')).toBeTruthy();
    expect(view.getByText('완료 0')).toBeTruthy();
    expect(view.getAllByRole('button', { name: '약속 만들기' })).toHaveLength(1);
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
  });

  test('[약속 만들기]는 새 SCR-A03으로 이동한다', async () => {
    const view = await render(<HomeScreen />);
    await settlePromises();

    await fireEvent.press(view.getByRole('button', { name: '약속 만들기' }));

    expect(push).toHaveBeenCalledWith('/promise/edit');
  });

  test('알림함 진입은 48dp 접근성 버튼으로 보호된 경로를 연다', async () => {
    const view = await render(<HomeScreen />);
    await settlePromises();

    const action = view.getByRole('button', { name: '알림' });
    await fireEvent.press(action);

    expect(action.props.style.minHeight).toBe(48);
    expect(action.props.style.minWidth).toBe(48);
    expect(push).toHaveBeenCalledWith('/notifications');
  });

  test('이번 흐름에서 만든 DRAFT와 PENDING만 대기 목록에 상태 라벨과 함께 보인다', async () => {
    listWaitingPromisesMock.mockResolvedValue([
      {
        id: 'draft-1',
        status: 'DRAFT',
        title: '주 3회 달리기',
        updated_at: '2026-07-30T01:00:00Z',
      },
      {
        id: 'pending-1',
        status: 'PENDING',
        title: '매일 물 마시기',
        updated_at: '2026-07-30T00:00:00Z',
      },
    ]);

    const view = await render(<HomeScreen />);
    await settlePromises();

    expect(view.getByText('주 3회 달리기')).toBeTruthy();
    expect(view.getByText('작성 중')).toBeTruthy();
    expect(view.getByText('승인 대기')).toBeTruthy();
    expect(view.getByText('대기 2')).toBeTruthy();
    expect(view.queryByText('아직 약속이 없어요. 첫 약속을 만들어보세요')).toBeNull();
  });

  test('DRAFT는 SCR-A03 재편집, PENDING은 SCR-A04로 이동한다', async () => {
    listWaitingPromisesMock.mockResolvedValue([
      {
        id: 'draft-1',
        status: 'DRAFT',
        title: '주 3회 달리기',
        updated_at: '2026-07-30T01:00:00Z',
      },
      {
        id: 'pending-1',
        status: 'PENDING',
        title: '매일 물 마시기',
        updated_at: '2026-07-30T00:00:00Z',
      },
    ]);
    const view = await render(<HomeScreen />);
    await settlePromises();

    await fireEvent.press(view.getByRole('button', { name: '주 3회 달리기 열기' }));
    await fireEvent.press(view.getByRole('button', { name: '매일 물 마시기 열기' }));

    expect(push).toHaveBeenNthCalledWith(1, {
      pathname: '/promise/edit',
      params: { promise_id: 'draft-1' },
    });
    expect(push).toHaveBeenNthCalledWith(2, {
      pathname: '/invite',
      params: { promise_id: 'pending-1' },
    });
  });

  test('DRAFT 삭제는 두 번 확인한 뒤에만 실행하고 목록에서 제거한다', async () => {
    listWaitingPromisesMock.mockResolvedValue([
      {
        id: 'draft-1',
        status: 'DRAFT',
        title: '삭제할 초안',
        updated_at: '2026-07-30T01:00:00Z',
      },
    ]);
    const alert = jest.spyOn(Alert, 'alert');
    const view = await render(<HomeScreen />);
    await settlePromises();
    expect(view.getByText('삭제할 초안')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: '삭제할 초안 초안 삭제' }));
    expect(alert).toHaveBeenCalledTimes(1);

    const firstButtons = alert.mock.calls[0]?.[2];
    firstButtons?.find((button) => button.text === '계속')?.onPress?.();
    expect(alert).toHaveBeenCalledTimes(2);
    expect(deleteDraftMock).not.toHaveBeenCalled();

    const secondButtons = alert.mock.calls[1]?.[2];
    await act(async () => {
      await secondButtons?.find((button) => button.text === '삭제')?.onPress?.();
    });

    expect(deleteDraftMock).toHaveBeenCalledWith('draft-1');
    expect(view.queryByText('삭제할 초안')).toBeNull();
  });

  test('목록 로드 실패는 내부 오류를 노출하지 않고 재시도 안내를 보여준다', async () => {
    listWaitingPromisesMock.mockRejectedValue(new Error('relation public.promises'));

    const view = await render(<HomeScreen />);
    await settlePromises();

    expect(view.getByText('약속을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')).toBeTruthy();
    expect(view.queryByText(/public\.promises/u)).toBeNull();
  });

  test('참여 약속을 대기 목록과 병렬로 불러오고 한쪽 실패가 다른 목록을 가리지 않는다', async () => {
    let settleWaiting: ((rows: []) => void) | undefined;
    listWaitingPromisesMock.mockImplementation(
      async () =>
        await new Promise((resolve) => {
          settleWaiting = resolve;
        }),
    );
    listParticipantPromisesMock.mockResolvedValue([
      {
        promise_id: 'checking-1',
        title: '먼저 답할 약속',
        status: 'CHECKING',
        end_date: '2026-08-11',
        keeper: 'BOTH',
        updated_at: '2026-08-12T01:00:00Z',
        check_deadline_at: '2026-08-18T15:00:00Z',
        check_round_no: 1,
        needs_response: true,
        waiting_for_partner: false,
      },
    ]);

    const view = await render(<HomeScreen />);
    await settlePromises();

    expect(listWaitingPromisesMock).toHaveBeenCalledTimes(1);
    expect(listParticipantPromisesMock).toHaveBeenCalledTimes(1);
    expect(view.getByText('먼저 답할 약속')).toBeTruthy();

    await act(async () => settleWaiting?.([]));
  });

  test('참여 목록 실패 시 DRAFT/PENDING은 유지하고 영향받은 영역만 오류를 표시한다', async () => {
    listWaitingPromisesMock.mockResolvedValue([
      {
        id: 'draft-1',
        status: 'DRAFT',
        title: '계속 보이는 초안',
        updated_at: '2026-07-30T01:00:00Z',
      },
    ]);
    listParticipantPromisesMock.mockRejectedValue(
      new Error('participant-promise-list failed'),
    );

    const view = await render(<HomeScreen />);
    await settlePromises();

    expect(view.getByText('계속 보이는 초안')).toBeTruthy();
    expect(view.getByText('참여 약속을 불러오지 못했어요.')).toBeTruthy();
    expect(view.queryByText(/participant-promise-list/u)).toBeNull();
  });

  test('상태 집합별 탭 수를 계산하고 응답이 필요한 CHECKING을 맨 앞에 둔다', async () => {
    listParticipantPromisesMock.mockResolvedValue([
      {
        promise_id: 'active-1',
        title: '진행 중 약속',
        status: 'ACTIVE',
        end_date: '2026-08-20',
        keeper: 'CREATOR',
        updated_at: '2026-08-10T00:00:00Z',
        check_deadline_at: null,
        check_round_no: 0,
        needs_response: false,
        waiting_for_partner: false,
      },
      {
        promise_id: 'completed-1',
        title: '완료 약속',
        status: 'COMPLETED',
        end_date: '2026-08-01',
        keeper: 'PARTNER',
        updated_at: '2026-08-13T00:00:00Z',
        check_deadline_at: null,
        check_round_no: 1,
        needs_response: false,
        waiting_for_partner: false,
      },
      {
        promise_id: 'checking-wait',
        title: '상대를 기다리는 약속',
        status: 'CHECKING',
        end_date: '2026-08-11',
        keeper: 'BOTH',
        updated_at: '2026-08-12T02:00:00Z',
        check_deadline_at: '2026-08-18T15:00:00Z',
        check_round_no: 1,
        needs_response: false,
        waiting_for_partner: true,
      },
      {
        promise_id: 'checking-action',
        title: '내 응답이 필요한 약속',
        status: 'CHECKING',
        end_date: '2026-08-11',
        keeper: 'BOTH',
        updated_at: '2026-08-12T01:00:00Z',
        check_deadline_at: '2026-08-18T15:00:00Z',
        check_round_no: 1,
        needs_response: true,
        waiting_for_partner: false,
      },
      {
        promise_id: 'amend-1',
        title: '변경 협의 약속',
        status: 'AMEND_PENDING',
        end_date: '2026-08-25',
        keeper: 'BOTH',
        updated_at: '2026-08-09T00:00:00Z',
        check_deadline_at: null,
        check_round_no: 0,
        needs_response: false,
        waiting_for_partner: false,
      },
      ...(['BROKEN', 'DISPUTED', 'UNRESOLVED', 'CANCELED', 'DECLINED'] as const).map(
        (status, index) => ({
          promise_id: `terminal-${index}`,
          title: `${status} 약속`,
          status,
          end_date: '2026-08-01',
          keeper: 'BOTH' as const,
          updated_at: `2026-08-0${index + 1}T00:00:00Z`,
          check_deadline_at: null,
          check_round_no: 1,
          needs_response: false,
          waiting_for_partner: false,
        }),
      ),
    ]);

    const view = await render(<HomeScreen />);
    await settlePromises();

    expect(view.getByText('진행 중 4')).toBeTruthy();
    expect(view.getByText('완료 6')).toBeTruthy();
    const cards = view.getAllByTestId(/^participant-promise-/u);
    expect(cards[0]?.props.testID).toBe('participant-promise-checking-action');
  });

  test.each(['CHECKING', 'DISPUTED', 'COMPLETED', 'BROKEN', 'UNRESOLVED'] as const)(
    '%s 카드는 SCR-A06 응답·결과 화면으로 이동한다',
    async (status) => {
      listParticipantPromisesMock.mockResolvedValue([
        {
          promise_id: `promise-${status}`,
          title: `${status} 약속`,
          status,
          end_date: '2026-08-11',
          keeper: 'BOTH',
          updated_at: '2026-08-12T01:00:00Z',
          check_deadline_at: status === 'CHECKING' ? '2026-08-18T15:00:00Z' : null,
          check_round_no: 1,
          needs_response: status === 'CHECKING',
          waiting_for_partner: false,
        },
      ]);
      const view = await render(<HomeScreen />);
      await settlePromises();

      await fireEvent.press(
        view.getByRole('button', { name: `${status} 약속 열기` }),
      );

      expect(push).toHaveBeenCalledWith({
        pathname: '/fulfillment/[promise_id]',
        params: { promise_id: `promise-${status}` },
      });
    },
  );

  test.each(['ACTIVE', 'AMEND_PENDING', 'CANCELED', 'DECLINED'] as const)(
    '%s 카드는 상태만 보여주고 아직 없는 상세 행동을 만들지 않는다',
    async (status) => {
      listParticipantPromisesMock.mockResolvedValue([
        {
          promise_id: `promise-${status}`,
          title: `${status} 약속`,
          status,
          end_date: '2026-08-11',
          keeper: 'BOTH',
          updated_at: '2026-08-12T01:00:00Z',
          check_deadline_at: null,
          check_round_no: 0,
          needs_response: false,
          waiting_for_partner: false,
        },
      ]);
      const view = await render(<HomeScreen />);
      await settlePromises();

      expect(view.getByText(`${status} 약속`)).toBeTruthy();
      expect(view.queryByRole('button', { name: `${status} 약속 열기` })).toBeNull();
    },
  );
});
