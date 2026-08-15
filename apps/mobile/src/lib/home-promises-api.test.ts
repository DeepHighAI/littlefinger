const PROMISE_ID = '11111111-1111-4111-8111-111111111111';

interface ApiModule {
  listHomePromises: (
    input: Record<string, unknown>,
    deps: { call: jest.Mock },
  ) => Promise<unknown>;
}

function loadApi(): ApiModule | null {
  try {
    return require('./home-promises-api.ts') as ApiModule;
  } catch {
    return null;
  }
}

const RESPONSE = {
  items: [
    {
      promise_id: PROMISE_ID,
      title: '매일 걷기',
      status: 'ACTIVE',
      end_date: '2026-08-30',
      updated_at: '2026-08-16T00:00:00Z',
      closed_at: null,
      my_role: 'CREATOR',
      creator: { nickname: '작성자', profile_image_url: null },
      partner: { nickname: '상대방', profile_image_url: null },
      has_witness: false,
      needs_response: false,
    },
  ],
  pinned: [],
  counts: { ACTIVE: 1, WAITING: 0, COMPLETED: 0 },
  next_cursor: null,
};

describe('모바일 F-10 홈 목록 API', () => {
  test('읽기 전용 endpoint에 탭·cursor를 그대로 보내고 엄격 응답을 반환한다', async () => {
    const api = loadApi();
    const call = jest.fn().mockResolvedValue(RESPONSE);
    const input = {
      tab: 'ACTIVE',
      cursor: {
        tab: 'ACTIVE',
        status_rank: 1,
        end_date: '2026-08-30',
        promise_id: PROMISE_ID,
      },
    };

    expect(api?.listHomePromises).toEqual(expect.any(Function));
    await expect(api?.listHomePromises(input, { call })).resolves.toEqual(RESPONSE);
    expect(call).toHaveBeenCalledWith('promise-home-list', input, { idempotent: false });
  });

  test('서버 성공 본문이 공개 계약을 벗어나면 화면으로 전달하지 않는다', async () => {
    const api = loadApi();
    const call = jest.fn().mockResolvedValue({ ...RESPONSE, storage_path: '/private/object' });

    await expect(api?.listHomePromises({ tab: 'ACTIVE' }, { call })).rejects.toThrow(
      'INVALID_PROMISE_HOME_RESPONSE',
    );
  });

  test('네트워크 실패는 성공 목록으로 바꾸지 않고 그대로 전파한다', async () => {
    const api = loadApi();
    const failure = new Error('network down');
    const call = jest.fn().mockRejectedValue(failure);

    await expect(api?.listHomePromises({ tab: 'ACTIVE' }, { call })).rejects.toBe(failure);
  });
});
