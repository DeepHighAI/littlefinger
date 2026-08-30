import { describe, expect, test } from 'vitest';

import * as shared from './index.ts';

type Parser = (value: unknown, expectedTab: 'ACTIVE' | 'WAITING' | 'COMPLETED') => unknown;

const parse = (shared as unknown as { asPromiseHomeListResponse?: Parser })
  .asPromiseHomeListResponse;

const ACTIVE_CARD = {
  promise_id: '10000000-0000-4000-8000-000000000001',
  title: '매일 함께 걷기',
  status: 'ACTIVE',
  end_date: '2026-08-20',
  updated_at: '2026-08-16T00:00:00Z',
  closed_at: null,
  my_role: 'CREATOR',
  creator: { nickname: '작성자', profile_image_url: 'https://example.com/creator.jpg' },
  partner: { nickname: '상대방', profile_image_url: null },
  has_witness: true,
  needs_response: false,
} as const;

const BASE_RESPONSE = {
  items: [ACTIVE_CARD],
  pinned: [],
  counts: { ACTIVE: 3, WAITING: 1, COMPLETED: 2 },
  next_cursor: {
    tab: 'ACTIVE',
    status_rank: 1,
    end_date: '2026-08-20',
    promise_id: '10000000-0000-4000-8000-000000000001',
  },
} as const;

describe('F-10 홈 목록 응답 경계', () => {
  test('세 탭의 복합 cursor와 카드 메타데이터를 보존한다', () => {
    expect(parse?.(BASE_RESPONSE, 'ACTIVE')).toEqual(BASE_RESPONSE);

    const waiting = {
      ...BASE_RESPONSE,
      items: [{ ...ACTIVE_CARD, status: 'DRAFT', end_date: null, partner: null }],
      next_cursor: {
        tab: 'WAITING',
        updated_at: '2026-08-16T00:00:00Z',
        promise_id: '10000000-0000-4000-8000-000000000001',
      },
    };
    expect(parse?.(waiting, 'WAITING')).toEqual(waiting);

    const completed = {
      ...BASE_RESPONSE,
      items: [
        {
          ...ACTIVE_CARD,
          status: 'COMPLETED',
          closed_at: '2026-08-16T00:00:00Z',
        },
      ],
      next_cursor: {
        tab: 'COMPLETED',
        closed_at: '2026-08-16T00:00:00Z',
        updated_at: '2026-08-16T00:00:00Z',
        promise_id: '10000000-0000-4000-8000-000000000001',
      },
    };
    expect(parse?.(completed, 'COMPLETED')).toEqual(completed);
  });

  test('요청 탭과 다른 cursor는 거부한다', () => {
    expect(parse?.(BASE_RESPONSE, 'WAITING')).toBeNull();
  });

  test('추가 필드가 있는 root·card·person은 실패 폐쇄한다', () => {
    expect(parse?.({ ...BASE_RESPONSE, internal_path: '/secret' }, 'ACTIVE')).toBeNull();
    expect(
      parse?.(
        { ...BASE_RESPONSE, items: [{ ...ACTIVE_CARD, keeper: 'BOTH' }] },
        'ACTIVE',
      ),
    ).toBeNull();
    expect(
      parse?.(
        {
          ...BASE_RESPONSE,
          items: [
            { ...ACTIVE_CARD, creator: { ...ACTIVE_CARD.creator, kakao_id: 'private' } },
          ],
        },
        'ACTIVE',
      ),
    ).toBeNull();
  });

  test('잘못된 UUID·날짜·enum·프로필 URL·음수 count를 거부한다', () => {
    const invalidCards = [
      { ...ACTIVE_CARD, promise_id: 'not-a-uuid' },
      { ...ACTIVE_CARD, end_date: '2026-02-30' },
      { ...ACTIVE_CARD, status: 'UNKNOWN' },
      {
        ...ACTIVE_CARD,
        creator: { nickname: '작성자', profile_image_url: 'file:///private/photo.jpg' },
      },
    ];
    for (const card of invalidCards) {
      expect(parse?.({ ...BASE_RESPONSE, items: [card] }, 'ACTIVE')).toBeNull();
    }
    expect(
      parse?.(
        { ...BASE_RESPONSE, counts: { ACTIVE: -1, WAITING: 1, COMPLETED: 2 } },
        'ACTIVE',
      ),
    ).toBeNull();
  });

  test('무기한 ACTIVE와 nullable 커서를 허용하고 pinned는 ACTIVE·CHECKING만 허용한다', () => {
    expect(
      parse?.({ ...BASE_RESPONSE, items: [{ ...ACTIVE_CARD, end_date: null }] }, 'ACTIVE'),
    ).not.toBeNull();
    expect(
      parse?.({ ...BASE_RESPONSE, next_cursor: { ...BASE_RESPONSE.next_cursor, end_date: null } }, 'ACTIVE'),
    ).not.toBeNull();
    expect(
      parse?.(
        {
          ...BASE_RESPONSE,
          pinned: [{ ...ACTIVE_CARD, status: 'AMEND_PENDING' }],
        },
        'ACTIVE',
      ),
    ).toBeNull();
  });
});
