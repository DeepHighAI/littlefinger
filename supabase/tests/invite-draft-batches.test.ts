import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  createInvitation,
  createPromise,
  createTestDb,
  createUser,
  type TestDb,
} from './harness.ts';

let db: TestDb;

async function runInviteExpiry(now: string): Promise<Record<string, number>> {
  const { rows } = await db.asService(
    `select public.lf_expire_invitations($1::timestamptz, 100) as result`,
    [now],
  );
  return rows[0]?.['result'] as Record<string, number>;
}

async function runDraftCleanup(now: string): Promise<Record<string, number>> {
  const { rows } = await db.asService(
    `select public.lf_prepare_draft_cleanup($1::timestamptz, 100) as result`,
    [now],
  );
  return rows[0]?.['result'] as Record<string, number>;
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('J-04 invitation expiry', () => {
  test('EC-B07 같은 시각에 두 번 실행해도 초대만 만료하고 NT-05를 한 번 기록한다', async () => {
    const creatorId = await createUser(db, `초대만료-${randomUUID().slice(0, 6)}`);
    const promiseId = await createPromise(db, {
      creatorId,
      status: 'PENDING',
    });
    await createInvitation(db, {
      promiseId,
      createdBy: creatorId,
      expiresInSeconds: -60,
    });
    const now = new Date().toISOString();

    expect(await runInviteExpiry(now)).toEqual({ expired: 1, notified: 1 });
    expect(await runInviteExpiry(now)).toEqual({ expired: 0, notified: 0 });

    const { rows } = await db.asAdmin(
      `select p.status::text as promise_status,
              i.status::text as invitation_status,
              count(o.id)::int as notification_count
         from public.promises p
         join public.invitations i on i.promise_id = p.id
         left join public.notification_outbox o
           on o.promise_id = p.id and o.event = 'NT-05'
        where p.id = $1
        group by p.status, i.status`,
      [promiseId],
    );
    expect(rows).toEqual([
      {
        promise_status: 'PENDING',
        invitation_status: 'EXPIRED',
        notification_count: 1,
      },
    ]);
  });
});

describe('J-06 draft reminder and cleanup', () => {
  test('EC-B09: 수정 초안 NT-20과 삭제 7일 전 NT-21을 한 번만 예약·발송한다', async () => {
    const creatorId = await createUser(db, `초안알림-${randomUUID().slice(0, 6)}`);
    const partnerId = await createUser(db, `수정제안-${randomUUID().slice(0, 6)}`);
    const resumePromiseId = await createPromise(db, {
      creatorId,
      partnerId,
      status: 'DRAFT',
    });
    const deleteSoonPromiseId = await createPromise(db, {
      creatorId,
      status: 'DRAFT',
    });
    const now = '2026-08-18T00:00:00.000Z';
    await db.asAdmin(
      `update public.promises
          set updated_at = case id
            when $1 then $3::timestamptz - interval '4 days'
            else $3::timestamptz - interval '84 days'
          end
        where id in ($1, $2)`,
      [resumePromiseId, deleteSoonPromiseId, now],
    );
    await db.asAdmin(
      `insert into public.approvals
         (promise_id, user_id, role, action, surface, acted_at)
       values ($1, $2, 'PARTNER', 'AMEND_SUGGEST', 'WEB', $3::timestamptz - interval '4 days')`,
      [resumePromiseId, partnerId, now],
    );

    expect(await runDraftCleanup(now)).toEqual({ deleted: 0, scheduled: 3 });
    expect(await runDraftCleanup(now)).toEqual({ deleted: 0, scheduled: 0 });

    const { rows: scheduled } = await db.asAdmin(
      `select promise_id, kind::text, status::text
         from public.reminder_schedules
        where promise_id in ($1, $2)
          and kind in ('DRAFT_RESUME', 'DRAFT_DELETE_SOON')
        order by kind`,
      [resumePromiseId, deleteSoonPromiseId],
    );
    expect(scheduled).toEqual(expect.arrayContaining([
      { promise_id: deleteSoonPromiseId, kind: 'DRAFT_DELETE_SOON', status: 'PENDING' },
      { promise_id: resumePromiseId, kind: 'DRAFT_DELETE_SOON', status: 'PENDING' },
      { promise_id: resumePromiseId, kind: 'DRAFT_RESUME', status: 'PENDING' },
    ]));

    const firstDispatch = await db.asService(
      `select public.lf_dispatch_due_reminders($1::timestamptz, 100) as result`,
      [now],
    );
    const secondDispatch = await db.asService(
      `select public.lf_dispatch_due_reminders($1::timestamptz, 100) as result`,
      [now],
    );
    expect(firstDispatch.rows[0]?.['result']).toMatchObject({ sent: 2 });
    expect(secondDispatch.rows[0]?.['result']).toMatchObject({ sent: 0 });

    const { rows: events } = await db.asAdmin(
      `select event, count(*)::int as count
         from public.notification_outbox
        where promise_id in ($1, $2) and event in ('NT-20', 'NT-21')
        group by event order by event`,
      [resumePromiseId, deleteSoonPromiseId],
    );
    expect(events).toEqual([
      { event: 'NT-20', count: 1 },
      { event: 'NT-21', count: 1 },
    ]);
  });

  test('90일이 지나고 삭제 예고가 발송된 DRAFT만 멱등 삭제한다', async () => {
    const creatorId = await createUser(db, `초안삭제-${randomUUID().slice(0, 6)}`);
    const partnerId = await createUser(db, `초안삭제제안-${randomUUID().slice(0, 6)}`);
    const promiseId = await createPromise(db, { creatorId, partnerId, status: 'DRAFT' });
    const now = '2026-08-18T00:00:00.000Z';
    await db.asAdmin(
      `update public.promises set updated_at = $2::timestamptz - interval '91 days' where id = $1`,
      [promiseId, now],
    );
    await db.asAdmin(
      `insert into public.reminder_schedules (promise_id, user_id, kind, fire_at, status)
       values ($1, $3, 'DRAFT_DELETE_SOON', $2::timestamptz - interval '8 days', 'SENT')`,
      [promiseId, now, creatorId],
    );
    await db.asAdmin(
      `insert into public.approvals (promise_id, user_id, role, action, surface, acted_at)
       values ($1, $2, 'PARTNER', 'AMEND_SUGGEST', 'WEB', $3::timestamptz - interval '91 days')`,
      [promiseId, partnerId, now],
    );

    expect(await runDraftCleanup(now)).toEqual({ deleted: 1, scheduled: 0 });
    expect(await runDraftCleanup(now)).toEqual({ deleted: 0, scheduled: 0 });
    const { rows } = await db.asAdmin(`select count(*)::int as count from public.promises where id = $1`, [promiseId]);
    expect(rows[0]?.['count']).toBe(0);
    expect((await db.asAdmin(`select count(*)::int as count from public.approvals where promise_id = $1`, [promiseId])).rows[0]?.['count']).toBe(0);
  });

  test('J-04/J-06 스케줄러를 재적용해도 cron 항목이 하나씩만 남는다', async () => {
    await db.asService(`select public.lf_schedule_invitation_expiry()`);
    await db.asService(`select public.lf_schedule_invitation_expiry()`);
    await db.asService(`select public.lf_schedule_draft_cleanup()`);
    await db.asService(`select public.lf_schedule_draft_cleanup()`);

    const { rows } = await db.asAdmin(
      `select jobname, count(*)::int as count, min(schedule) as schedule
         from cron.job
        where jobname in ('lf-invitation-expiry', 'lf-draft-cleanup')
        group by jobname order by jobname`,
    );
    expect(rows).toEqual([
      { jobname: 'lf-draft-cleanup', count: 1, schedule: '0 19 * * *' },
      { jobname: 'lf-invitation-expiry', count: 1, schedule: '*/30 * * * *' },
    ]);
  });
});
