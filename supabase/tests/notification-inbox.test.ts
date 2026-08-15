import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { NOTIFICATION_RETENTION_DAYS } from '../../packages/shared/src/config.ts';
import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

let db: TestDb;
let owner: string;
let other: string;
let promiseId: string;

interface InboxItem {
  notification_id: string;
  promise_id: string | null;
  event: string;
  title: string;
  body: string;
  deeplink: string | null;
  created_at: string;
  read_at: string | null;
}

interface InboxResponse {
  items: InboxItem[];
  unread_count: number;
  next_cursor: { created_at: string; notification_id: string } | null;
}

async function createNotification(input: {
  userId: string;
  promiseId?: string;
  channel?: 'INAPP' | 'PUSH';
  createdAt: string;
  readAt?: string | null;
  title?: string;
  deeplink?: string | null;
}): Promise<string> {
  const { rows } = await db.asAdmin(
    `insert into public.notifications
       (user_id, promise_id, type, channel, title, body, deeplink, status, read_at, dedupe_key, created_at)
     values ($1, $2, 'NT-01', $3::public.notification_channel, $4, '약속 본문', $5,
             case when $6::timestamptz is null then 'SENT'::public.notification_status
                  else 'READ'::public.notification_status end,
             $6::timestamptz, $7, $8::timestamptz)
     returning id`,
    [
      input.userId,
      input.promiseId ?? promiseId,
      input.channel ?? 'INAPP',
      input.title ?? '알림',
      input.deeplink ?? 'SCR-A05',
      input.readAt ?? null,
      randomUUID(),
      input.createdAt,
    ],
  );
  return String(rows[0]?.['id']);
}

async function createInboxUser(nickname: string): Promise<{ userId: string; promiseId: string }> {
  const userId = await createUser(db, nickname);
  return { userId, promiseId: await createPromise(db, { creatorId: userId, status: 'ACTIVE' }) };
}

async function list(input: {
  actor: string;
  now: string;
  limit?: number;
  cursorCreatedAt?: string | null;
  cursorNotificationId?: string | null;
}): Promise<InboxResponse> {
  const { rows } = await db.asAdmin(
    `select public.lf_notification_inbox_list($1, $2::timestamptz, $3::uuid, $4::int, $5::timestamptz) as result`,
    [
      input.actor,
      input.cursorCreatedAt ?? null,
      input.cursorNotificationId ?? null,
      input.limit ?? 20,
      input.now,
    ],
  );
  return (rows[0]?.['result'] as InboxResponse | undefined)!;
}

beforeAll(async () => {
  db = await createTestDb();
  owner = await createUser(db, '알림소유자');
  other = await createUser(db, '알림타인');
  promiseId = await createPromise(db, { creatorId: owner, status: 'ACTIVE' });
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('lf_notification_inbox_* — 사용자별 INAPP 알림함', () => {
  test('자기 INAPP만 최신순으로 반환하고 unread 수와 허용된 공개 필드만 준다', async () => {
    const now = '2026-08-15T00:00:00Z';
    const oldest = await createNotification({
      userId: owner,
      createdAt: '2026-08-14T20:00:00Z',
      title: '오래된 알림',
    });
    const newest = await createNotification({
      userId: owner,
      createdAt: '2026-08-14T22:00:00Z',
      title: '새 알림',
    });
    await createNotification({ userId: owner, channel: 'PUSH', createdAt: '2026-08-14T23:00:00Z' });
    await createNotification({ userId: other, createdAt: '2026-08-14T23:30:00Z' });

    const result = await list({ actor: owner, now });

    expect(result.unread_count).toBe(2);
    expect(result.items.map((item) => item.notification_id)).toEqual([newest, oldest]);
    expect(result.items[0]).toEqual({
      notification_id: newest,
      promise_id: promiseId,
      event: 'NT-01',
      title: '새 알림',
      body: '약속 본문',
      deeplink: 'SCR-A05',
      created_at: '2026-08-14T22:00:00+00:00',
      read_at: null,
    });
  });

  test('90일 경계의 항목은 보존하고 더 오래된 항목은 목록에서 제외한다', async () => {
    const now = '2026-08-15T00:00:00Z';
    const inbox = await createInboxUser('경계소유자');
    const retained = await createNotification({
      userId: inbox.userId,
      promiseId: inbox.promiseId,
      createdAt: '2026-05-17T00:00:00Z',
      title: '경계',
    });
    await createNotification({
      userId: inbox.userId,
      promiseId: inbox.promiseId,
      createdAt: '2026-05-16T23:59:59Z',
      title: '만료',
    });

    const result = await list({ actor: inbox.userId, now });

    expect(result.items.map((item) => item.notification_id)).toContain(retained);
    expect(result.items.map((item) => item.title)).not.toContain('만료');
  });

  test('알림함은 허용 목록 밖 deeplink를 노출하지 않는다', async () => {
    const now = '2026-08-15T00:00:00Z';
    const inbox = await createInboxUser('딥링크소유자');
    await createNotification({
      userId: inbox.userId,
      promiseId: inbox.promiseId,
      createdAt: '2026-08-14T22:00:00Z',
      deeplink: 'https://evil.example/steal',
    });

    const result = await list({ actor: inbox.userId, now });

    expect(result.items[0]?.deeplink).toBeNull();
  });

  test('복합 cursor는 중복 없이 다음 최신순 페이지를 반환한다', async () => {
    const now = '2026-08-16T00:00:00Z';
    const inbox = await createInboxUser('페이지소유자');
    const first = await createNotification({
      userId: inbox.userId,
      promiseId: inbox.promiseId,
      createdAt: '2026-08-15T03:00:00Z',
      title: '첫째',
    });
    const second = await createNotification({
      userId: inbox.userId,
      promiseId: inbox.promiseId,
      createdAt: '2026-08-15T02:00:00Z',
      title: '둘째',
    });
    const third = await createNotification({
      userId: inbox.userId,
      promiseId: inbox.promiseId,
      createdAt: '2026-08-15T01:00:00Z',
      title: '셋째',
    });

    const pageOne = await list({ actor: inbox.userId, now, limit: 2 });
    const pageTwo = await list({
      actor: inbox.userId,
      now,
      limit: 2,
      cursorCreatedAt: pageOne.next_cursor?.created_at ?? null,
      cursorNotificationId: pageOne.next_cursor?.notification_id ?? null,
    });

    expect(pageOne.items.map((item) => item.notification_id)).toEqual([first, second]);
    expect(pageOne.next_cursor).toEqual({
      created_at: '2026-08-15T02:00:00+00:00',
      notification_id: second,
    });
    expect(pageTwo.items.map((item) => item.notification_id)).toEqual([third]);
    expect(pageTwo.next_cursor).toBeNull();
  });

  test('마지막 페이지는 남은 항목이 없으면 next_cursor를 주지 않는다', async () => {
    const now = '2026-08-16T00:00:00Z';
    const inbox = await createInboxUser('마지막페이지소유자');
    await createNotification({
      userId: inbox.userId,
      promiseId: inbox.promiseId,
      createdAt: '2026-08-15T03:00:00Z',
    });

    const result = await list({ actor: inbox.userId, now, limit: 1 });

    expect(result.next_cursor).toBeNull();
  });

  test('소유자가 단건 읽음을 반복해도 최초 read_at을 유지한다', async () => {
    const inbox = await createInboxUser('단건소유자');
    const notificationId = await createNotification({
      userId: inbox.userId,
      promiseId: inbox.promiseId,
      createdAt: '2026-08-15T00:00:00Z',
    });
    const first = await db.asAdmin(
      `select public.lf_notification_read($1, $2, $3::timestamptz) as result`,
      [inbox.userId, notificationId, '2026-08-15T01:00:00Z'],
    );
    const second = await db.asAdmin(
      `select public.lf_notification_read($1, $2, $3::timestamptz) as result`,
      [inbox.userId, notificationId, '2026-08-15T02:00:00Z'],
    );

    expect(first.rows[0]?.['result']).toEqual({
      notification_id: notificationId,
      read_at: '2026-08-15T01:00:00+00:00',
    });
    expect(second.rows[0]?.['result']).toEqual(first.rows[0]?.['result']);
  });

  test('타인의 단건 읽음은 존재를 숨겨 E_NOT_FOUND로 거절한다', async () => {
    const inbox = await createInboxUser('비소유알림');
    const notificationId = await createNotification({
      userId: inbox.userId,
      promiseId: inbox.promiseId,
      createdAt: '2026-08-15T00:00:00Z',
    });

    await expect(
      db.asAdmin(`select public.lf_notification_read($1, $2, $3::timestamptz)`, [
        other,
        notificationId,
        '2026-08-15T01:00:00Z',
      ]),
    ).rejects.toThrow(/E_NOT_FOUND/u);
  });

  test('모두 읽음은 INAPP 미읽음만 한 번 바꾸고 반복 호출은 안전하다', async () => {
    const inbox = await createInboxUser('모두읽음소유자');
    const unread = await createNotification({
      userId: inbox.userId,
      promiseId: inbox.promiseId,
      createdAt: '2026-08-15T00:00:00Z',
    });
    const alreadyRead = await createNotification({
      userId: inbox.userId,
      promiseId: inbox.promiseId,
      createdAt: '2026-08-15T00:01:00Z',
      readAt: '2026-08-15T00:02:00Z',
    });
    const push = await createNotification({
      userId: inbox.userId,
      promiseId: inbox.promiseId,
      channel: 'PUSH',
      createdAt: '2026-08-15T00:03:00Z',
    });
    const first = await db.asAdmin(
      `select public.lf_notification_read_all($1, $2::timestamptz) as result`,
      [inbox.userId, '2026-08-15T01:00:00Z'],
    );
    const second = await db.asAdmin(
      `select public.lf_notification_read_all($1, $2::timestamptz) as result`,
      [inbox.userId, '2026-08-15T02:00:00Z'],
    );
    const states = await db.asAdmin(
      `select id, status::text, read_at::text
         from public.notifications
        where id = any($1::uuid[])
        order by id`,
      [[unread, alreadyRead, push]],
    );

    expect(first.rows[0]?.['result']).toEqual({ read_count: 1 });
    expect(second.rows[0]?.['result']).toEqual({ read_count: 0 });
    expect(states.rows).toContainEqual({
      id: unread,
      status: 'READ',
      read_at: '2026-08-15 01:00:00+00',
    });
    expect(states.rows).toContainEqual({
      id: alreadyRead,
      status: 'READ',
      read_at: '2026-08-15 00:02:00+00',
    });
    expect(states.rows).toContainEqual({ id: push, status: 'SENT', read_at: null });
  });

  test('authenticated는 notifications를 직접 UPDATE할 수 없고 retention은 경계와 반복 실행을 지킨다', async () => {
    const now = '2026-08-15T00:00:00Z';
    const inbox = await createInboxUser('정리소유자');
    const retained = await createNotification({
      userId: inbox.userId,
      promiseId: inbox.promiseId,
      createdAt: '2026-05-17T00:00:00Z',
    });
    const expired = await createNotification({
      userId: inbox.userId,
      promiseId: inbox.promiseId,
      createdAt: '2026-05-16T23:59:59Z',
    });
    const direct = await db.asUser(
      inbox.userId,
      `update public.notifications set read_at = now(), status = 'READ' where id = $1 returning id`,
      [retained],
    );
    await expect(
      db.asUser(
        inbox.userId,
        `select public.lf_notification_read($1, $2, $3::timestamptz)`,
        [inbox.userId, retained, now],
      ),
    ).rejects.toThrow(/permission denied/iu);
    const first = await db.asAdmin(
      `select public.lf_notification_retention_purge($1::timestamptz) as deleted`,
      [now],
    );
    const second = await db.asAdmin(
      `select public.lf_notification_retention_purge($1::timestamptz) as deleted`,
      [now],
    );

    expect(direct.rows).toEqual([]);
    expect(first.rows[0]?.['deleted']).toBeGreaterThanOrEqual(1);
    expect(second.rows[0]?.['deleted']).toBe(0);
    const remaining = await db.asAdmin(
      `select id from public.notifications where id = any($1::uuid[]) order by id`,
      [[retained, expired]],
    );
    expect(remaining.rows).toEqual([{ id: retained }]);
  });

  test('SQL retention policy는 공유 90일 계약과 일치한다', async () => {
    const { rows } = await db.asAdmin(`select public.lf_notification_retention_days() as days`);

    expect(rows[0]?.['days']).toBe(NOTIFICATION_RETENTION_DAYS);
  });

  test('읽음 RPC는 SECURITY DEFINER와 빈 search_path를 유지한다', async () => {
    const { rows } = await db.asAdmin(
      `select p.proname, p.prosecdef, p.proconfig
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
            'lf_notification_inbox_list',
            'lf_notification_read',
            'lf_notification_read_all'
          )
        order by p.proname`,
    );

    expect(rows).toEqual([
      { proname: 'lf_notification_inbox_list', prosecdef: true, proconfig: ['search_path=""'] },
      { proname: 'lf_notification_read', prosecdef: true, proconfig: ['search_path=""'] },
      { proname: 'lf_notification_read_all', prosecdef: true, proconfig: ['search_path=""'] },
    ]);
  });

  test('retention cron은 같은 이름으로 다시 등록해도 04:20 KST의 한 작업만 남긴다', async () => {
    await db.asAdmin(`select public.lf_schedule_notification_retention()`);
    await db.asAdmin(`select public.lf_schedule_notification_retention()`);
    const jobs = await db.asAdmin(
      `select jobname, schedule, command
         from cron.job
        where jobname = 'lf-notification-retention'`,
    );

    expect(jobs.rows).toEqual([
      {
        jobname: 'lf-notification-retention',
        schedule: '20 19 * * *',
        command: 'select public.lf_notification_retention_purge();',
      },
    ]);
  });
});
