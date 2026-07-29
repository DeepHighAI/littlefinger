// @vitest-environment jsdom
import { ENDPOINT, ERROR_HTTP_STATUS, ERROR_MESSAGE } from '@littlefinger/shared';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { invitePath, ROUTE } from '../routes.ts';
import { formatRemaining, ScrW01InviteLanding } from './scr-w01-invite-landing.tsx';

// vi.mock 은 끌어올려지므로 mock 함수도 vi.hoisted 로 만들어야 참조가 성립한다.
const { signInWithOAuth } = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }));

// 카카오 프로바이더는 아직 대시보드에 없어서 실서비스에서도 실패한다. 여기서는
// `functionUrl` 은 진짜를 쓰고 인증만 바꿔 끼운다 — 함수 주소 조립이 검증 대상이다.
vi.mock('../lib/supabase.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/supabase.ts')>()),
  getSupabase: () => ({ auth: { signInWithOAuth } }),
}));

const SUPABASE_URL = 'https://test-project.supabase.co';
const TOKEN = 'a-b_c-d_e';

const INVITE = {
  creator_nickname: '지우',
  title: '매주 화·목 아침 러닝 같이 하기',
  expires_at: new Date(Date.now() + (2 * 3600 + 3 * 60 + 4) * 1000).toISOString(),
  target_role: 'PARTNER' as const,
};

const fetchMock = vi.fn();

/** `response.ok` 와 `json()` 만 쓴다. jsdom 에 `Response` 전역이 있다고 가정하지 않는다. */
function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function renderAt(token = TOKEN): void {
  render(
    <MemoryRouter initialEntries={[invitePath(token)]}>
      <Routes>
        <Route path={ROUTE.invite} element={<ScrW01InviteLanding />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** 사용자가 실제로 읽는 글자. aria-hidden(아이콘)은 뗀다. */
function visibleText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  for (const hidden of clone.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return clone.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', SUPABASE_URL);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  signInWithOAuth.mockReset();
  signInWithOAuth.mockResolvedValue({ data: {}, error: null });
});

// Testing Library 의 자동 cleanup 은 전역 afterEach 가 있을 때만 등록된다. 이 저장소는
// vitest `globals` 를 켜지 않으므로 직접 부른다.
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('SCR-W01 초대 랜딩', () => {
  it('invite-resolve 가 준 것만 그린다', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, INVITE));
    renderAt();

    // 헤드라인은 디자인 요청서 §5-2 의 "○○님이 약속을 보냈어요"다. 레퍼런스의
    // "민준님, …"은 받는 사람 이름인데 로그인 전에는 알 수 없다.
    expect((await screen.findByRole('heading')).textContent).toBe('지우님이 약속을 보냈어요');

    // 문단 전체를 고정한다. 본문·보상·벌칙이 실수로 붙으면 여기서 깨진다 — 로그인 전에
    // 그것들을 노출하지 않는 것이 §4-3-3 의 요구다.
    const paragraphs = [...document.querySelectorAll('p')].map(visibleText).filter((t) => t);
    expect(paragraphs).toEqual([
      `${formatRemaining(Date.parse(INVITE.expires_at) - Date.now())}안에 확인해 주세요`,
      '약속 미리보기',
      '매주 화·목 아침 러닝 같이 하기',
      '자세한 내용은 로그인 후 볼 수 있어요',
      '리틀핑거는 둘이 합의한 약속을 기록하고지키게 돕는 서비스예요',
      '앱 설치 없이 3분이면 끝나요',
    ]);
  });

  it('만료 카운트다운이 HH:MM:SS 다', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, INVITE));
    renderAt();
    const countdown = await screen.findByTestId('countdown');
    expect(countdown.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(countdown.textContent?.startsWith('02:03:0')).toBe(true);
  });

  it('남은 시간이 0 이어도 CTA 는 살아 있다', async () => {
    // 만료 판정은 서버의 몫이다(EC-F09 — 기기 시계를 믿지 않는다). 여기서 화면을 닫으면
    // 시계가 앞선 기기에서 멀쩡한 초대가 열리지 않는다.
    fetchMock.mockResolvedValue(
      fakeResponse(200, { ...INVITE, expires_at: new Date(Date.now() - 1000).toISOString() }),
    );
    renderAt();
    expect(await screen.findByRole('button')).toBeTruthy();
    expect(screen.queryByTestId('countdown')).toBeNull();
  });

  it('함수에 필요한 것만 보낸다 — 열쇠 없이 POST, 토큰은 본문으로', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, INVITE));
    renderAt();
    await screen.findByRole('heading');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/${ENDPOINT.inviteResolve}`);
    expect(init.method).toBe('POST');
    // verify_jwt = false 다. apikey·Authorization 을 요구하지 않으므로 싣지 않는다.
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    // 토큰이 쿼리스트링에 새면 프록시·히스토리·액세스 로그에 원문이 남는다(§13).
    expect(url).not.toContain(TOKEN);
    expect(JSON.parse(String(init.body))).toEqual({ token: TOKEN });
  });

  it.each([
    ['E_INVITE_EXPIRED', '초대 링크가 만료되었습니다. 상대에게 새 링크를 요청해 주세요.'],
    ['E_INVITE_USED', '이미 사용된 초대입니다.'],
    ['E_INVITE_REVOKED', '이 초대는 취소되었습니다.'],
    ['E_BLOCKED', '이 초대는 열 수 없습니다.'],
    ['E_NOT_FOUND', '초대 링크를 찾을 수 없습니다.'],
  ] as const)('%s 는 SCR-W06 으로 간다', async (code, body) => {
    fetchMock.mockResolvedValue(fakeResponse(ERROR_HTTP_STATUS[code], { code, message: 'x' }));
    renderAt();

    expect((await screen.findByTestId('reason')).textContent).toBe(body);
    // 실패 화면에는 약속 내용도 CTA 도 없다(EC-B01·B11).
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(INVITE.title)).toBeNull();
  });

  it('E_RATE_LIMIT 은 SCR-W06 이 아니라 §2-3 문구만 띄운다', async () => {
    // 명세 어디에도 이 코드의 화면이 없다. SCR-W06 으로 보내면 "링크가 죽었다"고
    // 거짓말을 하게 된다 — 잠시 후에는 열린다.
    fetchMock.mockResolvedValue(
      fakeResponse(ERROR_HTTP_STATUS.E_RATE_LIMIT, { code: 'E_RATE_LIMIT', message: 'x' }),
    );
    renderAt();

    const message = await screen.findByTestId('retry-message');
    expect(message.textContent).toBe(ERROR_MESSAGE.E_RATE_LIMIT);
    // 화면이 통째로 바뀌는 자리라 스크린리더에는 알려 줄 것이 이 문단뿐이다.
    expect(message.getAttribute('role')).toBe('alert');
    expect(screen.queryByTestId('reason')).toBeNull();
  });

  it('네트워크가 끊기면 EC-C02 문구로 떨어진다', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderAt();
    expect((await screen.findByTestId('retry-message')).textContent).toBe(
      '처리 중 문제가 발생했습니다. 다시 시도해 주세요.',
    );
  });

  it('모르는 코드도 EC-C02 문구로 뭉갠다', async () => {
    // 서버가 500 에 싣는 `E_INTERNAL` 은 §2-3 의 14개 코드가 아니다.
    fetchMock.mockResolvedValue(fakeResponse(500, { code: 'E_INTERNAL', message: 'x' }));
    renderAt();
    expect((await screen.findByTestId('retry-message')).textContent).toBe(
      '처리 중 문제가 발생했습니다. 다시 시도해 주세요.',
    );
  });

  it('응답 전에는 로딩이고 CTA 가 없다', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt();
    expect(screen.getByTestId('loading').getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('reason')).toBeNull();
  });

  it('앞 토큰의 늦은 응답이 뒤 토큰의 화면을 덮지 않는다', async () => {
    // 취소가 없으면 A 의 응답이 나중에 도착해 B 를 덮어쓴다 — 다른 약속의 초대가
    // 열려 있는 것처럼 보이는 실패다.
    let resolveA!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => (resolveA = resolve)),
    );
    fetchMock.mockResolvedValue(fakeResponse(200, { ...INVITE, creator_nickname: '민준' }));

    const router = createMemoryRouter([{ path: ROUTE.invite, element: <ScrW01InviteLanding /> }], {
      initialEntries: [invitePath('token-a')],
    });
    render(<RouterProvider router={router} />);
    await screen.findByTestId('loading');

    await act(async () => void (await router.navigate(invitePath('token-b'))));
    expect((await screen.findByRole('heading')).textContent).toBe('민준님이 약속을 보냈어요');

    resolveA(fakeResponse(200, { ...INVITE, creator_nickname: '지우' }));
    await act(async () => {});
    expect(screen.getByRole('heading').textContent).toBe('민준님이 약속을 보냈어요');
  });

  it('화면을 떠나면 진행 중이던 요청을 취소한다', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { unmount } = render(
      <MemoryRouter initialEntries={[invitePath(TOKEN)]}>
        <Routes>
          <Route path={ROUTE.invite} element={<ScrW01InviteLanding />} />
        </Routes>
      </MemoryRouter>,
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal?.aborted).toBe(false);

    unmount();
    expect(init.signal?.aborted).toBe(true);
  });

  it('200 이어도 형태가 어긋나면 EC-C02 로 떨어진다', async () => {
    // 이름 없는 초대를 그리느니 실패를 말한다.
    fetchMock.mockResolvedValue(fakeResponse(200, { title: '러닝' }));
    renderAt();
    expect((await screen.findByTestId('retry-message')).textContent).toBe(
      '처리 중 문제가 발생했습니다. 다시 시도해 주세요.',
    );
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('카카오 CTA 가 이 초대 URL 로 되돌아오게 로그인시킨다', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, INVITE));
    renderAt();
    fireEvent.click(await screen.findByRole('button'));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}${invitePath(TOKEN)}` },
    });
    // 토큰이 왕복해야 로그인 후 SCR-W02 로 이어진다. OAuth `state` 는 supabase-js 가
    // PKCE 검증에 쓰므로 쓸 수 없다(G10).
    const [request] = signInWithOAuth.mock.calls[0] as [{ options: { redirectTo: string } }];
    const { redirectTo } = request.options;
    expect(new URL(redirectTo).pathname).toBe(invitePath(TOKEN));
  });

  it('로그인이 실패해도 CTA 는 남고 안내만 바뀐다', async () => {
    // 카카오 프로바이더가 아직 대시보드에 없어서 오늘은 이 경로가 실제로 돈다.
    signInWithOAuth.mockResolvedValue({ data: {}, error: new Error('provider not enabled') });
    fetchMock.mockResolvedValue(fakeResponse(200, INVITE));
    renderAt();
    fireEvent.click(await screen.findByRole('button'));

    // 라이브 리전은 실패 **전부터** 붙어 있어야 읽힌다. 문구와 함께 나타나면 놓친다.
    const live = screen.getByRole('alert');
    await waitFor(() =>
      expect(live.textContent).toBe('처리 중 문제가 발생했습니다. 다시 시도해 주세요.'),
    );
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('광고 슬롯이 없다', async () => {
    // CLAUDE.md §8-1 — 수락 웹 전체에 광고가 없다.
    fetchMock.mockResolvedValue(fakeResponse(200, INVITE));
    const { container } = render(
      <MemoryRouter initialEntries={[invitePath(TOKEN)]}>
        <Routes>
          <Route path={ROUTE.invite} element={<ScrW01InviteLanding />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('heading');
    // `[class*="ad"]` 로 찾으면 lf-pinky-b**ad**ge 가 걸린다. 광고가 실제로 타는 형태만 본다.
    expect(container.querySelector('ins, iframe, .lf-ad')).toBeNull();
  });
});

describe('formatRemaining', () => {
  it.each([
    [0, '00:00:00'],
    [-5000, '00:00:00'],
    [1000, '00:00:01'],
    [(71 * 3600 + 59 * 60 + 59) * 1000, '71:59:59'],
    // INVITE_TTL_HOURS = 72. 발급 직후가 상한이다.
    [72 * 3600 * 1000, '72:00:00'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatRemaining(ms)).toBe(expected);
  });

  it('남은 밀리초는 내림한다', () => {
    // 올림하면 마지막 1초가 00:00:01 에서 멈춘 것처럼 보인다.
    expect(formatRemaining(1999)).toBe('00:00:01');
  });
});
