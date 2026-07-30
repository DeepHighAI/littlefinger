import {
  ENDPOINT,
  type Endpoint,
  type PromiseDraftResponse,
  type PromiseDraftUpdateResponse,
  type PromiseInviteResponse,
} from '@littlefinger/shared';

import type { MobileApiOptions } from './mobile-api.ts';
import type { PromiseDraftFields } from './promise-draft.ts';

type PromiseSubmitResponse =
  | PromiseDraftResponse
  | PromiseDraftUpdateResponse
  | PromiseInviteResponse;

export interface PromiseEditorApiDeps {
  call<T>(endpoint: Endpoint, body: unknown, options: MobileApiOptions): Promise<T>;
}

export async function submitPromiseDraft(
  draft: PromiseDraftFields,
  promiseId: string | null,
  send: boolean,
  deps: PromiseEditorApiDeps,
): Promise<PromiseSubmitResponse> {
  if (promiseId === null) {
    return await deps.call(ENDPOINT.promiseCreate, { ...draft, send }, { idempotent: true });
  }

  return await deps.call(
    ENDPOINT.promiseDraftUpdate,
    { ...draft, promise_id: promiseId, send },
    { idempotent: true },
  );
}
