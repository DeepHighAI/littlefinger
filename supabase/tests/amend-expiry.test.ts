import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

let db: TestDb;

interface Fixture {
  creator: string;
  partner: string;
  promiseId: string;
}

function migrations(): string {
  const directory = join(__dirname, '../migrations');
  return readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(join(directory, file), 'utf8'))
    .join('\n')
    .toLowerCase();
}

async function seed(): Promise<Fixture> {
  const creator = await createUser(db, `만료작성자-${randomUUID().slice(0, 6)}`);
  const partner = await createUser(db, `만료상대-${randomUUID().slice(0, 6)}`);
  const promiseId = await createPromise(db, {
    creatorId: creator,
    partnerId: partner,
    status: 'ACTIVE',
    endDateOffsetDays: 30,
  });
  await db.asAdmin(
    `with activated as (
       update public.promise_versions
          set activated_at = now()
        where promise_id = $1 and version_no = 1
        returning id
     )
     update public.promises
        set current_version_id = activated.id, activated_at = now()
       from activated
      where public.promises.id = $1`,
    [promiseId],
  );
  return { creator, partner, promiseId };
}

async function requestCancel(fixture: Fixture, actor = fixture.creator): Promise<Record<string, unknown>> {
  const { rows } = await db.asService(
    `select public.lf_promise_amend_request(
       $1, $2, $3, 'CANCEL', null, '일정을 다시 정해요', 'APP'::public.surface, null, null
     ) as result`,
    [randomUUID(), actor, fixture.promiseId],
  );
  return rows[0]?.['result'] as Record<string, unknown>;
}

async function expire(now: string, limit = 100): Promise<Record<string, unknown>> {
  const { rows } = await db.asService(
    `select public.lf_expire_amend_requests($1::timestamptz, $2) as result`,
    [now, limit],
  );
  return rows[0]?.['result'] as Record<string, unknown>;
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('F-11 notification intent and reminder lifecycle', () => {
  test('request notifies only the counterpart and schedules one +3 day 09:00 KST reminder', async () => {
    const fixture = await seed();
    const created = await requestCancel(fixture);
    const { rows } = await db.asAdmin(
      `select o.recipient_user_id, o.event, o.template_args,
              rs.user_id as reminder_user_id,
              rs.kind::text as reminder_kind,
              rs.status::text as reminder_status,
              rs.fire_at::text,
              (((ar.created_at at time zone 'Asia/Seoul')::date + 3)::timestamp
                + interval '9 hours') at time zone 'Asia/Seoul' as expected_fire_at
         from public.amend_requests ar
         join public.notification_outbox o
           on o.promise_id = ar.promise_id and o.event = 'NT-15'
         join public.reminder_schedules rs
           on rs.promise_id = ar.promise_id and rs.kind = 'AMEND_REMIND'
        where ar.id = $1`,
      [created['request_id']],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      recipient_user_id: fixture.partner,
      reminder_user_id: fixture.partner,
      event: 'NT-15',
      reminder_kind: 'AMEND_REMIND',
      reminder_status: 'PENDING',
      template_args: expect.objectContaining({ amendType: 'CANCEL' }),
    });
    expect(Date.parse(String(rows[0]?.['fire_at']))).toBe(
      Date.parse(String(rows[0]?.['expected_fire_at'])),
    );
  });

  test('response notifies only the requester and cancels AMEND_REMIND', async () => {
    const fixture = await seed();
    const created = await requestCancel(fixture);
    await db.asService(
      `select public.lf_promise_amend_respond(
         $1, $2, $3, $4, 'DECLINE', 'APP'::public.surface, null, null
       )`,
      [randomUUID(), fixture.partner, fixture.promiseId, created['request_id']],
    );
    const { rows } = await db.asAdmin(
      `select o.recipient_user_id, o.event, o.template_args,
              (select count(*)::int from public.reminder_schedules rs
                where rs.promise_id = $1 and rs.kind = 'AMEND_REMIND'
                  and rs.status = 'PENDING') as pending_reminders
         from public.notification_outbox o
        where o.promise_id = $1 and o.event = 'NT-16'`,
      [fixture.promiseId],
    );
    expect(rows).toEqual([
      expect.objectContaining({
        recipient_user_id: fixture.creator,
        event: 'NT-16',
        template_args: expect.objectContaining({ amendDecision: 'DECLINE' }),
        pending_reminders: 0,
      }),
    ]);
  });

  test('withdrawal cancels the pending reminder without inventing a response notification', async () => {
    const fixture = await seed();
    const created = await requestCancel(fixture);
    await db.asService(
      `select public.lf_promise_amend_withdraw(
         $1, $2, $3, $4, 'APP'::public.surface, null, null
       )`,
      [randomUUID(), fixture.creator, fixture.promiseId, created['request_id']],
    );
    const { rows } = await db.asAdmin(
      `select
         count(*) filter (where rs.status = 'PENDING')::int as pending_reminders,
         (select count(*)::int from public.notification_outbox o
           where o.promise_id = $1 and o.event = 'NT-16') as response_notifications
       from public.reminder_schedules rs
       where rs.promise_id = $1 and rs.kind = 'AMEND_REMIND'`,
      [fixture.promiseId],
    );
    expect(rows[0]).toEqual({ pending_reminders: 0, response_notifications: 0 });
  });
});

describe('J-05 amend request expiry', () => {
  test('expires both request types, preserves proposals, returns ACTIVE, and enqueues NT-17 for both parties once', async () => {
    const amendFixture = await seed();
    const current = await db.asAdmin(
      `select jsonb_build_object(
         'title', '만료 뒤 산책', 'body', body, 'category', category,
         'end_date', end_date, 'keeper', keeper, 'reward', reward, 'penalty', penalty
       ) as proposal from public.promises where id = $1`,
      [amendFixture.promiseId],
    );
    const amendCreated = await db.asService(
      `select public.lf_promise_amend_request(
         $1, $2, $3, 'AMEND', $4::jsonb, null, 'APP'::public.surface, null, null
       ) as result`,
      [randomUUID(), amendFixture.creator, amendFixture.promiseId, JSON.stringify(current.rows[0]?.['proposal'])],
    );
    const amendRequest = amendCreated.rows[0]?.['result'] as Record<string, unknown>;
    const cancelFixture = await seed();
    const cancelRequest = await requestCancel(cancelFixture, cancelFixture.partner);
    // 다른 테스트가 남긴 정상 7일 기한보다 과거에 앵커를 두어 이 두 행만 due가 된다.
    const now = '2000-01-01T00:00:00.000Z';
    await db.asAdmin(
      `update public.amend_requests set expires_at = $1 where id in ($2, $3)`,
      [now, amendRequest['request_id'], cancelRequest['request_id']],
    );

    expect(await expire(now)).toEqual({ expired: 2 });
    expect(await expire(now)).toEqual({ expired: 0 });
    const { rows } = await db.asAdmin(
      `select ar.id, ar.status::text, p.status::text as promise_status,
              v.version_no, v.activated_at,
              (select count(*)::int from public.notification_outbox o
                where o.promise_id = p.id and o.event = 'NT-17') as expiry_notifications,
              (select count(*)::int from public.reminder_schedules rs
                where rs.promise_id = p.id and rs.kind = 'AMEND_REMIND'
                  and rs.status = 'PENDING') as pending_reminders
         from public.amend_requests ar
         join public.promises p on p.id = ar.promise_id
         left join public.promise_versions v on v.id = ar.proposed_version_id
        where ar.id in ($1, $2)
        order by ar.id`,
      [amendRequest['request_id'], cancelRequest['request_id']],
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toMatchObject({
        status: 'EXPIRED',
        promise_status: 'ACTIVE',
        expiry_notifications: 2,
        pending_reminders: 0,
      });
    }
    const amendRow = rows.find((row) => row['id'] === amendRequest['request_id']);
    expect(amendRow).toMatchObject({ version_no: null, activated_at: null });
  });

  test('expired request fencing rejects a later response and leaves exactly one terminal outcome', async () => {
    const fixture = await seed();
    const created = await requestCancel(fixture);
    const now = '2000-01-01T00:00:00.000Z';
    await db.asAdmin(`update public.amend_requests set expires_at = $1 where id = $2`, [
      now,
      created['request_id'],
    ]);
    await expire(now);
    await expect(
      db.asService(
        `select public.lf_promise_amend_respond(
           $1, $2, $3, $4, 'APPROVE', 'APP'::public.surface, null, null
         )`,
        [randomUUID(), fixture.partner, fixture.promiseId, created['request_id']],
      ),
    ).rejects.toThrow('E_STATE_CONFLICT');
    const { rows } = await db.asAdmin(
      `select status::text from public.amend_requests where id = $1`,
      [created['request_id']],
    );
    expect(rows[0]?.['status']).toBe('EXPIRED');
  });

  test('batch and scheduler are serialized, server-only, empty-search-path functions with one 00:30 KST cron', async () => {
    const source = migrations();
    for (const name of ['lf_expire_amend_requests', 'lf_schedule_amend_expiry']) {
      const body = source.split(`create or replace function public.${name}`)[1]?.split('$$;')[0] ?? '';
      expect(body).toContain("set search_path = ''");
      expect(body).toContain('pg_advisory_xact_lock');
    }
    expect(source).toMatch(
      /lf_expire_amend_requests[\s\S]*order by p\.id, ar\.id[\s\S]*for update of p, ar skip locked/u,
    );
    const { rows } = await db.asAdmin(
      `select count(*)::int as count, min(schedule) as schedule
         from cron.job where jobname = 'lf-amend-request-expiry'`,
    );
    expect(rows[0]).toEqual({ count: 1, schedule: '30 15 * * *' });

    const actor = await createUser(db, '만료권한');
    await expect(
      db.asUser(actor, `select public.lf_expire_amend_requests(now(), 100)`),
    ).rejects.toThrow(/permission denied/u);
  });
});
