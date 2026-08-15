import type { PromiseDetailResponse } from '@littlefinger/shared';

import { getPromiseDetail as getPromiseDetailWith } from './promise-detail-api.ts';
import { callMobileFunctionNative } from './mobile-api-native.ts';

const deps = { call: callMobileFunctionNative };

export async function getPromiseDetail(promiseId: string): Promise<PromiseDetailResponse> {
  return await getPromiseDetailWith(promiseId, deps);
}
