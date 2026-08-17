// @vitest-environment jsdom
import type { WitnessDetailResponse } from '@littlefinger/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ROUTE, witnessJoinPath, witnessPath } from '../routes.ts';
import { ScrW05WitnessConfirm } from './scr-w05-witness-confirm.tsx';

const {
  getSession,
  joinWitness,
  getWitnessDetail,
  leaveWitness,
  signWitness,
  signFulfillmentEvidence,
  signInWithKakao,
} = vi.hoisted(() => ({
  getSession: vi.fn(),
  joinWitness: vi.fn(),
  getWitnessDetail: vi.fn(),
  leaveWitness: vi.fn(),
  signWitness: vi.fn(),
  signFulfillmentEvidence: vi.fn(),
  signInWithKakao: vi.fn(),
}));

vi.mock('../lib/supabase.ts', () => ({
  getSupabase: () => ({ auth: { getSession } }),
}));
vi.mock('../lib/witness-api.ts', () => ({
  joinWitness,
  getWitnessDetail,
  leaveWitness,
  signWitness,
  WitnessApiError: class WitnessApiError extends Error { authExpired = false; },
}));
vi.mock('../lib/fulfillment-api.ts', () => ({ signFulfillmentEvidence }));
vi.mock('../lib/web-auth.ts', () => ({ signInWithKakao }));

const TOKEN = 'witness_raw_token';
const PROMISE_ID = '11111111-1111-4111-8111-111111111111';
const CREATOR_ID = '22222222-2222-4222-8222-222222222222';
const PARTNER_ID = '33333333-3333-4333-8333-333333333333';
const EVIDENCE_AVAILABLE = '44444444-4444-4444-8444-444444444444';
const EVIDENCE_BLINDED = '55555555-5555-4555-8555-555555555555';
const EVIDENCE_EXPIRED = '66666666-6666-4666-8666-666666666666';

const LIMITED: WitnessDetailResponse = {
  promise_id: PROMISE_ID,
  status: 'PENDING',
  visibility: 'LIMITED',
  title: '아침 러닝',
  creator: { user_id: CREATOR_ID, nickname: '지우', profile_image_url: null },
  partner: null,
  activated_at: null,
  signed_at: null,
  content: null,
  fulfillment: null,
};

const FULL: WitnessDetailResponse = {
  ...LIMITED,
  status: 'ACTIVE',
  visibility: 'FULL',
  partner: { user_id: PARTNER_ID, nickname: '민준', profile_image_url: null },
  activated_at: '2026-08-16T09:00:00Z',
  content: {
    body: '매주 화요일과 목요일에 함께 달린다.',
    category: 'HABIT',
    end_date: '2026-09-01',
    keeper: 'BOTH',
    reward: '커피 사기',
    penalty: '설거지 일주일',
  },
};

const WITH_EVIDENCE: WitnessDetailResponse = {
  ...FULL,
  status: 'COMPLETED',
  fulfillment: {
    round_no: 1,
    claims: [{
      role: 'CREATOR',
      answer: 'KEPT',
      comment: '지켰어요.',
      submitted_at: '2026-09-01T01:00:00Z',
      evidences: [
        { evidence_id: EVIDENCE_AVAILABLE, mime: 'image/jpeg', bytes: 100, width: 10, height: 10, availability: 'AVAILABLE' },
        { evidence_id: EVIDENCE_BLINDED, mime: 'image/jpeg', bytes: 100, width: 10, height: 10, availability: 'BLINDED' },
        { evidence_id: EVIDENCE_EXPIRED, mime: 'image/jpeg', bytes: 100, width: 10, height: 10, availability: 'EXPIRED' },
      ],
    }],
  },
};

function renderAt(path: string) {
  const router = createMemoryRouter([
    { path: ROUTE.witnessJoin, element: <ScrW05WitnessConfirm /> },
    { path: ROUTE.witness, element: <ScrW05WitnessConfirm /> },
    { path: ROUTE.promises, element: <div>참여 약속</div> },
  ], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: 'jwt' } } });
  joinWitness.mockReset();
  joinWitness.mockResolvedValue({ promise_id: PROMISE_ID, participant_id: CREATOR_ID, status: 'JOINED' });
  getWitnessDetail.mockReset();
  getWitnessDetail.mockResolvedValue(LIMITED);
  leaveWitness.mockReset();
  leaveWitness.mockResolvedValue({ promise_id: PROMISE_ID, status: 'WITHDRAWN' });
  signWitness.mockReset();
  signWitness.mockResolvedValue({ promise_id: PROMISE_ID, signed_at: '2026-08-16T09:03:00Z' });
  signFulfillmentEvidence.mockReset();
  signFulfillmentEvidence.mockResolvedValue({
    evidence_id: EVIDENCE_AVAILABLE,
    variant: 'THUMBNAIL',
    signed_url: 'https://storage.example/thumb.jpg',
    expires_at: new Date(Date.now() + 600_000).toISOString(),
  });
  signInWithKakao.mockReset();
  signInWithKakao.mockResolvedValue(undefined);
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('SCR-W05 witness confirmation', () => {
  it('joins the token once and replaces it with the account route', async () => {
    const router = renderAt(witnessJoinPath(TOKEN));

    await screen.findByRole('heading', { name: '증인으로 약속을 확인해 주세요' });
    expect(joinWitness).toHaveBeenCalledWith(
      'jwt',
      TOKEN,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      expect.any(AbortSignal),
    );
    expect(router.state.location.pathname).toBe(witnessPath(PROMISE_ID));
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it('signed-out account revisit starts Kakao OAuth for the same account route', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    renderAt(witnessPath(PROMISE_ID));

    await fireEvent.click(await screen.findByRole('button', { name: '카카오 로그인하고 확인하기' }));
    expect(signInWithKakao).toHaveBeenCalledWith(witnessPath(PROMISE_ID));
  });

  it('LIMITED exposes only title, creator, and the wait message', async () => {
    renderAt(witnessPath(PROMISE_ID));

    expect(await screen.findByText('아침 러닝')).toBeTruthy();
    expect(screen.getByText('지우님의 약속')).toBeTruthy();
    expect(screen.getByText('약속이 확정되면 전체 내용을 볼 수 있습니다')).toBeTruthy();
    expect(screen.queryByText('매주 화요일과 목요일에 함께 달린다.')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByRole('button', { name: '증인 나가기' })).toBeTruthy();
  });

  it('shows the unsigned warning and keeps the LIMITED detail when canceled', async () => {
    renderAt(witnessPath(PROMISE_ID));

    await fireEvent.click(await screen.findByRole('button', { name: '증인 나가기' }));
    const dialog = screen.getByRole('dialog', { name: '증인 나가기' });
    expect(within(dialog).getByText('나가면 이 약속을 더 이상 볼 수 없습니다. 계속하시겠어요?')).toBeTruthy();
    await fireEvent.click(within(dialog).getByRole('button', { name: '계속 보기' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('아침 러닝')).toBeTruthy();
    expect(leaveWitness).not.toHaveBeenCalled();
  });

  it('FULL renders read-only content, parties, activation, and no mutation controls or ads', async () => {
    getWitnessDetail.mockResolvedValue(FULL);
    renderAt(witnessPath(PROMISE_ID));

    expect(await screen.findByText(FULL.content!.body)).toBeTruthy();
    expect(screen.getByText('지우 · 민준의 약속')).toBeTruthy();
    expect(screen.getByText('증인은 내용을 확인만 해요 — 누가 옳은지 판정하지 않아요')).toBeTruthy();
    expect(screen.getByText('2026-08-16 18:00 (KST)')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /이행|수정|변경|파기/u })).toBeNull();
    expect(screen.queryByTestId('lf-ad-slot')).toBeNull();
  });

  it('requires the checkbox, suppresses rapid repeats, and records the original server time', async () => {
    getWitnessDetail.mockResolvedValue(FULL);
    let resolveSign: ((value: { promise_id: string; signed_at: string }) => void) | undefined;
    signWitness.mockImplementation(async () => await new Promise((resolve) => { resolveSign = resolve; }));
    renderAt(witnessPath(PROMISE_ID));

    const submit = await screen.findByRole('button', { name: '내용을 확인했습니다' });
    expect(submit.closest('.lf-screen__actions--web')).not.toBeNull();
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(screen.getByRole('checkbox', { name: '약속 내용을 확인했습니다' }));
    await fireEvent.click(submit);
    await fireEvent.click(submit);
    expect(signWitness).toHaveBeenCalledTimes(1);
    await act(async () => resolveSign?.({ promise_id: PROMISE_ID, signed_at: '2026-08-16T09:03:00Z' }));

    expect(await screen.findByText('2026-08-16 18:03 (KST) 확인 서명')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '내용을 확인했습니다' })).toBeNull();
  });

  it('fences repeated leave confirmation and disables signing while leave is pending', async () => {
    getWitnessDetail.mockResolvedValue(FULL);
    let resolveLeave: ((value: { promise_id: string; status: 'WITHDRAWN' }) => void) | undefined;
    leaveWitness.mockImplementation(async () => await new Promise((resolve) => { resolveLeave = resolve; }));
    renderAt(witnessPath(PROMISE_ID));

    await fireEvent.click(await screen.findByRole('checkbox', { name: '약속 내용을 확인했습니다' }));
    await fireEvent.click(screen.getByRole('button', { name: '증인 나가기' }));
    const dialog = screen.getByRole('dialog', { name: '증인 나가기' });
    const confirm = within(dialog).getByRole('button', { name: '나가기' });
    await fireEvent.click(confirm);
    await fireEvent.click(confirm);

    expect(leaveWitness).toHaveBeenCalledTimes(1);
    expect(leaveWitness).toHaveBeenCalledWith(
      'jwt',
      PROMISE_ID,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect((screen.getByRole('button', { name: '내용을 확인했습니다' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolveLeave?.({ promise_id: PROMISE_ID, status: 'WITHDRAWN' }));

    expect(await screen.findByText('증인에서 나왔습니다.')).toBeTruthy();
    expect(screen.queryByText(FULL.content!.body)).toBeNull();
  });

  it('retains the detail and retries a failed leave with the same idempotency key', async () => {
    getWitnessDetail.mockResolvedValue(FULL);
    leaveWitness
      .mockRejectedValueOnce(new Error('잠시 후 다시 시도해 주세요.'))
      .mockResolvedValueOnce({ promise_id: PROMISE_ID, status: 'WITHDRAWN' });
    renderAt(witnessPath(PROMISE_ID));

    await fireEvent.click(await screen.findByRole('button', { name: '증인 나가기' }));
    await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '나가기' }));

    expect((await screen.findByRole('alert')).textContent).toBe('잠시 후 다시 시도해 주세요.');
    expect(screen.getByText(FULL.content!.body)).toBeTruthy();
    await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '나가기' }));

    expect(leaveWitness).toHaveBeenCalledTimes(2);
    expect(leaveWitness.mock.calls[0]?.[2]).toBe(leaveWitness.mock.calls[1]?.[2]);
    expect(await screen.findByText('증인에서 나왔습니다.')).toBeTruthy();
  });

  it('restores an existing signature without a second action', async () => {
    getWitnessDetail.mockResolvedValue({ ...FULL, signed_at: '2026-08-16T09:03:00Z' });
    renderAt(witnessPath(PROMISE_ID));

    expect(await screen.findByText('2026-08-16 18:03 (KST) 확인 서명')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '내용을 확인했습니다' })).toBeNull();
  });

  it('warns that the signature remains and returns a left witness to promises', async () => {
    getWitnessDetail.mockResolvedValue({ ...FULL, signed_at: '2026-08-16T09:03:00Z' });
    const router = renderAt(witnessPath(PROMISE_ID));

    await fireEvent.click(await screen.findByRole('button', { name: '증인 나가기' }));
    const dialog = screen.getByRole('dialog', { name: '증인 나가기' });
    expect(within(dialog).getByText('서명 기록은 지워지지 않습니다. 계속하시겠어요?')).toBeTruthy();
    await fireEvent.click(within(dialog).getByRole('button', { name: '나가기' }));
    await fireEvent.click(await screen.findByRole('button', { name: '참여 약속으로 이동' }));

    expect(router.state.location.pathname).toBe(ROUTE.promises);
  });

  it('requests only AVAILABLE evidence and preserves blind and expired placeholders', async () => {
    getWitnessDetail.mockResolvedValue(WITH_EVIDENCE);
    renderAt(witnessPath(PROMISE_ID));

    expect((await screen.findByAltText('증빙 사진')).getAttribute('src')).toBe(
      'https://storage.example/thumb.jpg',
    );
    expect(signFulfillmentEvidence).toHaveBeenCalledWith('jwt', EVIDENCE_AVAILABLE, 'THUMBNAIL');
    expect(screen.getByText('신고 접수로 가려진 이미지입니다')).toBeTruthy();
    expect(screen.getByText('보관 기간이 만료된 증빙입니다')).toBeTruthy();
    expect(signFulfillmentEvidence).toHaveBeenCalledTimes(1);
  });

  it('refreshes a thumbnail when its 600-second signed URL expires', async () => {
    vi.useFakeTimers();
    getWitnessDetail.mockResolvedValue(WITH_EVIDENCE);
    signFulfillmentEvidence
      .mockResolvedValueOnce({
        evidence_id: EVIDENCE_AVAILABLE,
        variant: 'THUMBNAIL',
        signed_url: 'https://storage.example/one.jpg',
        expires_at: new Date(Date.now() + 600_000).toISOString(),
      })
      .mockResolvedValueOnce({
        evidence_id: EVIDENCE_AVAILABLE,
        variant: 'THUMBNAIL',
        signed_url: 'https://storage.example/two.jpg',
        expires_at: new Date(Date.now() + 1_200_000).toISOString(),
      });
    renderAt(witnessPath(PROMISE_ID));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(signFulfillmentEvidence).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(600_000));

    expect(signFulfillmentEvidence).toHaveBeenCalledTimes(2);
  });
});
