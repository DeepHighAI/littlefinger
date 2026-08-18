import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import ProfileNicknameScreen from '../app/profile-nickname';
import { updateProfileNicknameNative } from '../lib/account-safety-native.ts';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../lib/account-safety-native.ts', () => ({ updateProfileNicknameNative: jest.fn() }));

const back = jest.fn();
const updateMock = jest.mocked(updateProfileNicknameNative);

beforeEach(() => {
  back.mockReset();
  updateMock.mockReset();
});

afterEach(async () => {
  await cleanup();
});

test('EC-A04 닉네임은 NFC 정규화·40자 제한 뒤 저장하고 돌아간다', async () => {
  jest.mocked(useRouter).mockReturnValue({ back } as never);
  updateMock.mockResolvedValue({ nickname: '가속' });
  const view = await render(<ProfileNicknameScreen />);

  await fireEvent.changeText(view.getByLabelText('닉네임'), '  가속  ');
  await fireEvent.press(view.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(updateMock).toHaveBeenCalledWith('가속'));
  expect(back).toHaveBeenCalledTimes(1);
});

test('빈 값은 서버 호출 전에 안내한다', async () => {
  jest.mocked(useRouter).mockReturnValue({ back } as never);
  const view = await render(<ProfileNicknameScreen />);
  await fireEvent.press(view.getByRole('button', { name: '저장' }));
  expect(view.getByText('닉네임을 입력해 주세요.')).toBeTruthy();
  expect(updateMock).not.toHaveBeenCalled();
});
