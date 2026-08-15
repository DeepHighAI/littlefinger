import { describe, expect, test } from 'vitest';

import * as shared from './index.ts';

const PROMISE_ID = '11111111-1111-4111-8111-111111111111';
const CREATOR_ID = '22222222-2222-4222-8222-222222222222';
const PARTNER_ID = '33333333-3333-4333-8333-333333333333';

interface DetailModule {
  asPromiseDetailResponse?: (value: unknown) => unknown;
}

const parser = (shared as DetailModule).asPromiseDetailResponse;

const person = {
  user_id: CREATOR_ID,
  nickname: '지우',
  profile_image_url: 'https://example.com/creator.jpg',
  role: 'CREATOR',
  status: 'JOINED',
  joined_at: '2026-07-12T12:04:00Z',
} as const;

const version = {
  version_no: 1,
  title: '매주 화·목 아침 러닝 같이 하기',
  body: '매주 화요일과 목요일에 함께 달린다.',
  category: 'HABIT',
  end_date: '2026-08-30',
  keeper: 'BOTH',
  reward: '오마카세 사주기',
  penalty: '한 달 커피 사기',
  content_hash: 'a'.repeat(64),
  fingerprint: 'AAAA-AAAA-AA',
  activated_at: '2026-07-12T12:04:00Z',
  superseded_at: null,
  change_reason: null,
} as const;

const active = {
  promise_id: PROMISE_ID,
  status: 'ACTIVE',
  title: version.title,
  body: version.body,
  category: version.category,
  end_date: version.end_date,
  keeper: version.keeper,
  reward: version.reward,
  penalty: version.penalty,
  witness_enabled: true,
  activated_at: '2026-07-12T12:04:00Z',
  closed_at: null,
  checking_started_at: null,
  check_deadline_at: null,
  check_round_no: 1,
  my_role: 'CREATOR',
  creator: person,
  partner: {
    ...person,
    user_id: PARTNER_ID,
    nickname: '민준',
    profile_image_url: null,
    role: 'PARTNER',
  },
  witnesses: [],
  approvals: [
    {
      role: 'CREATOR',
      action: 'APPROVE',
      actor: {
        user_id: CREATOR_ID,
        nickname: '지우',
        profile_image_url: 'https://example.com/creator.jpg',
      },
      acted_at: '2026-07-12T11:58:00Z',
      comment: null,
    },
    {
      role: 'PARTNER',
      action: 'APPROVE',
      actor: {
        user_id: PARTNER_ID,
        nickname: '민준',
        profile_image_url: null,
      },
      acted_at: '2026-07-12T12:04:00Z',
      comment: null,
    },
  ],
  current_version: version,
  invitation: null,
  amend_request: null,
  fulfillment: null,
  integrity_status: 'VERIFIED',
} as const;

const evidence = {
  evidence_id: '44444444-4444-4444-8444-444444444444',
  mime: 'image/jpeg',
  bytes: 2048,
  width: 640,
  height: 480,
  availability: 'AVAILABLE',
} as const;

const check = {
  role: 'CREATOR',
  answer: 'KEPT',
  comment: '계획대로 지켰어요.',
  submitted_at: '2026-08-31T01:00:00Z',
  revised_at: null,
  round_no: 1,
  evidences: [evidence],
} as const;

function parse(value: unknown): unknown {
  return parser?.(value);
}

describe('SCR-A05 promise detail public boundary', () => {
  test('정확한 ACTIVE 상세 snapshot을 그대로 허용한다', () => {
    expect(parser).toBeTypeOf('function');
    expect(parse(active)).toEqual(active);
  });

  test.each([
    ['top-level extra key', { ...active, storage_key: 'private/full.jpg' }],
    ['DRAFT detail', { ...active, status: 'DRAFT', integrity_status: 'UNVERIFIED' }],
    ['invalid promise UUID', { ...active, promise_id: 'not-a-uuid' }],
    ['invalid end date', { ...active, end_date: '2026-02-30' }],
    [
      'non-HTTPS profile image',
      { ...active, creator: { ...active.creator, profile_image_url: 'http://example.com/a.jpg' } },
    ],
    [
      'nested audit leak',
      {
        ...active,
        approvals: [{ ...active.approvals[0], ip_hash: 'secret' }, active.approvals[1]],
      },
    ],
    ['ACTIVE invitation', { ...active, invitation: { status: 'PENDING', expires_at: '2026-08-20T00:00:00Z', resend_count: 0 } }],
    ['ACTIVE unverified integrity', { ...active, integrity_status: 'UNVERIFIED' }],
  ] as const)('%s를 거부한다', (_name, value) => {
    expect(parse(value)).toBeNull();
  });

  test('PENDING은 초대 만료 snapshot과 미확정 fingerprint 조합만 허용한다', () => {
    const pending = {
      ...active,
      status: 'PENDING',
      activated_at: null,
      partner: null,
      approvals: [],
      current_version: { ...version, activated_at: null },
      invitation: {
        status: 'PENDING',
        expires_at: '2026-08-20T00:00:00Z',
        resend_count: 2,
      },
      integrity_status: 'UNVERIFIED',
    };

    expect(parse(pending)).toEqual(pending);
    expect(parse({ ...pending, invitation: null })).toBeNull();
  });

  test('AMEND_PENDING은 현재 요청과 제안 버전을 함께 요구한다', () => {
    const amendPending = {
      ...active,
      status: 'AMEND_PENDING',
      amend_request: {
        request_id: '55555555-5555-4555-8555-555555555555',
        type: 'AMEND',
        status: 'PENDING',
        requester: {
          user_id: CREATOR_ID,
          nickname: '지우',
          profile_image_url: 'https://example.com/creator.jpg',
        },
        reason: '휴가 기간 반영',
        created_at: '2026-08-01T00:00:00Z',
        expires_at: '2026-08-08T00:00:00Z',
        proposed_version: {
          ...version,
          version_no: 2,
          end_date: '2026-09-13',
          content_hash: 'b'.repeat(64),
          fingerprint: 'BBBB-BBBB-BB',
          activated_at: null,
          change_reason: '휴가 기간 반영',
        },
      },
    };

    expect(parse(amendPending)).toEqual(amendPending);
    expect(parse({ ...amendPending, amend_request: null })).toBeNull();
  });

  test('CHECKING과 종결 결과는 엄격한 fulfillment·증빙 구조를 요구한다', () => {
    const checking = {
      ...active,
      status: 'CHECKING',
      checking_started_at: '2026-08-31T15:00:00Z',
      check_deadline_at: '2026-09-07T15:00:00Z',
      fulfillment: {
        round_no: 1,
        creator_has_submitted: true,
        partner_has_submitted: false,
        creator_check: check,
        partner_check: null,
        history: [],
      },
    };

    expect(parse(checking)).toEqual(checking);
    expect(parse({ ...checking, fulfillment: null })).toBeNull();
    expect(
      parse({
        ...checking,
        fulfillment: {
          ...checking.fulfillment,
          creator_check: {
            ...check,
            evidences: [{ ...evidence, storage_key: 'private/full.jpg' }],
          },
        },
      }),
    ).toBeNull();
  });

  test('CANCELED만 승인된 파기 요청을 종결 이유로 포함할 수 있다', () => {
    const canceled = {
      ...active,
      status: 'CANCELED',
      closed_at: '2026-08-10T00:00:00Z',
      amend_request: {
        request_id: '55555555-5555-4555-8555-555555555555',
        type: 'CANCEL',
        status: 'APPROVED',
        requester: {
          user_id: CREATOR_ID,
          nickname: '지우',
          profile_image_url: 'https://example.com/creator.jpg',
        },
        reason: '서로 일정이 달라졌어요.',
        created_at: '2026-08-01T00:00:00Z',
        expires_at: '2026-08-08T00:00:00Z',
        proposed_version: null,
      },
    };

    expect(parse(canceled)).toEqual(canceled);
    expect(parse({ ...canceled, amend_request: { ...canceled.amend_request, type: 'AMEND' } })).toBeNull();
  });
});

