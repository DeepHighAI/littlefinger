import { describe, expect, test } from 'vitest';

import {
  ENDPOINT,
  type ApiValidationField,
  type EvidenceDiscardRequest,
  type EvidenceSignUrlRequest,
  type EvidenceSignUrlResponse,
  type EvidenceUploadResponse,
  type EvidenceView,
  type FulfillmentCheckView,
  type FulfillmentReopenRequest,
  type FulfillmentReopenResponse,
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
  evidences: [
    {
      evidence_id: 'evidence-id',
      mime: 'image/jpeg',
      bytes: 1024,
      width: 1280,
      height: 720,
      availability: 'AVAILABLE',
    },
  ],
};

const evidence: EvidenceView = check.evidences[0]!;

const uploadResponse: EvidenceUploadResponse = {
  upload_id: 'upload-id',
  status: 'READY',
  mime: 'image/jpeg',
  bytes: 2048,
  width: 1920,
  height: 1080,
};

const discardRequest: EvidenceDiscardRequest = { upload_id: 'upload-id' };

const signRequest: EvidenceSignUrlRequest = {
  evidence_id: 'evidence-id',
  variant: 'THUMBNAIL',
};

const signResponse: EvidenceSignUrlResponse = {
  evidence_id: 'evidence-id',
  variant: 'THUMBNAIL',
  signed_url: 'https://signed.example/evidence',
  expires_at: '2026-07-31T00:10:00Z',
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
  my_role: 'CREATOR',
  my_check: null,
  creator_has_submitted: false,
  partner_has_submitted: true,
  partner_check: null,
  history: [round],
};

const submitRequest: FulfillmentSubmitRequest = {
  promise_id: 'promise-id',
  answer: 'KEPT',
  comment: '약속대로 했어요',
  revise: false,
  evidence_upload_ids: ['upload-id'],
  retained_evidence_ids: ['evidence-id'],
};

const submitResponse: FulfillmentSubmitResponse = {
  promise_id: 'promise-id',
  status: 'CHECKING',
  round_no: 1,
  submitted_at: '2026-07-31T00:00:00Z',
  revised_at: null,
  waiting_for_partner: true,
  title: '매일 걷기',
  actor_nickname: '작성자',
  notification_recipients: [
    { user_id: 'creator-id', role: 'CREATOR' },
    { user_id: 'partner-id', role: 'PARTNER' },
  ],
};

const reopenRequest: FulfillmentReopenRequest = {
  promise_id: 'promise-id',
};

const reopenResponse: FulfillmentReopenResponse = {
  promise_id: 'promise-id',
  status: 'CHECKING',
  round_no: 2,
  check_deadline_at: '2026-08-07T00:00:00Z',
  title: '매일 걷기',
  notification_recipients: [{ user_id: 'partner-id', role: 'PARTNER' }],
};

const validationFields: ApiValidationField[] = [
  'answer',
  'comment',
  'revise',
  'evidences',
  'upload_id',
  'evidence_id',
  'variant',
];

describe('F-07 공개 API 계약', () => {
  test('참여 목록·상세·제출 소비자가 snake_case 계약을 그대로 쓴다', () => {
    expect({
      summary,
      detailRequest,
      detailResponse,
      submitRequest,
      submitResponse,
      reopenRequest,
      reopenResponse,
      evidence,
      uploadResponse,
      discardRequest,
      signRequest,
      signResponse,
      validationFields,
    }).toMatchObject({
      summary: { needs_response: true, waiting_for_partner: false },
      detailResponse: {
        my_role: 'CREATOR',
        creator_has_submitted: false,
        partner_has_submitted: true,
        partner_check: null,
      },
      submitResponse: { waiting_for_partner: true, actor_nickname: '작성자' },
      reopenResponse: {
        status: 'CHECKING',
        round_no: 2,
        title: '매일 걷기',
        notification_recipients: [{ user_id: 'partner-id', role: 'PARTNER' }],
      },
      evidence: {
        availability: 'AVAILABLE',
        mime: 'image/jpeg',
      },
      uploadResponse: {
        status: 'READY',
        mime: 'image/jpeg',
      },
      validationFields: [
        'answer',
        'comment',
        'revise',
        'evidences',
        'upload_id',
        'evidence_id',
        'variant',
      ],
    });
  });

  test('네 Edge Function 슬러그가 공개된다', () => {
    expect(ENDPOINT).toMatchObject({
      participantPromiseList: 'participant-promise-list',
      promiseFulfillmentDetail: 'promise-fulfillment-detail',
      fulfillmentSubmit: 'fulfillment-submit',
      fulfillmentReopen: 'fulfillment-reopen',
    });
  });

  test('증빙 선업로드·폐기·서명 URL Endpoint가 공개된다', () => {
    expect(ENDPOINT).toMatchObject({
      evidenceUpload: 'evidence-upload',
      evidenceDiscard: 'evidence-discard',
      evidenceSignUrl: 'evidence-sign-url',
    });
  });
});
