// @vitest-environment jsdom
import {
  ENDPOINT,
  ERROR_HTTP_STATUS,
  type ParticipantPromiseSummary,
  type PromiseFulfillmentDetailResponse,
} from '@littlefinger/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { promisesPath, ROUTE } from '../routes.ts';
import { ScrW04ParticipantPromises } from './scr-w04-participant-promises.tsx';

const ACCESS_TOKEN = 'stored-session-jwt';
const CREATOR_ID = '11111111-1111-4111-8111-111111111111';
const PARTNER_ID = '22222222-2222-4222-8222-222222222222';
const PROMISE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROMISE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PROMISE_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PROMISE_D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SUPABASE_URL = 'https://test-project.supabase.co';

const { getSession, signInWithOAuth } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock('../lib/supabase.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/supabase.ts')>();
  return {
    ...actual,
    getSupabase: () => ({ auth: { getSession, signInWithOAuth } }),
  };
});

const fetchMock = vi.fn();
const createObjectUrlMock = vi.fn();
const revokeObjectUrlMock = vi.fn();
const openWindowMock = vi.fn();

function summary(
  patch: Partial<ParticipantPromiseSummary> = {},
): ParticipantPromiseSummary {
  return {
    promise_id: PROMISE_A,
    title: '매일 함께 걷기',
    status: 'CHECKING',
    end_date: '2026-07-30',
    keeper: 'BOTH',
    updated_at: '2026-07-31T01:00:00.000Z',
    check_deadline_at: '2026-08-06T15:00:00.000Z',
    check_round_no: 1,
    needs_response: true,
    waiting_for_partner: false,
    ...patch,
  };
}

function check(role: 'CREATOR' | 'PARTNER', answer: 'KEPT' | 'NOT_KEPT', revised = false) {
  return {
    role,
    answer,
    comment: role === 'CREATOR' ? '작성자 의견' : '상대방 의견',
    submitted_at: '2026-07-31T02:00:00.000Z',
    revised_at: revised ? '2026-07-31T03:00:00.000Z' : null,
    round_no: 1,
    evidences: [],
  };
}

function evidence(
  evidenceId: string,
  availability: 'AVAILABLE' | 'BLINDED' | 'EXPIRED' = 'AVAILABLE',
) {
  return {
    evidence_id: evidenceId,
    mime: 'image/jpeg' as const,
    bytes: 100,
    width: 100,
    height: 50,
    availability,
  };
}

function detail(
  patch: Partial<PromiseFulfillmentDetailResponse> = {},
): PromiseFulfillmentDetailResponse {
  return {
    promise_id: PROMISE_A,
    title: '매일 함께 걷기',
    body: '저녁 식사 뒤 30분 걷기',
    category: 'HABIT',
    end_date: '2026-07-30',
    keeper: 'BOTH',
    reward: null,
    penalty: null,
    status: 'CHECKING',
    checking_started_at: '2026-07-30T15:00:00.000Z',
    check_deadline_at: '2026-08-06T15:00:00.000Z',
    check_round_no: 1,
    creator: { user_id: CREATOR_ID, nickname: '지우', profile_image_url: null },
    partner: { user_id: PARTNER_ID, nickname: '민준', profile_image_url: null },
    my_role: 'PARTNER',
    my_check: null,
    creator_has_submitted: false,
    partner_has_submitted: false,
    partner_check: null,
    history: [],
    ...patch,
  };
}

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function endpointOf(url: unknown): string {
  return String(url).split('/').at(-1) ?? '';
}

function mutationKeys(endpoint: string): string[] {
  return fetchMock.mock.calls
    .filter(([url]) => endpointOf(url) === endpoint)
    .map(([, init]) => {
      const headers = (init as RequestInit).headers as Record<string, string>;
      return headers['Idempotency-Key'] ?? '';
    });
}

function installServer(
  list: ParticipantPromiseSummary[],
  details: Record<string, PromiseFulfillmentDetailResponse>,
): void {
  fetchMock.mockImplementation((url: string, init: RequestInit) => {
    const endpoint = endpointOf(url);
    const body =
      init.body instanceof FormData
        ? Object.fromEntries(init.body.entries())
        : (JSON.parse(String(init.body)) as Record<string, unknown>);
    if (endpoint === ENDPOINT.participantPromiseList) return Promise.resolve(response(200, list));
    if (endpoint === ENDPOINT.promiseFulfillmentDetail) {
      return Promise.resolve(response(200, details[String(body['promise_id'])]));
    }
    if (endpoint === ENDPOINT.fulfillmentSubmit) {
      return Promise.resolve(
        response(200, {
          promise_id: body['promise_id'],
          status: 'CHECKING',
          round_no: 1,
          submitted_at: '2026-07-31T02:00:00.000Z',
          revised_at: body['revise'] === true ? '2026-07-31T03:00:00.000Z' : null,
          waiting_for_partner: true,
          title: '매일 함께 걷기',
          actor_nickname: '민준',
          notification_recipients: [],
        }),
      );
    }
    if (endpoint === ENDPOINT.fulfillmentReopen) {
      return Promise.resolve(
        response(200, {
          promise_id: body['promise_id'],
          status: 'CHECKING',
          round_no: 2,
          check_deadline_at: '2026-08-13T15:00:00.000Z',
          title: '매일 함께 걷기',
          notification_recipients: [],
        }),
      );
    }
    if (endpoint === ENDPOINT.evidenceUpload) {
      const file = body['file'] as File;
      return Promise.resolve(
        response(200, {
          upload_id: `upload-${file.name}`,
          status: 'READY',
          mime: 'image/jpeg',
          bytes: file.size,
          width: 100,
          height: 50,
        }),
      );
    }
    if (endpoint === ENDPOINT.evidenceDiscard) {
      return Promise.resolve(
        response(200, {
          upload_id: body['upload_id'],
          status: 'DISCARDED',
        }),
      );
    }
    if (endpoint === ENDPOINT.evidenceSignUrl) {
      return Promise.resolve(
        response(200, {
          evidence_id: body['evidence_id'],
          variant: body['variant'],
          signed_url: `https://storage.example/${String(body['evidence_id'])}/${String(body['variant'])}`,
          expires_at: '2026-08-12T01:10:00Z',
        }),
      );
    }
    return Promise.resolve(response(500, {}));
  });
}

function renderAt(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[promisesPath()]}>
      <Routes>
        <Route path={ROUTE.promises} element={<ScrW04ParticipantPromises />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', SUPABASE_URL);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  getSession.mockReset();
  signInWithOAuth.mockReset();
  createObjectUrlMock.mockReset();
  revokeObjectUrlMock.mockReset();
  openWindowMock.mockReset();
  createObjectUrlMock.mockImplementation(
    (file: File) => `blob:${file.name}`,
  );
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectUrlMock,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectUrlMock,
  });
  Object.defineProperty(window, 'open', {
    configurable: true,
    value: openWindowMock,
  });
  sessionStorage.clear();
  getSession.mockResolvedValue({
    data: { session: { access_token: ACCESS_TOKEN, user: { id: PARTNER_ID } } },
  });
  signInWithOAuth.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('SCR-W04 참여 약속', () => {
  it('세션이 없으면 /promises로 돌아오는 카카오 로그인 CTA를 보여준다', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    renderAt();

    fireEvent.click(await screen.findByRole('button', { name: '카카오 로그인' }));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/promises` },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('저장된 세션으로 직접 방문·새로고침해 서버 목록을 복원하고 정렬한다', async () => {
    const rows = [
      summary({
        promise_id: PROMISE_B,
        title: '응답 없는 약속',
        needs_response: false,
        check_deadline_at: '2026-08-01T15:00:00.000Z',
        updated_at: '2026-07-31T04:00:00.000Z',
      }),
      summary({
        promise_id: PROMISE_A,
        title: '같은 기한의 오래된 약속',
        needs_response: true,
        check_deadline_at: '2026-08-05T15:00:00.000Z',
      }),
      summary({
        promise_id: PROMISE_C,
        title: '가장 가까운 기한',
        needs_response: true,
        check_deadline_at: '2026-08-03T15:00:00.000Z',
      }),
      summary({
        promise_id: PROMISE_D,
        title: '같은 기한의 최근 약속',
        needs_response: true,
        check_deadline_at: '2026-08-05T15:00:00.000Z',
        updated_at: '2026-07-31T05:00:00.000Z',
      }),
    ];
    installServer(rows, {
      [PROMISE_A]: detail({ title: '같은 기한의 오래된 약속' }),
      [PROMISE_B]: detail({
        promise_id: PROMISE_B,
        title: '응답 없는 약속',
        my_check: check('PARTNER', 'KEPT'),
        partner_has_submitted: false,
      }),
      [PROMISE_C]: detail({
        promise_id: PROMISE_C,
        title: '가장 가까운 기한',
      }),
      [PROMISE_D]: detail({
        promise_id: PROMISE_D,
        title: '같은 기한의 최근 약속',
      }),
    });
    const { container } = renderAt();

    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
      '참여 중인 약속',
    );
    expect(screen.getByText('응답이 필요해요 · 3건')).toBeTruthy();
    expect(
      Array.from(container.querySelectorAll('[data-testid="promise-card-title"]')).map(
        (node) => node.textContent,
      ),
    ).toEqual([
      '가장 가까운 기한',
      '같은 기한의 최근 약속',
      '같은 기한의 오래된 약속',
      '응답 없는 약속',
    ]);
  });

  it('내가 미응답이면 상대 응답 내용은 숨기고 제출한다', async () => {
    installServer(
      [summary()],
      {
        [PROMISE_A]: detail({
          creator_has_submitted: true,
          partner_check: null,
        }),
      },
    );
    renderAt();

    expect(await screen.findByText('상대방이 먼저 응답했어요')).toBeTruthy();
    expect(screen.getByText('내 응답 전')).toBeTruthy();
    expect(screen.queryByText('상대방 의견')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '지켰어요' }));
    fireEvent.change(screen.getByLabelText('한 줄 의견'), {
      target: { value: '함께 잘 지켰어요' },
    });
    fireEvent.click(screen.getByRole('button', { name: '응답 제출' }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => endpointOf(url) === ENDPOINT.fulfillmentSubmit),
      ).toBe(true),
    );
    const submit = fetchMock.mock.calls.find(
      ([url]) => endpointOf(url) === ENDPOINT.fulfillmentSubmit,
    ) as [string, RequestInit];
    expect(JSON.parse(String(submit[1].body))).toEqual({
      promise_id: PROMISE_A,
      answer: 'KEPT',
      comment: '함께 잘 지켰어요',
    });
  });

  it('한 줄 의견은 정규화 뒤 코드포인트 200자까지만 제출한다', async () => {
    installServer([summary()], { [PROMISE_A]: detail() });
    renderAt();
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('button', { name: '지켰어요' }));
    const comment = screen.getByLabelText('한 줄 의견');

    fireEvent.change(comment, { target: { value: '가'.repeat(201) } });
    expect((screen.getByRole('button', { name: '응답 제출' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      '의견은 200자 이하로 입력해 주세요.',
    );

    fireEvent.change(comment, { target: { value: '가'.repeat(200) } });
    expect((screen.getByRole('button', { name: '응답 제출' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('대기 중이면 내 응답만 보여 주고 수정은 한 번만 허용한다', async () => {
    installServer(
      [summary({ needs_response: false, waiting_for_partner: true })],
      {
        [PROMISE_A]: detail({
          my_check: check('PARTNER', 'KEPT'),
          partner_has_submitted: false,
        }),
      },
    );
    renderAt();

    expect(await screen.findByText('내 응답: 지켰어요')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '응답 수정' }));
    fireEvent.click(screen.getByRole('button', { name: '안 지켜졌어요' }));
    fireEvent.click(screen.getByRole('button', { name: '수정 제출' }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          if (endpointOf(url) !== ENDPOINT.fulfillmentSubmit) return false;
          return (JSON.parse(String(init.body)) as { revise?: boolean }).revise === true;
        }),
      ).toBe(true),
    );
  });

  it('이미 수정한 응답에는 수정 액션이 없다', async () => {
    installServer(
      [summary({ needs_response: false, waiting_for_partner: true })],
      {
        [PROMISE_A]: detail({
          my_check: check('PARTNER', 'KEPT', true),
          partner_has_submitted: false,
        }),
      },
    );
    renderAt();

    expect(await screen.findByText('내 응답: 지켰어요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '응답 수정' })).toBeNull();
  });

  it('상태 충돌이면 목록과 상세를 다시 읽는다', async () => {
    const creator = check('CREATOR', 'KEPT');
    const partner = check('PARTNER', 'KEPT');
    let submitSeen = false;
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      const endpoint = endpointOf(url);
      if (endpoint === ENDPOINT.participantPromiseList) {
        return Promise.resolve(
          response(200, [
            submitSeen
              ? summary({
                  status: 'COMPLETED',
                  needs_response: false,
                  check_deadline_at: null,
                })
              : summary(),
          ]),
        );
      }
      if (endpoint === ENDPOINT.promiseFulfillmentDetail) {
        return Promise.resolve(
          response(
            200,
            submitSeen
              ? detail({
                  status: 'COMPLETED',
                  my_check: partner,
                  partner_has_submitted: true,
                  partner_check: creator,
                })
              : detail(),
          ),
        );
      }
      if (endpoint === ENDPOINT.fulfillmentSubmit) {
        submitSeen = true;
        return Promise.resolve(
          response(ERROR_HTTP_STATUS.E_STATE_CONFLICT, {
            code: 'E_STATE_CONFLICT',
            message: '상태가 바뀌었어요.',
          }),
        );
      }
      return Promise.resolve(response(500, {}));
    });
    renderAt();
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('button', { name: '지켰어요' }));
    fireEvent.click(screen.getByRole('button', { name: '응답 제출' }));

    await waitFor(() => expect(submitSeen).toBe(true));
    await waitFor(
      () =>
        expect(
          fetchMock.mock.calls.filter(
            ([url]) => endpointOf(url) === ENDPOINT.participantPromiseList,
          ),
        ).toHaveLength(2),
    );
    expect(await screen.findByText('완료')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '응답 제출' })).toBeNull();
  });

  it('제출 응답 유실 뒤 같은 intent 재시도는 같은 멱등 키를 쓴다', async () => {
    let submitAttempts = 0;
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      const endpoint = endpointOf(url);
      if (endpoint === ENDPOINT.participantPromiseList) {
        return Promise.resolve(response(200, [summary()]));
      }
      if (endpoint === ENDPOINT.promiseFulfillmentDetail) {
        return Promise.resolve(response(200, detail()));
      }
      if (endpoint === ENDPOINT.fulfillmentSubmit) {
        submitAttempts += 1;
        return submitAttempts === 1
          ? Promise.reject(new TypeError('response lost'))
          : Promise.resolve(
              response(200, {
                promise_id: PROMISE_A,
                status: 'CHECKING',
                round_no: 1,
                submitted_at: '2026-07-31T02:00:00.000Z',
                revised_at: null,
                waiting_for_partner: true,
                title: '매일 함께 걷기',
                actor_nickname: '민준',
                notification_recipients: [],
              }),
            );
      }
      return Promise.resolve(response(500, {}));
    });
    renderAt();

    await screen.findByRole('button', { name: '지켰어요' });
    fireEvent.click(screen.getByRole('button', { name: '지켰어요' }));
    fireEvent.change(screen.getByLabelText('한 줄 의견'), {
      target: { value: '완료했어요' },
    });
    fireEvent.click(screen.getByRole('button', { name: '응답 제출' }));
    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    await screen.findByRole('button', { name: '응답 제출' });
    fireEvent.click(screen.getByRole('button', { name: '응답 제출' }));

    await waitFor(() => expect(mutationKeys(ENDPOINT.fulfillmentSubmit)).toHaveLength(2));
    const keys = mutationKeys(ENDPOINT.fulfillmentSubmit);
    expect(keys[0]).toBe(keys[1]);
  });

  it.each([
    [
      'answer',
      () => fireEvent.click(screen.getByRole('button', { name: '안 지켜졌어요' })),
    ],
    [
      'comment',
      () =>
        fireEvent.change(screen.getByLabelText('한 줄 의견'), {
          target: { value: '바뀐 의견' },
        }),
    ],
  ])('%s만 바뀐 제출 intent는 새 키를 쓴다', async (_field, changeIntent) => {
    fetchMock.mockImplementation((url: string) => {
      const endpoint = endpointOf(url);
      if (endpoint === ENDPOINT.participantPromiseList) {
        return Promise.resolve(response(200, [summary()]));
      }
      if (endpoint === ENDPOINT.promiseFulfillmentDetail) {
        return Promise.resolve(response(200, detail()));
      }
      if (endpoint === ENDPOINT.fulfillmentSubmit) {
        return Promise.reject(new TypeError('response lost'));
      }
      return Promise.resolve(response(500, {}));
    });
    renderAt();

    await screen.findByRole('button', { name: '지켰어요' });
    fireEvent.click(screen.getByRole('button', { name: '지켰어요' }));
    fireEvent.change(screen.getByLabelText('한 줄 의견'), {
      target: { value: '같은 의견' },
    });
    fireEvent.click(screen.getByRole('button', { name: '응답 제출' }));
    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    await screen.findByRole('button', { name: '응답 제출' });
    changeIntent();
    fireEvent.click(screen.getByRole('button', { name: '응답 제출' }));

    await waitFor(() => expect(mutationKeys(ENDPOINT.fulfillmentSubmit)).toHaveLength(2));
    const keys = mutationKeys(ENDPOINT.fulfillmentSubmit);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('revise만 바뀐 제출 intent는 새 키를 쓴다', async () => {
    let detailAfterRetry = false;
    fetchMock.mockImplementation((url: string) => {
      const endpoint = endpointOf(url);
      if (endpoint === ENDPOINT.participantPromiseList) {
        return Promise.resolve(
          response(200, [
            summary({ needs_response: !detailAfterRetry, waiting_for_partner: detailAfterRetry }),
          ]),
        );
      }
      if (endpoint === ENDPOINT.promiseFulfillmentDetail) {
        return Promise.resolve(
          response(
            200,
            detailAfterRetry
              ? detail({
                  my_check: check('PARTNER', 'KEPT'),
                  partner_has_submitted: false,
                })
              : detail(),
          ),
        );
      }
      if (endpoint === ENDPOINT.fulfillmentSubmit) {
        detailAfterRetry = true;
        return Promise.reject(new TypeError('response lost'));
      }
      return Promise.resolve(response(500, {}));
    });
    renderAt();

    await screen.findByRole('button', { name: '지켰어요' });
    fireEvent.click(screen.getByRole('button', { name: '지켰어요' }));
    fireEvent.change(screen.getByLabelText('한 줄 의견'), {
      target: { value: '상대방 의견' },
    });
    fireEvent.click(screen.getByRole('button', { name: '응답 제출' }));
    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));

    fireEvent.click(await screen.findByRole('button', { name: '응답 수정' }));
    fireEvent.click(screen.getByRole('button', { name: '수정 제출' }));

    await waitFor(() => expect(mutationKeys(ENDPOINT.fulfillmentSubmit)).toHaveLength(2));
    const keys = mutationKeys(ENDPOINT.fulfillmentSubmit);
    expect(keys[0]).not.toBe(keys[1]);
    const bodies = fetchMock.mock.calls
      .filter(([url]) => endpointOf(url) === ENDPOINT.fulfillmentSubmit)
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    expect(bodies).toEqual([
      { promise_id: PROMISE_A, answer: 'KEPT', comment: '상대방 의견' },
      {
        promise_id: PROMISE_A,
        answer: 'KEPT',
        comment: '상대방 의견',
        revise: true,
      },
    ]);
  });

  it('다중 파일을 검증·선업로드하고 성공한 upload_id만 세션 초안과 제출에 보낸다', async () => {
    installServer([summary()], { [PROMISE_A]: detail() });
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: '지켰어요' }));

    const first = new File(['first'], 'first.jpg', { type: 'image/jpeg' });
    const second = new File(['second'], 'second.webp', { type: 'image/webp' });
    const invalid = new File(['text'], 'note.txt', { type: 'text/plain' });
    const tooLarge = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      'large.png',
      { type: 'image/png' },
    );
    fireEvent.change(screen.getByLabelText('증빙 사진 선택'), {
      target: { files: [first, second, invalid, tooLarge] },
    });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(
          ([url]) => endpointOf(url) === ENDPOINT.evidenceUpload,
        ),
      ).toHaveLength(2);
    });
    expect(screen.getByText('JPEG, PNG, WEBP, HEIC 사진만 올릴 수 있어요.')).toBeTruthy();
    expect(screen.getByText('사진은 장당 5MB까지 올릴 수 있어요.')).toBeTruthy();
    expect(screen.getAllByText('업로드 완료')).toHaveLength(2);

    const storageKey = `lf.fulfillment-evidence-draft.${PARTNER_ID}.${PROMISE_A}.1`;
    expect(JSON.parse(sessionStorage.getItem(storageKey) ?? 'null')).toEqual({
      answer: 'KEPT',
      comment: '',
      evidence_upload_ids: ['upload-first.jpg', 'upload-second.webp'],
    });

    fireEvent.click(screen.getByRole('button', { name: '응답 제출' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) => endpointOf(url) === ENDPOINT.fulfillmentSubmit,
        ),
      ).toBe(true),
    );
    const submitCall = fetchMock.mock.calls.find(
      ([url]) => endpointOf(url) === ENDPOINT.fulfillmentSubmit,
    ) as [string, RequestInit];
    expect(JSON.parse(String(submitCall[1].body))).toMatchObject({
      evidence_upload_ids: ['upload-first.jpg', 'upload-second.webp'],
    });
    expect(sessionStorage.getItem(storageKey)).toBeNull();
  });

  it('브라우저가 MIME을 비워도 HEIC 확장자를 선업로드한다', async () => {
    installServer([summary()], { [PROMISE_A]: detail() });
    renderAt();
    await screen.findByText('매일 함께 걷기');

    const file = new File(['heic'], 'camera.heic', { type: '' });
    fireEvent.change(screen.getByLabelText('증빙 사진 선택'), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) => endpointOf(url) === ENDPOINT.evidenceUpload,
        ),
      ).toBe(true),
    );
    expect(await screen.findByText('업로드 완료')).toBeTruthy();
  });

  it('부분 실패 뒤 같은 업로드 키로 재시도하고 READY 제거·unmount에서 object URL을 정리한다', async () => {
    installServer([summary()], { [PROMISE_A]: detail() });
    const server = fetchMock.getMockImplementation();
    let uploadAttempts = 0;
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      if (endpointOf(url) === ENDPOINT.evidenceUpload) {
        uploadAttempts += 1;
        if (uploadAttempts === 1) return Promise.reject(new TypeError('network'));
      }
      return server?.(url, init);
    });
    const view = renderAt();
    await screen.findByText('매일 함께 걷기');

    const file = new File(['retry'], 'retry.heic', { type: 'image/heic' });
    fireEvent.change(screen.getByLabelText('증빙 사진 선택'), {
      target: { files: [file] },
    });
    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    await screen.findByText('업로드 완료');

    const uploadKeys = mutationKeys(ENDPOINT.evidenceUpload);
    expect(uploadKeys).toHaveLength(2);
    expect(uploadKeys[1]).toBe(uploadKeys[0]);

    fireEvent.click(screen.getByRole('button', { name: 'retry.heic 삭제' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) => endpointOf(url) === ENDPOINT.evidenceDiscard,
        ),
      ).toBe(true),
    );
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:retry.heic');

    const remaining = new File(['remaining'], 'remaining.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(screen.getByLabelText('증빙 사진 선택'), {
      target: { files: [remaining] },
    });
    await screen.findByAltText('remaining.jpg 미리보기');
    view.unmount();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:remaining.jpg');
  });

  it('sessionStorage 초안은 파일 원문·서명 URL 없이 답변·의견·READY upload_id만 복원한다', async () => {
    const storageKey = `lf.fulfillment-evidence-draft.${PARTNER_ID}.${PROMISE_A}.1`;
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        answer: 'NOT_KEPT',
        comment: '새로고침 뒤 복원',
        evidence_upload_ids: ['upload-restored'],
      }),
    );
    installServer([summary()], { [PROMISE_A]: detail() });
    renderAt();

    expect(
      (await screen.findByRole('button', { name: '안 지켜졌어요' })).getAttribute(
        'aria-pressed',
      ),
    ).toBe('true');
    expect((screen.getByLabelText('한 줄 의견') as HTMLTextAreaElement).value).toBe(
      '새로고침 뒤 복원',
    );
    expect(screen.getByText('업로드 완료')).toBeTruthy();
    expect(sessionStorage.getItem(storageKey)).not.toContain('blob:');
    expect(sessionStorage.getItem(storageKey)).not.toContain('https://');
  });

  it('정정은 기존 증빙 유지·제거와 새 업로드를 결합한다', async () => {
    const mine = {
      ...check('PARTNER', 'KEPT'),
      evidences: [evidence('evidence-1'), evidence('evidence-2')],
    };
    installServer([summary({ needs_response: false })], {
      [PROMISE_A]: detail({
        my_check: mine,
        partner_has_submitted: true,
      }),
    });
    renderAt();

    fireEvent.click(await screen.findByRole('button', { name: '응답 수정' }));
    fireEvent.click(screen.getByRole('button', { name: 'evidence-1 삭제' }));
    fireEvent.change(screen.getByLabelText('증빙 사진 선택'), {
      target: {
        files: [new File(['new'], 'new.png', { type: 'image/png' })],
      },
    });
    await screen.findByText('업로드 완료');
    fireEvent.click(screen.getByRole('button', { name: '수정 제출' }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) => endpointOf(url) === ENDPOINT.fulfillmentSubmit,
        ),
      ).toBe(true),
    );
    const submitCall = fetchMock.mock.calls.find(
      ([url]) => endpointOf(url) === ENDPOINT.fulfillmentSubmit,
    ) as [string, RequestInit];
    expect(JSON.parse(String(submitCall[1].body))).toMatchObject({
      revise: true,
      retained_evidence_ids: ['evidence-2'],
      evidence_upload_ids: ['upload-new.png'],
    });
  });

  it('결과와 과거 라운드는 10분 서명 URL·블라인드·만료 증빙을 함께 보여준다', async () => {
    const creator = {
      ...check('CREATOR', 'KEPT'),
      evidences: [
        evidence('evidence-available'),
        evidence('evidence-blinded', 'BLINDED'),
        evidence('evidence-expired', 'EXPIRED'),
      ],
    };
    const partner = check('PARTNER', 'KEPT');
    installServer(
      [summary({ status: 'COMPLETED', needs_response: false, check_deadline_at: null })],
      {
        [PROMISE_A]: detail({
          status: 'COMPLETED',
          my_check: partner,
          partner_has_submitted: true,
          partner_check: creator,
          history: [
            {
              round_no: 1,
              creator_check: creator,
              partner_check: partner,
            },
          ],
        }),
      },
    );
    renderAt();

    const [image] = await screen.findAllByAltText('evidence-available 증빙');
    if (image === undefined) throw new Error('증빙 이미지가 없다.');
    expect(screen.getAllByText('신고 접수로 가려진 이미지입니다')).toHaveLength(2);
    expect(screen.getAllByText('보관 기간이 만료된 증빙입니다')).toHaveLength(2);
    fireEvent.error(image);
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'evidence-available 증빙 열기',
      })[0] as HTMLElement,
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([url]) => endpointOf(url) === ENDPOINT.evidenceSignUrl,
        ).length,
      ).toBeGreaterThanOrEqual(3),
    );
    await waitFor(() =>
      expect(openWindowMock).toHaveBeenCalledWith(
        'https://storage.example/evidence-available/FULL',
        '_blank',
        'noopener,noreferrer',
      ),
    );
  });

  it('DISPUTED는 양측을 같은 구조로, 중립 문구와 기록 및 재확인 액션으로 그린다', async () => {
    const creator = check('CREATOR', 'KEPT');
    const partner = check('PARTNER', 'NOT_KEPT');
    installServer(
      [summary({ status: 'DISPUTED', needs_response: false, check_deadline_at: null })],
      {
        [PROMISE_A]: detail({
          status: 'DISPUTED',
          my_check: partner,
          partner_has_submitted: true,
          partner_check: creator,
          history: [{ round_no: 1, creator_check: creator, partner_check: partner }],
        }),
      },
    );
    const { container } = renderAt();

    expect(await screen.findByText('두 분의 확인이 서로 달라요. 대화로 다시 정해보세요.')).toBeTruthy();
    const claims = container.querySelector('.lf-stack > .lf-claims')?.querySelectorAll('.lf-claim');
    expect(claims).toBeTruthy();
    if (!claims) throw new Error('현재 라운드 주장 영역이 없다.');
    expect(claims).toHaveLength(2);
    expect(claims[0]?.className).toBe(claims[1]?.className);
    expect(claims[0]?.textContent).toContain('작성자');
    expect(claims[1]?.textContent).toContain('상대방');
    expect(screen.getByText('1차 확인 기록')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '다시 확인 요청하기' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => endpointOf(url) === ENDPOINT.fulfillmentReopen),
      ).toBe(true),
    );
  });

  it('재확인 응답 유실은 같은 round에서 같은 키를 쓰고 round 변경 뒤에는 새 키를 쓴다', async () => {
    const creator = check('CREATOR', 'KEPT');
    const partner = check('PARTNER', 'NOT_KEPT');
    let roundNo = 1;
    let reopenAttempts = 0;
    const disputedDetail = (): PromiseFulfillmentDetailResponse =>
      detail({
        status: 'DISPUTED',
        check_round_no: roundNo,
        my_check: { ...partner, round_no: roundNo },
        partner_has_submitted: true,
        partner_check: { ...creator, round_no: roundNo },
        history: [
          {
            round_no: roundNo,
            creator_check: { ...creator, round_no: roundNo },
            partner_check: { ...partner, round_no: roundNo },
          },
        ],
      });
    fetchMock.mockImplementation((url: string) => {
      const endpoint = endpointOf(url);
      if (endpoint === ENDPOINT.participantPromiseList) {
        return Promise.resolve(
          response(200, [
            summary({
              status: 'DISPUTED',
              check_round_no: roundNo,
              needs_response: false,
              check_deadline_at: null,
            }),
          ]),
        );
      }
      if (endpoint === ENDPOINT.promiseFulfillmentDetail) {
        return Promise.resolve(response(200, disputedDetail()));
      }
      if (endpoint === ENDPOINT.fulfillmentReopen) {
        reopenAttempts += 1;
        if (reopenAttempts === 2) roundNo = 2;
        return Promise.reject(new TypeError('response lost'));
      }
      return Promise.resolve(response(500, {}));
    });
    renderAt();

    fireEvent.click(await screen.findByRole('button', { name: '다시 확인 요청하기' }));
    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    fireEvent.click(await screen.findByRole('button', { name: '다시 확인 요청하기' }));
    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    fireEvent.click(await screen.findByRole('button', { name: '다시 확인 요청하기' }));

    await waitFor(() => expect(mutationKeys(ENDPOINT.fulfillmentReopen)).toHaveLength(3));
    const keys = mutationKeys(ENDPOINT.fulfillmentReopen);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it('UNRESOLVED는 응답자와 미응답자 사실만 말한다', async () => {
    installServer(
      [summary({ status: 'UNRESOLVED', needs_response: false, check_deadline_at: null })],
      {
        [PROMISE_A]: detail({
          status: 'UNRESOLVED',
          my_check: check('PARTNER', 'KEPT'),
          partner_has_submitted: true,
        }),
      },
    );
    renderAt();

    expect(await screen.findByText('작성자 미응답')).toBeTruthy();
    expect(screen.getByText('상대방 응답 완료')).toBeTruthy();
    expect(screen.queryByText(/잘못|책임|귀책/u)).toBeNull();
  });

  it('UNRESOLVED 미응답 상대방에게 숨긴 작성자 답변 대신 제출 사실을 보여준다', async () => {
    installServer(
      [summary({ status: 'UNRESOLVED', needs_response: false, check_deadline_at: null })],
      {
        [PROMISE_A]: detail({
          status: 'UNRESOLVED',
          my_role: 'PARTNER',
          my_check: null,
          creator_has_submitted: true,
          partner_has_submitted: false,
          partner_check: null,
        }),
      },
    );
    renderAt();

    expect(await screen.findByText('작성자 응답 완료')).toBeTruthy();
    expect(screen.getByText('상대방 미응답')).toBeTruthy();
    expect(screen.queryByText('작성자 의견')).toBeNull();
  });

  it('COMPLETED와 BROKEN은 양측 주장을 같은 구조로 보여준다', async () => {
    const creator = check('CREATOR', 'KEPT');
    const partner = check('PARTNER', 'KEPT');
    const rows = [
      summary({
        promise_id: PROMISE_A,
        status: 'COMPLETED',
        needs_response: false,
        check_deadline_at: null,
      }),
      summary({
        promise_id: PROMISE_B,
        title: '불이행 약속',
        status: 'BROKEN',
        needs_response: false,
        check_deadline_at: null,
      }),
    ];
    installServer(rows, {
      [PROMISE_A]: detail({
        status: 'COMPLETED',
        my_check: partner,
        partner_has_submitted: true,
        partner_check: creator,
      }),
      [PROMISE_B]: detail({
        promise_id: PROMISE_B,
        title: '불이행 약속',
        status: 'BROKEN',
        my_check: { ...partner, answer: 'NOT_KEPT' },
        partner_has_submitted: true,
        partner_check: { ...creator, answer: 'NOT_KEPT' },
      }),
    });
    const { container } = renderAt();

    await screen.findByText('불이행 약속');
    const claimGroups = container.querySelectorAll('article > .lf-mt-4 > .lf-claims');
    expect(claimGroups).toHaveLength(2);
    expect(claimGroups[0]?.querySelectorAll('.lf-claim')).toHaveLength(2);
    expect(claimGroups[1]?.querySelectorAll('.lf-claim')).toHaveLength(2);
  });

  it('ACTIVE와 AMEND_PENDING는 읽기 전용이고 F-11 버튼이 없다', async () => {
    const rows = [
      summary({
        promise_id: PROMISE_A,
        status: 'ACTIVE',
        needs_response: false,
        check_deadline_at: null,
      }),
      summary({
        promise_id: PROMISE_B,
        title: '변경 중인 약속',
        status: 'AMEND_PENDING',
        needs_response: false,
        check_deadline_at: null,
      }),
    ];
    installServer(rows, {
      [PROMISE_A]: detail({ status: 'ACTIVE' }),
      [PROMISE_B]: detail({
        promise_id: PROMISE_B,
        title: '변경 중인 약속',
        status: 'AMEND_PENDING',
      }),
    });
    renderAt();

    expect(await screen.findByText('변경 협의 중')).toBeTruthy();
    for (const forbidden of ['변경 승인', '거절', '변경 요청', '파기 요청']) {
      expect(screen.queryByRole('button', { name: forbidden })).toBeNull();
    }
  });

  it('세션 만료 응답은 /promises 복귀 로그인 CTA로 회복한다', async () => {
    fetchMock.mockResolvedValue(response(401, { message: 'Invalid JWT' }));
    renderAt();

    fireEvent.click(await screen.findByRole('button', { name: '카카오 로그인' }));
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(signInWithOAuth.mock.calls[0]?.[0].options.redirectTo).toBe(
      `${window.location.origin}/promises`,
    );
  });

  it('빈 목록·오류 재시도·광고와 증빙 부재를 각각 보여준다', async () => {
    installServer([], {});
    const first = renderAt();
    expect(await screen.findByText('참여 중인 약속이 아직 없어요')).toBeTruthy();
    expect(first.container.querySelector('ins, iframe, .lf-ad, .lf-ad-slot')).toBeNull();
    expect(screen.queryByText(/증빙|사진/u)).toBeNull();

    cleanup();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(response(500, { code: 'E_INTERNAL', message: 'table leak' }));
    renderAt();
    expect((await screen.findByRole('alert')).textContent).toBe(
      '처리 중 문제가 발생했습니다. 다시 시도해 주세요.',
    );
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
  });
});
