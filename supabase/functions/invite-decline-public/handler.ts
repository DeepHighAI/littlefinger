import { witnessTokenOf } from '../_shared/witness.ts';
import { ENDPOINT } from '../../../packages/shared/src/api.ts';
import type { Deps } from '../_shared/deps.ts';
import { ApiError } from '../_shared/errors.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { inviteTokenHash, piiHash } from '../_shared/hash.ts';
import { clientIp, jsonBody, rateLimitBucket, userAgent } from '../_shared/request.ts';

export function createInviteDeclinePublicHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();

    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'token' });
      }

      // 잘못된 토큰 요청도 집계해 익명 거절 경로의 조회·변경 비용을 제한한다.
      const ip = clientIp(request);
      const ipHash = ip === null ? null : await piiHash(ip, deps.secrets.piiSalt);
      await deps.rpc('lf_rate_limit_hit', {
        p_bucket: rateLimitBucket(ENDPOINT.inviteDeclinePublic, ipHash),
      });

      // 토큰은 본문으로 받는다. 쿼리스트링에 실으면 프록시·브라우저 히스토리·서버 액세스
      // 로그에 원문이 남아, "원본 토큰 미저장"(§13)이 DB 밖에서 깨진다.
      const body = await jsonBody(request);
      const token = witnessTokenOf(body);

      const ua = userAgent(request);
      const payload = await deps.rpc('lf_invite_decline_public', {
        p_token_hash: await inviteTokenHash(token, deps.secrets.invitePepper),
        p_ip_hash: ipHash,
        p_ua_hash: ua === null ? null : await piiHash(ua, deps.secrets.piiSalt),
      });

      // 실패 payload 는 존재하지 않는다 — RPC 는 실패를 raise 로만 알린다. 만료·사용됨·
      // 무효화·차단 어느 쪽도 작성자 이름이나 제목을 싣지 않는다(EC-B01·B03·B11).
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
