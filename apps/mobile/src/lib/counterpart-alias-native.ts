import type { CounterpartAliasResponse } from '@littlefinger/shared';
import * as Crypto from 'expo-crypto';

import { fetchCounterpartAlias, updateCounterpartAlias } from './counterpart-alias-api.ts';
import { callMobileFunctionNative } from './mobile-api-native.ts';

const deps = { call: callMobileFunctionNative };

export async function loadCounterpartAliasNative(promiseId: string): Promise<CounterpartAliasResponse> {
  return await fetchCounterpartAlias(promiseId, deps);
}

export async function updateCounterpartAliasNative(
  promiseId: string,
  alias: string | null,
  idempotencyKey: string,
): Promise<CounterpartAliasResponse> {
  return await updateCounterpartAlias(promiseId, alias, idempotencyKey, deps);
}

export function createCounterpartAliasKey(): string {
  return Crypto.randomUUID();
}
