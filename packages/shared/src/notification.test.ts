import { describe, expect, test } from 'vitest';

import {
  NOTIFICATION_DEEPLINK,
  NOTIFICATION_TITLE,
  fulfillmentDedupeKey,
} from './notification.ts';

describe('F-07 알림 계약', () => {
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
});
