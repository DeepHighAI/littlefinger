import {
  isInviteUnavailableReason,
  phaseAfterResolve,
  phaseForInviteFailure,
} from './invite-review-state.ts';

import type { InviteResolveResponse } from '@littlefinger/shared';

const INVITE: InviteResolveResponse = {
  creator_nickname: '지우',
  title: '매일 걷기',
  expires_at: '2026-08-23T00:00:00Z',
  target_role: 'PARTNER',
};

describe('phaseAfterResolve', () => {
  test('비로그인 PARTNER 는 랜딩, 로그인 PARTNER 는 검토 로딩이다', () => {
    expect(phaseAfterResolve(INVITE, false)).toEqual({ kind: 'LANDING', invite: INVITE });
    expect(phaseAfterResolve(INVITE, true)).toEqual({ kind: 'REVIEW_LOADING', invite: INVITE });
  });

  test('증인 토큰은 세션과 무관하게 웹 핸드오프다', () => {
    const witness = { ...INVITE, target_role: 'WITNESS' as const };
    expect(phaseAfterResolve(witness, false).kind).toBe('HANDOFF');
    expect(phaseAfterResolve(witness, true).kind).toBe('HANDOFF');
  });
});

describe('phaseForInviteFailure', () => {
  test('링크가 죽은 다섯 사유는 UNAVAILABLE 로 간다 (SCR-W06 동형)', () => {
    for (const code of [
      'E_INVITE_EXPIRED',
      'E_INVITE_USED',
      'E_INVITE_REVOKED',
      'E_BLOCKED',
      'E_NOT_FOUND',
    ] as const) {
      expect(phaseForInviteFailure(code, '')).toEqual({ kind: 'UNAVAILABLE', reason: code });
      expect(isInviteUnavailableReason(code)).toBe(true);
    }
  });

  test('자기 초대는 링크 사망이 아니라 별도 화면이다 (EC-B05)', () => {
    expect(phaseForInviteFailure('E_SELF_INVITE', '')).toEqual({ kind: 'SELF_INVITE' });
  });

  test('그 밖의 실패는 재시도 화면이다 — E_RATE_LIMIT 은 잠시 후 열린다', () => {
    expect(phaseForInviteFailure('E_RATE_LIMIT', '요청이 많아요')).toEqual({
      kind: 'RETRY',
      message: '요청이 많아요',
    });
    expect(phaseForInviteFailure(null, '네트워크 오류')).toEqual({
      kind: 'RETRY',
      message: '네트워크 오류',
    });
  });
});
