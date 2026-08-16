import { describe, expect, test } from 'vitest';

import * as shared from './index.ts';

const detail = {
  nickname: '지우',
  profile_image_url: 'https://example.com/profile.jpg',
  keep_rate: 75,
  completed_count: 3,
  broken_count: 1,
  disputed_count: 2,
  unresolved_count: 1,
  active_count: 4,
  updated_at: '2026-08-17T00:00:00.000Z',
  reminders: {
    remind_d7: true,
    remind_d3: true,
    remind_d1: false,
    remind_dday: true,
    remind_hour: '12',
  },
} as const;

function functionExport(name: string): (value: unknown) => unknown {
  const value = (shared as unknown as Record<string, unknown>)[name];
  expect(value, `${name} 공개 export`).toBeTypeOf('function');
  return value as (input: unknown) => unknown;
}

describe('F-09 신뢰 프로필 공개 계약', () => {
  test('리마인드 시각과 기본 설정은 명세의 세 값과 전체 활성 상태다', () => {
    expect((shared as unknown as Record<string, unknown>)['REMINDER_HOURS']).toEqual([
      '09',
      '12',
      '20',
    ]);
    expect(
      (shared as unknown as Record<string, unknown>)['DEFAULT_REMINDER_PREFERENCES'],
    ).toEqual({
      remind_d7: true,
      remind_d3: true,
      remind_d1: true,
      remind_dday: true,
      remind_hour: '09',
    });
  });

  test('상세 응답은 승인된 키와 값만 허용한다', () => {
    const parse = functionExport('asTrustProfileDetailResponse');

    expect(parse(detail)).toEqual(detail);
    expect(parse({ ...detail, kakao_id: 'forbidden' })).toBeNull();
    expect(parse({ ...detail, keep_rate: 101 })).toBeNull();
    expect(parse({ ...detail, keep_rate: 75.5 })).toBeNull();
    expect(parse({ ...detail, completed_count: -1 })).toBeNull();
    expect(parse({ ...detail, profile_image_url: 'http://example.com/a.jpg' })).toBeNull();
    expect(parse({ ...detail, updated_at: 'not-an-instant' })).toBeNull();
    expect(
      parse({
        ...detail,
        reminders: { ...detail.reminders, remind_hour: '10' },
      }),
    ).toBeNull();
  });

  test('설정 변경과 기기 해제 응답도 정확한 키만 허용한다', () => {
    const parseSettings = functionExport('asTrustProfileSettingsUpdateResponse');
    const parseUnregister = functionExport('asDeviceTokenUnregisterResponse');
    const settings = {
      reminders: detail.reminders,
      updated_at: detail.updated_at,
    };

    expect(parseSettings(settings)).toEqual(settings);
    expect(parseSettings({ ...settings, extra: true })).toBeNull();
    expect(parseUnregister({ removed: true })).toEqual({ removed: true });
    expect(parseUnregister({ removed: false })).toEqual({ removed: false });
    expect(parseUnregister({ removed: true, token: 'forbidden' })).toBeNull();
  });
});
