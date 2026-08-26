import { createContext, useContext } from 'react';

export interface MobileAuthGateValue {
  callbackFailed: boolean;
  sessionExpired?: boolean;
  onOnboardingCompleted?: () => void;
}

export const MobileAuthGateContext = createContext<MobileAuthGateValue>({
  callbackFailed: false,
  sessionExpired: false,
});

export function useMobileAuthGate(): MobileAuthGateValue {
  return useContext(MobileAuthGateContext);
}
