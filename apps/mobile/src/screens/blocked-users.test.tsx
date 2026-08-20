import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import BlockedUsersScreen from '../app/blocked-users';
import {
  listBlockedUsersNative,
  unblockUserNative,
} from '../lib/account-safety-native.ts';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../lib/account-safety-native.ts', () => ({
  listBlockedUsersNative: jest.fn(),
  unblockUserNative: jest.fn(),
}));

const back = jest.fn();
const listMock = jest.mocked(listBlockedUsersNative);
const unblockMock = jest.mocked(unblockUserNative);

const TARGET_A = '11111111-1111-4111-8111-111111111111';
const TARGET_B = '22222222-2222-4222-8222-222222222222';

const ITEMS = [
  {
    target_user_id: TARGET_A,
    nickname: '민준',
    profile_image_url: null,
    blocked_at: '2026-08-19T00:00:00Z',
  },
  {
    target_user_id: TARGET_B,
    nickname: '탈퇴한 사용자',
    profile_image_url: null,
    blocked_at: '2026-08-20T00:00:00Z',
  },
] as const;

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('차단 목록 관리 (F3)', () => {
  beforeEach(() => {
    back.mockReset();
    jest.mocked(useRouter).mockReturnValue({ back } as never);
    listMock.mockReset().mockResolvedValue({ items: ITEMS });
    unblockMock.mockReset();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  test('차단한 사용자를 닉네임과 함께 나열한다', async () => {
    const view = await render(<BlockedUsersScreen />);
    await settle();

    expect(view.getByText('민준')).toBeTruthy();
    expect(view.getByText('탈퇴한 사용자')).toBeTruthy();
    expect(view.getAllByText('차단 해제')).toHaveLength(2);
  });

  test('해제는 확인을 거친 뒤 서버 요청하고 목록에서 지운다', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    unblockMock.mockResolvedValue({ target_user_id: TARGET_A, blocked: false });
    const view = await render(<BlockedUsersScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '민준 차단 해제' }));
    expect(alert.mock.calls[0]?.[1]).toContain('민준님이 다시 초대를 보낼 수 있게 돼요');
    expect(unblockMock).not.toHaveBeenCalled();

    await act(async () => alert.mock.calls[0]?.[2]?.find((button) => button.text === '해제')?.onPress?.());
    await settle();

    expect(unblockMock).toHaveBeenCalledWith(TARGET_A);
    expect(view.queryByText('민준')).toBeNull();
    expect(view.getByText('탈퇴한 사용자')).toBeTruthy();
  });

  test('해제 실패는 목록을 유지하고 오류 문구를 보여준다', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    unblockMock.mockRejectedValue(new Error('offline'));
    const view = await render(<BlockedUsersScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '민준 차단 해제' }));
    await act(async () => alert.mock.calls[0]?.[2]?.find((button) => button.text === '해제')?.onPress?.());
    await settle();

    expect(view.getByText('민준')).toBeTruthy();
    expect(view.getByText('차단을 해제하지 못했어요. 다시 시도해 주세요.')).toBeTruthy();
  });

  test('빈 목록과 재시도 가능한 조회 실패를 표시한다', async () => {
    listMock.mockResolvedValueOnce({ items: [] });
    const empty = await render(<BlockedUsersScreen />);
    await settle();
    expect(empty.getByText('차단한 사용자가 없어요')).toBeTruthy();
    await cleanup();

    listMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ items: ITEMS });
    const failed = await render(<BlockedUsersScreen />);
    await settle();
    expect(failed.getByText('차단 목록을 불러오지 못했어요. 다시 시도해 주세요.')).toBeTruthy();

    await fireEvent.press(failed.getByRole('button', { name: '다시 시도' }));
    await settle();
    expect(failed.getByText('민준')).toBeTruthy();
  });
});
