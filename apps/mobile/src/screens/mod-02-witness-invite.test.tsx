import { act, fireEvent, render } from '@testing-library/react-native';

import { WitnessInviteSheet } from '../components/witness-invite-sheet.tsx';
import {
  issueWitnessInvite,
  listWitnesses,
  shareWitnessInvite,
} from '../lib/witness-native.ts';

jest.mock('../lib/witness-native.ts', () => ({
  issueWitnessInvite: jest.fn(),
  listWitnesses: jest.fn(),
  shareWitnessInvite: jest.fn(),
}));

const PROMISE_ID = '11111111-1111-4111-8111-111111111111';
const INVITED_ID = '22222222-2222-4222-8222-222222222222';
const JOINED_ID = '33333333-3333-4333-8333-333333333333';
const invite = {
  promise_id: PROMISE_ID,
  participant_id: INVITED_ID,
  invitation_id: '44444444-4444-4444-8444-444444444444',
  title: '매일 걷기',
  expires_at: '2026-08-20T00:00:00Z',
  token: 'A'.repeat(43),
} as const;

const listMock = jest.mocked(listWitnesses);
const issueMock = jest.mocked(issueWitnessInvite);
const shareMock = jest.mocked(shareWitnessInvite);
const close = jest.fn();

function list(witnesses: ReadonlyArray<Record<string, unknown>>) {
  return {
    promise_id: PROMISE_ID,
    occupied_count: witnesses.length,
    capacity: 2 as const,
    witnesses,
  } as never;
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function hiddenScrimProps(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = hiddenScrimProps(child);
      if (found !== null) return found;
    }
    return null;
  }
  if (typeof node !== 'object' || node === null) return null;
  const value = node as { props?: Record<string, unknown>; children?: unknown };
  if (value.props?.['accessibilityElementsHidden'] === true) return value.props;
  return hiddenScrimProps(value.children);
}

describe('MOD-02 witness invitation sheet', () => {
  beforeEach(() => {
    close.mockReset();
    listMock.mockReset();
    listMock.mockResolvedValue(list([]));
    issueMock.mockReset();
    issueMock.mockResolvedValue(invite);
    shareMock.mockReset();
    shareMock.mockResolvedValue(undefined);
  });

  test('dismiss scrim is absent from the Android accessibility tree', async () => {
    const view = await render(<WitnessInviteSheet visible promiseId={PROMISE_ID} onClose={close} />);
    expect(hiddenScrimProps(view.toJSON())?.['importantForAccessibility']).toBe(
      'no-hide-descendants',
    );
  }, 30_000);

  test('renders loading while the slot request is pending', async () => {
    listMock.mockImplementationOnce(async () => await new Promise((resolve) => {
      void resolve;
    }));
    const view = await render(<WitnessInviteSheet visible promiseId={PROMISE_ID} onClose={close} />);
    expect(view.getByText('증인 목록을 불러오는 중이에요')).toBeTruthy();
    await view.unmount();
  }, 30_000);

  test('loads zero slots, renders two remaining places, and no ad', async () => {
    const view = await render(<WitnessInviteSheet visible promiseId={PROMISE_ID} onClose={close} />);
    await settle();
    expect(listMock).toHaveBeenCalledWith(PROMISE_ID);
    expect(view.getByText('증인 0 / 2')).toBeTruthy();
    expect(view.getByText('두 자리 남았어요')).toBeTruthy();
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
  });

  test('load failure exposes retry and recovers', async () => {
    listMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(list([]));
    const view = await render(<WitnessInviteSheet visible promiseId={PROMISE_ID} onClose={close} />);
    await settle();
    expect(view.getByText('증인 목록을 불러오지 못했어요.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '다시 시도' }));
    await settle();
    expect(view.getByText('증인 0 / 2')).toBeTruthy();
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  test('invited slot is anonymous and can reshare its encrypted token', async () => {
    listMock.mockResolvedValue(list([{
      participant_id: INVITED_ID,
      status: 'INVITED',
      nickname: null,
      profile_image_url: null,
      expires_at: '2026-08-20T00:00:00Z',
      signed_at: null,
    }]));
    const view = await render(<WitnessInviteSheet visible promiseId={PROMISE_ID} onClose={close} />);
    await settle();
    expect(view.getByText('초대받은 증인')).toBeTruthy();
    expect(view.getByText('초대 중')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '초대 링크 다시 공유' }));
    await settle();
    expect(issueMock).toHaveBeenCalledWith(PROMISE_ID, INVITED_ID);
    expect(shareMock).toHaveBeenCalledWith(invite);
  });

  test('joined unsigned and signed slots use account names and equal status emphasis', async () => {
    listMock.mockResolvedValue(list([
      {
        participant_id: JOINED_ID,
        status: 'JOINED',
        nickname: '하영',
        profile_image_url: null,
        expires_at: null,
        signed_at: null,
      },
      {
        participant_id: INVITED_ID,
        status: 'JOINED',
        nickname: '민준',
        profile_image_url: null,
        expires_at: null,
        signed_at: '2026-08-16T09:03:00Z',
      },
    ]));
    const view = await render(<WitnessInviteSheet visible promiseId={PROMISE_ID} onClose={close} />);
    await settle();
    expect(view.getByText('하영')).toBeTruthy();
    expect(view.getByText('확인 대기')).toBeTruthy();
    expect(view.getByText('민준')).toBeTruthy();
    expect(view.getByText('확인 완료')).toBeTruthy();
    expect(view.getByText('2026. 8. 16. 18:03 확인 서명')).toBeTruthy();
  });

  test('new invite shares, refreshes, and the CTA remains at least 48dp', async () => {
    const view = await render(<WitnessInviteSheet visible promiseId={PROMISE_ID} onClose={close} />);
    await settle();
    const button = view.getByTestId('witness-invite-button');
    expect(button).toHaveStyle({ minHeight: 48 });
    await fireEvent.press(button);
    await settle();
    expect(issueMock).toHaveBeenCalledWith(PROMISE_ID, null);
    expect(shareMock).toHaveBeenCalledWith(invite);
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  test('same-frame double press issues only once', async () => {
    let resolveIssue: ((value: typeof invite) => void) | undefined;
    issueMock.mockImplementation(async () => await new Promise((resolve) => { resolveIssue = resolve; }));
    const view = await render(<WitnessInviteSheet visible promiseId={PROMISE_ID} onClose={close} />);
    await settle();
    const button = view.getByTestId('witness-invite-button');
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(issueMock).toHaveBeenCalledTimes(1);
    await act(async () => resolveIssue?.(invite));
    await settle();
  });

  test('two occupied slots disable issue and show the policy copy', async () => {
    listMock.mockResolvedValue(list([
      {
        participant_id: JOINED_ID,
        status: 'JOINED', nickname: '하영', profile_image_url: null, expires_at: null, signed_at: null,
      },
      {
        participant_id: INVITED_ID,
        status: 'INVITED', nickname: null, profile_image_url: null,
        expires_at: '2026-08-20T00:00:00Z', signed_at: null,
      },
    ]));
    const view = await render(<WitnessInviteSheet visible promiseId={PROMISE_ID} onClose={close} />);
    await settle();
    expect(view.getByText('증인은 최대 2명까지예요.')).toBeTruthy();
    expect(
      view.getByRole('button', { name: '카카오톡으로 증인 초대하기' }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  test('share error remains inside the sheet and can retry', async () => {
    shareMock.mockRejectedValueOnce(new Error('share')).mockResolvedValueOnce(undefined);
    const view = await render(<WitnessInviteSheet visible promiseId={PROMISE_ID} onClose={close} />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '카카오톡으로 증인 초대하기' }));
    await settle();
    expect(view.getByText('증인 초대 링크를 공유하지 못했어요.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '카카오톡으로 증인 초대하기' }));
    await settle();
    expect(shareMock).toHaveBeenCalledTimes(2);
    expect(issueMock).toHaveBeenCalledTimes(1);
  });

  test('failed reshare token is never reused for a new witness slot', async () => {
    listMock.mockResolvedValue(list([{
      participant_id: INVITED_ID,
      status: 'INVITED',
      nickname: null,
      profile_image_url: null,
      expires_at: '2026-08-20T00:00:00Z',
      signed_at: null,
    }]));
    shareMock.mockRejectedValueOnce(new Error('share')).mockResolvedValueOnce(undefined);
    const view = await render(<WitnessInviteSheet visible promiseId={PROMISE_ID} onClose={close} />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '초대 링크 다시 공유' }));
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '카카오톡으로 증인 초대하기' }));
    await settle();

    expect(issueMock).toHaveBeenNthCalledWith(1, PROMISE_ID, INVITED_ID);
    expect(issueMock).toHaveBeenNthCalledWith(2, PROMISE_ID, null);
  });

  test('close control returns to the underlying detail', async () => {
    const view = await render(<WitnessInviteSheet visible promiseId={PROMISE_ID} onClose={close} />);
    await settle();
    await fireEvent.press(view.getByRole('button', { name: '증인 초대 닫기' }));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
