import {
  ENDPOINT,
  asWitnessInviteListResponse,
  asWitnessInviteResponse,
  type Endpoint,
  type WitnessInviteListResponse,
  type WitnessInviteResponse,
} from '@littlefinger/shared';

import type { MobileApiOptions } from './mobile-api.ts';

export interface WitnessApiDeps {
  call<T>(endpoint: Endpoint, body: unknown, options: MobileApiOptions): Promise<T>;
}

export async function listWitnessesWith(
  promiseId: string,
  deps: WitnessApiDeps,
): Promise<WitnessInviteListResponse> {
  const raw = await deps.call<unknown>(ENDPOINT.witnessInviteList, { promise_id: promiseId }, {
    idempotent: false,
  });
  const parsed = asWitnessInviteListResponse(raw);
  if (parsed === null) throw new Error('INVALID_WITNESS_LIST_RESPONSE');
  return parsed;
}

export async function issueWitnessInviteWith(
  promiseId: string,
  participantId: string | null,
  deps: WitnessApiDeps,
): Promise<WitnessInviteResponse> {
  const raw = await deps.call<unknown>(
    ENDPOINT.witnessInvite,
    {
      promise_id: promiseId,
      ...(participantId === null ? {} : { participant_id: participantId }),
    },
    { idempotent: true },
  );
  const parsed = asWitnessInviteResponse(raw);
  if (parsed === null) throw new Error('INVALID_WITNESS_ISSUE_RESPONSE');
  return parsed;
}
