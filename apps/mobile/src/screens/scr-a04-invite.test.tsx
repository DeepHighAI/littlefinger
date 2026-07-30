import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { MobileApiError } from '../lib/mobile-api.ts';

import InviteScreen from '../app/invite';
import {
  loadStoredInvite,
  reissueInvite,
  revokeInvite,
  shareInvite,
} from '../lib/invite-native.ts';
import type { InviteWithToken } from '../lib/invite-flow.ts';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));
jest.mock(
  '../lib/invite-native.ts',
  () => ({
    loadStoredInvite: jest.fn(),
    reissueInvite: jest.fn(),
    revokeInvite: jest.fn(),
    shareInvite: jest.fn(),
  }),
  { virtual: true },
);

const NOW = new Date('2026-07-30T01:00:00.000Z');
const invite: InviteWithToken = {
  promise_id: 'promise-1',
  status: 'PENDING',
  invitation_id: 'invite-1',
  expires_at: '2026-08-02T01:00:00.000Z',
  resend_count: 0,
  title: '주 3회 달리기',
  token: 'raw-token',
};

const push = jest.fn();
const loadStoredInviteMock = jest.mocked(loadStoredInvite);
const reissueInviteMock = jest.mocked(reissueInvite);
const revokeInviteMock = jest.mocked(revokeInvite);
const shareInviteMock = jest.mocked(shareInvite);

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('SCR-A04 초대 전송·대기', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    push.mockReset();
    jest.mocked(useRouter).mockReturnValue({ push } as never);
    jest.mocked(useLocalSearchParams).mockReturnValue({ promise_id: 'promise-1' });
    loadStoredInviteMock.mockReset();
    loadStoredInviteMock.mockResolvedValue(invite);
    reissueInviteMock.mockReset();
    reissueInviteMock.mockResolvedValue({
      ...invite,
      invitation_id: 'invite-2',
      resend_count: 1,
      token: 'new-token',
    });
    revokeInviteMock.mockReset();
    revokeInviteMock.mockResolvedValue(undefined);
    shareInviteMock.mockReset();
    shareInviteMock.mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('가상 이름 대신 상대방 문구와 제목·72시간 카운트다운을 보여주고 광고를 두지 않는다', async () => {
    const view = await render(<InviteScreen />);
    await settle();

    expect(loadStoredInviteMock).toHaveBeenCalledWith('promise-1');
    expect(view.getByText('상대방에게 손가락을 내밀어 볼까요?')).toBeTruthy();
    expect(view.getByText('약속: 주 3회 달리기')).toBeTruthy();
    expect(view.getByText('72:00:00')).toBeTruthy();
    expect(view.queryByText(/민준/u)).toBeNull();
    expect(view.queryByText(/약속 취소/u)).toBeNull();
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
  });

  test('같은 토큰 재공유는 공유 시트만 다시 열고 서버를 호출하지 않는다', async () => {
    const view = await render(<InviteScreen />);
    await settle();

    await fireEvent.press(
      view.getByRole('button', { name: '카카오톡으로 초대 보내기' }),
    );
    expect(shareInviteMock).toHaveBeenCalledWith(invite);
    expect(view.getByRole('button', { name: '링크 다시 공유' })).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: '링크 다시 공유' }));
    expect(shareInviteMock).toHaveBeenCalledTimes(2);
    expect(reissueInviteMock).not.toHaveBeenCalled();
  });

  test('만료되면 만료 문구와 재발급 CTA를 보여주고 새 토큰을 발급해 공유한다', async () => {
    loadStoredInviteMock.mockResolvedValue({
      ...invite,
      expires_at: '2026-07-30T00:59:59.000Z',
    });
    const view = await render(<InviteScreen />);
    await settle();

    expect(view.getByText('초대가 만료됐어요')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '초대 다시 보내기' }));
    await settle();

    expect(reissueInviteMock).toHaveBeenCalledWith('promise-1');
    expect(shareInviteMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'new-token' }),
    );
  });

  test('링크 무효화는 두 번 확인한 뒤 초대만 폐기하고 재발급 상태로 바꾼다', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const view = await render(<InviteScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '초대 링크 무효화' }));
    expect(alert).toHaveBeenCalledTimes(1);
    alert.mock.calls[0]?.[2]?.find((button) => button.text === '계속')?.onPress?.();
    expect(alert).toHaveBeenCalledTimes(2);
    expect(revokeInviteMock).not.toHaveBeenCalled();

    await act(async () => {
      await alert.mock.calls[1]?.[2]
        ?.find((button) => button.text === '초대 링크 무효화')
        ?.onPress?.();
    });

    expect(revokeInviteMock).toHaveBeenCalledWith('promise-1');
    expect(view.getByText('초대 링크를 무효화했어요')).toBeTruthy();
    expect(view.getByRole('button', { name: '초대 다시 보내기' })).toBeTruthy();
  });

  test('재발송 10회에 도달하면 추가 발급을 막고 명세 문구를 보여준다', async () => {
    loadStoredInviteMock.mockResolvedValue({
      ...invite,
      expires_at: '2026-07-30T00:59:59.000Z',
      resend_count: 10,
    });
    const view = await render(<InviteScreen />);
    await settle();

    expect(
      view.getByText('초대는 약속당 10번까지 보낼 수 있습니다.'),
    ).toBeTruthy();
    expect(
      view.getByRole('button', { name: '초대 다시 보내기' }).props
        .accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  test('암호화 토큰을 복원할 수 없으면 기존 링크를 추측하지 않고 재발급만 제안한다', async () => {
    loadStoredInviteMock.mockResolvedValue(null);
    const view = await render(<InviteScreen />);
    await settle();

    expect(view.getByText('저장된 초대 링크를 불러올 수 없어요')).toBeTruthy();
    expect(view.queryByRole('button', { name: '링크 다시 공유' })).toBeNull();
    expect(view.getByRole('button', { name: '초대 다시 보내기' })).toBeTruthy();
  });

  test('저장소 유실 뒤 서버가 10회 한도를 알리면 전용 문구로 재발급을 잠근다', async () => {
    loadStoredInviteMock.mockResolvedValue(null);
    reissueInviteMock.mockRejectedValue(
      new MobileApiError('E_RATE_LIMIT', '잠시 후 다시 시도해 주세요.'),
    );
    const view = await render(<InviteScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '초대 다시 보내기' }));
    await settle();

    expect(
      view.getByText('초대는 약속당 10번까지 보낼 수 있습니다.'),
    ).toBeTruthy();
    expect(
      view.getByRole('button', { name: '초대 다시 보내기' }).props
        .accessibilityState,
    ).toMatchObject({ disabled: true });
  });
});
