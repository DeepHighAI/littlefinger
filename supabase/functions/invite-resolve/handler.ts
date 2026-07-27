// invite-resolve — 02 §4-3-3 (SCR-W01 초대 랜딩, **비로그인**).
//
// 서비스에서 로그인 이전에 DB 를 건드리는 유일한 경로다. `verify_jwt = false` 로 열려 있으므로
// 이 함수는 **인터넷 전체가 부를 수 있다**. 그래서 다른 셋과 두 가지가 다르다.
//
// 1. 사용자 식별이 없다. RPC 도 `user_id` 를 받지 않는다.
// 2. 상태를 바꾸지 않는다 — `lf_invite_resolve` 는 `stable` 이라 Postgres 가 INSERT/UPDATE 를
//    문법 수준에서 거부한다. 그래서 `Idempotency-Key` 도 알림도 없다.
//
// 3. 열쇠 없이 불릴 수 있으므로 **빈도 제한이 이 함수에만** 붙는다(IP 당 10분 60회, PO 2026-07-27).
//    나머지 셋은 JWT 게이트와 1회용 토큰이 이미 반복 호출을 막는다.

import { ENDPOINT } from '../../../packages/shared/src/api.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { inviteTokenHash, piiHash } from '../_shared/hash.ts';
import { clientIp, jsonBody, rateLimitBucket, requiredString } from '../_shared/request.ts';

export function createInviteResolveHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();

    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'token' });
      }

      // 빈도 제한이 **토큰 조회보다 먼저**다. 뒤에 두면 막으려던 호출을 이미 다 한 뒤에
      // 세는 셈이라 무료 플랜 사용량이 그대로 나간다. 실패한 조회도 세어야 의미가 있다.
      //
      // `lf_invite_resolve` 안에 넣을 수는 없다 — 그 함수는 `stable` 이라 Postgres 가 쓰기를
      // 문법 수준에서 거부한다. 읽기 경로가 초대를 소모하지 못하게 하는 장치라 풀 수 없다.
      const ip = clientIp(request);
      const ipHash = ip === null ? null : await piiHash(ip, deps.secrets.piiSalt);
      await deps.rpc('lf_rate_limit_hit', {
        p_bucket: rateLimitBucket(ENDPOINT.inviteResolve, ipHash),
      });

      // 토큰은 본문으로 받는다. 쿼리스트링에 실으면 프록시·브라우저 히스토리·서버 액세스
      // 로그에 원문이 남아, "원본 토큰 미저장"(§13)이 DB 밖에서 깨진다.
      const body = await jsonBody(request);
      const token = requiredString(body, 'token', 'token');

      const payload = await deps.rpc('lf_invite_resolve', {
        p_token_hash: await inviteTokenHash(token, deps.secrets.invitePepper),
      });

      // 실패 payload 는 존재하지 않는다 — RPC 는 실패를 raise 로만 알린다. 만료·사용됨·
      // 무효화·차단 어느 쪽도 작성자 이름이나 제목을 싣지 않는다(EC-B01·B03·B11).
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
