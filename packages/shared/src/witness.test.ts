import { describe, expect, test } from 'vitest';

import * as shared from './index.ts';

type Parser = (value: unknown) => unknown;

const witnessExports = shared as unknown as Record<string, unknown>;
const parseList = witnessExports['asWitnessInviteListResponse'] as Parser | undefined;
const parseInvite = witnessExports['asWitnessInviteResponse'] as Parser | undefined;
const parseJoin = witnessExports['asWitnessJoinResponse'] as Parser | undefined;
const parseDetail = witnessExports['asWitnessDetailResponse'] as Parser | undefined;
const parseSign = witnessExports['asWitnessSignResponse'] as Parser | undefined;
const parseLeave = witnessExports['asWitnessLeaveResponse'] as Parser | undefined;

const PROMISE_ID = '10000000-0000-4000-8000-000000000001';
const PARTICIPANT_ID = '20000000-0000-4000-8000-000000000002';
const INVITATION_ID = '30000000-0000-4000-8000-000000000003';
const USER_ID = '40000000-0000-4000-8000-000000000004';
const EVIDENCE_ID = '50000000-0000-4000-8000-000000000005';
const INSTANT = '2026-08-16T01:02:03Z';

const SLOT = {
  participant_id: PARTICIPANT_ID,
  status: 'INVITED',
  nickname: null,
  profile_image_url: null,
  expires_at: INSTANT,
  signed_at: null,
} as const;

const ACTOR = {
  user_id: USER_ID,
  nickname: '하영',
  profile_image_url: 'https://example.com/profile.jpg',
} as const;

describe('F-05 증인 공개 계약', () => {
  test('여섯 endpoint slug를 고정한다', () => {
    expect(shared.ENDPOINT).toMatchObject({
      witnessInviteList: 'witness-invite-list',
      witnessInvite: 'witness-invite',
      witnessJoin: 'witness-join',
      witnessDetail: 'witness-detail',
      witnessSign: 'witness-sign',
      witnessLeave: 'witness-leave',
    });
  });

  test('초대 목록은 최대 두 슬롯과 점유 수를 엄격히 검증한다', () => {
    const value = {
      promise_id: PROMISE_ID,
      occupied_count: 1,
      capacity: 2,
      witnesses: [SLOT],
    };
    expect(parseList?.(value)).toEqual(value);
    expect(parseList?.({ ...value, capacity: 3 })).toBeNull();
    expect(parseList?.({ ...value, witnesses: [SLOT, SLOT, SLOT] })).toBeNull();
    expect(parseList?.({ ...value, internal_token_hash: 'secret' })).toBeNull();
    expect(parseList?.({ ...value, witnesses: [{ ...SLOT, expires_at: 'not-an-instant' }] })).toBeNull();
  });

  test('발급 응답은 선택 token을 허용하되 내부 필드와 잘못된 token을 거절한다', () => {
    const value = {
      promise_id: PROMISE_ID,
      participant_id: PARTICIPANT_ID,
      invitation_id: INVITATION_ID,
      title: '아침 러닝',
      expires_at: INSTANT,
      token: 'abcdefghijklmnopqrstuvwxyzABCDEFGH012345678',
    };
    expect(parseInvite?.(value)).toEqual(value);
    expect(parseInvite?.({ ...value, token: undefined })).toBeNull();
    expect(parseInvite?.({ ...value, token: 'short' })).toBeNull();
    expect(parseInvite?.({ ...value, token_hash: 'secret' })).toBeNull();

    const { token: _token, ...replay } = value;
    expect(parseInvite?.(replay)).toEqual(replay);
  });

  test('join과 sign 응답은 UUID와 실제 instant만 허용한다', () => {
    const joined = { promise_id: PROMISE_ID, participant_id: PARTICIPANT_ID, status: 'JOINED' };
    const signed = { promise_id: PROMISE_ID, signed_at: INSTANT };
    expect(parseJoin?.(joined)).toEqual(joined);
    expect(parseJoin?.({ ...joined, status: 'INVITED' })).toBeNull();
    expect(parseSign?.(signed)).toEqual(signed);
    expect(parseSign?.({ ...signed, signed_at: '2026-02-30T00:00:00Z' })).toBeNull();
  });

  test('leave 응답은 철회 상태와 정확한 공개 필드만 허용한다', () => {
    const left = { promise_id: PROMISE_ID, status: 'WITHDRAWN' };
    expect(parseLeave?.(left)).toEqual(left);
    expect(parseLeave?.({ ...left, status: 'JOINED' })).toBeNull();
    expect(parseLeave?.({ ...left, promise_id: 'not-a-uuid' })).toBeNull();
    expect(parseLeave?.({ ...left, participant_id: PARTICIPANT_ID })).toBeNull();
    expect(parseLeave?.({ promise_id: PROMISE_ID })).toBeNull();
  });

  test('LIMITED 상세는 제목·작성자 외 약속 전문을 허용하지 않는다', () => {
    const limited = {
      promise_id: PROMISE_ID,
      status: 'PENDING',
      visibility: 'LIMITED',
      title: '아침 러닝',
      creator: ACTOR,
      partner: null,
      activated_at: null,
      signed_at: null,
      content: null,
      fulfillment: null,
    };
    expect(parseDetail?.(limited)).toEqual(limited);
    expect(
      parseDetail?.({
        ...limited,
        content: {
          body: '노출되면 안 되는 전문',
          category: 'HABIT',
          end_date: '2026-08-30',
          keeper: 'BOTH',
          reward: null,
          penalty: null,
        },
      }),
    ).toBeNull();
  });

  test('FULL 상세는 활성 내용과 증빙 availability를 보존한다', () => {
    const full = {
      promise_id: PROMISE_ID,
      status: 'ACTIVE',
      visibility: 'FULL',
      title: '아침 러닝',
      creator: ACTOR,
      partner: { ...ACTOR, user_id: '60000000-0000-4000-8000-000000000006', nickname: '민준' },
      activated_at: INSTANT,
      signed_at: null,
      content: {
        body: '매일 아침 함께 달린다.',
        category: 'HABIT',
        end_date: '2026-08-30',
        keeper: 'BOTH',
        reward: '커피',
        penalty: null,
      },
      fulfillment: {
        round_no: 1,
        claims: [
          {
            role: 'CREATOR',
            answer: 'KEPT',
            comment: null,
            submitted_at: INSTANT,
            evidences: [
              {
                evidence_id: EVIDENCE_ID,
                mime: 'image/jpeg',
                bytes: 1200,
                width: 320,
                height: 200,
                availability: 'AVAILABLE',
              },
            ],
          },
        ],
      },
    };
    expect(parseDetail?.(full)).toEqual(full);
    expect(parseDetail?.({ ...full, activated_at: null })).toBeNull();
    expect(
      parseDetail?.({
        ...full,
        fulfillment: {
          ...full.fulfillment,
          claims: [{ ...full.fulfillment.claims[0], role: 'WITNESS' }],
        },
      }),
    ).toBeNull();
    expect(parseDetail?.({ ...full, storage_path: '/private/full.jpg' })).toBeNull();
  });
});
