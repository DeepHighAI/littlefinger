// promise-create — 02 §4-2-2 · §4-3-1 (T-01, `send` 가 true 면 T-02 까지).
//
// 껍데기가 하는 일: JWT → user id, 본문 파싱, §5-1 필드 판정, 토큰 생성, RPC, 에러 매핑.
// 전이·해시·한도는 전부 `lf_promise_create` 안에서 한 트랜잭션으로 돈다(ADR 0003).
//
// **알림이 없다.** §8-1 이 명시한다 — "초대 발송 자체는 시스템 알림이 아니다"(작성자가
// 카카오톡으로 직접 공유한다). 그래서 이 함수는 `createTransitionHandler` 를 쓰지 않는다.

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

/**
 * §5-1 판정을 껍데기가 **먼저** 돌리는 이유는 문구 때문이다.
 *
 * RPC 는 필드 이름 없이 `E_VALIDATION` 을 raise 한다 — 승인·거절처럼 검사 대상이 하나뿐인
 * 함수는 그걸로 충분하지만, 작성은 일곱 개다. 어느 칸이 틀렸는지 모르면 SCR-A03 은 폼 전체에
 * 빨간 줄을 긋는 수밖에 없다.
 *
 * 그래도 **서버가 최종이다**(§2-3). RPC 는 같은 규칙을 다시 돌리고, 여기까지 못 잡은 값은
 * 거기서 걸린다 — 두 구현이 어긋났다는 뜻이므로 그때는 공통 문구가 맞다.
 */
function assertField(result: ValidationResult, field: ApiValidationField): void {
  if (result.valid) return;
  throw new ApiError('E_VALIDATION', {
    field,
    // §5 에 문구가 없는 실패(상한 초과·개행 등)는 지어내지 않는다. validation.ts 와 같은 규칙이다.
    ...(result.message !== null ? { userMessage: result.message } : {}),
  });
}

export function createPromiseCreateHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();

    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'title' });
      }

      const userId = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const body = await jsonBody(request, 'title');

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
      // **기기 시계를 쓰지 않는다.** `deps.now()` 는 서버 시각이고, RPC 가 KST 로 같은 판정을
      // 다시 한다(§2-2 "날짜 경계는 서버가 판단").
      assertField(validateEndDate(endDate, deps.now()), 'end_date');
      // 미지정이면 §5-1 기본값. RPC 도 같은 기본값을 쓴다.
      assertField(validateKeeper(keeper ?? 'BOTH'), 'keeper');
      assertField(validateReward(reward ?? ''), 'reward');
      assertField(validatePenalty(penalty ?? ''), 'penalty');

      // 토큰은 **보낼 때만** 만든다. [임시저장]에 발급하면 아무도 받지 않을 링크가 남고,
      // 그 초대의 만료 알림이 작성자에게 나간다.
      const issued = send ? await issueToken(deps.secrets.invitePepper) : null;

      const payload = await deps.rpc('lf_promise_create', {
        p_idempotency_key: idempotencyKey,
        p_user_id: userId,
        // 정규화하지 않고 원문을 넘긴다. 저장되는 값을 정하는 곳은 `lf_normalize_input` 한 곳이다.
        p_title: title,
        p_body: content,
        p_category: category,
        p_end_date: endDate,
        p_keeper: keeper,
        p_reward: reward,
        p_penalty: penalty,
        p_witness_enabled: witnessEnabled,
        // 원문 토큰은 RPC 로 넘어가지 않는다(§13). 서버가 보관하는 것은 해시뿐이다.
        p_token_hash: issued?.hash ?? null,
      });

      return jsonResponse(attachToken(payload, issued), 200);
    } catch (raised) {
      // RPC 가 raise 한 `E_VALIDATION` 에는 필드를 붙이지 않는다. 껍데기가 이미 일곱 칸을
      // 다 본 뒤라, 여기까지 온 것은 두 구현이 어긋났다는 뜻이지 특정 칸의 문제가 아니다.
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
