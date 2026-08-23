import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import PromisesScreen from '../app/promises';
import { deleteDraft, listHomePromises } from '../lib/home-promises-native.ts';

jest.mock('expo-router', () => ({ useRouter: jest.fn(), useFocusEffect: () => undefined }));
jest.mock('../lib/home-promises-native.ts', () => ({ deleteDraft: jest.fn(), listHomePromises: jest.fn() }));

const ACTIVE_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_ID = '22222222-2222-4222-8222-222222222222';
const push = jest.fn();
const back = jest.fn();

function card(id: string, title: string, status = 'ACTIVE', endDate: string | null = '2026-08-30') {
  return {
    promise_id: id,
    title,
    status,
    end_date: endDate,
    updated_at: '2026-08-16T00:00:00Z',
    closed_at: null,
    my_role: 'CREATOR',
    creator: { nickname: '지우', profile_image_url: null },
    partner: { nickname: '민준', profile_image_url: null },
    has_witness: false,
    needs_response: false,
  } as any;
}

function response(items: any[] = [], counts = { ACTIVE: 0, WAITING: 0, COMPLETED: 0 }) {
  return { items, pinned: [], counts, next_cursor: null };
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

describe('SCR-A02 전체 약속', () => {
  beforeEach(() => {
    push.mockReset();
    back.mockReset();
    jest.mocked(useRouter).mockReturnValue({ push, back } as never);
    jest.mocked(listHomePromises).mockReset().mockResolvedValue(response());
    jest.mocked(deleteDraft).mockReset().mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  test('세 필터와 뒤로가기를 제공하고 하단 내비·광고는 표시하지 않는다', async () => {
    const view = await render(<PromisesScreen />);
    await settle();
    expect(view.getByRole('tab', { name: '진행 중 0' })).toBeTruthy();
    expect(view.getByRole('tab', { name: '대기 0' })).toBeTruthy();
    expect(view.getByRole('tab', { name: '완료 0' })).toBeTruthy();
    expect(view.queryByRole('button', { name: '작성' })).toBeNull();
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: '뒤로' }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  test('필터는 최초 선택할 때만 조회하고 기존 cache를 유지한다', async () => {
    jest.mocked(listHomePromises).mockImplementation(async ({ tab }) => tab === 'ACTIVE'
      ? response([card(ACTIVE_ID, '진행 약속')], { ACTIVE: 1, WAITING: 1, COMPLETED: 0 })
      : response([card(SECOND_ID, '대기 약속', 'PENDING')], { ACTIVE: 1, WAITING: 1, COMPLETED: 0 }));
    const view = await render(<PromisesScreen />);
    await settle();
    await fireEvent.press(view.getByRole('tab', { name: '대기 1' }));
    await settle();
    expect(view.getByText('대기 약속')).toBeTruthy();
    await fireEvent.press(view.getByRole('tab', { name: '진행 중 1' }));
    expect(view.getByText('진행 약속')).toBeTruthy();
    expect(listHomePromises).toHaveBeenCalledTimes(2);
  });

  test('DRAFT는 편집으로, PENDING은 상세로 이동하고 초안 삭제는 두 번 확인한다', async () => {
    jest.mocked(listHomePromises)
      .mockResolvedValueOnce(response([], { ACTIVE: 0, WAITING: 2, COMPLETED: 0 }))
      .mockResolvedValueOnce(response([
        card(ACTIVE_ID, '초안', 'DRAFT', null),
        card(SECOND_ID, '승인 대기', 'PENDING'),
      ], { ACTIVE: 0, WAITING: 2, COMPLETED: 0 }));
    const alert = jest.spyOn(Alert, 'alert');
    const view = await render(<PromisesScreen />);
    await settle();
    await fireEvent.press(view.getByRole('tab', { name: '대기 2' }));
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '초안 열기' }));
    await fireEvent.press(view.getByRole('button', { name: '승인 대기 열기' }));
    expect(push).toHaveBeenNthCalledWith(1, { pathname: '/promise/edit', params: { promise_id: ACTIVE_ID } });
    expect(push).toHaveBeenNthCalledWith(2, { pathname: '/promise/[promise_id]', params: { promise_id: SECOND_ID } });
    await fireEvent.press(view.getByRole('button', { name: '초안 초안 삭제' }));
    alert.mock.calls[0]?.[2]?.find((button) => button.text === '계속')?.onPress?.();
    await act(async () => {
      await alert.mock.calls[1]?.[2]?.find((button) => button.text === '삭제')?.onPress?.();
    });
    expect(deleteDraft).toHaveBeenCalledWith(ACTIVE_ID);
    expect(view.queryByText('초안')).toBeNull();
  });
});
