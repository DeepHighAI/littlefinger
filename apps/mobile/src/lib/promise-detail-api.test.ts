const PROMISE_ID = '11111111-1111-4111-8111-111111111111';

interface ApiModule {
  getPromiseDetail: (promiseId: string, deps: { call: jest.Mock }) => Promise<unknown>;
}

function loadApi(): ApiModule | null {
  try {
    return require('./promise-detail-api.ts') as ApiModule;
  } catch {
    return null;
  }
}

const VERSION = {
  version_no: 1,
  title: '매일 걷기',
  body: '함께 걸어요.',
  category: 'HABIT',
  end_date: '2026-09-01',
  keeper: 'BOTH',
  reward: null,
  penalty: null,
  content_hash: 'a'.repeat(64),
  fingerprint: 'AAAA-AAAA-AA',
  activated_at: '2026-08-01T00:00:00Z',
  superseded_at: null,
  change_reason: null,
};

const RESPONSE = {
  promise_id: PROMISE_ID,
  status: 'ACTIVE',
  title: VERSION.title,
  body: VERSION.body,
  category: VERSION.category,
  end_date: VERSION.end_date,
  keeper: VERSION.keeper,
  reward: VERSION.reward,
  penalty: VERSION.penalty,
  witness_enabled: false,
  activated_at: '2026-08-01T00:00:00Z',
  closed_at: null,
  checking_started_at: null,
  check_deadline_at: null,
  check_round_no: 1,
  my_role: 'CREATOR',
  creator: {
    user_id: '22222222-2222-4222-8222-222222222222',
    nickname: '작성자',
    profile_image_url: null,
    role: 'CREATOR',
    status: 'JOINED',
    joined_at: '2026-07-31T00:00:00Z',
  },
  partner: {
    user_id: '33333333-3333-4333-8333-333333333333',
    nickname: '상대방',
    profile_image_url: null,
    role: 'PARTNER',
    status: 'JOINED',
    joined_at: '2026-08-01T00:00:00Z',
  },
  witnesses: [],
  approvals: [],
  current_version: VERSION,
  invitation: null,
  amend_request: null,
  fulfillment: null,
  integrity_status: 'VERIFIED',
};

describe('모바일 SCR-A05 약속 상세 API', () => {
  test('읽기 전용 endpoint에 promise_id만 보내고 엄격 응답을 반환한다', async () => {
    const api = loadApi();
    const call = jest.fn().mockResolvedValue(RESPONSE);

    expect(api?.getPromiseDetail).toEqual(expect.any(Function));
    await expect(api?.getPromiseDetail(PROMISE_ID, { call })).resolves.toEqual(RESPONSE);
    expect(call).toHaveBeenCalledWith(
      'promise-detail',
      { promise_id: PROMISE_ID },
      { idempotent: false },
    );
  });

  test('서버 성공 본문이 공개 계약을 벗어나면 화면으로 전달하지 않는다', async () => {
    const api = loadApi();
    const call = jest.fn().mockResolvedValue({ ...RESPONSE, token_hash: 'private' });

    await expect(api?.getPromiseDetail(PROMISE_ID, { call })).rejects.toThrow(
      'INVALID_PROMISE_DETAIL_RESPONSE',
    );
  });

  test('네트워크 실패는 성공 상세로 바꾸지 않고 그대로 전파한다', async () => {
    const api = loadApi();
    const failure = new Error('network down');
    const call = jest.fn().mockRejectedValue(failure);

    await expect(api?.getPromiseDetail(PROMISE_ID, { call })).rejects.toBe(failure);
  });
});
