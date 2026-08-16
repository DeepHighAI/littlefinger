// @vitest-environment jsdom
import { LEGAL_DISCLAIMER } from '@littlefinger/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LegalDocument } from './legal-document.tsx';

afterEach(cleanup);

describe('public draft legal documents', () => {
  it.each([
    ['TERMS', '이용약관', '서비스 이용계약'],
    ['PRIVACY', '개인정보 처리방침', '처리하는 개인정보'],
  ] as const)('renders the %s draft without auth or ads', (kind, title, section) => {
    const { container } = render(<LegalDocument kind={kind} />);

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(screen.getByText('비배포용 초안')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: section })).toBeTruthy();
    expect(screen.getByText('버전 2026-08-16-draft.1 · 시행 예정일 2026-08-16')).toBeTruthy();
    expect(screen.getByText(LEGAL_DISCLAIMER)).toBeTruthy();
    expect(screen.getAllByText(/\[배포 전 입력 필요/u).length).toBeGreaterThan(0);
    expect(container.querySelector('ins, iframe, .lf-ad')).toBeNull();
  });

  it('states the MVP collection boundary on the privacy draft', () => {
    render(<LegalDocument kind="PRIVACY" />);
    expect(screen.getByText(/이메일과 전화번호는 수집하지 않습니다/u)).toBeTruthy();
  });

  it('lists every approved draft section', () => {
    const { rerender } = render(<LegalDocument kind="TERMS" />);
    for (const heading of [
      '서비스 이용계약', '계정', '약속 기록', '서비스 이용', '금지 행위',
      '기록 보존과 탈퇴', '서비스 변경과 중단', '책임과 면책', '분쟁 해결', '운영자 정보',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeTruthy();
    }

    rerender(<LegalDocument kind="PRIVACY" />);
    for (const heading of [
      '처리하는 개인정보', '처리 목적', '보유 및 이용기간', '제3자 제공',
      '처리위탁과 국외 처리', '정보주체의 권리', '안전성 확보조치',
      '개인정보 보호책임자', '방침 변경',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeTruthy();
    }
  });
});
