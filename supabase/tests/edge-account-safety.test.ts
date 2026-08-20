import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { Deps } from '../functions/_shared/deps.ts';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const PROMISE_ID = '22222222-2222-4222-8222-222222222222';
const TARGET_ID = '33333333-3333-4333-8333-333333333333';
const EVIDENCE_ID = '44444444-4444-4444-8444-444444444444';
const REPORT_ID = '55555555-5555-4555-8555-555555555555';
const KEY = '66666666-6666-4666-8666-666666666666';

interface FactoryModule {
  [name: string]: ((deps: never) => (request: Request) => Promise<Response>) | undefined;
}

interface Spy {
  deps: Deps;
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
  logs: { message: string; detail: unknown }[];
}

async function load(path: string): Promise<FactoryModule | null> {
  return import(/* @vite-ignore */ path).catch(() => null) as Promise<FactoryModule | null>;
}

function spy(payload: unknown): Spy {
  const rpcCalls: Spy['rpcCalls'] = [];
  const logs: Spy['logs'] = [];
  return {
    rpcCalls,
    logs,
    deps: {
      authenticate: async () => ACTOR_ID,
      rpc: async (fn, args) => {
        rpcCalls.push({ fn, args });
        return payload;
      },
      secrets: { invitePepper: 'unused', piiSalt: 'unused' },
      log: { error: (message, detail) => logs.push({ message, detail }) },
      now: () => new Date('2026-08-18T00:00:00Z'),
    },
  };
}

function request(slug: string, body: unknown): Request {
  return new Request(`https://ref.supabase.co/functions/v1/${slug}`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt',
      'content-type': 'application/json',
      'idempotency-key': KEY,
    },
    body: JSON.stringify(body),
  });
}

describe('account and safety Edge Functions', () => {
  let withdraw: FactoryModule | null;
  let nickname: FactoryModule | null;
  let hide: FactoryModule | null;
  let block: FactoryModule | null;
  let unblock: FactoryModule | null;
  let blockList: FactoryModule | null;
  let report: FactoryModule | null;

  beforeEach(async () => {
    [withdraw, nickname, hide, block, unblock, blockList, report] = await Promise.all([
      load('../functions/account-withdraw/handler.ts'),
      load('../functions/profile-nickname-update/handler.ts'),
      load('../functions/promise-hide/handler.ts'),
      load('../functions/user-block/handler.ts'),
      load('../functions/user-unblock/handler.ts'),
      load('../functions/user-block-list/handler.ts'),
      load('../functions/safety-report/handler.ts'),
    ]);
  });

  test('Deno 전역 없는 순수 handler를 제공한다', () => {
    expect(withdraw?.['createAccountWithdrawHandler']).toBeTypeOf('function');
    expect(nickname?.['createProfileNicknameUpdateHandler']).toBeTypeOf('function');
    expect(hide?.['createPromiseHideHandler']).toBeTypeOf('function');
    expect(block?.['createUserBlockHandler']).toBeTypeOf('function');
    expect(unblock?.['createUserUnblockHandler']).toBeTypeOf('function');
    expect(blockList?.['createUserBlockListHandler']).toBeTypeOf('function');
    expect(report?.['createSafetyReportHandler']).toBeTypeOf('function');
  });

  test('탈퇴는 ACCOUNT_ID_PEPPER 해시만 RPC에 보내고 auth 삭제 실패와 응답을 분리한다', async () => {
    const s = spy({ status: 'WITHDRAWN' });
    const deleteAuthUser = vi.fn().mockRejectedValue(new Error('auth unavailable'));
    const accountDeps = {
      ...s.deps,
      accountIdPepper: 'account-pepper',
      accountIdentifier: vi.fn().mockResolvedValue('kakao-123'),
      deleteAuthUser,
    };
    const response = await withdraw!.createAccountWithdrawHandler!(accountDeps as never)(
      request('account-withdraw', {}),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'WITHDRAWN' });
    expect(s.rpcCalls).toEqual([{
      fn: 'lf_account_withdraw',
      args: {
        p_idempotency_key: KEY,
        p_actor: ACTOR_ID,
        p_anonymized_provider_user_id: `withdrawn:${createHash('sha256').update('kakao-123account-pepper').digest('hex')}`,
      },
    }]);
    expect(deleteAuthUser).toHaveBeenCalledWith(ACTOR_ID);
    expect(s.logs).toHaveLength(1);
  });

  test('닉네임·숨김·차단 요청은 JWT actor와 엄격한 본문만 RPC에 전달한다', async () => {
    const nicknameSpy = spy({ nickname: '새 닉네임' });
    const hideSpy = spy({ promise_id: PROMISE_ID, hidden: true });
    const blockSpy = spy({ target_user_id: TARGET_ID, blocked: true });

    expect((await nickname!.createProfileNicknameUpdateHandler!(nicknameSpy.deps as never)(
      request('profile-nickname-update', { nickname: '새 닉네임' }),
    )).status).toBe(200);
    expect((await hide!.createPromiseHideHandler!(hideSpy.deps as never)(
      request('promise-hide', { promise_id: PROMISE_ID, hidden: true }),
    )).status).toBe(200);
    expect((await block!.createUserBlockHandler!(blockSpy.deps as never)(
      request('user-block', { target_user_id: TARGET_ID }),
    )).status).toBe(200);

    expect(nicknameSpy.rpcCalls[0]).toEqual({
      fn: 'lf_profile_nickname_update',
      args: { p_idempotency_key: KEY, p_actor: ACTOR_ID, p_nickname: '새 닉네임' },
    });
    expect(hideSpy.rpcCalls[0]).toEqual({
      fn: 'lf_promise_hide',
      args: { p_idempotency_key: KEY, p_actor: ACTOR_ID, p_promise_id: PROMISE_ID, p_hidden: true },
    });
    expect(blockSpy.rpcCalls[0]).toEqual({
      fn: 'lf_user_block',
      args: { p_idempotency_key: KEY, p_actor: ACTOR_ID, p_target_user_id: TARGET_ID },
    });
  });

  test('F3 차단 해제·목록은 JWT actor 기준으로만 RPC를 부른다', async () => {
    const unblockSpy = spy({ target_user_id: TARGET_ID, blocked: false });
    expect((await unblock!.createUserUnblockHandler!(unblockSpy.deps as never)(
      request('user-unblock', { target_user_id: TARGET_ID }),
    )).status).toBe(200);
    expect(unblockSpy.rpcCalls[0]).toEqual({
      fn: 'lf_user_unblock',
      args: { p_idempotency_key: KEY, p_actor: ACTOR_ID, p_target_user_id: TARGET_ID },
    });

    const listSpy = spy({
      items: [{
        target_user_id: TARGET_ID,
        nickname: '차단상대',
        profile_image_url: null,
        blocked_at: '2026-08-20T00:00:00+00:00',
      }],
    });
    const listResponse = await blockList!.createUserBlockListHandler!(listSpy.deps as never)(
      request('user-block-list', {}),
    );
    expect(listResponse.status).toBe(200);
    expect(listSpy.rpcCalls[0]).toEqual({
      fn: 'lf_user_block_list',
      args: { p_actor: ACTOR_ID },
    });
    expect(await listResponse.json()).toEqual({
      items: [{
        target_user_id: TARGET_ID,
        nickname: '차단상대',
        profile_image_url: null,
        blocked_at: '2026-08-20T00:00:00+00:00',
      }],
    });
  });

  test('신고는 약속 컨텍스트와 nullable 대상을 그대로 전달한다', async () => {
    const s = spy({ report_id: REPORT_ID, status: 'RECEIVED', evidence_blinded: true });
    const response = await report!.createSafetyReportHandler!(s.deps as never)(
      request('safety-report', {
        promise_id: PROMISE_ID,
        target_user_id: TARGET_ID,
        evidence_id: EVIDENCE_ID,
        reason: 'ABUSE',
        detail: '부적절한 이미지',
      }),
    );
    expect(response.status).toBe(200);
    expect(s.rpcCalls[0]).toEqual({
      fn: 'lf_safety_report',
      args: {
        p_idempotency_key: KEY,
        p_actor: ACTOR_ID,
        p_promise_id: PROMISE_ID,
        p_target_user_id: TARGET_ID,
        p_evidence_id: EVIDENCE_ID,
        p_reason: 'ABUSE',
        p_detail: '부적절한 이미지',
      },
    });
  });

  test.each([
    ['profile-nickname-update', 'createProfileNicknameUpdateHandler', { nickname: '이름', extra: true }],
    ['promise-hide', 'createPromiseHideHandler', { promise_id: PROMISE_ID, hidden: 'yes' }],
    ['user-block', 'createUserBlockHandler', { target_user_id: 'not-a-uuid' }],
    ['user-unblock', 'createUserUnblockHandler', { target_user_id: 'not-a-uuid' }],
    ['user-block-list', 'createUserBlockListHandler', { target_user_id: TARGET_ID }],
    ['safety-report', 'createSafetyReportHandler', { promise_id: PROMISE_ID, target_user_id: null, evidence_id: null, reason: 'OTHER', detail: null }],
  ] as const)('잘못된 %s 본문은 RPC 전에 422로 막는다', async (slug, factory, body) => {
    const modules: Record<string, FactoryModule | null> = {
      'profile-nickname-update': nickname,
      'promise-hide': hide,
      'user-block': block,
      'user-unblock': unblock,
      'user-block-list': blockList,
      'safety-report': report,
    };
    const s = spy({});
    const response = await modules[slug]![factory]!(s.deps as never)(request(slug, body));
    expect(response.status).toBe(422);
    expect(s.rpcCalls).toEqual([]);
  });
});
