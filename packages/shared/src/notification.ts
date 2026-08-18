/**
 * 알림 이벤트 — 02_세부기능명세서 §8-1 · §6-2.
 *
 * `notifications.type` 에 들어가는 값은 §6-2 가 "§8-1 NT 코드"라고 못박았다. 그래서 이 파일의
 * 어휘가 곧 DB 에 저장되는 문자열이고, `notifications` 는 UPDATE 정책이 아예 없는 append-only
 * 테이블이라 **첫 행을 쓰는 순간 되돌릴 수 없다**.
 *
 * §8-1 은 NT-01~NT-19 를 나열하지만 여기에는 실제로 발송하는 것만 둔다. 전이표에 없는 전이를
 * 구현하지 않는 것과 같은 이유다 — 쓰지 않는 코드에 문구를 붙여 두면 그 문구가 검토를 거치지
 * 않은 채 나중에 그대로 나간다.
 *
 * `promise.ts` 의 `NotificationType` 과는 층이 다르다. 그쪽은 알림함 아이콘을 고르는 **분류**고
 * 이쪽은 **어떤 사건이었는지**다. 한 분류에 여러 사건이 들어간다.
 */

import type { NotificationInboxItem } from './api.ts';
import { isIsoInstant } from './datetime.ts';

/** §8-1 NT 코드 중 현재 계약과 발송 경로가 있는 것 */
export type NotificationEvent =
  | 'NT-01'
  | 'NT-02'
  | 'NT-03'
  | 'NT-04'
  | 'NT-05'
  | 'NT-06'
  | 'NT-07'
  | 'NT-08'
  | 'NT-09'
  | 'NT-10'
  | 'NT-11'
  | 'NT-12'
  | 'NT-13'
  | 'NT-14'
  | 'NT-15'
  | 'NT-16'
  | 'NT-17'
  | 'NT-18'
  | 'NT-19'
  | 'NT-20'
  | 'NT-21';

export type ReminderKind =
  | 'D7'
  | 'D3'
  | 'D1'
  | 'DDAY'
  | 'CHECK_REQ'
  | 'CHECK_R1'
  | 'CHECK_R2'
  | 'AMEND_REMIND'
  | 'INVITE_EXPIRE_SOON'
  | 'DRAFT_RESUME'
  | 'DRAFT_DELETE_SOON';

export type FulfillmentNotificationEvent = Extract<
  NotificationEvent,
  'NT-09' | 'NT-11' | 'NT-12' | 'NT-13' | 'NT-14' | 'NT-19'
>;

/**
 * 알림 제목. 디자인 레퍼런스의 브랜드 톤을 따른다(PO 결정 2026-07-26).
 *
 * 축하 문형은 **승인에만** 쓴다. 원본 마크업이 그렇게 갈라 두었고(SCR-A07 은 "손가락 걸었어요!",
 * SCR-A05/DECLINED 는 "거절했어요") 그 구분이 옳다 — 거절 알림에 새끼손가락 장식을 붙이면
 * 받는 사람을 놀리는 문구가 된다.
 *
 * NT-03 은 레퍼런스에 문구가 없어 같은 화면의 형제 문구("민준님이 변경을 요청했어요", NT-15)와
 * 같은 문형으로 맞췄다.
 */
export const NOTIFICATION_TITLE: Record<NotificationEvent, (partnerNickname: string) => string> = {
  'NT-01': (n) => `${n}님이 손가락 걸었어요! 약속 성립`,
  'NT-02': (n) => `${n}님이 거절했어요`,
  'NT-03': (n) => `${n}님이 수정을 제안했어요`,
  'NT-04': () => '초대가 곧 만료돼요',
  'NT-05': () => '초대가 만료됐어요. 다시 보낼 수 있어요',
  'NT-06': (n) => `약속까지 ${n}일 남았어요`,
  'NT-07': () => '오늘이 약속 종료일이에요',
  'NT-08': () => '약속이 지켜졌나요?',
  'NT-09': (n) => `${n}님이 이행 확인을 보냈어요`,
  'NT-10': (n) => `이행 확인이 ${n}일 남았어요`,
  'NT-11': () => '약속을 지켰어요!',
  'NT-12': () => '약속이 불이행으로 기록됐어요',
  'NT-13': () => '두 분의 확인이 서로 달라요',
  'NT-14': () => '이행 확인 없이 종결됐어요',
  'NT-15': (n) => `${n}님이 약속 변경을 요청했어요`,
  'NT-16': (n) => `요청이 ${n}됐어요`,
  'NT-17': () => '변경 요청이 자동 철회됐어요',
  'NT-18': (n) => `${n}님이 내용을 확인했어요`,
  'NT-19': () => '다시 확인해 달라는 요청이 왔어요',
  'NT-20': () => '작성 중인 약속이 있어요',
  'NT-21': () => '작성 중인 약속이 7일 뒤 삭제돼요',
};

/**
 * 알림함 항목을 탭했을 때 갈 화면. §8-1 딥링크 열의 값 그대로다.
 *
 * URL 이 아니라 **화면 ID** 를 저장한다. 라우트는 앱이 아직 만들지 않았고, `notifications` 에
 * UPDATE 정책이 없어 지금 박아 넣은 URL 이 틀리면 영구히 고칠 수 없다. 같은 행에 `promise_id`
 * 가 이미 있으므로 클라이언트가 화면 ID + 인자로 경로를 조립하면 된다.
 */
export type NotificationDeeplink = 'SCR-A03' | 'SCR-A04' | 'SCR-A05' | 'SCR-A06';

export const NOTIFICATION_DEEPLINK: Record<NotificationEvent, NotificationDeeplink> = {
  'NT-01': 'SCR-A05',
  'NT-02': 'SCR-A05',
  // 수정 제안은 약속이 DRAFT 로 돌아간 뒤라, 갈 곳은 상세가 아니라 재작성 화면이다.
  'NT-03': 'SCR-A03',
  'NT-04': 'SCR-A04',
  'NT-05': 'SCR-A04',
  'NT-06': 'SCR-A05',
  'NT-07': 'SCR-A05',
  'NT-08': 'SCR-A06',
  'NT-09': 'SCR-A06',
  'NT-10': 'SCR-A06',
  'NT-11': 'SCR-A05',
  'NT-12': 'SCR-A05',
  'NT-13': 'SCR-A05',
  'NT-14': 'SCR-A05',
  'NT-15': 'SCR-A05',
  'NT-16': 'SCR-A05',
  'NT-17': 'SCR-A05',
  'NT-18': 'SCR-A05',
  'NT-19': 'SCR-A06',
  'NT-20': 'SCR-A03',
  'NT-21': 'SCR-A03',
};

export interface NotificationTemplateArgs {
  promiseTitle: string;
  partnerNickname?: string;
  days?: number;
  amendType?: 'AMEND' | 'CANCEL';
  amendDecision?: 'APPROVE' | 'DECLINE';
}

export interface RenderedNotificationTemplate {
  title: string;
  body: string;
  deeplink: NotificationDeeplink;
}

const NICKNAME_EVENTS = new Set<NotificationEvent>(['NT-01', 'NT-02', 'NT-03', 'NT-09', 'NT-18']);
const DAYS_EVENTS = new Set<NotificationEvent>(['NT-06', 'NT-10']);

/** SQL outbox의 데이터 인자를 검증하고 사용자에게 보일 문구를 한 곳에서 렌더링한다. */
export function renderNotificationTemplate(
  event: NotificationEvent,
  args: NotificationTemplateArgs,
): RenderedNotificationTemplate {
  if (typeof args.promiseTitle !== 'string' || args.promiseTitle.length === 0) {
    throw new Error('INVALID_NOTIFICATION_TEMPLATE_ARGS');
  }

  if (event === 'NT-15') {
    if (
      typeof args.partnerNickname !== 'string' ||
      args.partnerNickname.length === 0 ||
      (args.amendType !== 'AMEND' && args.amendType !== 'CANCEL')
    ) {
      throw new Error('INVALID_NOTIFICATION_TEMPLATE_ARGS');
    }
    return {
      title: `${args.partnerNickname}님이 약속 ${args.amendType === 'AMEND' ? '변경을' : '파기를'} 요청했어요`,
      body: args.promiseTitle,
      deeplink: NOTIFICATION_DEEPLINK[event],
    };
  }

  if (event === 'NT-16') {
    if (args.amendDecision !== 'APPROVE' && args.amendDecision !== 'DECLINE') {
      throw new Error('INVALID_NOTIFICATION_TEMPLATE_ARGS');
    }
    return {
      title: NOTIFICATION_TITLE[event](args.amendDecision === 'APPROVE' ? '승인' : '거절'),
      body: args.promiseTitle,
      deeplink: NOTIFICATION_DEEPLINK[event],
    };
  }

  let titleArg = '';
  if (NICKNAME_EVENTS.has(event)) {
    if (typeof args.partnerNickname !== 'string' || args.partnerNickname.length === 0) {
      throw new Error('INVALID_NOTIFICATION_TEMPLATE_ARGS');
    }
    titleArg = args.partnerNickname;
  } else if (DAYS_EVENTS.has(event)) {
    if (!Number.isInteger(args.days) || (args.days ?? 0) < 1) {
      throw new Error('INVALID_NOTIFICATION_TEMPLATE_ARGS');
    }
    titleArg = String(args.days);
  }

  return {
    title: NOTIFICATION_TITLE[event](titleArg),
    body: args.promiseTitle,
    deeplink: NOTIFICATION_DEEPLINK[event],
  };
}

export interface PushNotificationData {
  notification_id: string;
  deeplink: NotificationDeeplink;
  promise_id: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const PUSH_DEEPLINKS = new Set<NotificationDeeplink>(Object.values(NOTIFICATION_DEEPLINK));
const PUSH_DATA_FIELDS = new Set(['notification_id', 'deeplink', 'promise_id']);
const NOTIFICATION_EVENTS = new Set<NotificationEvent>(
  Object.keys(NOTIFICATION_DEEPLINK) as NotificationEvent[],
);

/** DB RPC 결과를 공개 알림함 항목으로 좁히고, 화면 경로는 이벤트 계약에서 다시 만든다. */
export function asNotificationInboxItem(value: unknown): NotificationInboxItem | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const event = row['event'];
  const promiseId = row['promise_id'];
  const readAt = row['read_at'];
  if (
    typeof row['notification_id'] !== 'string' ||
    !UUID_PATTERN.test(row['notification_id']) ||
    (promiseId !== null && (typeof promiseId !== 'string' || !UUID_PATTERN.test(promiseId))) ||
    typeof event !== 'string' ||
    !NOTIFICATION_EVENTS.has(event as NotificationEvent) ||
    typeof row['title'] !== 'string' ||
    typeof row['body'] !== 'string' ||
    !isIsoInstant(row['created_at']) ||
    (readAt !== null && !isIsoInstant(readAt))
  ) {
    return null;
  }

  const publicEvent = event as NotificationEvent;
  return {
    notification_id: row['notification_id'],
    promise_id: promiseId as string | null,
    event: publicEvent,
    title: row['title'],
    body: row['body'],
    deeplink: NOTIFICATION_DEEPLINK[publicEvent],
    created_at: row['created_at'],
    read_at: readAt as string | null,
  };
}

/** 외부 푸시 payload 는 임의 URL이나 잘못된 식별자를 앱 라우터로 넘기기 전에 거른다. */
export function asPushNotificationData(value: unknown): PushNotificationData | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const fields = Object.keys(row);
  if (
    fields.length !== PUSH_DATA_FIELDS.size ||
    fields.some((field) => !PUSH_DATA_FIELDS.has(field)) ||
    typeof row['notification_id'] !== 'string' ||
    !UUID_PATTERN.test(row['notification_id']) ||
    typeof row['promise_id'] !== 'string' ||
    !UUID_PATTERN.test(row['promise_id']) ||
    typeof row['deeplink'] !== 'string' ||
    !PUSH_DEEPLINKS.has(row['deeplink'] as NotificationDeeplink)
  ) {
    return null;
  }
  return {
    notification_id: row['notification_id'],
    deeplink: row['deeplink'] as NotificationDeeplink,
    promise_id: row['promise_id'],
  };
}

/**
 * `notifications.dedupe_key` 조립 (§6-2 · EC-G04, PO 결정 2026-07-26).
 *
 * EC-G04 원문은 `{promise_id}:{type}:{yyyymmdd}` 인데, 컬럼이 UNIQUE 라 한 이벤트가 채널마다
 * 행을 만드는 순간 깨진다 — NT-01 은 작성자 한 명에게 PUSH + INAPP 두 행이다. 그래서 수신자와
 * 채널을 키에 넣는다.
 *
 * 마지막 조각은 **두 종류**다.
 *
 * - 전이 알림(NT-01~03)은 `Idempotency-Key` 를 쓴다. 껍데기가 재시도되면 RPC 가 캐시된
 *   payload 를 그대로 돌려주므로 같은 키가 다시 조립되고, UNIQUE 가 중복 삽입을 막는다.
 *   날짜를 쓰면 같은 날 두 번째 수정 제안(재발송 → 또 수정 제안)이 조용히 사라진다.
 * - 배치 알림은 날짜(KST)를 쓴다. 거기서는 "하루 1회"가 실제로 의도한 규칙이고, 배치를 두 번
 *   돌려도 중복 발송되지 않게 하는 것이 EC-G04 의 목적이다.
 */
export function transitionDedupeKey(input: {
  promiseId: string;
  event: NotificationEvent;
  userId: string;
  channel: string;
  idempotencyKey: string;
}): string {
  return [input.promiseId, input.event, input.userId, input.channel, input.idempotencyKey].join(
    ':',
  );
}

/** 즉시 이행 알림은 같은 약속에서도 라운드가 바뀌므로 라운드와 요청 키를 함께 고정한다. */
export function fulfillmentDedupeKey(input: {
  promiseId: string;
  event: FulfillmentNotificationEvent;
  userId: string;
  channel: string;
  roundNo: number;
  idempotencyKey: string;
}): string {
  return [
    input.promiseId,
    input.event,
    input.userId,
    input.channel,
    input.roundNo,
    input.idempotencyKey,
  ].join(':');
}

/** 배치 알림용. 날짜는 **KST** 다 — UTC 로 잡으면 00:00~09:00 KST 발송이 전부 전날로 들어간다. */
export function scheduledDedupeKey(input: {
  promiseId: string;
  event: string;
  userId: string;
  channel: string;
  /** `YYYYMMDD` (KST) */
  yyyymmddKst: string;
}): string {
  return [input.promiseId, input.event, input.userId, input.channel, input.yyyymmddKst].join(':');
}
