import { createHash } from 'node:crypto';

import { describe, expect, test } from 'vitest';

import { ERROR_CODES, ERROR_HTTP_STATUS } from '../../packages/shared/src/errors.ts';
import { transitionDedupeKey } from '../../packages/shared/src/notification.ts';
import { ApiError, INTERNAL_ERROR, errorBody, toErrorCode } from '../functions/_shared/errors.ts';
import { inviteTokenHash, piiHash, sha256Hex } from '../functions/_shared/hash.ts';
import { failureResponse } from '../functions/_shared/http.ts';
import {
  asTransitionPayload,
  buildTransitionNotification,
} from '../functions/_shared/notify.ts';
import {
  clientIp,
  idempotencyKeyOf,
  jsonBody,
  optionalString,
  rateLimitBucket,
  requiredString,
  surfaceOf,
  userAgent,
} from '../functions/_shared/request.ts';

/**
 * 껍데기 계층 테스트.
 *
 * 이 파일이 존재할 수 있는 이유가 곧 함수 구조의 이유다 — 로직은 `handler.ts`(순수)에 있고
 * `Deno.serve` 와 supabase-js 는 `index.ts`·`runtime.ts` 에만 있다. 모듈 최상단에서 Deno
 * 전역을 건드리면 vitest 가 import 하는 순간 파일 전체가 죽는다.
 */

const NO_LOG = { error: () => {} };

function post(options: { headers?: Record<string, string>; body?: unknown } = {}): Request {
  return new Request('https://ref.supabase.co/functions/v1/x', {
    method: 'POST',
    headers: options.headers ?? {},
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('해시 — 원본 미보관 (§13 · 04 §12-8)', () => {
  test('sha256Hex 는 소문자 hex 64자다', async () => {
    const digest = await sha256Hex('매일 걷기');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toBe(createHash('sha256').update('매일 걷기', 'utf8').digest('hex'));
  });

  test('초대 토큰 해시는 SHA-256(token + pepper) 다 (PO 결정 2026-07-26)', async () => {
    // 발급하는 쪽(T-02)이 나중에 만들어진다. 두 경로가 어긋나면 멀쩡한 링크가 전부
    // E_NOT_FOUND 로 죽고 다른 증상이 없으므로, 규칙을 여기서 못박아 둔다.
    const expected = createHash('sha256').update('tok-abc' + 'pep-xyz', 'utf8').digest('hex');
    expect(await inviteTokenHash('tok-abc', 'pep-xyz')).toBe(expected);
  });

  test('pepper 가 다르면 같은 토큰도 다른 해시가 된다', async () => {
    expect(await inviteTokenHash('tok-abc', 'pep-1')).not.toBe(
      await inviteTokenHash('tok-abc', 'pep-2'),
    );
  });

  test('pepper 를 빠뜨리면 해시가 달라져 링크가 죽는다', async () => {
    // pepper 없이 해싱하는 변이를 잡는다. 이 단언이 없으면 `token + pepper` 를 `token` 으로
    // 바꿔도 위 테스트만 통과하는 구멍이 생긴다.
    expect(await inviteTokenHash('tok-abc', 'pep-xyz')).not.toBe(await sha256Hex('tok-abc'));
  });

  test('PII salt 는 초대 pepper 와 다른 값을 쓴다', async () => {
    // 같은 비밀을 쓰면 링크 인증용 비밀이 새는 순간 저장된 IP 를 되짚는 오라클이 함께 넘어간다.
    expect(await piiHash('1.2.3.4', 'salt-a')).not.toBe(await piiHash('1.2.3.4', 'salt-b'));
  });
});

describe('표면 판정 (§2-1)', () => {
  test('Origin 이 있으면 WEB 이다 — 브라우저는 교차 출처 POST 에 항상 붙인다', () => {
    expect(surfaceOf(post({ headers: { origin: 'https://littlefinger.pages.dev' } }))).toBe('WEB');
  });

  test('Origin 이 없으면 APP 이다 — RN 의 fetch 는 붙이지 않는다', () => {
    expect(surfaceOf(post())).toBe('APP');
  });
});

describe('IP·UA 추출', () => {
  test('cf-connecting-ip 가 있으면 그것을 쓴다', () => {
    // 배포된 함수에서 실제 관측한 헤더다(2026-07-27). Cloudflare 가 넣고 클라이언트는
    // 위조할 수 없다.
    expect(
      clientIp(
        post({ headers: { 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '9.9.9.9' } }),
      ),
    ).toBe('203.0.113.7');
  });

  test('x-forwarded-for 는 **마지막이 아니라 첫** 항목을 예비로 쓴다', () => {
    // 관측된 실제 구조는 [실제주소, 실제주소, 내부홉] 이고 **마지막이 요청마다 바뀐다**.
    // 마지막을 읽으면 빈도 제한 버킷이 매번 새로 생겨 제한이 통째로 무력화된다 —
    // 실제로 210회를 두드려도 429 가 나오지 않았다.
    const request = post({ headers: { 'x-forwarded-for': '203.0.113.7, 203.0.113.7, 10.9.9.9' } });
    expect(clientIp(request)).toBe('203.0.113.7');
    expect(clientIp(request)).not.toBe('10.9.9.9');
  });

  test('항목이 하나뿐이면 그 값이다', () => {
    expect(clientIp(post({ headers: { 'x-forwarded-for': '203.0.113.7' } }))).toBe('203.0.113.7');
  });

  test('같은 클라이언트의 연속 요청은 같은 값을 낸다 — 버킷이 고정돼야 한다', () => {
    // 내부 홉만 바뀌는 두 요청. 값이 갈리면 빈도 제한이 존재하지 않는 것과 같다.
    const a = post({ headers: { 'x-forwarded-for': '203.0.113.7, 203.0.113.7, 10.0.0.1' } });
    const b = post({ headers: { 'x-forwarded-for': '203.0.113.7, 203.0.113.7, 10.0.0.2' } });
    expect(clientIp(a)).toBe(clientIp(b));
  });

  test('헤더가 없으면 null 이고 자리 표시자를 만들지 않는다', () => {
    // approvals.ip_hash 는 nullable 이다. 없는 값을 해싱해 채우면 서로 다른 사람이 같은
    // 해시를 갖게 되어 감사 기록이 거짓말을 한다.
    expect(clientIp(post())).toBeNull();
    expect(userAgent(post())).toBeNull();
  });

  test('빈 x-forwarded-for 도 null 이다', () => {
    expect(clientIp(post({ headers: { 'x-forwarded-for': '' } }))).toBeNull();
  });
});

describe('빈도 제한 버킷', () => {
  test('엔드포인트와 IP 해시를 합친다', () => {
    expect(rateLimitBucket('invite-resolve', 'abc')).toBe('invite-resolve:abc');
  });

  test('IP 를 모르면 unknown 하나를 공유한다 — 건너뛰지 않는다', () => {
    // 건너뛰면 헤더를 지우는 것이 곧 우회가 된다.
    expect(rateLimitBucket('invite-resolve', null)).toBe('invite-resolve:unknown');
  });
});

describe('Idempotency-Key (§7-3.6)', () => {
  const KEY = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

  test('UUID 를 그대로 돌려준다', () => {
    expect(idempotencyKeyOf(post({ headers: { 'idempotency-key': KEY } }))).toBe(KEY);
  });

  test('없으면 E_VALIDATION 이다', () => {
    expect(() => idempotencyKeyOf(post())).toThrow(ApiError);
  });

  test('UUID 가 아니면 거절한다', () => {
    // 임의 문자열을 받아 주면 상수를 보내는 클라이언트가 자기 요청을 첫 응답에 영구히
    // 고정시킨다 — lf_idempotency_begin 은 키가 같으면 캐시를 주는 것이 일이라 막을 수 없다.
    expect(() => idempotencyKeyOf(post({ headers: { 'idempotency-key': 'always-the-same' } })))
      .toThrow(ApiError);
  });
});

describe('본문 파싱', () => {
  test('객체가 아니면 E_VALIDATION 이다', async () => {
    await expect(jsonBody(post({ body: ['x'] }))).rejects.toThrow(ApiError);
    await expect(jsonBody(post())).rejects.toThrow(ApiError);
  });

  test('필수 문자열은 비어 있으면 거절한다', () => {
    expect(() => requiredString({ token: '' }, 'token', 'token')).toThrow(ApiError);
    expect(() => requiredString({}, 'token', 'token')).toThrow(ApiError);
    expect(requiredString({ token: 'abc' }, 'token', 'token')).toBe('abc');
  });

  test('필수 문자열은 길이를 보지 않는다 — 정규화 뒤에 세는 것은 RPC 몫이다 (§2-3)', () => {
    // 껍데기가 먼저 길이를 재면 정규화 이전 값으로 세게 되어, 조합형 자모로 입력된 의견이
    // 서버 규칙보다 길게 잡혀 반려된다.
    expect(requiredString({ comment: 'a' }, 'comment', 'amend_suggestion')).toBe('a');
  });

  test('선택 문자열은 없으면 null 이다', () => {
    expect(optionalString({}, 'reason', 'decline_reason')).toBeNull();
    expect(optionalString({ reason: null }, 'reason', 'decline_reason')).toBeNull();
    expect(optionalString({ reason: '어려워요' }, 'reason', 'decline_reason')).toBe('어려워요');
  });
});

describe('에러 매핑 (§2-3)', () => {
  test('아는 코드 14개가 모두 매핑된다', () => {
    for (const code of ERROR_CODES) {
      expect(toErrorCode(new Error(code))).toBe(code);
    }
  });

  test('모르는 메시지는 null 이다 — 그대로 흘려보내지 않는다', () => {
    // Postgres 는 제약 위반 메시지에 테이블·컬럼·값을 담는다. 그게 응답에 실리면 §9 의
    // "비참여자에게 약속의 존재조차 알리지 않는다"가 실패 경로에서만 무너진다.
    expect(toErrorCode(new Error('duplicate key value violates unique constraint "promises_pkey"')))
      .toBeNull();
  });

  test('모르는 실패는 500 + 내부 오류 문구로 뭉갠다 (EC-C02)', async () => {
    const response = failureResponse(new Error('relation "promises" does not exist'), {
      log: NO_LOG.error,
    });
    expect(response.status).toBe(500);
    const body = await bodyOf(response);
    expect(body['message']).toBe(INTERNAL_ERROR.message);
    expect(JSON.stringify(body)).not.toContain('promises');
  });

  test('모르는 실패 원문은 logger 인자에도 전달하지 않는다', () => {
    const sensitive = [
      '외부에 나오면 안 되는 의견',
      'NOT_KEPT',
      '22222222-2222-2222-2222-222222222222',
      'promise:NT-13:user:INAPP:1:key',
    ];
    const logs: { message: string; detail: unknown }[] = [];
    const response = failureResponse(new Error(sensitive.join('|')), {
      log: (message, detail) => logs.push({ message, detail }),
    });

    expect(response.status).toBe(500);
    const serialized = JSON.stringify(logs);
    for (const value of sensitive) expect(serialized).not.toContain(value);
    expect(logs).toEqual([
      {
        message: 'unmapped RPC failure',
        detail: { reason: 'UNMAPPED_ERROR' },
      },
    ]);
  });

  test('각 코드가 §2-3 의 HTTP 상태로 나간다', async () => {
    for (const code of ERROR_CODES) {
      const response = failureResponse(new Error(code), { log: NO_LOG.error });
      expect(response.status).toBe(ERROR_HTTP_STATUS[code]);
    }
  });

  test('E_VALIDATION 에만 필드 설명이 붙는다', async () => {
    const meaning = { field: 'end_date', message: '종료일이 지났어요.', action: 'AMEND_SUGGEST' } as const;

    const validation = await bodyOf(
      failureResponse(new Error('E_VALIDATION'), { validation: meaning, log: NO_LOG.error }),
    );
    expect(validation).toEqual({
      code: 'E_VALIDATION',
      message: '종료일이 지났어요.',
      field: 'end_date',
      action: 'AMEND_SUGGEST',
    });

    // 만료된 링크에 종료일 안내가 나가면, 사용자가 고칠 수 없는 것을 고치라고 말하게 된다.
    const expired = await bodyOf(
      failureResponse(new Error('E_INVITE_EXPIRED'), { validation: meaning, log: NO_LOG.error }),
    );
    expect(expired['field']).toBeUndefined();
    expect(expired['action']).toBeUndefined();
    expect(expired['message']).toContain('만료');
  });

  test('껍데기가 던진 E_VALIDATION 은 RPC 용 설명을 물려받지 않는다', async () => {
    // Idempotency-Key 누락에 "종료일이 지났어요"가 나가면 안 된다.
    const body = await bodyOf(
      failureResponse(new ApiError('E_VALIDATION', { field: 'idempotency_key' }), {
        validation: { field: 'end_date', message: '종료일이 지났어요.', action: 'AMEND_SUGGEST' },
        log: NO_LOG.error,
      }),
    );
    expect(body['field']).toBe('idempotency_key');
    expect(body['action']).toBeUndefined();
    expect(body['message']).not.toContain('종료일');
  });

  test('errorBody 는 §5 문구가 없으면 공통 문구로 떨어진다', () => {
    expect(errorBody(new ApiError('E_NOT_FOUND')).message).toBe('약속을 찾을 수 없어요.');
  });

  test('실패 응답에 CORS 헤더가 붙는다 — 없으면 브라우저가 본문을 못 읽는다', () => {
    const response = failureResponse(new Error('E_NOT_FOUND'), { log: NO_LOG.error });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('알림 조립 (§8-1 NT-01~03)', () => {
  const PAYLOAD = {
    promise_id: 'p-1',
    creator_id: 'c-1',
    title: '매일 걷기',
    partner: { user_id: 'u-1', nickname: '민준', profile_image_url: null },
  };
  const KEY = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
  const NOW = new Date('2026-07-27T00:30:00Z');

  test('수신자는 상대가 아니라 작성자다 (§8-1 수신자 = C)', () => {
    const row = buildTransitionNotification({
      event: 'NT-01',
      payload: PAYLOAD,
      idempotencyKey: KEY,
      now: NOW,
    });
    expect(row.user_id).toBe('c-1');
    expect(row.user_id).not.toBe(PAYLOAD.partner.user_id);
  });

  test('INAPP 행만 만들고 상태는 SENT 다', () => {
    // push-send 워커가 M2 라, QUEUED 로 두면 그것을 SENT 로 바꿔 줄 사람이 없다.
    // notifications 에는 UPDATE 정책이 아예 없어 영구히 QUEUED 로 남는다.
    const row = buildTransitionNotification({
      event: 'NT-02',
      payload: PAYLOAD,
      idempotencyKey: KEY,
      now: NOW,
    });
    expect(row.channel).toBe('INAPP');
    expect(row.status).toBe('SENT');
    expect(row.sent_at).toBe(NOW.toISOString());
  });

  test('본문은 약속 제목이다 — SCR-A07 두 번째 줄', () => {
    const row = buildTransitionNotification({
      event: 'NT-03',
      payload: PAYLOAD,
      idempotencyKey: KEY,
      now: NOW,
    });
    expect(row.body).toBe('매일 걷기');
  });

  test('제목은 브랜드 톤이고 축하 문형은 승인에만 쓴다', () => {
    const titleOf = (event: 'NT-01' | 'NT-02' | 'NT-03'): string =>
      buildTransitionNotification({ event, payload: PAYLOAD, idempotencyKey: KEY, now: NOW }).title;

    expect(titleOf('NT-01')).toBe('민준님이 손가락 걸었어요! 약속 성립');
    // 거절 알림에 새끼손가락 장식을 붙이면 받는 사람을 놀리는 문구가 된다.
    expect(titleOf('NT-02')).toBe('민준님이 거절했어요');
    expect(titleOf('NT-02')).not.toContain('손가락');
    expect(titleOf('NT-03')).toBe('민준님이 수정을 제안했어요');
  });

  test('수정 제안의 딥링크는 상세가 아니라 재작성 화면이다 (§8-1)', () => {
    const deeplinkOf = (event: 'NT-01' | 'NT-02' | 'NT-03'): string =>
      buildTransitionNotification({ event, payload: PAYLOAD, idempotencyKey: KEY, now: NOW })
        .deeplink;

    expect(deeplinkOf('NT-01')).toBe('SCR-A05');
    expect(deeplinkOf('NT-02')).toBe('SCR-A05');
    expect(deeplinkOf('NT-03')).toBe('SCR-A03');
  });

  test('dedupe_key 는 Idempotency-Key 로 끝나 재시도가 중복을 만들지 않는다', () => {
    const row = buildTransitionNotification({
      event: 'NT-01',
      payload: PAYLOAD,
      idempotencyKey: KEY,
      now: NOW,
    });
    expect(row.dedupe_key).toBe(
      transitionDedupeKey({
        promiseId: 'p-1',
        event: 'NT-01',
        userId: 'c-1',
        channel: 'INAPP',
        idempotencyKey: KEY,
      }),
    );
  });

  test('같은 날 두 번째 수정 제안이 살아남는다 — 날짜 키였다면 사라진다', () => {
    // 작성자가 고쳐 재발송 → 상대가 또 수정 제안. 같은 날 같은 유형 같은 수신자다.
    const first = buildTransitionNotification({
      event: 'NT-03',
      payload: PAYLOAD,
      idempotencyKey: '11111111-1111-1111-1111-111111111111',
      now: NOW,
    });
    const second = buildTransitionNotification({
      event: 'NT-03',
      payload: PAYLOAD,
      idempotencyKey: '22222222-2222-2222-2222-222222222222',
      now: NOW,
    });
    expect(first.dedupe_key).not.toBe(second.dedupe_key);
  });

  test('같은 요청을 재시도하면 같은 dedupe_key 가 나온다', () => {
    const build = (): string =>
      buildTransitionNotification({
        event: 'NT-01',
        payload: PAYLOAD,
        idempotencyKey: KEY,
        // 재시도는 시각이 다르다. 그래도 키는 같아야 UNIQUE 가 중복 삽입을 막는다.
        now: new Date(NOW.getTime() + 5_000),
      }).dedupe_key;

    expect(build()).toBe(
      buildTransitionNotification({
        event: 'NT-01',
        payload: PAYLOAD,
        idempotencyKey: KEY,
        now: NOW,
      }).dedupe_key,
    );
  });

  test('payload 에 알림 재료가 없으면 null 을 돌려준다', () => {
    expect(asTransitionPayload(null)).toBeNull();
    expect(asTransitionPayload({ promise_id: 'p-1' })).toBeNull();
    // title 이 빠진 경우 — RPC 계약이 바뀌면 여기서 걸린다.
    expect(
      asTransitionPayload({ promise_id: 'p', creator_id: 'c', partner: PAYLOAD.partner }),
    ).toBeNull();
    expect(asTransitionPayload({ ...PAYLOAD, partner: { user_id: 'u' } })).toBeNull();
  });

  test('정상 payload 는 그대로 통과한다', () => {
    expect(asTransitionPayload(PAYLOAD)).toEqual(PAYLOAD);
  });
});
