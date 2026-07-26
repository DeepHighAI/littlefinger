// 승인·거절·수정 제안이 공유하는 껍데기 — 02 §4-3-4 · §4-3-5.
//
// 셋은 같은 토큰, 같은 화면(SCR-W02)의 3택이고 서버 쪽 절차도 **순서까지** 같다. 한 곳에
// 모아 둔 이유는 중복을 줄이려는 게 아니라, RPC 계층에서 `lf_invite_lock_for_response` 를
// 뽑아낸 이유와 같다 — 판정 순서가 갈리면 같은 토큰에 화면과 서버가 다른 답을 낸다.
//
// 갈리는 것은 셋뿐이다: 부르는 RPC, 본문의 추가 필드 하나, `E_VALIDATION` 이 뜻하는 필드.

import type { Deps } from './deps.ts';
import { ApiError } from './errors.ts';
import { corsPreflight, failureResponse, jsonResponse, type ValidationMeaning } from './http.ts';
import { inviteTokenHash, piiHash } from './hash.ts';
import { asTransitionPayload, buildTransitionNotification } from './notify.ts';
import type { NotificationEvent } from '../../../packages/shared/src/notification.ts';
import {
  clientIp,
  idempotencyKeyOf,
  jsonBody,
  requiredString,
  surfaceOf,
  userAgent,
} from './request.ts';

export interface TransitionConfig {
  /** `lf_promise_approve` 등. */
  rpc: string;
  /** §8-1 코드. 커밋 뒤 작성자에게 남길 알림. */
  event: NotificationEvent;
  /** 이 함수에서 `E_VALIDATION` 이 뜻하는 것. RPC 는 필드 이름 없이 raise 한다. */
  validation: ValidationMeaning;
  /**
   * 본문에서 RPC 인자를 더 뽑아낸다. 승인은 없고, 거절은 `p_reason`, 수정 제안은 `p_comment`.
   * 길이는 여기서 보지 않는다 — 정규화 뒤에 세는 것이 규칙이고 그건 RPC 몫이다(§2-3).
   */
  extraArgs: (body: Record<string, unknown>) => Record<string, unknown>;
}

export function createTransitionHandler(config: TransitionConfig, deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();

    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'token' });
      }

      // §9 의 "세션 확인 → …" 순서다. 로그인하지 않은 사람에게는 토큰이 유효한지조차
      // 답하지 않는다 — 그 답 자체가 약속의 존재를 알려 준다.
      const userId = await deps.authenticate(request.headers.get('authorization'));

      const idempotencyKey = idempotencyKeyOf(request);
      const body = await jsonBody(request);
      const token = requiredString(body, 'token', 'token');

      const ip = clientIp(request);
      const ua = userAgent(request);

      const payload = await deps.rpc(config.rpc, {
        p_idempotency_key: idempotencyKey,
        p_token_hash: await inviteTokenHash(token, deps.secrets.invitePepper),
        p_user_id: userId,
        p_surface: surfaceOf(request),
        // 헤더가 없으면 NULL 이다. 자리 표시자를 해싱하면 서로 다른 사람이 같은 해시를 갖는다.
        p_ip_hash: ip === null ? null : await piiHash(ip, deps.secrets.piiSalt),
        p_ua_hash: ua === null ? null : await piiHash(ua, deps.secrets.piiSalt),
        ...config.extraArgs(body),
      });

      await notify(config.event, payload, idempotencyKey, deps);

      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { validation: config.validation, log: deps.log.error });
    }
  };
}

/**
 * 알림은 **응답을 막지 않는다.**
 *
 * 전이는 이미 커밋됐다. 여기서 던지면 확정된 약속에 클라이언트만 실패를 보게 되고, 재시도는
 * 멱등 캐시가 받아 같은 payload 를 돌려주므로 사용자는 영문 모를 에러를 한 번 본 뒤 정상
 * 화면으로 간다. EC-C02 가 "알림 실패는 트랜잭션 밖에서 재시도"라고 적은 그대로, 실패는
 * 로그로만 남긴다.
 */
async function notify(
  event: NotificationEvent,
  payload: unknown,
  idempotencyKey: string,
  deps: Deps,
): Promise<void> {
  const parsed = asTransitionPayload(payload);
  if (parsed === null) {
    deps.log.error('RPC payload is missing notification fields', { event });
    return;
  }

  try {
    await deps.insertNotification(
      buildTransitionNotification({ event, payload: parsed, idempotencyKey, now: deps.now() }),
    );
  } catch (raised) {
    deps.log.error('notification insert failed', { event, raised: String(raised) });
  }
}
