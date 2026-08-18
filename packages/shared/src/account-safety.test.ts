import { describe, expect, test } from 'vitest';

import {
  asAccountWithdrawResponse,
  asProfileNicknameUpdateResponse,
  asPromiseHideResponse,
  asSafetyReportResponse,
  asUserBlockResponse,
} from './account-safety.ts';

const PROMISE_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const TARGET_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3302';
const REPORT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3303';

describe('계정·안전 공개 응답 경계', () => {
  test('정확한 공개 필드만 허용한다', () => {
    expect(asAccountWithdrawResponse({ status: 'WITHDRAWN' })).toEqual({ status: 'WITHDRAWN' });
    expect(asProfileNicknameUpdateResponse({ nickname: '새 닉네임' })).toEqual({ nickname: '새 닉네임' });
    expect(asPromiseHideResponse({ promise_id: PROMISE_ID, hidden: true })).toEqual({ promise_id: PROMISE_ID, hidden: true });
    expect(asUserBlockResponse({ target_user_id: TARGET_ID, blocked: true })).toEqual({ target_user_id: TARGET_ID, blocked: true });
    expect(asSafetyReportResponse({ report_id: REPORT_ID, status: 'RECEIVED', evidence_blinded: true })).toEqual({ report_id: REPORT_ID, status: 'RECEIVED', evidence_blinded: true });
  });

  test('잘못된 값이나 내부 필드가 섞이면 fail-closed 한다', () => {
    expect(asAccountWithdrawResponse({ status: 'ACTIVE' })).toBeNull();
    expect(asProfileNicknameUpdateResponse({ nickname: '' })).toBeNull();
    expect(asPromiseHideResponse({ promise_id: 'bad', hidden: true })).toBeNull();
    expect(asUserBlockResponse({ target_user_id: TARGET_ID, blocked: true, secret: 'x' })).toBeNull();
    expect(asSafetyReportResponse({ report_id: REPORT_ID, status: 'ACTIONED', evidence_blinded: false })).toBeNull();
  });
});
