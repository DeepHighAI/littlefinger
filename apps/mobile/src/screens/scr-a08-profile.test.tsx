import { LEGAL_DISCLAIMER, type ReminderPreferences, type TrustProfileDetailResponse } from '@littlefinger/shared';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import ProfileScreen from '../app/profile';
import { withdrawAccountNative } from '../lib/account-safety-native.ts';
import { openLegalDocument } from '../lib/legal-native.ts';
import { currentMobileUserId } from '../lib/mobile-api-native.ts';
import {
  loadTrustProfile,
  logoutCurrentDeviceNative,
  updateTrustProfileSettings,
} from '../lib/trust-profile-native.ts';
import {
  createInitialProfileState,
  profileReducer,
} from './scr-a08-profile-state.ts';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../lib/legal-native.ts', () => ({ openLegalDocument: jest.fn() }));
jest.mock('../lib/mobile-api-native.ts', () => ({ currentMobileUserId: jest.fn() }));
jest.mock('../lib/account-safety-native.ts', () => ({ withdrawAccountNative: jest.fn() }));
jest.mock('../lib/trust-profile-native.ts', () => ({
  loadTrustProfile: jest.fn(),
  logoutCurrentDeviceNative: jest.fn(),
  updateTrustProfileSettings: jest.fn(),
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const REMINDERS: ReminderPreferences = {
  remind_d7: true,
  remind_d3: true,
  remind_d1: false,
  remind_dday: true,
  remind_hour: '12',
};
const PROFILE: TrustProfileDetailResponse = {
  nickname: '지우',
  profile_image_url: null,
  keep_rate: 75,
  completed_count: 3,
  broken_count: 1,
  disputed_count: 2,
  unresolved_count: 4,
  active_count: 5,
  updated_at: '2026-08-17T00:00:00Z',
  reminders: REMINDERS,
};

const loadMock = jest.mocked(loadTrustProfile);
const updateMock = jest.mocked(updateTrustProfileSettings);
const logoutMock = jest.mocked(logoutCurrentDeviceNative);
const userIdMock = jest.mocked(currentMobileUserId);
const openLegalMock = jest.mocked(openLegalDocument);
const withdrawMock = jest.mocked(withdrawAccountNative);
const back = jest.fn();
const push = jest.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

describe('SCR-A08 fenced profile state', () => {
  test('matching update 실패만 optimistic 설정을 서버 확정값으로 되돌린다', () => {
    const loading = profileReducer(createInitialProfileState(), { type: 'LOAD_STARTED', loadId: 1 });
    const loaded = profileReducer(loading, { type: 'LOAD_SUCCEEDED', loadId: 1, profile: PROFILE });
    const next = { ...REMINDERS, remind_d7: false };
    const updated = profileReducer(loaded, { type: 'UPDATE_STARTED', updateId: 4, reminders: next });

    expect(updated.displayedReminders).toEqual(next);
    expect(profileReducer(updated, { type: 'UPDATE_FAILED', updateId: 3 })).toEqual(updated);
    expect(profileReducer(updated, { type: 'UPDATE_FAILED', updateId: 4 }).displayedReminders)
      .toEqual(loaded.confirmedReminders);
  });

  test('늦은 load와 update 응답은 최신 화면을 덮지 않는다', () => {
    const started = profileReducer(createInitialProfileState(), { type: 'LOAD_STARTED', loadId: 2 });
    const loaded = profileReducer(started, { type: 'LOAD_SUCCEEDED', loadId: 2, profile: PROFILE });
    const next = { ...REMINDERS, remind_d3: false };
    const updated = profileReducer(loaded, { type: 'UPDATE_STARTED', updateId: 8, reminders: next });

    expect(profileReducer(updated, { type: 'LOAD_SUCCEEDED', loadId: 1, profile: { ...PROFILE, nickname: '과거' } })).toEqual(updated);
    expect(profileReducer(updated, {
      type: 'UPDATE_SUCCEEDED',
      updateId: 7,
      response: { reminders: REMINDERS, updated_at: PROFILE.updated_at },
    })).toEqual(updated);
  });
});

describe('SCR-A08 마이·신뢰 프로필', () => {
  beforeEach(() => {
    back.mockReset();
    push.mockReset();
    jest.mocked(useRouter).mockReturnValue({ back, push } as never);
    loadMock.mockReset();
    updateMock.mockReset();
    logoutMock.mockReset().mockResolvedValue(undefined);
    userIdMock.mockReset().mockResolvedValue(USER_ID);
    openLegalMock.mockReset().mockResolvedValue(undefined);
    withdrawMock.mockReset().mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  test('로딩과 재시도 가능한 조회 실패를 표시한다', async () => {
    const pending = deferred<TrustProfileDetailResponse>();
    loadMock.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(PROFILE);
    const view = await render(<ProfileScreen />);
    expect(view.getByText('프로필을 불러오는 중이에요')).toBeTruthy();

    await act(async () => pending.reject(new Error('offline')));
    expect(view.getByText('프로필을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '프로필 다시 시도' }));
    await settle();
    expect(view.getByText('지우')).toBeTruthy();
    expect(loadMock).toHaveBeenCalledTimes(2);
  });

  test('닉네임·아바타·지킴율과 다섯 상태 건수를 텍스트로 표시한다', async () => {
    loadMock.mockResolvedValue(PROFILE);
    const view = await render(<ProfileScreen />);
    await settle();

    expect(view.getByText('지우')).toBeTruthy();
    expect(view.getByLabelText('지우 프로필 사진')).toBeTruthy();
    expect(view.getByText('75%')).toBeTruthy();
    expect(view.getByLabelText('약속 지킴율 75퍼센트')).toBeTruthy();
    for (const text of ['완료 3건 · 불이행 1건', '의견 불일치 2건 · 미확정 종결 4건', '진행 중 5건']) {
      expect(view.getByText(text)).toBeTruthy();
    }
  });

  test('표본이 부족하면 퍼센트 대신 집계 중을 표시한다', async () => {
    loadMock.mockResolvedValue({ ...PROFILE, keep_rate: null });
    const view = await render(<ProfileScreen />);
    await settle();
    expect(view.getByText('집계 중')).toBeTruthy();
    expect(view.queryByText('0%')).toBeNull();
  });

  test('네 리마인드 switch는 독립적이며 저장 중 모든 설정 control을 비활성화한다', async () => {
    loadMock.mockResolvedValue(PROFILE);
    const pending = deferred<{ reminders: ReminderPreferences; updated_at: string }>();
    updateMock.mockReturnValue(pending.promise as never);
    const view = await render(<ProfileScreen />);
    await settle();

    const switches = ['D-7 리마인드', 'D-3 리마인드', 'D-1 리마인드', 'D-Day 리마인드']
      .map((name) => view.getByRole('switch', { name }));
    expect(switches.map((item) => item.props.accessibilityState.checked)).toEqual([true, true, false, true]);
    await fireEvent.press(switches[0]!);
    expect(updateMock).toHaveBeenCalledWith({ ...REMINDERS, remind_d7: false });
    for (const item of switches) expect(item.props.accessibilityState.disabled).toBe(true);
    expect(view.getByRole('button', { name: '리마인드 발송 시각 12:00' }).props.accessibilityState.disabled).toBe(true);
  });

  test('발송 시각 picker는 정확히 세 KST 선택지를 저장한다', async () => {
    loadMock.mockResolvedValue(PROFILE);
    updateMock.mockResolvedValue({ reminders: { ...REMINDERS, remind_hour: '20' }, updated_at: PROFILE.updated_at });
    const alert = jest.spyOn(Alert, 'alert');
    const view = await render(<ProfileScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '리마인드 발송 시각 12:00' }));
    expect(alert.mock.calls[0]?.[2]?.map((button) => button.text)).toEqual(['09:00', '12:00', '20:00', '취소']);
    await act(async () => alert.mock.calls[0]?.[2]?.find((button) => button.text === '20:00')?.onPress?.());
    expect(updateMock).toHaveBeenCalledWith({ ...REMINDERS, remind_hour: '20' });
  });

  test('설정 저장 실패는 확정값으로 되돌리고 재시도 안내를 표시한다', async () => {
    loadMock.mockResolvedValue(PROFILE);
    updateMock.mockRejectedValue(new Error('offline'));
    const view = await render(<ProfileScreen />);
    await settle();

    await fireEvent.press(view.getByRole('switch', { name: 'D-7 리마인드' }));
    await settle();
    expect(view.getByRole('switch', { name: 'D-7 리마인드' }).props.accessibilityState.checked).toBe(true);
    expect(view.getByText('설정을 저장하지 못했어요. 다시 시도해 주세요.')).toBeTruthy();
  });

  test('약관·개인정보 링크와 고정 디스클레이머를 표시하고 광고는 렌더하지 않는다', async () => {
    loadMock.mockResolvedValue(PROFILE);
    const view = await render(<ProfileScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '이용약관 열기' }));
    await fireEvent.press(view.getByRole('button', { name: '개인정보 처리방침 열기' }));
    expect(openLegalMock).toHaveBeenNthCalledWith(1, 'TERMS');
    expect(openLegalMock).toHaveBeenNthCalledWith(2, 'PRIVACY');
    expect(view.getByText(LEGAL_DISCLAIMER)).toBeTruthy();
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
    expect(view.queryByTestId('profile-ad-space')).toBeNull();
  });

  test('로그아웃 확인 뒤 현재 기기를 해제하고 실패하면 세션을 유지한 채 안내한다', async () => {
    loadMock.mockResolvedValue(PROFILE);
    logoutMock.mockRejectedValueOnce(new Error('cannot sign out'));
    const alert = jest.spyOn(Alert, 'alert');
    const view = await render(<ProfileScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '로그아웃' }));
    expect(alert).toHaveBeenCalledWith('로그아웃할까요?', '이 기기의 알림 토큰을 해제한 뒤 로그아웃해요.', expect.any(Array));
    await act(async () => alert.mock.calls[0]?.[2]?.find((button) => button.text === '로그아웃')?.onPress?.());
    await settle();
    expect(userIdMock).toHaveBeenCalledTimes(1);
    expect(logoutMock).toHaveBeenCalledWith(USER_ID);
    expect(view.getByText('로그아웃하지 못했어요. 다시 시도해 주세요.')).toBeTruthy();
  });

  test('로그아웃 성공은 직접 라우팅하지 않고 세션 게이트 전환에 맡긴다', async () => {
    loadMock.mockResolvedValue(PROFILE);
    const alert = jest.spyOn(Alert, 'alert');
    const view = await render(<ProfileScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '로그아웃' }));
    await act(async () => alert.mock.calls[0]?.[2]?.find((button) => button.text === '로그아웃')?.onPress?.());
    await settle();
    expect(logoutMock).toHaveBeenCalledWith(USER_ID);
    expect(back).not.toHaveBeenCalled();
    expect(view.queryByText('로그아웃하지 못했어요. 다시 시도해 주세요.')).toBeNull();
  });

  test('EC-A04 임시 닉네임은 직접 설정 화면으로 갈 수 있다', async () => {
    loadMock.mockResolvedValue({ ...PROFILE, nickname: '사용자1234' });
    const view = await render(<ProfileScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '닉네임 설정' }));
    expect(push).toHaveBeenCalledWith('/profile-nickname');
  });

  test('차단 목록 관리 행은 차단 목록 화면으로 간다(F3)', async () => {
    loadMock.mockResolvedValue(PROFILE);
    const view = await render(<ProfileScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '차단 목록 관리' }));
    expect(push).toHaveBeenCalledWith('/blocked-users');
  });

  test('탈퇴는 진행 중 기록 경고와 최종 확인을 거친 뒤 서버 요청한다', async () => {
    loadMock.mockResolvedValue(PROFILE);
    const alert = jest.spyOn(Alert, 'alert');
    const view = await render(<ProfileScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '탈퇴' }));
    expect(alert.mock.calls[0]?.[1]).toContain('진행 중인 약속 5건');
    await act(async () => alert.mock.calls[0]?.[2]?.find((button) => button.text === '계속')?.onPress?.());
    expect(alert.mock.calls[1]?.[1]).toContain('개인정보는 비식별 처리됩니다');
    await act(async () => alert.mock.calls[1]?.[2]?.find((button) => button.text === '탈퇴')?.onPress?.());
    await settle();
    expect(withdrawMock).toHaveBeenCalledTimes(1);
  });

  test('탈퇴 요청 실패는 세션을 유지하고 재시도 안내를 표시한다', async () => {
    loadMock.mockResolvedValue(PROFILE);
    withdrawMock.mockRejectedValue(new Error('offline'));
    const alert = jest.spyOn(Alert, 'alert');
    const view = await render(<ProfileScreen />);
    await settle();

    await fireEvent.press(view.getByRole('button', { name: '탈퇴' }));
    await act(async () => alert.mock.calls[0]?.[2]?.find((button) => button.text === '계속')?.onPress?.());
    await act(async () => alert.mock.calls[1]?.[2]?.find((button) => button.text === '탈퇴')?.onPress?.());
    await settle();
    expect(view.getByText('탈퇴하지 못했어요. 다시 시도해 주세요.')).toBeTruthy();
  });

  test('뒤로·법적 문서·설정·로그아웃 control은 모두 48dp 이상이다', async () => {
    loadMock.mockResolvedValue(PROFILE);
    const view = await render(<ProfileScreen />);
    await settle();

    const controls = [
      view.getByRole('button', { name: '뒤로' }),
      view.getByRole('button', { name: '리마인드 발송 시각 12:00' }),
      view.getByRole('button', { name: '이용약관 열기' }),
      view.getByRole('button', { name: '개인정보 처리방침 열기' }),
      view.getByRole('button', { name: '로그아웃' }),
      ...view.getAllByRole('switch'),
    ];
    for (const control of controls) expect(control).toHaveStyle({ minHeight: 48 });
  });
});
