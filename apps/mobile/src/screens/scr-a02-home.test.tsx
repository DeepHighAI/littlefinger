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

const deleteDraftMock = jest.mocked(deleteDraft);
const listWaitingPromisesMock = jest.mocked(listWaitingPromises);
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
});
