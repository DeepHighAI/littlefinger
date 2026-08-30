// promise-draft-update — 02 §4-2-2.4.
//
// DRAFT의 버전 원본·조회 캐시 수정과 선택적인 T-02는 RPC 한 트랜잭션에서 끝난다.
// 껍데기는 JWT, 필드 판정, 멱등 키, 초대 토큰 발급만 맡는다.

import type { ApiValidationField } from '../../../packages/shared/src/api.ts';
import type { ValidationResult } from '../../../packages/shared/src/validation.ts';
import {
  validateBody,
  validateCategory,
  validateEndDate,
  validateKeeper,
  validatePenalty,
  validateReward,
  validateTitle,
} from '../../../packages/shared/src/validation.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { attachToken, issueToken } from '../_shared/invite.ts';
import {
  idempotencyKeyOf,
  jsonBody,
  optionalBoolean,
  optionalString,
  requiredString,
} from '../_shared/request.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertField(result: ValidationResult, field: ApiValidationField): void {
  if (result.valid) return;
  throw new ApiError('E_VALIDATION', {
    field,
    ...(result.message !== null ? { userMessage: result.message } : {}),
  });
}

export function createPromiseDraftUpdateHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();

    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }

      const userId = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const body = await jsonBody(request, 'promise_id');

      const promiseId = requiredString(body, 'promise_id', 'promise_id');
      if (!UUID_PATTERN.test(promiseId)) {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }

      const title = requiredString(body, 'title', 'title');
      const content = requiredString(body, 'body', 'body');
      const category = requiredString(body, 'category', 'category');
      const endDateValue = body['end_date'];
      if (endDateValue !== null && typeof endDateValue !== 'string') {
        throw new ApiError('E_VALIDATION', { field: 'end_date' });
      }
      const endDate = endDateValue as string | null;
      const keeper = optionalString(body, 'keeper', 'keeper');
      const reward = optionalString(body, 'reward', 'reward');
      const penalty = optionalString(body, 'penalty', 'penalty');
      const witnessEnabled = optionalBoolean(body, 'witness_enabled', 'witness_enabled');
      const send = optionalBoolean(body, 'send', 'title') ?? false;

      assertField(validateTitle(title), 'title');
      assertField(validateBody(content), 'body');
      assertField(validateCategory(category), 'category');
      assertField(validateEndDate(endDate, deps.now()), 'end_date');
      assertField(validateKeeper(keeper ?? 'BOTH'), 'keeper');
      assertField(validateReward(reward ?? ''), 'reward');
      assertField(validatePenalty(penalty ?? ''), 'penalty');

      // 저장만 할 때는 아무도 받을 수 없는 토큰과 만료 예약을 만들지 않는다.
      const issued = send ? await issueToken(deps.secrets.invitePepper) : null;
      const payload = await deps.rpc('lf_promise_draft_update', {
        p_idempotency_key: idempotencyKey,
        p_user_id: userId,
        p_promise_id: promiseId,
        p_title: title,
        p_body: content,
        p_category: category,
        p_end_date: endDate,
        p_keeper: keeper,
        p_reward: reward,
        p_penalty: penalty,
        p_witness_enabled: witnessEnabled,
        // 원문 토큰은 응답을 조립하는 이 메모리 범위를 벗어나지 않는다.
        p_token_hash: issued?.hash ?? null,
      });

      return jsonResponse(attachToken(payload, issued), 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
