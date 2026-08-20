import { ENDPOINT } from '@littlefinger/shared';

import {
  MobileApiError,
  callMobileFunction,
  callMobileFunctionPublic,
  callMobileMultipartFunction,
} from './mobile-api.ts';

const deps = {
  fetch: jest.fn(),
  functionUrl: (endpoint: string) => `https://project.supabase.co/functions/v1/${endpoint}`,
  getAccessToken: jest.fn(),
  randomUuid: jest.fn(() => '38ae6b47-6ce8-4c9e-adbf-c4dfed61ac7e'),
};

describe('모바일 Edge Function API', () => {
  beforeEach(() => {
    deps.fetch.mockReset();
    deps.getAccessToken.mockReset();
    deps.randomUuid.mockClear();
    deps.getAccessToken.mockResolvedValue('access-token');
  });

  test('세션 JWT와 UUID 멱등 키를 넣고 성공 payload를 돌려준다', async () => {
    deps.fetch.mockResolvedValue(
      new Response(JSON.stringify({ promise_id: 'promise-1', status: 'DRAFT' }), {
        status: 200,
      }),
    );

    await expect(
      callMobileFunction(
        ENDPOINT.promiseCreate,
        { title: '주 3회 달리기' },
        { idempotent: true },
        deps,
      ),
    ).resolves.toEqual({ promise_id: 'promise-1', status: 'DRAFT' });

    expect(deps.fetch).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/promise-create',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer access-token',
          'Content-Type': 'application/json',
          'Idempotency-Key': '38ae6b47-6ce8-4c9e-adbf-c4dfed61ac7e',
        },
        body: JSON.stringify({ title: '주 3회 달리기' }),
      }),
    );
  });

  test('세션이 없으면 네트워크를 호출하지 않고 다시 로그인 안내를 준다', async () => {
    deps.getAccessToken.mockResolvedValue(null);

    await expect(
      callMobileFunction(ENDPOINT.promiseCreate, {}, { idempotent: true }, deps),
    ).rejects.toMatchObject({
      code: 'E_AUTH_REQUIRED',
      message: '다시 로그인해 주세요.',
    });
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  test('공개 호출은 세션 없이도 Authorization 없이 나간다 — invite-resolve 전용', async () => {
    deps.getAccessToken.mockResolvedValue(null);
    deps.fetch.mockResolvedValue(
      new Response(JSON.stringify({ title: '아침 달리기' }), { status: 200 }),
    );

    await expect(
      callMobileFunctionPublic(ENDPOINT.inviteResolve, { token: 'tok-1' }, deps),
    ).resolves.toEqual({ title: '아침 달리기' });

    expect(deps.fetch).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/invite-resolve',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'tok-1' }),
      }),
    );
    expect(deps.getAccessToken).not.toHaveBeenCalled();
  });

  test('공개 호출의 실패도 같은 에러 봉투로 매핑된다', async () => {
    deps.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'E_INVITE_EXPIRED', message: '초대 링크가 만료됐어요. (72시간)' }),
        { status: 410 },
      ),
    );

    await expect(
      callMobileFunctionPublic(ENDPOINT.inviteResolve, { token: 'tok-1' }, deps),
    ).rejects.toMatchObject({ code: 'E_INVITE_EXPIRED' });
  });

  test('multipart 업로드는 Content-Type 경계를 직접 지정하지 않고 별도 멱등 키를 보낸다', async () => {
    deps.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          upload_id: 'upload-1',
          status: 'READY',
          mime: 'image/jpeg',
          bytes: 4,
          width: 2,
          height: 1,
        }),
        { status: 200 },
      ),
    );
    const form = new FormData();
    form.set('promise_id', 'promise-1');

    await callMobileMultipartFunction(
      ENDPOINT.evidenceUpload,
      form,
      '11111111-1111-4111-8111-111111111111',
      deps,
    );

    expect(deps.fetch).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/evidence-upload',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer access-token',
          'Idempotency-Key': '11111111-1111-4111-8111-111111111111',
        },
        body: form,
      }),
    );
  });

  test('서버의 필드 오류를 보존하고 알 수 없는 실패는 공통 500 문구로 평탄화한다', async () => {
    deps.fetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'E_VALIDATION',
            field: 'title',
            message: '제목을 2자 이상 입력해 주세요.',
          }),
          { status: 422 },
        ),
      )
      .mockResolvedValueOnce(
        new Response('<html>relation public.promises</html>', { status: 500 }),
      );

    await expect(
      callMobileFunction(ENDPOINT.promiseCreate, {}, { idempotent: true }, deps),
    ).rejects.toEqual(
      new MobileApiError(
        'E_VALIDATION',
        '제목을 2자 이상 입력해 주세요.',
        'title',
      ),
    );
    await expect(
      callMobileFunction(ENDPOINT.promiseCreate, {}, { idempotent: true }, deps),
    ).rejects.toMatchObject({
      message: '문제가 발생했어요. 잠시 후 다시 시도해 주세요.',
      field: undefined,
    });
  });
});
