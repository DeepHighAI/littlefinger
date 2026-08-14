import { readdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.asAdmin(`delete from net.http_post_requests`);
  await db.asAdmin(`delete from vault.decrypted_secrets`);
  await db.asAdmin(
    `insert into vault.decrypted_secrets (name, decrypted_secret)
     values
       ('push_send_url', 'https://push.example.test/functions/v1/push-send'),
       ('push_send_secret', 'test-push-send-secret')`,
  );
});

describe('push-send 스케줄링 배포 계약', () => {
  test('내부 worker는 플랫폼 JWT 없이 비밀 헤더로만 호출된다', async () => {
    const config = await readFile(new URL('../config.toml', import.meta.url), 'utf8');

    expect(config).toMatch(/\[functions\.push-send\]\s*\r?\nverify_jwt = false/iu);
  });

  test('outbox nudge와 10분 복구 잡을 담은 단일 마이그레이션이 있다', async () => {
    const migrations = new URL('../migrations/', import.meta.url);
    const names = (await readdir(migrations)).filter((name) =>
      name.endsWith('_schedule_push_send.sql'),
    );

    expect(names).toHaveLength(1);
    const sql = await readFile(new URL(`../migrations/${names[0]}`, import.meta.url), 'utf8');
    expect(sql).toContain("'*/10 * * * *'");
    expect(sql).toContain("'x-push-send-secret'");
    expect(sql).toContain("'push_send_url'");
    expect(sql).toContain("'push_send_secret'");
  });

  test('재설치해도 push-send 복구 잡은 정확히 한 건이다', async () => {
    await db.asAdmin(`select public.lf_schedule_push_send()`);
    await db.asAdmin(`select public.lf_schedule_push_send()`);
    const jobs = await db.asAdmin(
      `select jobname, schedule, command
         from cron.job
        where jobname = 'lf-push-send'`,
    );

    expect(jobs.rows).toHaveLength(1);
    expect(jobs.rows[0]).toMatchObject({
      jobname: 'lf-push-send',
      schedule: '*/10 * * * *',
    });
    expect(String(jobs.rows[0]?.['command'])).toContain('net.http_post');
    expect(String(jobs.rows[0]?.['command'])).toContain('push_send_url');
    expect(String(jobs.rows[0]?.['command'])).toContain('push_send_secret');
    expect(String(jobs.rows[0]?.['command'])).toContain('x-push-send-secret');
  });

  test('기존에 같은 이름의 cron 행이 중복돼도 재설치하면 한 건으로 수렴한다', async () => {
    await db.asAdmin(`delete from cron.job where jobname = 'lf-push-send'`);
    await db.asAdmin(
      `insert into cron.job (jobname, schedule, command)
       values
         ('lf-push-send', '* * * * *', 'select 1'),
         ('lf-push-send', '0 * * * *', 'select 2')`,
    );

    await db.asAdmin(`select public.lf_schedule_push_send()`);
    const jobs = await db.asAdmin(
      `select jobname, schedule from cron.job where jobname = 'lf-push-send'`,
    );

    expect(jobs.rows).toEqual([{ jobname: 'lf-push-send', schedule: '*/10 * * * *' }]);
  });

  test('outbox INSERT는 같은 내부 worker를 정확한 Vault 비밀 헤더로 nudge한다', async () => {
    const userId = await createUser(db, 'push-nudge');
    const promiseId = await createPromise(db, { creatorId: userId });

    await db.asAdmin(
      `select public.lf_notification_outbox_enqueue(
         $1::uuid, $2::uuid, 'NT-07', $3::jsonb, $4, now()
       )`,
      [userId, promiseId, JSON.stringify({ promiseTitle: '알림' }), randomUUID()],
    );

    const requests = await db.asAdmin(
      `select url, headers, body, timeout_milliseconds
         from net.http_post_requests`,
    );
    expect(requests.rows).toEqual([{
      url: 'https://push.example.test/functions/v1/push-send',
      headers: {
        'Content-Type': 'application/json',
        'x-push-send-secret': 'test-push-send-secret',
      },
      body: {},
      timeout_milliseconds: 10_000,
    }]);
  });

  test('한 트랜잭션에서 intent 200건을 넣어도 worker nudge는 한 번만 요청한다', async () => {
    const userId = await createUser(db, 'push-coalesced-nudge');
    const promiseId = await createPromise(db, { creatorId: userId });

    await db.asAdmin(
      `insert into public.notification_outbox (
         recipient_user_id, promise_id, event, template_args,
         inapp_dedupe_key, push_dedupe_key
       )
       select $1::uuid, $2::uuid, 'NT-07', '{"promiseTitle":"알림"}'::jsonb,
              'coalesced-inapp-' || n, 'coalesced-push-' || n
         from generate_series(1, 200) n`,
      [userId, promiseId],
    );

    const requests = await db.asAdmin(`select count(*)::int as count from net.http_post_requests`);
    expect(requests.rows).toEqual([{ count: 1 }]);
  });

  test('push_send_url 누락은 요청 없이 격리되고 outbox intent를 보존한다', async () => {
    await db.asAdmin(`delete from vault.decrypted_secrets where name = 'push_send_url'`);
    const userId = await createUser(db, 'push-nudge-url-missing');
    const promiseId = await createPromise(db, { creatorId: userId });

    const inserted = await db.asAdmin(
      `select public.lf_notification_outbox_enqueue(
         $1::uuid, $2::uuid, 'NT-07', $3::jsonb, $4, now()
       )::text as id`,
      [userId, promiseId, JSON.stringify({ promiseTitle: '복구' }), randomUUID()],
    );
    const row = await db.asAdmin(
      `select status::text from public.notification_outbox where id = $1::uuid`,
      [inserted.rows[0]?.['id']],
    );

    expect(row.rows).toEqual([{ status: 'PENDING' }]);
    expect((await db.asAdmin(`select * from net.http_post_requests`)).rows).toEqual([]);
  });

  test('push_send_secret 누락은 요청 없이 격리되고 outbox intent를 보존한다', async () => {
    await db.asAdmin(`delete from vault.decrypted_secrets where name = 'push_send_secret'`);
    const userId = await createUser(db, 'push-nudge-secret-missing');
    const promiseId = await createPromise(db, { creatorId: userId });

    const inserted = await db.asAdmin(
      `select public.lf_notification_outbox_enqueue(
         $1::uuid, $2::uuid, 'NT-07', $3::jsonb, $4, now()
       )::text as id`,
      [userId, promiseId, JSON.stringify({ promiseTitle: '복구' }), randomUUID()],
    );
    const row = await db.asAdmin(
      `select status::text from public.notification_outbox where id = $1::uuid`,
      [inserted.rows[0]?.['id']],
    );

    expect(row.rows).toEqual([{ status: 'PENDING' }]);
    expect((await db.asAdmin(`select * from net.http_post_requests`)).rows).toEqual([]);
  });

  test('pg_net nudge 실패가 outbox 기록을 롤백하지 않는다', async () => {
    await db.asAdmin(
      `update vault.decrypted_secrets
          set decrypted_secret = 'fail://push-send'
        where name = 'push_send_url'`,
    );
    const userId = await createUser(db, 'push-nudge-failure');
    const promiseId = await createPromise(db, { creatorId: userId });

    const inserted = await db.asAdmin(
      `select public.lf_notification_outbox_enqueue(
         $1::uuid, $2::uuid, 'NT-07', $3::jsonb, $4, now()
       )::text as id`,
      [userId, promiseId, JSON.stringify({ promiseTitle: '복구' }), randomUUID()],
    );
    const row = await db.asAdmin(
      `select status::text from public.notification_outbox where id = $1::uuid`,
      [inserted.rows[0]?.['id']],
    );

    expect(row.rows).toEqual([{ status: 'PENDING' }]);
    expect((await db.asAdmin(`select * from net.http_post_requests`)).rows).toEqual([]);
  });

  test('notification 또는 PUSH 행에서 직접 fanout하는 trigger는 없다', async () => {
    const triggers = await db.asAdmin(
      `select c.relname as table_name, t.tgname as trigger_name
         from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
        where not t.tgisinternal
          and c.relname in ('notifications', 'push_deliveries')`,
    );

    expect(triggers.rows).toEqual([]);
  });

  test('nudge helper는 trigger 전용이고 scheduler만 service_role이 실행한다', async () => {
    const privileges = await db.asAdmin(
      `select
         has_function_privilege('service_role', 'public.lf_nudge_push_send()', 'EXECUTE') as nudge,
         has_function_privilege('service_role', 'public.lf_schedule_push_send()', 'EXECUTE') as scheduler`,
    );

    expect(privileges.rows).toEqual([{ nudge: false, scheduler: true }]);
  });
});
