import { asAccountWithdrawResponse } from '../../../packages/shared/src/account-safety.ts';
import { emptyAccountBody } from '../_shared/account-safety.ts';
import type { Deps } from '../_shared/deps.ts';
import { sha256Hex } from '../_shared/hash.ts';
import { corsPreflight, failureResponse, jsonResponse } from '../_shared/http.ts';
import { idempotencyKeyOf, jsonBody } from '../_shared/request.ts';

export interface AccountWithdrawDeps extends Deps {
  accountIdPepper: string;
  accountIdentifier: (actor: string) => Promise<string>;
  deleteAuthUser: (actor: string) => Promise<void>;
}

export function createAccountWithdrawHandler(deps: AccountWithdrawDeps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      emptyAccountBody(await jsonBody(request, 'nickname'));
      const identifier = await deps.accountIdentifier(actor);
      const anonymizedProviderUserId = `withdrawn:${await sha256Hex(identifier + deps.accountIdPepper)}`;
      const payload = asAccountWithdrawResponse(await deps.rpc('lf_account_withdraw', {
        p_idempotency_key: idempotencyKey,
        p_actor: actor,
        p_anonymized_provider_user_id: anonymizedProviderUserId,
      }));
      if (payload === null) throw new Error('INVALID_ACCOUNT_WITHDRAW_RESPONSE');
      try {
        await deps.deleteAuthUser(actor);
      } catch (raised) {
        // public 계정은 이미 WITHDRAWN이라 접근은 막혔다. 인증 삭제 장애로 그 사실을 되돌리지 않는다.
        deps.log.error('auth user deletion failed after account withdrawal', raised);
      }
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { validation: { field: 'nickname', message: null }, log: deps.log.error });
    }
  };
}
