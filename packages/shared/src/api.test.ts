import { describe, expect, test } from 'vitest';

import {
  ENDPOINT,
  type ApiValidationField,
  type FulfillmentCheckView,
  type FulfillmentRoundView,
  type FulfillmentSubmitRequest,
  type FulfillmentSubmitResponse,
  type ParticipantPromiseSummary,
  type PromiseFulfillmentDetailRequest,
  type PromiseFulfillmentDetailResponse,
} from './api.ts';

// 타입 소비자가 실제 화면에 필요한 모든 필드를 한 번에 조립할 수 있어야 한다.
const summary: ParticipantPromiseSummary = {
  promise_id: 'promise-id',
  title: '매일 걷기',
  status: 'CHECKING',
  end_date: '2026-07-31',
  keeper: 'BOTH',
  updated_at: '2026-07-31T00:00:00Z',
  check_deadline_at: '2026-08-07T00:00:00Z',
  check_round_no: 1,
  needs_response: true,
  waiting_for_partner: false,
};

const check: FulfillmentCheckView = {
  role: 'CREATOR',
  answer: 'KEPT',
  comment: '약속대로 했어요',
  submitted_at: '2026-07-31T00:00:00Z',
  revised_at: null,
  round_no: 1,
};

const round: FulfillmentRoundView = {
  round_no: 1,
  creator_check: check,
  partner_check: { ...check, role: 'PARTNER' },
};

const detailRequest: PromiseFulfillmentDetailRequest = { promise_id: 'promise-id' };

const detailResponse: PromiseFulfillmentDetailResponse = {
  promise_id: 'promise-id',
  title: '매일 걷기',
  body: '매일 30분 걷기로 했다',
  category: 'HABIT',
  end_date: '2026-07-31',
  keeper: 'BOTH',
  reward: '커피 한 잔',
  penalty: '설거지 1주일',
  status: 'CHECKING',
  checking_started_at: '2026-07-31T00:00:00Z',
  check_deadline_at: '2026-08-07T00:00:00Z',
  check_round_no: 1,
  creator: {
    user_id: 'creator-id',
    nickname: '작성자',
    profile_image_url: null,
  },
  partner: {
    user_id: 'partner-id',
    nickname: '상대방',
    profile_image_url: null,
  },
  my_check: null,
  partner_has_submitted: true,
  partner_check: null,
  history: [round],
};

const submitRequest: FulfillmentSubmitRequest = {
  promise_id: 'promise-id',
  answer: 'KEPT',
  comment: '약속대로 했어요',
  revise: false,
};

const submitResponse: FulfillmentSubmitResponse = {
  promise_id: 'promise-id',
  status: 'CHECKING',
  round_no: 1,
  submitted_at: '2026-07-31T00:00:00Z',
  revised_at: null,
  waiting_for_partner: true,
  title: '매일 걷기',
  notification_recipients: [
    { user_id: 'creator-id', role: 'CREATOR' },
    { user_id: 'partner-id', role: 'PARTNER' },
  ],
};

const validationFields: ApiValidationField[] = ['answer', 'comment', 'revise'];

describe('F-07 공개 API 계약', () => {
  test('참여 목록·상세·제출 소비자가 snake_case 계약을 그대로 쓴다', () => {
    expect({
      summary,
      detailRequest,
      detailResponse,
      submitRequest,
      submitResponse,
      validationFields,
    }).toMatchObject({
      summary: { needs_response: true, waiting_for_partner: false },
      detailResponse: { partner_has_submitted: true, partner_check: null },
      submitResponse: { waiting_for_partner: true },
      validationFields: ['answer', 'comment', 'revise'],
    });
  });

  test('세 Edge Function 슬러그가 공개된다', () => {
    expect(ENDPOINT).toMatchObject({
      participantPromiseList: 'participant-promise-list',
      promiseFulfillmentDetail: 'promise-fulfillment-detail',
      fulfillmentSubmit: 'fulfillment-submit',
    });
  });
});
