// @vitest-environment jsdom
import {
  DRAFT_TTL_DAYS,
  EVIDENCE_RETENTION_DAYS,
  EVIDENCE_SIGNED_URL_MIN,
  INVITE_TTL_HOURS,
  LEGAL_DISCLAIMER,
  NOTIFICATION_RETENTION_DAYS,
  QUIET_HOURS_KST,
  type LegalDocumentKind,
} from '@littlefinger/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LEGAL_CONTENT_BY_LOCALE } from '../legal/legal-content.ts';
import { LegalDocument } from './legal-document.tsx';

afterEach(cleanup);

function fullText(locale: 'ko' | 'en', kind: LegalDocumentKind): string {
  return LEGAL_CONTENT_BY_LOCALE[locale][kind].sections
    .flatMap((section) => [section.title, ...section.paragraphs])
    .join('\n');
}

describe('public legal documents', () => {
  it.each([
    ['TERMS', '이용약관', '제1조 (목적)', '버전 2026-08-22.3 · 시행일 2026-08-22'],
    [
      'PRIVACY',
      '개인정보 처리방침',
      '1. 처리하는 개인정보의 항목과 수집 방법',
      '버전 2026-08-23.1 · 시행일 2026-08-23',
    ],
  ] as const)('renders the final %s document without auth or ads', (kind, title, section, versionLine) => {
    const { container } = render(<LegalDocument kind={kind} />);

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: section })).toBeTruthy();
    expect(screen.getByText(versionLine)).toBeTruthy();
    expect(screen.getByText(LEGAL_DISCLAIMER)).toBeTruthy();
    expect(screen.queryByText('비배포용 초안')).toBeNull();
    expect(screen.queryByText(/\[배포 전 입력 필요/u)).toBeNull();
    expect(container.querySelector('ins, iframe, .lf-ad')).toBeNull();
  });

  it('lists every approved section', () => {
    const { rerender } = render(<LegalDocument kind="TERMS" />);
    for (const heading of [
      '제1조 (목적)', '제2조 (정의)', '제3조 (약관의 게시와 개정)', '제4조 (이용계약의 체결)',
      '제5조 (계정의 관리)', '제6조 (개인정보의 보호)', '제7조 (서비스의 내용)',
      '제8조 (서비스의 성격과 한계)', '제9조 (약속의 확정과 변경)', '제10조 (분쟁에 대한 중립)',
      '제11조 (알림)', '제12조 (광고)', '제13조 (사용자의 의무)', '제14조 (콘텐츠의 권리와 책임)',
      '제15조 (서비스의 변경과 중단)', '제16조 (이용제한)', '제17조 (탈퇴와 기록의 보존)',
      '제18조 (손해배상과 면책)', '제19조 (준거법과 관할)', '제20조 (언어)', '부칙', '회사 정보',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeTruthy();
    }

    rerender(<LegalDocument kind="PRIVACY" />);
    for (const heading of [
      '개요', '1. 처리하는 개인정보의 항목과 수집 방법', '2. 개인정보의 처리 목적',
      '3. 개인정보의 처리와 보유 기간', '4. 개인정보의 파기', '5. 개인정보의 제3자 제공',
      '6. 개인정보 처리의 위탁과 국외 이전', '7. 광고와 자동 수집 장치',
      '8. 정보주체의 권리와 행사 방법', '9. 개인정보의 안전성 확보조치',
      '10. 개인정보 보호책임자와 고충 처리', '11. 권익침해에 대한 구제 방법',
      '12. 처리방침의 변경', '회사 정보',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeTruthy();
    }
  });

  it('states the MVP collection boundary on the privacy policy', () => {
    render(<LegalDocument kind="PRIVACY" />);
    expect(screen.getByText(/전화번호, 연락처 목록, 위치정보를 수집하지 않습니다/u)).toBeTruthy();
    expect(screen.getByText(/인증 시스템에만 저장되며 서비스는 이를 이용하지 않습니다/u)).toBeTruthy();
  });

  it.each(['ko', 'en'] as const)('carries the operator identity in %s', (locale) => {
    for (const kind of ['TERMS', 'PRIVACY'] as const) {
      const text = fullText(locale, kind);
      expect(text).toContain('798-86-01094');
      expect(text).toContain(locale === 'ko' ? '주식회사 딥하이' : 'DeepHigh Co., Ltd.');
      expect(text).toContain(locale === 'ko' ? '심충섭' : 'Chungseob Shim');
      expect(text).toContain(locale === 'ko' ? '02-3443-1028' : '+82-2-3443-1028');
    }
    // 보호책임자 문의 이메일은 방침에만 있다 (PO 2026-08-22).
    expect(fullText(locale, 'PRIVACY')).toContain('task@deephigh.ai');
  });

  // 본문 수치는 버전 고정 문서라 리터럴이다 — config 가 바뀌면 여기서 깨져
  // 의식적인 개정판(버전 올림 + 재공지)을 강제한다.
  it.each(['ko', 'en'] as const)('policy numbers match the config source of truth in %s', (locale) => {
    const privacy = fullText(locale, 'PRIVACY');
    expect(privacy).toContain(String(DRAFT_TTL_DAYS));
    expect(privacy).toContain(String(NOTIFICATION_RETENTION_DAYS));
    expect(privacy).toContain(String(EVIDENCE_RETENTION_DAYS));
    expect(privacy).toContain(String(INVITE_TTL_HOURS));
    expect(privacy).toContain(String(EVIDENCE_SIGNED_URL_MIN));

    const terms = fullText(locale, 'TERMS');
    expect(terms).toContain(String(INVITE_TTL_HOURS));
    expect(terms).toContain(`${QUIET_HOURS_KST.startHour}:00`);
    expect(terms).toContain(`${String(QUIET_HOURS_KST.endHour).padStart(2, '0')}:00`);
  });

  it('keeps ko and en structurally in sync', () => {
    for (const kind of ['TERMS', 'PRIVACY'] as const) {
      const koSections = LEGAL_CONTENT_BY_LOCALE.ko[kind].sections;
      const enSections = LEGAL_CONTENT_BY_LOCALE.en[kind].sections;
      expect(enSections.length).toBe(koSections.length);
      koSections.forEach((section, i) => {
        expect(enSections[i]?.paragraphs.length).toBe(section.paragraphs.length);
      });
    }
  });
});
