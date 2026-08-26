import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import HistoryScreen from '../app/history';
import { listHomePromises } from '../lib/home-promises-native.ts';

const mockFocusEffects = new Set<() => undefined | (() => void)>();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useFocusEffect: (effect: () => undefined | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => {
      mockFocusEffects.add(effect);
      const cleanupEffect = effect();
      return () => {
        mockFocusEffects.delete(effect);
        if (typeof cleanupEffect === 'function') cleanupEffect();
      };
    }, [effect]);
  },
}));
jest.mock('../lib/home-promises-native.ts', () => ({ listHomePromises: jest.fn() }));

const DONE_ID = '11111111-1111-4111-8111-111111111111';
const UNSETTLED_ID = '22222222-2222-4222-8222-222222222222';
const push = jest.fn();
const back = jest.fn();

function card(input: { id: string; title: string; status: string }) {
  return {
    promise_id: input.id,
    title: input.title,
    status: input.status,
    end_date: '2026-08-10',
    updated_at: '2026-08-16T00:00:00Z',
    closed_at: '2026-08-15T00:00:00Z',
    my_role: 'CREATOR',
    creator: { nickname: '지우', profile_image_url: null },
    partner: { nickname: '민준', profile_image_url: null },
    has_witness: false,
    needs_response: false,
  } as never;
}

function response(input: { items?: unknown[]; counts?: Record<string, number> } = {}) {
  return {
    items: input.items ?? [],
    pinned: [],
    counts: input.counts ?? { DONE: 1, BROKEN: 0, UNSETTLED: 1, DECLINED: 0 },
    next_cursor: null,
  } as never;
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

describe('SCR-A09 지난 약속 히스토리', () => {
  beforeEach(() => {
    push.mockReset();
    back.mockReset();
    jest.mocked(useRouter).mockReturnValue({ push, back } as never);
    jest.mocked(listHomePromises).mockReset().mockResolvedValue(response());
  });

  afterEach(async () => {
    await cleanup();
    mockFocusEffects.clear();
  });

  test('완료 탭으로 시작하고 네 분류 탭을 카운트와 함께 보여준다 (ADR 0011)', async () => {
    jest.mocked(listHomePromises).mockResolvedValue(
      response({ items: [card({ id: DONE_ID, title: '끝난 약속', status: 'COMPLETED' })] }),
    );
    const view = await render(<HistoryScreen />);
    await settle();

    expect(listHomePromises).toHaveBeenCalledWith({ tab: 'DONE' });
    expect(view.getByRole('tab', { name: '완료 1' })).toBeTruthy();
    expect(view.getByRole('tab', { name: '불이행 0' })).toBeTruthy();
    // P1: 의견 불일치는 '불이행'이 아니라 중립 '협의 중단' 탭이다.
    expect(view.getByRole('tab', { name: '협의 중단 1' })).toBeTruthy();
    expect(view.getByRole('tab', { name: '거절·파기 0' })).toBeTruthy();
    expect(view.getByText('끝난 약속')).toBeTruthy();
    // 광고 슬롯은 없다 — F-12 허용 지면은 A02·A07·A08 뿐이다.
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
  });

  test('탭 전환은 해당 분류만 읽고 행은 상세로 이동한다', async () => {
    jest.mocked(listHomePromises).mockImplementation(async (input: { tab: string }) =>
      input.tab === 'UNSETTLED'
        ? response({ items: [card({ id: UNSETTLED_ID, title: '의견이 갈린 약속', status: 'DISPUTED' })] })
        : response(),
    );
    const view = await render(<HistoryScreen />);
    await settle();

    await fireEvent.press(view.getByRole('tab', { name: '협의 중단 1' }));
    await settle();

    expect(listHomePromises).toHaveBeenCalledWith({ tab: 'UNSETTLED' });
    expect(view.getByText('의견이 갈린 약속')).toBeTruthy();
    expect(view.getByText('의견 불일치')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: '의견이 갈린 약속 열기' }));
    expect(push).toHaveBeenCalledWith({
      pathname: '/promise/[promise_id]',
      params: { promise_id: UNSETTLED_ID },
    });
  });

  test('빈 분류는 전용 빈 상태 문구를 보여준다', async () => {
    const view = await render(<HistoryScreen />);
    await settle();

    expect(view.getByText('이 분류의 지난 약속이 없어요')).toBeTruthy();
  });
});
