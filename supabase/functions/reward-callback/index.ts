import { createDeps, requireEnv } from '../_shared/runtime.ts';
import { createRewardCallbackHandler } from './handler.ts';
import { createVerifierKeyCache, fetchVerifierKeysJson } from './keys.ts';

const configuredAdUnits = [
  requireEnv('ADMOB_REWARDED_WITNESS_UNIT_ID'),
  requireEnv('ADMOB_REWARDED_DURATION_UNIT_ID'),
  requireEnv('ADMOB_REWARDED_RETENTION_UNIT_ID'),
];
const allowedAdUnits = new Set(configuredAdUnits.flatMap((unitId) => {
  const separator = unitId.lastIndexOf('/');
  return separator < 0 ? [unitId] : [unitId, unitId.slice(separator + 1)];
}));

// 캐시는 격리 인스턴스 수명 동안 산다 — 요청마다 만들면 24시간 캐시도 60초 간격도 없는 셈이다.
const verifierKeys = createVerifierKeyCache({ fetchJson: fetchVerifierKeysJson, now: Date.now });

Deno.serve(createRewardCallbackHandler({ ...createDeps(), allowedAdUnits, verifierKeys }));
