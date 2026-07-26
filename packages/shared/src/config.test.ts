import { describe, expect, test } from 'vitest';

import {
  ACCESS_TOKEN_TTL_MIN,
  ADS_ACTIVATION_DAILY_CONFIRMS,
  ADS_ENABLED_DEFAULT,
  AMEND_AUTO_WITHDRAW_DAYS,
  AMEND_MAX_ROUNDS,
  CHECK_DEADLINE_DAYS,
  DEVICE_TOKEN_MAX,
  DRAFT_MAX_CONCURRENT,
  DRAFT_TTL_DAYS,
  END_DATE_MAX_DAYS,
  EVIDENCE_MAX_COUNT,
  EVIDENCE_MAX_MB,
  EVIDENCE_RETENTION_DAYS,
  EVIDENCE_SIGNED_URL_MIN,
  IMMINENT_THRESHOLD_DAYS,
  INVITE_RESEND_MAX,
  INVITE_TTL_HOURS,
  PROMISE_MAX_PER_DAY,
  QUIET_HOURS_KST,
  REFRESH_TOKEN_TTL_DAYS,
  REMINDER_OFFSETS_DAYS,
  REMINDER_SEND_HOUR_KST,
  TRUST_MIN_SAMPLE,
  WITNESS_MAX,
} from './config.js';

// 근거: 02_세부기능명세서 §11-3 설정값 목록.
// 값이 명세와 어긋나면 실패한다. 정책 수치를 코드 여기저기 박지 않기 위한 단일 출처다.
describe('PO 확정값 (변경 금지)', () => {
  test('초대 링크 유효 시간은 72시간이다', () => {
    expect(INVITE_TTL_HOURS).toBe(72);
  });

  test('증인은 최대 2명이다', () => {
    expect(WITNESS_MAX).toBe(2);
  });

  test('광고 활성화 검토 기준은 일 확정 100건이다', () => {
    expect(ADS_ACTIVATION_DAILY_CONFIRMS).toBe(100);
  });

  test('광고는 기본적으로 꺼져 있다', () => {
    expect(ADS_ENABLED_DEFAULT).toBe(false);
  });
});

describe('기본안 (PO 미확정 — 원격으로 바뀔 수 있다)', () => {
  test('이행 확인 기한은 7일이다', () => {
    expect(CHECK_DEADLINE_DAYS).toBe(7);
  });

  test('변경 요청 자동 철회는 7일이다', () => {
    expect(AMEND_AUTO_WITHDRAW_DAYS).toBe(7);
  });

  test('리마인드는 D-7 / D-3 / D-1 / D-Day 에 보낸다', () => {
    expect(REMINDER_OFFSETS_DAYS).toEqual([7, 3, 1, 0]);
  });

  test('리마인드 발송 시각은 KST 09시다', () => {
    expect(REMINDER_SEND_HOUR_KST).toBe(9);
  });

  test('조용한 시간은 KST 21시부터 08시까지다', () => {
    expect(QUIET_HOURS_KST).toEqual({ startHour: 21, endHour: 8 });
  });

  test('액세스 토큰은 30분, 리프레시 토큰은 30일이다', () => {
    expect(ACCESS_TOKEN_TTL_MIN).toBe(30);
    expect(REFRESH_TOKEN_TTL_DAYS).toBe(30);
  });

  test('지킴율 최소 표본은 3건이다', () => {
    expect(TRUST_MIN_SAMPLE).toBe(3);
  });

  test('증빙은 최대 3장, 장당 10MB 다', () => {
    expect(EVIDENCE_MAX_COUNT).toBe(3);
    expect(EVIDENCE_MAX_MB).toBe(10);
  });

  test('DRAFT 동시 보유 20건, 하루 약속 생성 30건이 상한이다', () => {
    expect(DRAFT_MAX_CONCURRENT).toBe(20);
    expect(PROMISE_MAX_PER_DAY).toBe(30);
  });

  test('초대 재발송은 10회까지다', () => {
    expect(INVITE_RESEND_MAX).toBe(10);
  });

  test('기기 토큰은 3개까지다', () => {
    expect(DEVICE_TOKEN_MAX).toBe(3);
  });

  test('종료일은 오늘+365일까지다', () => {
    expect(END_DATE_MAX_DAYS).toBe(365);
  });

  test('증빙 보존은 365일, DRAFT 보존은 90일이다', () => {
    expect(EVIDENCE_RETENTION_DAYS).toBe(365);
    expect(DRAFT_TTL_DAYS).toBe(90);
  });

  test('재협의 라운드는 무제한이라 상한이 없다', () => {
    // S-10 기본안 "무제한". 숫자 상한이 아니라 부재를 명시한다.
    expect(AMEND_MAX_ROUNDS).toBeNull();
  });
});

describe('§11-3 표에 이름이 없지만 코드에 박으면 안 되는 값', () => {
  test('증빙 서명 URL 은 10분간 유효하다', () => {
    // 04 §12-8 · 02 §13 "비공개 버킷 + 10분 서명 URL"
    expect(EVIDENCE_SIGNED_URL_MIN).toBe(10);
  });

  test('임박 기준은 D-3 이내다', () => {
    // 02 §6-4 파생값 "0 ≤ D ≤ 3 이고 상태 ACTIVE"
    expect(IMMINENT_THRESHOLD_DAYS).toBe(3);
  });
});
