// 커밋 뒤 알림 — 02 §8-1 NT-01·NT-02·NT-03.
//
// **트랜잭션 밖이다.** EC-C02 가 알림을 명시적으로 예외로 빼고, ADR 0003 이 그 자리를
// 껍데기로 정했다. RPC 는 알림 행을 쓰지 않는 대신 상대 닉네임·프로필·제목을 payload 에
// 담아 돌려주므로, 여기서 두 번째 조회 없이 행을 만든다.
//
// 지금은 **INAPP 행만** 쓴다(PO 결정 2026-07-26). PUSH 행은 `push-send` 워커가 생기는 M2 에
// 함께 들어간다 — `notifications` 에는 UPDATE 정책이 아예 없어서, 보낼 사람이 없는 지금
// QUEUED 행을 만들면 영원히 QUEUED 로 남는 거짓 기록이 된다.

import {
  NOTIFICATION_DEEPLINK,
  NOTIFICATION_TITLE,
  type NotificationEvent,
  transitionDedupeKey,
} from '../../../packages/shared/src/notification.ts';

/** RPC payload 중 알림을 만드는 데 쓰는 부분 */
export interface TransitionPayload {
  promise_id: string;
  creator_id: string;
  title: string;
  partner: { user_id: string; nickname: string; profile_image_url: string | null };
}

export interface NotificationRow {
  user_id: string;
  promise_id: string;
  type: NotificationEvent;
  channel: 'INAPP';
  title: string;
  body: string;
  deeplink: string;
  status: 'SENT';
  sent_at: string;
  dedupe_key: string;
  push_dedupe_key: string;
}

/**
 * 세 이벤트 모두 수신자는 **작성자 한 명**이다(§8-1 수신자 열 = C).
 *
 * 상대방에게는 보내지 않는다 — 상대는 방금 그 행동을 한 본인이라, 자기 행동을 알림으로
 * 되돌려 받게 된다.
 *
 * INAPP 은 행이 존재하는 순간이 곧 도달이므로 `SENT` 로 쓴다. QUEUED 로 두면 아무도 그것을
 * SENT 로 바꿔 주지 않는다.
 */
export function buildTransitionNotification(input: {
  event: NotificationEvent;
  payload: TransitionPayload;
  idempotencyKey: string;
  now: Date;
}): NotificationRow {
  const { event, payload } = input;
  const channel = 'INAPP' as const;

  return {
    user_id: payload.creator_id,
    promise_id: payload.promise_id,
    type: event,
    channel,
    title: NOTIFICATION_TITLE[event](payload.partner.nickname),
    // SCR-A07 의 두 번째 줄이 "약속 제목 · 상대 시각"이다. 제목이 없으면 약속이 여러 건일 때
    // 어느 것에 대한 알림인지 알 수 없다.
    body: payload.title,
    deeplink: NOTIFICATION_DEEPLINK[event],
    status: 'SENT',
    sent_at: input.now.toISOString(),
    dedupe_key: transitionDedupeKey({
      promiseId: payload.promise_id,
      event,
      userId: payload.creator_id,
      channel,
      idempotencyKey: input.idempotencyKey,
    }),
    push_dedupe_key: transitionDedupeKey({
      promiseId: payload.promise_id,
      event,
      userId: payload.creator_id,
      channel: 'PUSH',
      idempotencyKey: input.idempotencyKey,
    }),
  };
}

/** 런타임이 직접 테이블을 쓰지 않고 내부 fanout RPC에 넘길 인자만 조립한다. */
export function notificationFanoutArgs(row: NotificationRow): Record<string, unknown> {
  return {
    p_user_id: row.user_id,
    p_promise_id: row.promise_id,
    p_type: row.type,
    p_title: row.title,
    p_body: row.body,
    p_deeplink: row.deeplink,
    p_inapp_dedupe_key: row.dedupe_key,
    p_push_dedupe_key: row.push_dedupe_key,
    p_now: row.sent_at,
  };
}

/**
 * payload 가 알림을 만들 재료를 갖췄는지 본다.
 *
 * RPC 계약이 바뀌어 키가 빠지면 여기서 걸러 알림만 건너뛴다. 이미 커밋된 전이를 알림 실패로
 * 되돌릴 수는 없으므로(EC-C02), 응답은 그대로 나가고 로그만 남는다.
 */
export function asTransitionPayload(value: unknown): TransitionPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const partner = row['partner'];

  if (
    typeof row['promise_id'] !== 'string' ||
    typeof row['creator_id'] !== 'string' ||
    typeof row['title'] !== 'string' ||
    typeof partner !== 'object' ||
    partner === null
  ) {
    return null;
  }

  const partnerRow = partner as Record<string, unknown>;
  if (typeof partnerRow['user_id'] !== 'string' || typeof partnerRow['nickname'] !== 'string') {
    return null;
  }

  return {
    promise_id: row['promise_id'],
    creator_id: row['creator_id'],
    title: row['title'],
    partner: {
      user_id: partnerRow['user_id'],
      nickname: partnerRow['nickname'],
      profile_image_url:
        typeof partnerRow['profile_image_url'] === 'string'
          ? partnerRow['profile_image_url']
          : null,
    },
  };
}
