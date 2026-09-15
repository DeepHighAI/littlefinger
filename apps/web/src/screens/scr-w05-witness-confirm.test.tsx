// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { ScrW05WitnessConfirm } from './scr-w05-witness-confirm.tsx';
afterEach(cleanup);
it('existing witness links open the native witness view without web sign-in', () => {
  Object.defineProperty(navigator, 'userAgent', { value: 'Android', configurable: true });
  render(<MemoryRouter initialEntries={['/witness/123']}><Routes><Route path="/witness/:promise_id" element={<ScrW05WitnessConfirm />} /></Routes></MemoryRouter>);
  expect(screen.getByRole('link', { name: '앱에서 확인하기' }).getAttribute('href')).toContain('intent://witness/123');
  expect(screen.queryByText(/로그인/)).toBeNull();
});
