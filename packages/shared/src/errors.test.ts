import { describe, expect, test } from 'vitest';

import { INVITE_TTL_HOURS, WITNESS_MAX } from './config.ts';
import { ERROR_CODES, ERROR_HTTP_STATUS, ERROR_MESSAGE } from './errors.ts';

// 근거: 02_세부기능명세서 §2-3 에러 코드표 + 수익화 개정(PO 2026-08-29)
describe('ERROR_CODES', () => {
  test('명세와 수익화 오류 코드를 빠짐없이 정의한다', () => {
    expect([...ERROR_CODES].sort()).toEqual(
      [
        'E_AUTH_REQUIRED',
        'E_BLOCKED',
        'E_DUPLICATE_ROLE',
        'E_END_DATE_RANGE',
        'E_FORBIDDEN',
        'E_INVITE_EXPIRED',
        'E_INVITE_REVOKED',
        'E_INVITE_USED',
        'E_NOT_FOUND',
        'E_RATE_LIMIT',
        'E_REWARD_NOT_ELIGIBLE',
        'E_SELF_INVITE',
        'E_SLOT_LIMIT',
        'E_STATE_CONFLICT',
        'E_UPLOAD_FAILED',
        'E_VALIDATION',
        'E_WITNESS_LIMIT',
      ].sort(),
    );
  });

  test('모든 코드에 HTTP 상태와 문구 항목이 있다', () => {
    for (const code of ERROR_CODES) {
      expect(ERROR_HTTP_STATUS[code], `${code} 의 HTTP 상태`).toBeTypeOf('number');
      expect(ERROR_MESSAGE, `${code} 의 문구`).toHaveProperty(code);
    }
  });
});

describe('ERROR_HTTP_STATUS', () => {
  test('명세표의 상태 코드를 그대로 쓴다', () => {
    expect(ERROR_HTTP_STATUS.E_AUTH_REQUIRED).toBe(401);
    expect(ERROR_HTTP_STATUS.E_FORBIDDEN).toBe(403);
    expect(ERROR_HTTP_STATUS.E_NOT_FOUND).toBe(404);
    expect(ERROR_HTTP_STATUS.E_INVITE_EXPIRED).toBe(410);
    expect(ERROR_HTTP_STATUS.E_INVITE_USED).toBe(410);
    expect(ERROR_HTTP_STATUS.E_INVITE_REVOKED).toBe(410);
    expect(ERROR_HTTP_STATUS.E_STATE_CONFLICT).toBe(409);
    expect(ERROR_HTTP_STATUS.E_VALIDATION).toBe(422);
    expect(ERROR_HTTP_STATUS.E_SELF_INVITE).toBe(422);
    expect(ERROR_HTTP_STATUS.E_DUPLICATE_ROLE).toBe(422);
    expect(ERROR_HTTP_STATUS.E_WITNESS_LIMIT).toBe(422);
    expect(ERROR_HTTP_STATUS.E_BLOCKED).toBe(422);
    expect(ERROR_HTTP_STATUS.E_RATE_LIMIT).toBe(429);
    expect(ERROR_HTTP_STATUS.E_UPLOAD_FAILED).toBe(400);
    // 결제로만 풀리는 한도 — Payment Required 를 그대로 쓴다.
    expect(ERROR_HTTP_STATUS.E_SLOT_LIMIT).toBe(402);
  });
});

describe('ERROR_MESSAGE', () => {
  test('명세 문구를 원문 그대로 쓴다', () => {
    expect(ERROR_MESSAGE.E_AUTH_REQUIRED).toBe('다시 로그인해 주세요.');
    expect(ERROR_MESSAGE.E_FORBIDDEN).toBe('이 약속에 대한 권한이 없어요.');
    expect(ERROR_MESSAGE.E_NOT_FOUND).toBe('약속을 찾을 수 없어요.');
    expect(ERROR_MESSAGE.E_INVITE_USED).toBe('이미 사용된 초대 링크예요.');
    expect(ERROR_MESSAGE.E_INVITE_REVOKED).toBe(
      '작성자가 초대를 다시 보냈어요. 최신 링크를 확인해 주세요.',
    );
    expect(ERROR_MESSAGE.E_STATE_CONFLICT).toBe(
      '약속 상태가 변경됐어요. 새로고침 후 다시 시도해 주세요.',
    );
    expect(ERROR_MESSAGE.E_SELF_INVITE).toBe('본인은 상대방이 될 수 없어요.');
    expect(ERROR_MESSAGE.E_DUPLICATE_ROLE).toBe('이미 이 약속에 참여하고 있어요.');
    expect(ERROR_MESSAGE.E_BLOCKED).toBe('초대를 받을 수 없습니다.');
    expect(ERROR_MESSAGE.E_RATE_LIMIT).toBe('잠시 후 다시 시도해 주세요.');
    expect(ERROR_MESSAGE.E_UPLOAD_FAILED).toBe('사진을 올리지 못했어요. 다시 시도해 주세요.');
    expect(ERROR_MESSAGE.E_SLOT_LIMIT).toBe(
      '약속 슬롯이 가득 찼어요. 슬롯을 추가하면 새 약속을 보낼 수 있어요.',
    );
  });

  test('E_VALIDATION 은 공통 문구가 없다 — 필드별 문구(§5)를 쓴다', () => {
    expect(ERROR_MESSAGE.E_VALIDATION).toBeNull();
  });

  test('만료 문구의 시간은 INVITE_TTL_HOURS 에서 온다', () => {
    // "(72시간)" 을 문자열에 박으면 정책값이 바뀔 때 문구만 남는다.
    expect(ERROR_MESSAGE.E_INVITE_EXPIRED).toBe(`초대 링크가 만료됐어요. (${INVITE_TTL_HOURS}시간)`);
    expect(ERROR_MESSAGE.E_INVITE_EXPIRED).toContain('72');
  });

  test('증인 제한은 구매·광고 여부를 노출하지 않는 중립 문구다', () => {
    expect(WITNESS_MAX).toBe(3);
    expect(ERROR_MESSAGE.E_WITNESS_LIMIT).toBe('지금 사용할 수 있는 증인 자리를 모두 사용했어요.');
  });
});
