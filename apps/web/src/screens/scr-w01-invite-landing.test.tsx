// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://littlefinger-app.web.app"}
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ScrW01InviteLanding } from './scr-w01-invite-landing.tsx';
const fetchMock = vi.fn();
const invite = { creator_nickname: '지우', sender_nickname: '민수', title: '매일 걷기', expires_at: '2099-01-01T00:00:00Z', target_role: 'PARTNER' };
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body });
function show(path = '/i/token') { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/i/:token" element={<ScrW01InviteLanding />} /><Route path="/i/:token/review" element={<ScrW01InviteLanding />} /></Routes></MemoryRouter>); }
beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co'); vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(navigator, 'userAgent', { value: 'Android KAKAOTALK', configurable: true });
  fetchMock.mockResolvedValue(response(invite));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); fetchMock.mockReset(); });
it('EC-I02 shows sender/title, app handoff and decline without web authentication', async () => {
  show(); await screen.findByRole('heading', { name: invite.title });
  expect(screen.getByText('지우님이 약속을 보냈어요')).toBeTruthy();
  expect(screen.queryByText(/로그인/)).toBeNull();
  const app = screen.getByRole('link', { name: '앱에서 확인하기' });
  expect(app.getAttribute('href')).toContain('package=com.littlefinger.app');
  expect(app.getAttribute('href')).toContain('/i/token');
  expect(decodeURIComponent(app.getAttribute('href') ?? '')).toContain('play.google.com/store');
  expect(screen.getByRole('link', {name: '앱이 없거나 이 화면으로 돌아오면 설치·업데이트 후 초대 링크를 다시 열어주세요.'}).getAttribute('href')).toContain('play.google.com/store/apps/details');
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('witness invitation shows the actual sender and uses the same handoff', async () => {
  fetchMock.mockResolvedValue(response({ ...invite, target_role: 'WITNESS' })); show();
  await screen.findByText('민수님이 증인으로 초대했어요');
  expect(screen.getByRole('link', { name: '앱에서 확인하기' })).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('only explicit confirmation declines, without Authorization', async () => {
  show(); await screen.findByText(invite.title);
  fireEvent.click(screen.getByRole('button', { name: '거절하기' }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '돌아가기' }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '거절하기' }));
  fetchMock.mockResolvedValue(response({ status: 'DECLINED', target_role: 'PARTNER' }));
  fireEvent.click(screen.getByRole('button', { name: '거절하기' }));
  await screen.findByRole('heading', { name: '초대를 거절했어요' });
  const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
  expect(url).toContain('invite-decline-public'); expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  expect(init.body).toBe(JSON.stringify({ token: 'token' }));
  expect(screen.queryByRole('link', { name: '앱에서 확인하기' })).toBeNull();
});
it('decline failure preserves confirmation and supports retry', async () => {
  show(); await screen.findByText(invite.title); fireEvent.click(screen.getByText('거절하기'));
  fetchMock.mockRejectedValueOnce(new Error('offline')); fireEvent.click(screen.getByText('거절하기'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).not.toBe(''));
  expect(screen.getByRole('button', { name: '거절하기' }).hasAttribute('disabled')).toBe(false);
});
it.each(['E_INVITE_EXPIRED', 'E_INVITE_USED', 'E_INVITE_REVOKED', 'E_NOT_FOUND', 'E_BLOCKED'])('does not expose invitation on %s', async code => {
  fetchMock.mockResolvedValue(response({ code, message: '사용할 수 없는 초대' }, 410)); show();
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  expect(screen.queryByText(invite.title)).toBeNull(); expect(screen.queryByText('거절하기')).toBeNull();
});
it('retries malformed server response', async () => {
  fetchMock.mockResolvedValueOnce(response({ title: 'incomplete' })); show();
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
  await screen.findByText(invite.title);
});
it('legacy review route displays the same public landing', async () => {
  show('/i/token/review'); await screen.findByText(invite.title); expect(screen.queryByText(/로그인/)).toBeNull();
});
it('non-Android visitors get an explicit Android availability explanation', async () => {
  Object.defineProperty(navigator, 'userAgent', { value: 'iPhone', configurable: true }); show();
  await screen.findByText(invite.title); expect(screen.getByText(/현재 Android 앱/)).toBeTruthy();
  expect(screen.getByRole('link', { name: '앱에서 확인하기' }).getAttribute('href')).toContain('play.google.com');
});
