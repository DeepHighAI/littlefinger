import { act, fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { completeOnboardingNative } from '../lib/onboarding-native.ts';
import { MobileAuthGateContext } from '../lib/mobile-auth-gate.ts';
import OnboardingScreen from '../app/onboarding';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('../lib/onboarding-native.ts', () => ({ completeOnboardingNative: jest.fn() }));

const completeMock = jest.mocked(completeOnboardingNative);

function OnboardingHarness(): React.JSX.Element {
  const [completed, setCompleted] = useState(false);
  const gateValue = {
    callbackFailed: false,
    onOnboardingCompleted: () => setCompleted(true),
  };

  return (
    <MobileAuthGateContext.Provider value={gateValue}>
      <Text>{completed ? 'login-ready' : 'onboarding-required'}</Text>
      <OnboardingScreen />
    </MobileAuthGateContext.Provider>
  );
}

describe('SCR-A00 온보딩', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    completeMock.mockReset();
    completeMock.mockResolvedValue(undefined);
  });

  test('승인된 첫 페이지의 핵심 루프와 접근성 라벨을 표시한다', async () => {
    const view = await render(<OnboardingScreen />);
    expect(view.getByText('약속하고, 걸고,\n지키는 재미')).toBeTruthy();
    expect(view.getByText('둘이 정한 약속을 기록하고\n잊지 않게 챙겨드려요')).toBeTruthy();
    expect(view.getByText('작성')).toBeTruthy();
    expect(view.getByText('카톡 초대')).toBeTruthy();
    expect(view.getByText('걸고 지키기')).toBeTruthy();
    // 단일 페이지 확정(Q-5 (b)) — 페이지 인디케이터는 더 이상 없다.
    expect(view.queryByRole('image', { name: '1/3 단계' })).toBeNull();
    expect(view.queryByTestId('lf-ad-slot')).toBeNull();
  });

  test.each(['건너뛰기', '시작하기'])('%s는 저장 완료를 루트 게이트에 반영한 뒤 로그인으로 교체한다', async (label) => {
    const view = await render(<OnboardingHarness />);
    await act(async () => fireEvent.press(view.getByRole('button', { name: label })));
    expect(view.getByText('login-ready')).toBeTruthy();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
