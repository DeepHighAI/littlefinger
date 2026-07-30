import { ENDPOINT } from '@littlefinger/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { watchSignInProvision } from './user-provision.ts';

// vi.mock 은 끌어올려지므로 mock 함수도 vi.hoisted 로 만들어야 참조가 성립한다.
const { getSupabaseMock, onAuthStateChange, unsubscribe } = vi.hoisted(() => ({
  getSupabaseMock: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
}));

// functionUrl 은 진짜를 쓴다 — 함수 주소 조립이 검증 대상이다(scr-w01 테스트와 같은 규칙).
vi.mock('./supabase.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./supabase.ts')>()),
  getSupabase: () => getSupabaseMock(),
}));

const SUPABASE_URL = 'https://test-project.supabase.co';
const fetchMock = vi.fn();

/** 등록된 onAuthStateChange 콜백에 이벤트를 흘려 넣는다. */
function emit(event: string, session: unknown): void {
  const call = onAuthStateChange.mock.calls[0] as
    | [(event: string, session: unknown) => void]
    | undefined;
  if (call === undefined) throw new Error('onAuthStateChange 가 등록되지 않았다');
  call[0](event, session);
}

const SESSION = {
  access_token: 'jwt-value',
  user: { user_metadata: { name: '지우', avatar_url: 'https://k.kakaocdn.net/p.jpg' } },
};

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', SUPABASE_URL);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 204 });
  onAuthStateChange.mockReset();
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
  unsubscribe.mockReset();
  getSupabaseMock.mockReset();
  getSupabaseMock.mockReturnValue({ auth: { onAuthStateChange } });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('watchSignInProvision — 로그인 직후 users 행 보정', () => {
  it('SIGNED_IN 에서 user-provision 을 부른다 — Bearer 토큰, 메타데이터의 name·avatar_url', () => {
    watchSignInProvision();
    emit('SIGNED_IN', SESSION);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/${ENDPOINT.userProvision}`);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer jwt-value',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      nickname: '지우',
      profile_image_url: 'https://k.kakaocdn.net/p.jpg',
    });
  });

  it('거부된 [선택 동의] — 메타데이터에 없는 키는 본문에도 없다', () => {
    // 카카오 claims 는 omitempty 라 거부하면 키가 아예 없다(§6-1). 빈 문자열이나 null 로
    // 지어 보내면 RPC 의 "없으면 대진값 유지"가 성립하지 않는다.
    watchSignInProvision();
    emit('SIGNED_IN', { access_token: 'jwt-value', user: { user_metadata: {} } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({});
  });

  it('문자열이 아닌 메타데이터 값은 보내지 않는다', () => {
    // user_metadata 는 updateUser({data}) 로 사용자가 아무 형태나 넣을 수 있는 자리다.
    watchSignInProvision();
    emit('SIGNED_IN', {
      access_token: 'jwt-value',
      user: { user_metadata: { name: 42, avatar_url: false } },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({});
  });

  it('SIGNED_IN 이 아닌 이벤트는 부르지 않는다', () => {
    watchSignInProvision();
    emit('INITIAL_SESSION', SESSION);
    emit('TOKEN_REFRESHED', SESSION);
    emit('SIGNED_IN', null);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('보정 실패는 조용히 끝난다 — 로그인 흐름을 깨지 않는다', async () => {
    // 트리거가 행 존재는 이미 보장했고, 다음 로그인이 같은 보정을 다시 시도한다.
    // 잡지 않으면 unhandled rejection 으로 이 테스트 파일 자체가 깨진다 — 그게 검증이다.
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    watchSignInProvision();
    emit('SIGNED_IN', SESSION);
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cleanup 이 구독을 해제한다', () => {
    const cleanup = watchSignInProvision();
    cleanup();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('클라이언트를 만들 수 없으면 조용한 no-op 이다', () => {
    // .env 없는 CI·테스트에서 import 만으로 죽지 않아야 한다(lib/supabase.ts 와 같은 규칙).
    getSupabaseMock.mockImplementation(() => {
      throw new Error('VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 가 필요하다.');
    });
    const cleanup = watchSignInProvision();
    expect(() => cleanup()).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
