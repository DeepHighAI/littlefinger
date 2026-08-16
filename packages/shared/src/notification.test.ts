import { describe, expect, test } from 'vitest';

import {
  NOTIFICATION_DEEPLINK,
  NOTIFICATION_TITLE,
  asNotificationInboxItem,
  asPushNotificationData,
  fulfillmentDedupeKey,
  renderNotificationTemplate,
} from './notification.ts';

describe('F-06 알림 계약', () => {
  test('NT-15~17 변경·파기 알림을 공유 템플릿으로 렌더링한다', () => {
    const render = renderNotificationTemplate as unknown as (
      event: string,
      args: Record<string, unknown>,
    ) => unknown;

    expect(
      render('NT-15', {
        promiseTitle: '매일 걷기',
        partnerNickname: '민준',
        amendType: 'AMEND',
      }),
    ).toEqual({
      title: '민준님이 약속 변경을 요청했어요',
      body: '매일 걷기',
      deeplink: 'SCR-A05',
    });
    expect(
      render('NT-15', {
        promiseTitle: '매일 걷기',
        partnerNickname: '민준',
        amendType: 'CANCEL',
      }),
    ).toMatchObject({ title: '민준님이 약속 파기를 요청했어요' });
    expect(
      render('NT-16', { promiseTitle: '매일 걷기', amendDecision: 'APPROVE' }),
    ).toMatchObject({ title: '요청이 승인됐어요', deeplink: 'SCR-A05' });
    expect(
      render('NT-16', { promiseTitle: '매일 걷기', amendDecision: 'DECLINE' }),
    ).toMatchObject({ title: '요청이 거절됐어요', deeplink: 'SCR-A05' });
    expect(render('NT-17', { promiseTitle: '매일 걷기' })).toMatchObject({
      title: '변경 요청이 자동 철회됐어요',
      deeplink: 'SCR-A05',
    });
  });

  test('NT-15와 NT-16은 잘못된 변경 템플릿 인자를 거절한다', () => {
    const render = renderNotificationTemplate as unknown as (
      event: string,
      args: Record<string, unknown>,
    ) => unknown;

    expect(() =>
      render('NT-15', { promiseTitle: '매일 걷기', partnerNickname: '민준' }),
    ).toThrow('INVALID_NOTIFICATION_TEMPLATE_ARGS');
    expect(() =>
      render('NT-16', { promiseTitle: '매일 걷기', amendDecision: 'MAYBE' }),
    ).toThrow('INVALID_NOTIFICATION_TEMPLATE_ARGS');
  });

  test('NT-04~08·10 예약 알림 제목과 앱 화면이 명세와 같다', () => {
    expect({
      'NT-04': [NOTIFICATION_TITLE['NT-04']('무시'), NOTIFICATION_DEEPLINK['NT-04']],
      'NT-05': [NOTIFICATION_TITLE['NT-05']('무시'), NOTIFICATION_DEEPLINK['NT-05']],
      'NT-06': [NOTIFICATION_TITLE['NT-06']('7'), NOTIFICATION_DEEPLINK['NT-06']],
      'NT-07': [NOTIFICATION_TITLE['NT-07']('무시'), NOTIFICATION_DEEPLINK['NT-07']],
      'NT-08': [NOTIFICATION_TITLE['NT-08']('무시'), NOTIFICATION_DEEPLINK['NT-08']],
      'NT-10': [NOTIFICATION_TITLE['NT-10']('2'), NOTIFICATION_DEEPLINK['NT-10']],
    }).toEqual({
      'NT-04': ['초대가 곧 만료돼요', 'SCR-A04'],
      'NT-05': ['초대가 만료됐어요. 다시 보낼 수 있어요', 'SCR-A04'],
      'NT-06': ['약속까지 7일 남았어요', 'SCR-A05'],
      'NT-07': ['오늘이 약속 종료일이에요', 'SCR-A05'],
      'NT-08': ['약속이 지켜졌나요?', 'SCR-A06'],
      'NT-10': ['이행 확인이 2일 남았어요', 'SCR-A06'],
    });
  });

  test('NT-09·11~14·19 제목과 딥링크가 명세 화면을 가리킨다', () => {
    expect({
      'NT-09': [NOTIFICATION_TITLE['NT-09']('민준'), NOTIFICATION_DEEPLINK['NT-09']],
      'NT-11': [NOTIFICATION_TITLE['NT-11']('무시'), NOTIFICATION_DEEPLINK['NT-11']],
      'NT-12': [NOTIFICATION_TITLE['NT-12']('무시'), NOTIFICATION_DEEPLINK['NT-12']],
      'NT-13': [NOTIFICATION_TITLE['NT-13']('무시'), NOTIFICATION_DEEPLINK['NT-13']],
      'NT-14': [NOTIFICATION_TITLE['NT-14']('무시'), NOTIFICATION_DEEPLINK['NT-14']],
      'NT-19': [NOTIFICATION_TITLE['NT-19']('무시'), NOTIFICATION_DEEPLINK['NT-19']],
    }).toEqual({
      'NT-09': ['민준님이 이행 확인을 보냈어요', 'SCR-A06'],
      'NT-11': ['약속을 지켰어요!', 'SCR-A05'],
      'NT-12': ['약속이 불이행으로 기록됐어요', 'SCR-A05'],
      'NT-13': ['두 분의 확인이 서로 달라요', 'SCR-A05'],
      'NT-14': ['이행 확인 없이 종결됐어요', 'SCR-A05'],
      'NT-19': ['다시 확인해 달라는 요청이 왔어요', 'SCR-A06'],
    });
  });

  test('NT-18 증인 확인은 증인 닉네임과 SCR-A05를 사용한다', () => {
    expect(NOTIFICATION_TITLE['NT-18']('하영')).toBe('하영님이 내용을 확인했어요');
    expect(NOTIFICATION_DEEPLINK['NT-18']).toBe('SCR-A05');
    expect(
      renderNotificationTemplate('NT-18', {
        promiseTitle: '아침 러닝',
        partnerNickname: '하영',
      }),
    ).toEqual({
      title: '하영님이 내용을 확인했어요',
      body: '아침 러닝',
      deeplink: 'SCR-A05',
    });
  });

  test('이행 알림 dedupe key는 라운드와 요청 키를 모두 포함한다', () => {
    expect(
      fulfillmentDedupeKey({
        promiseId: 'promise-1',
        event: 'NT-09',
        userId: 'partner-1',
        channel: 'INAPP',
        roundNo: 2,
        idempotencyKey: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
      }),
    ).toBe(
      'promise-1:NT-09:partner-1:INAPP:2:3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    );
  });

  test('푸시 데이터는 UUID와 알려진 화면 ID를 모두 검증한다', () => {
    const valid = {
      notification_id: '11111111-1111-4111-8111-111111111111',
      deeplink: 'SCR-A06',
      promise_id: '22222222-2222-4222-8222-222222222222',
    };

    expect(asPushNotificationData(valid)).toEqual(valid);
    expect(asPushNotificationData({ ...valid, notification_id: 'not-a-uuid' })).toBeNull();
    expect(asPushNotificationData({ ...valid, promise_id: 'not-a-uuid' })).toBeNull();
    expect(asPushNotificationData({ ...valid, deeplink: 'https://evil.example' })).toBeNull();
    expect(asPushNotificationData({ ...valid, deeplink: 'SCR-A99' })).toBeNull();
    expect(asPushNotificationData({ ...valid, extra: 'rejected' })).toBeNull();
    expect(asPushNotificationData({ ...valid, url: 'https://evil.example' })).toBeNull();
  });

  test('알림함 공개 경계는 이벤트의 공유 경로를 사용하고 내부 필드를 제거한다', () => {
    const raw = {
      notification_id: '11111111-1111-4111-8111-111111111111',
      promise_id: '22222222-2222-4222-8222-222222222222',
      event: 'NT-01',
      title: '약속 성립',
      body: '매일 걷기',
      deeplink: 'https://evil.example/steal',
      created_at: '2026-08-15T00:00:00Z',
      read_at: null,
      dedupe_key: 'internal-only',
      status: 'SENT',
    };

    expect(asNotificationInboxItem(raw)).toEqual({
      notification_id: '11111111-1111-4111-8111-111111111111',
      promise_id: '22222222-2222-4222-8222-222222222222',
      event: 'NT-01',
      title: '약속 성립',
      body: '매일 걷기',
      deeplink: 'SCR-A05',
      created_at: '2026-08-15T00:00:00Z',
      read_at: null,
    });
  });

  test('알림함 공개 경계는 공유 계약에 없는 이벤트를 거절한다', () => {
    expect(
      asNotificationInboxItem({
        notification_id: '11111111-1111-4111-8111-111111111111',
        promise_id: '22222222-2222-4222-8222-222222222222',
        event: 'INTERNAL-ONLY',
        title: '내부 알림',
        body: '노출 금지',
        deeplink: 'SCR-A05',
        created_at: '2026-08-15T00:00:00Z',
        read_at: null,
      }),
    ).toBeNull();
  });

  test.each([
    ['created_at', '2026-02-30T00:00:00Z'],
    ['created_at', '2026-08-15 00:00:00Z'],
    ['read_at', '2026-02-30T00:00:00Z'],
  ] as const)('알림함 공개 경계는 잘못된 %s instant를 거절한다', (field, value) => {
    const raw = {
      notification_id: '11111111-1111-4111-8111-111111111111',
      promise_id: '22222222-2222-4222-8222-222222222222',
      event: 'NT-01',
      title: '약속 성립',
      body: '매일 걷기',
      deeplink: 'SCR-A05',
      created_at: '2026-08-15T00:00:00Z',
      read_at: null,
      [field]: value,
    };

    expect(asNotificationInboxItem(raw)).toBeNull();
  });

  test('outbox 템플릿 인자를 공유 계약으로 렌더링한다', () => {
    expect(
      renderNotificationTemplate('NT-01', {
        partnerNickname: '민준',
        promiseTitle: '매일 걷기',
      }),
    ).toEqual({
      title: '민준님이 손가락 걸었어요! 약속 성립',
      body: '매일 걷기',
      deeplink: 'SCR-A05',
    });
    expect(
      renderNotificationTemplate('NT-06', { days: 3, promiseTitle: '매일 걷기' }),
    ).toEqual({
      title: '약속까지 3일 남았어요',
      body: '매일 걷기',
      deeplink: 'SCR-A05',
    });
  });

  test('필수 템플릿 인자가 없으면 렌더링하지 않는다', () => {
    expect(() => renderNotificationTemplate('NT-09', { promiseTitle: '매일 걷기' })).toThrow(
      'INVALID_NOTIFICATION_TEMPLATE_ARGS',
    );
    expect(() =>
      renderNotificationTemplate('NT-10', { days: 0, promiseTitle: '매일 걷기' }),
    ).toThrow('INVALID_NOTIFICATION_TEMPLATE_ARGS');
    expect(() => renderNotificationTemplate('NT-18', { promiseTitle: '매일 걷기' })).toThrow(
      'INVALID_NOTIFICATION_TEMPLATE_ARGS',
    );
  });
});
