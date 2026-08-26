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
  // 카테고리 미선택은 '기타'로 저장한다(PO 2026-08-26). 서버 계약(enum NOT NULL·기록 지문)은
  // 그대로 두고 기본값만 여기서 정한다 — 빈 문자열을 보내면 서버가 E_VALIDATION 으로 거절한다.
  const payload = { ...draft, category: draft.category === '' ? 'ETC' : draft.category };

  if (promiseId === null) {
    return await deps.call(ENDPOINT.promiseCreate, { ...payload, send }, { idempotent: true });
  }

  return await deps.call(
    ENDPOINT.promiseDraftUpdate,
    { ...payload, promise_id: promiseId, send },
    { idempotent: true },
  );
}
