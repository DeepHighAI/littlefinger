// @vitest-environment jsdom
import {
  ENDPOINT,
  ERROR_HTTP_STATUS,
  ERROR_MESSAGE,
  LEGAL_DISCLAIMER,
  WITNESS_MAX,
} from '@littlefinger/shared';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  Routes,
  RouterProvider,
  useNavigationType,
} from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { invitePath, reviewPath, ROUTE } from '../routes.ts';
import { ScrW02PromiseReview } from './scr-w02-promise-review.tsx';
import { ScrW03ApprovalComplete } from './scr-w03-approval-complete.tsx';

const { getSession, getSupabase } = vi.hoisted(() => {
  const getSession = vi.fn();
  return { getSession, getSupabase: vi.fn(() => ({ auth: { getSession } })) };
});

// `functionUrl` 은 진짜를 쓴다 — 어느 함수를 어느 주소로 부르는지가 검증 대상이다.
vi.mock('../lib/supabase.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/supabase.ts')>()),
  getSupabase,
}));

const SUPABASE_URL = 'https://test-project.supabase.co';
const TOKEN = 'a-b_c-d_e';
const ACCESS_TOKEN = 'jwt-access-token';

/** 오늘로부터 n 일 뒤의 KST 날짜. 종료일 경과(EC-B10)를 실제 시각으로 만든다. */
function kstDatePlus(days: number): string {
  const shifted = new Date(Date.now() + 9 * 3600 * 1000 + days * 24 * 3600 * 1000);
  return shifted.toISOString().slice(0, 10);
}

const PREVIEW = {
  title: '매주 화·목 아침 러닝 같이 하기',
  body: '8월 11일까지 매주 화·목 아침 7시, 반포한강공원에서 함께 러닝한다.',
  category: 'HABIT' as const,
  end_date: kstDatePlus(17),
  keeper: 'BOTH' as const,
  reward: '성공하면 오마카세 사주기',
  penalty: '한 달 커피 셔틀',
  witness_enabled: true,
  creator: { nickname: '지우', profile_image_url: null },
};

const APPROVED = {
  promise_id: '11111111-1111-4111-8111-111111111111',
  status: 'ACTIVE' as const,
  activated_at: '2026-07-12T12:04:00.000Z',
  creator_id: '22222222-2222-4222-8222-222222222222',
  title: PREVIEW.title,
  partner: { user_id: '33333333-3333-4333-8333-333333333333', nickname: '민준', profile_image_url: null },
  version_no: 1,
  fingerprint: 'A3F9-77C2-01',
  approvals: [
    { role: 'CREATOR' as const, nickname: '지우', acted_at: '2026-07-12T11:58:00.000Z' },
    { role: 'PARTNER' as const, nickname: '민준', acted_at: '2026-07-12T12:04:00.000Z' },
  ],
};

const fetchMock = vi.fn();

function fakeResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

/** 이동이 push 였는지 replace 였는지. EC-B02 는 replace 를 요구한다. */
function NavigationTypeProbe(): React.JSX.Element {
  return <span data-testid="nav-type">{useNavigationType()}</span>;
}

function renderAt(token = TOKEN): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[reviewPath(token)]}>
      <Routes>
        <Route path={ROUTE.review} element={<ScrW02PromiseReview />} />
        <Route
          path={ROUTE.approvalComplete}
          element={
            <>
              <NavigationTypeProbe />
              <ScrW03ApprovalComplete />
            </>
          }
        />
        {/* 세션이 없으면 화면은 SCR-W01 로 되돌린다. 실물 대신 자리만 둔다 — 여기서
            검증하는 것은 "어디로 보내는가"이지 랜딩이 무엇을 그리는가가 아니다. */}
        <Route path={ROUTE.invite} element={<span data-testid="landing" />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** 마지막 fetch 호출의 [url, init]. */
function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls.at(-1) as [string, RequestInit];
}

function callsTo(slug: string): unknown[] {
  return fetchMock.mock.calls.filter(([url]) => String(url).endsWith(slug));
}

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', SUPABASE_URL);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: ACCESS_TOKEN } } });
  getSupabase.mockReset();
  getSupabase.mockReturnValue({ auth: { getSession } });
});

// vitest `globals` 가 꺼져 있어 Testing Library 의 자동 cleanup 이 등록되지 않는다.
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('SCR-W02 약속 검토', () => {
  it('§4-3-4 의 표시 요소를 전부 그린다', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, PREVIEW));
    renderAt();

    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
      '지우님과의 약속, 꼼꼼히 봐주세요',
    );
    // 약속 전문 — SCR-W01 이 감췄던 것이 여기서 열린다.
    expect(screen.getByText(PREVIEW.title)).toBeTruthy();
    expect(screen.getByText(PREVIEW.body)).toBeTruthy();
    // 종료일 + D-Day. `(KST)` 는 EC-F09 의 고정 표기라 SCR-W03 과 같은 자리에 붙는다.
    expect(
      screen.getByText(new RegExp(`^${PREVIEW.end_date} \\([일월화수목금토]\\) \\(KST\\)$`)),
    ).toBeTruthy();
    expect(screen.getByTestId('dday').textContent).toBe('D-17');
    // 보상 / 벌칙 — 라벨은 '패널티'가 아니다(§7).
    expect(screen.getByText('벌칙')).toBeTruthy();
    expect(screen.getByText(PREVIEW.reward)).toBeTruthy();
    expect(screen.getByText(PREVIEW.penalty)).toBeTruthy();
    // 지킬 사람 · 카테고리 — 라벨 맵을 거친다.
    expect(screen.getByText('둘 다')).toBeTruthy();
    expect(screen.getByText('습관')).toBeTruthy();
    // 작성자 프로필
    expect(screen.getByText('작성자')).toBeTruthy();
    // 증인 사용 예정 여부. 상한은 정책 상수에서 온다.
    expect(screen.getByTestId('witness-notice').textContent).toContain(`최대 ${WITNESS_MAX}명`);
  });

  it('디스클레이머는 상수 그대로다', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, PREVIEW));
    const { container } = render(
      <MemoryRouter initialEntries={[reviewPath(TOKEN)]}>
        <Routes>
          <Route path={ROUTE.review} element={<ScrW02PromiseReview />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { level: 1 });

    // CLAUDE.md §8-2 — 4곳 중 하나. 한 글자라도 다르면 여기서 깨진다.
    const disclaimer = container.querySelector('.lf-disclaimer');
    expect(disclaimer?.textContent).toBe(LEGAL_DISCLAIMER);
  });

  it('로그인 후 함수라 액세스 토큰을 싣는다', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, PREVIEW));
    renderAt();
    await screen.findByRole('heading', { level: 1 });

    const [url, init] = lastCall();
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/${ENDPOINT.invitePreview}`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${ACCESS_TOKEN}`);
    // 토큰이 쿼리스트링에 새면 프록시·히스토리에 원문이 남는다(§13).
    expect(url).not.toContain(TOKEN);
    expect(JSON.parse(String(init.body))).toEqual({ token: TOKEN });
  });

  it('세션이 없으면 부르지도 않고 SCR-W01 로 되돌린다', async () => {
    // 이 화면에는 카카오 로그인 버튼이 없다. 문구만 띄우면 누를 것이 없는 막다른 길이다.
    getSession.mockResolvedValue({ data: { session: null } });
    renderAt();

    expect(await screen.findByTestId('landing')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('환경 변수가 없는 것은 로그아웃이 아니라 EC-C02 다', async () => {
    // `VITE_*` 누락은 배포 설정 사고다. 로그인 문제로 보고하면 멀쩡한 세션을 가진
    // 사용자에게 로그인을 요구하게 되고, 진짜 원인은 화면 어디에도 남지 않는다.
    getSupabase.mockImplementation(() => {
      throw new Error('VITE_SUPABASE_URL 이 필요하다.');
    });
    renderAt();

    expect((await screen.findByTestId('retry-message')).textContent).toBe(
      '처리 중 문제가 발생했습니다. 다시 시도해 주세요.',
    );
    expect(screen.queryByTestId('landing')).toBeNull();
  });

  it('승인 버튼만으로는 승인되지 않는다 — 확인 시트를 거친다', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, PREVIEW));
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: '승인하기' }));

    // 오수락 방지(§4-3-4 · F-03). 여기서 함수가 불리면 방어선이 없는 것이다.
    expect(callsTo(ENDPOINT.promiseApprove)).toHaveLength(0);
    const sheet = screen.getByRole('dialog');
    expect(sheet.textContent).toContain('지우님이 보낸 약속이 맞나요?');
    expect(sheet.textContent).toContain('승인하면 두 사람의 기록으로 확정돼요.');
    expect(screen.getByRole('button', { name: '네, 승인합니다' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '아니에요' })).toBeTruthy();
  });

  it('[아니에요] 는 시트를 닫고 아무것도 보내지 않는다', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, PREVIEW));
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: '승인하기' }));
    fireEvent.click(screen.getByRole('button', { name: '아니에요' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(callsTo(ENDPOINT.promiseApprove)).toHaveLength(0);
  });

  it('[네, 승인합니다] 가 승인하고 SCR-W03 으로 넘긴다', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).endsWith(ENDPOINT.promiseApprove)
          ? fakeResponse(200, APPROVED)
          : fakeResponse(200, PREVIEW),
      ),
    );
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: '승인하기' }));
    fireEvent.click(screen.getByRole('button', { name: '네, 승인합니다' }));

    // 확정 화면이 실제로 그려져야 한다 — 넘기기만 하고 state 가 비면 빈 화면이 된다.
    expect((await screen.findByTestId('fingerprint')).textContent).toBe('A3F9-77C2-01');

    const [url, init] = lastCall();
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/${ENDPOINT.promiseApprove}`);
    const headers = init.headers as Record<string, string>;
    // §7-3.6 — 상태 변경 요청은 UUID 형식의 Idempotency-Key 를 반드시 단다.
    expect(headers['Idempotency-Key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(headers['Authorization']).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  it('EC-B02 — 확정 화면으로는 replace 로 넘어간다', async () => {
    // push 로 넘기면 뒤로가기가 이미 소모된 토큰의 검토 화면으로 돌아가고,
    // 거기서 나올 수 있는 답은 E_INVITE_USED 뿐이다.
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).endsWith(ENDPOINT.promiseApprove)
          ? fakeResponse(200, APPROVED)
          : fakeResponse(200, PREVIEW),
      ),
    );
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: '승인하기' }));
    fireEvent.click(screen.getByRole('button', { name: '네, 승인합니다' }));

    expect((await screen.findByTestId('nav-type')).textContent).toBe('REPLACE');
  });

  it('SCR-W03 이 거절할 응답이면 넘기지 않는다', async () => {
    // 승인 응답의 검사가 보내는 쪽에서 더 느슨하면, 저쪽에서 걸리는 payload 가 replace 로
    // 넘어가 빈 화면이 된다. 그 시점에 초대는 USED 이고 뒤로가기도 없어서 기록 지문을
    // 다시 볼 방법이 영영 사라진다.
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).endsWith(ENDPOINT.promiseApprove)
          ? fakeResponse(200, { ...APPROVED, approvals: [APPROVED.approvals[0]] })
          : fakeResponse(200, PREVIEW),
      ),
    );
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: '승인하기' }));
    fireEvent.click(screen.getByRole('button', { name: '네, 승인합니다' }));

    expect((await screen.findByTestId('approve-error')).textContent).toBe(
      '처리 중 문제가 발생했습니다. 다시 시도해 주세요.',
    );
    expect(screen.queryByTestId('no-result')).toBeNull();
    expect(screen.queryByTestId('fingerprint')).toBeNull();
  });

  it('§7-3.6 — Idempotency-Key 는 재시도해도 같은 값이다', async () => {
    // 클릭마다 새로 만들면 두 번 눌린 승인이 서버에 **두 요청**으로 도착하고,
    // 멱등 캐시가 잡아 줄 근거가 사라진다.
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).endsWith(ENDPOINT.promiseApprove)
          ? fakeResponse(ERROR_HTTP_STATUS.E_VALIDATION, { code: 'E_VALIDATION', message: 'x' })
          : fakeResponse(200, PREVIEW),
      ),
    );
    renderAt();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      fireEvent.click(await screen.findByRole('button', { name: '승인하기' }));
      fireEvent.click(screen.getByRole('button', { name: '네, 승인합니다' }));
      await screen.findByTestId('approve-error');
    }

    const keys = (fetchMock.mock.calls as [string, RequestInit][])
      .filter(([url]) => String(url).endsWith(ENDPOINT.promiseApprove))
      .map(([, init]) => (init.headers as Record<string, string>)['Idempotency-Key']);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('토큰이 바뀌면 앞 요청의 늦은 응답이 뒤 화면을 덮지 않는다', async () => {
    // StrictMode 도 이펙트를 두 번 돌린다. 취소한 요청의 응답을 그대로 받아 그리면
    // 사용자가 **다른 약속**을 보면서 승인하게 된다.
    let resolveFirst: (value: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => (resolveFirst = resolve)),
    );
    fetchMock.mockResolvedValue(
      fakeResponse(200, { ...PREVIEW, creator: { nickname: '민준', profile_image_url: null } }),
    );

    const router = createMemoryRouter([{ path: ROUTE.review, element: <ScrW02PromiseReview /> }], {
      initialEntries: [reviewPath('token-a')],
    });
    render(<RouterProvider router={router} />);
    await screen.findByTestId('loading');

    await act(async () => void (await router.navigate(reviewPath('token-b'))));
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
      '민준님과의 약속, 꼼꼼히 봐주세요',
    );

    resolveFirst(fakeResponse(200, PREVIEW));
    await act(async () => {});
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      '민준님과의 약속, 꼼꼼히 봐주세요',
    );
  });

  it('화면을 떠나면 진행 중이던 요청을 취소한다', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { unmount } = renderAt();
    // SCR-W01 과 달리 fetch 앞에 세션 조회가 한 번 들어가서, 렌더 직후에는 아직 안 불렸다.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal?.aborted).toBe(false);
    unmount();
    expect(init.signal?.aborted).toBe(true);
  });

  it('확인 시트는 포커스를 받고 Escape 로 닫힌다', async () => {
    // 이 시트가 오수락의 유일한 방어선이다(EC-B04·S-3). 포커스가 들어가지 않으면
    // 키보드·스크린리더 사용자에게는 열린 줄 모른 채 뒤의 [승인하기]가 그대로 잡힌다.
    fetchMock.mockResolvedValue(fakeResponse(200, PREVIEW));
    renderAt();
    const approve = await screen.findByRole('button', { name: '승인하기' });
    approve.focus();
    fireEvent.click(approve);

    const sheet = screen.getByRole('dialog');
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    // 닫고 나면 포커스는 열었던 자리로 돌아간다. 안 그러면 문서 맨 앞에서 다시 시작한다.
    await waitFor(() => expect(document.activeElement).toBe(approve));
    expect(callsTo(ENDPOINT.promiseApprove)).toHaveLength(0);
  });

  it('EC-B10 — 종료일이 지났으면 승인이 잠기고 변경 요청 안내가 뜬다', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, { ...PREVIEW, end_date: kstDatePlus(-1) }));
    renderAt();

    const approve = await screen.findByRole('button', { name: '승인하기' });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    // 문구는 §4-3-4(261행)다. §10(1108행)은 다르게 적혀 있지만 서버가 §4-3-4 를 골랐다.
    expect(screen.getByTestId('end-date-passed').textContent).toBe(
      '종료일이 지난 약속은 승인할 수 없어요. 작성자에게 종료일 변경을 요청해 주세요.',
    );
    expect(screen.getByRole('button', { name: '종료일 변경 요청하기' })).toBeTruthy();
    // 잠겼는데도 눌러 보내지는 일이 없어야 한다.
    fireEvent.click(approve);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('dday').textContent).toBe('D+1');
  });

  it('EC-B10 이 승인 응답으로 와도 같은 상태가 된다', async () => {
    // 검토하는 동안 자정을 넘긴 경우다. 화면은 멀쩡했고 서버가 거절한다.
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).endsWith(ENDPOINT.promiseApprove)
          ? fakeResponse(ERROR_HTTP_STATUS.E_VALIDATION, {
              code: 'E_VALIDATION',
              field: 'end_date',
              message: '종료일이 지난 약속은 승인할 수 없어요. 작성자에게 종료일 변경을 요청해 주세요.',
              action: 'AMEND_SUGGEST',
            })
          : fakeResponse(200, PREVIEW),
      ),
    );
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: '승인하기' }));
    fireEvent.click(screen.getByRole('button', { name: '네, 승인합니다' }));

    expect((await screen.findByTestId('end-date-passed')).textContent).toBe(
      '종료일이 지난 약속은 승인할 수 없어요. 작성자에게 종료일 변경을 요청해 주세요.',
    );
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: '승인하기' }) as HTMLButtonElement).disabled,
      ).toBe(true),
    );
    expect(screen.getByRole('button', { name: '종료일 변경 요청하기' })).toBeTruthy();
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
    // 실패 화면에는 약속 내용이 없다(EC-B01·B11).
    expect(screen.queryByText(PREVIEW.title)).toBeNull();
  });

  it.each(['E_STATE_CONFLICT', 'E_FORBIDDEN', 'E_SELF_INVITE', 'E_DUPLICATE_ROLE'] as const)(
    '%s 는 SCR-W06 이 아니라 §2-3 문구를 띄운다',
    async (code) => {
      // 이 코드들에는 화면이 없다. SCR-W06 으로 보내면 "링크가 죽었다"고 거짓말하게 된다.
      fetchMock.mockResolvedValue(fakeResponse(ERROR_HTTP_STATUS[code], { code, message: 'x' }));
      renderAt();

      const message = await screen.findByTestId('retry-message');
      expect(message.textContent).toBe(ERROR_MESSAGE[code]);
      expect(message.getAttribute('role')).toBe('alert');
      expect(screen.queryByTestId('reason')).toBeNull();
    },
  );

  it('모르는 코드와 끊긴 네트워크는 EC-C02 로 뭉갠다', async () => {
    fetchMock.mockResolvedValue(fakeResponse(500, { code: 'E_INTERNAL', message: '릴레이션 promises' }));
    renderAt();
    expect((await screen.findByTestId('retry-message')).textContent).toBe(
      '처리 중 문제가 발생했습니다. 다시 시도해 주세요.',
    );

    cleanup();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderAt();
    expect((await screen.findByTestId('retry-message')).textContent).toBe(
      '처리 중 문제가 발생했습니다. 다시 시도해 주세요.',
    );
  });

  it('200 이어도 형태가 어긋나면 그리지 않는다', async () => {
    // 보상·벌칙이 빠진 채 그리면 사용자가 다른 약속을 승인하게 된다. 승인은 되돌릴 수 없다(P3).
    fetchMock.mockResolvedValue(fakeResponse(200, { title: '러닝' }));
    renderAt();
    expect((await screen.findByTestId('retry-message')).textContent).toBe(
      '처리 중 문제가 발생했습니다. 다시 시도해 주세요.',
    );
  });

  it.each([
    ['end_date', { end_date: '언젠가' }],
    ['category', { category: 'NOT_A_CATEGORY' }],
    ['keeper', { keeper: 'SOMEONE' }],
  ])('%s 가 아는 값이 아니면 그리지 않는다', async (_field, patch) => {
    // 문자열이기만 하면 통과시키면, 라벨 맵이 undefined 로 떨어져 칸이 조용히 빈다.
    // 깨진 end_date 는 더 나쁘다 — D-Day 가 NaN 이 되고 `NaN < 0` 은 false 라
    // EC-B10 게이트가 열린 채로 승인 버튼이 살아난다.
    fetchMock.mockResolvedValue(fakeResponse(200, { ...PREVIEW, ...patch }));
    renderAt();
    expect((await screen.findByTestId('retry-message')).textContent).toBe(
      '처리 중 문제가 발생했습니다. 다시 시도해 주세요.',
    );
  });

  it('보상·벌칙이 없으면 그 칸을 만들지 않는다', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, { ...PREVIEW, reward: null, penalty: null }));
    renderAt();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText('보상')).toBeNull();
    expect(screen.queryByText('벌칙')).toBeNull();
  });

  it('증인을 쓰지 않는 약속에는 증인 안내가 없다', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, { ...PREVIEW, witness_enabled: false }));
    renderAt();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByTestId('witness-notice')).toBeNull();
  });

  it('거절·수정 제안은 자리만 있고 아직 연결되지 않았다', async () => {
    // 미해결 항목 G4 — 셋이 도착할 종결 화면에 SCR-ID 도 문구도 없다. 눌려서 아무 일도
    // 일어나지 않는 것보다, 눌리지 않는 것이 정직하다.
    fetchMock.mockResolvedValue(fakeResponse(200, PREVIEW));
    renderAt();
    await screen.findByRole('heading', { level: 1 });

    for (const name of ['수정 제안', '거절하기']) {
      const button = screen.getByRole('button', { name }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(callsTo(ENDPOINT.promiseDecline)).toHaveLength(0);
    expect(callsTo(ENDPOINT.promiseAmend)).toHaveLength(0);
  });

  it('광고 슬롯이 없다', async () => {
    // CLAUDE.md §8-1 — 수락 웹 전체, 특히 승인 화면에 광고가 없다.
    fetchMock.mockResolvedValue(fakeResponse(200, PREVIEW));
    const { container } = render(
      <MemoryRouter initialEntries={[reviewPath(TOKEN)]}>
        <Routes>
          <Route path={ROUTE.review} element={<ScrW02PromiseReview />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { level: 1 });
    expect(container.querySelector('ins, iframe, .lf-ad, .lf-ad-slot')).toBeNull();
  });

  it('검토 경로는 초대 경로 아래에 있다', () => {
    // 로그인은 `/i/{token}` 으로만 돌아온다. 이 관계가 깨지면 토큰을 잃는다.
    expect(reviewPath(TOKEN)).toBe(`${invitePath(TOKEN)}/review`);
  });
});
