import { createContext, useContext } from 'react';

export interface MobileAuthGateValue {
  callbackFailed: boolean;
}

export const MobileAuthGateContext = createContext<MobileAuthGateValue>({
  callbackFailed: false,
});

export function useMobileAuthGate(): MobileAuthGateValue {
  return useContext(MobileAuthGateContext);
}
