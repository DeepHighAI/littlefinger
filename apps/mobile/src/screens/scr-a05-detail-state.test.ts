import type {
  FulfillmentCheckView,
  PromiseStatus,
} from '@littlefinger/shared';

interface PresentationModule {
  detailVariantOf(status: PromiseStatus): string;
  detailStatusOf(status: PromiseStatus): {
    label: string;
    headline: string;
    tone: string;
  };
  formatDetailDate(value: string): string;
  formatDetailInstant(value: string): string;
  formatDetailDday(endDate: string, now: Date): string;
  fingerprintText(value: string): string;
  evidenceAvailabilityText(value: 'AVAILABLE' | 'BLINDED' | 'EXPIRED'): string | null;
  responseFact(nickname: string, submitted: boolean): string;
  claimPresentation(check: FulfillmentCheckView, nickname: string): {
    nickname: string;
    answer: string;
    submittedAt: string;
    evidenceCount: string;
  };
}

function loadPresentation(): PresentationModule | null {
  try {
    return require('./scr-a05-detail-state.ts') as PresentationModule;
  } catch {
    return null;
  }
}

const presentation = loadPresentation();

describe('SCR-A05 상태별 표현 계약', () => {
  test.each([
    ['PENDING', 'PENDING', '승인 대기', '상대방의 승인을 기다리고 있어요', 'neutral'],
    ['ACTIVE', 'ACTIVE', '진행 중', '두 사람이 손가락 걸었어요!', 'status'],
    ['AMEND_PENDING', 'AMEND_PENDING', '변경 협의 중', '변경 내용을 확인하고 있어요', 'urgent'],
    ['CHECKING', 'CHECKING', '이행 확인 중', '약속, 지켜졌나요?', 'urgent'],
    ['COMPLETED', 'COMPLETED', '완료', '약속 지킴! 완주했어요', 'done'],
    ['BROKEN', 'BROKEN', '불이행', '이번엔 못 지켰어요', 'broken'],
    ['DISPUTED', 'DISPUTED', '의견 불일치', '서로의 응답이 달라요', 'neutral'],
    ['UNRESOLVED', 'UNRESOLVED', '미확정 종결', '응답 없이 종료됐어요', 'neutral'],
    ['DECLINED', 'TERMINAL', '거절됨', '이번엔 성립되지 않았어요', 'neutral'],
    ['CANCELED', 'TERMINAL', '파기됨', '약속이 파기됐어요', 'neutral'],
  ] as const)(
    '%s를 9개 시각 변형과 확정 문구로 매핑한다',
    (status, variant, label, headline, tone) => {
      expect(presentation).not.toBeNull();
      expect(presentation?.detailVariantOf(status)).toBe(variant);
      expect(presentation?.detailStatusOf(status)).toEqual({ label, headline, tone });
    },
  );

  test('날짜·시각·D-Day는 기기 시간대가 아니라 KST로 표시한다', () => {
    expect(presentation?.formatDetailDate('2026-08-18')).toBe('2026-08-18 (화)');
    expect(presentation?.formatDetailInstant('2026-08-15T15:04:00Z')).toBe(
      '2026-08-16 00:04 (KST)',
    );
    expect(
      presentation?.formatDetailDday('2026-08-18', new Date('2026-08-15T16:00:00Z')),
    ).toBe('D-2');
  });

  test('기록 지문과 응답 사실은 고정 용어로 표시한다', () => {
    expect(presentation?.fingerprintText('AAAA-BBBB-CC')).toBe('기록 지문 · AAAA-BBBB-CC');
    expect(presentation?.responseFact('지우', true)).toBe('지우 · 응답 완료');
    expect(presentation?.responseFact('민준', false)).toBe('민준 · 응답 없음');
  });

  test('블라인드·만료 증빙은 고정 플레이스홀더를 반환한다', () => {
    expect(presentation?.evidenceAvailabilityText('AVAILABLE')).toBeNull();
    expect(presentation?.evidenceAvailabilityText('BLINDED')).toBe(
      '신고 접수로 가려진 이미지입니다',
    );
    expect(presentation?.evidenceAvailabilityText('EXPIRED')).toBe('보관 기간이 지난 증빙입니다');
  });

  test('DISPUTED 양측 주장은 동일한 필드·강조 구조로 표현한다', () => {
    const creator: FulfillmentCheckView = {
      role: 'CREATOR',
      answer: 'KEPT',
      comment: '지켰어요',
      submitted_at: '2026-08-15T15:04:00Z',
      revised_at: null,
      round_no: 1,
      evidences: [],
    };
    const partner: FulfillmentCheckView = {
      ...creator,
      role: 'PARTNER',
      answer: 'NOT_KEPT',
      submitted_at: '2026-08-15T16:04:00Z',
      evidences: [
        {
          evidence_id: '11111111-1111-4111-8111-111111111111',
          mime: 'image/jpeg',
          bytes: 100,
          width: 10,
          height: 10,
          availability: 'AVAILABLE',
        },
      ],
    };

    expect(presentation?.claimPresentation(creator, '지우')).toEqual({
      nickname: '지우',
      answer: '지켰어요',
      submittedAt: '2026-08-16 00:04 (KST)',
      evidenceCount: '증빙 없음',
    });
    expect(presentation?.claimPresentation(partner, '민준')).toEqual({
      nickname: '민준',
      answer: '안 지켜졌어요',
      submittedAt: '2026-08-16 01:04 (KST)',
      evidenceCount: '증빙 1장',
    });
  });
});
