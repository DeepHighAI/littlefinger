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

const DELETE_SQL = `select public.lf_promise_pending_delete(
  $1::uuid, $2::uuid, $3::uuid) as payload`;

async function deletePending(
  actor: string,
  promiseId: string,
  key = randomUUID(),
): Promise<Record<string, unknown>> {
  const { rows } = await db.asService(DELETE_SQL, [key, actor, promiseId]);
  return (rows[0] as { payload: Record<string, unknown> }).payload;
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('PENDING 약속 작성자 삭제', () => {
  test('약속·초대·수락 대기·증인 기록을 원자적으로 지우고 신고는 분리 보존한다', async () => {
    const creator = await createUser(db, '대기삭제작성자');
    const witness = await createUser(db, '대기삭제증인');
    const promiseId = await createPromise(db, {
      creatorId: creator,
      witnessId: witness,
      status: 'PENDING',
    });
    await createInvitation(db, { promiseId, createdBy: creator, targetRole: 'PARTNER' });
    await createInvitation(db, { promiseId, createdBy: creator, targetRole: 'WITNESS' });
    await db.asAdmin(
      `insert into public.reminder_schedules (promise_id, user_id, kind, fire_at)
       values ($1, $2, 'INVITE_EXPIRE_SOON', now() + interval '1 day')`,
      [promiseId, creator],
    );
    await db.asAdmin(
      `insert into public.approvals
         (promise_id, version_id, user_id, role, action, surface)
       select $1, v.id, $2, 'WITNESS', 'WITNESS_SIGN', 'APP'
         from public.promise_versions v
        where v.promise_id = $1`,
      [promiseId, witness],
    );
    const { rows: reportRows } = await db.asAdmin(
      `insert into public.reports (reporter_id, target_user_id, promise_id, reason)
       values ($1, $2, $3, 'ETC') returning id`,
      [creator, witness, promiseId],
    );
    const reportId = String(reportRows[0]?.['id']);

    await expect(deletePending(creator, promiseId)).resolves.toEqual({
      promise_id: promiseId,
      deleted: true,
    });

    const { rows } = await db.asAdmin(
      `select
         (select count(*)::int from public.promises where id = $1) as promises,
         (select count(*)::int from public.promise_versions where promise_id = $1) as versions,
         (select count(*)::int from public.promise_participants where promise_id = $1) as participants,
         (select count(*)::int from public.invitations where promise_id = $1) as invitations,
         (select count(*)::int from public.reminder_schedules where promise_id = $1) as reminders,
         (select count(*)::int from public.approvals where promise_id = $1) as approvals,
         (select count(*)::int from public.reports where id = $2 and promise_id is null) as reports`,
      [promiseId, reportId],
    );
    expect(rows[0]).toEqual({
      promises: 0,
      versions: 0,
      participants: 0,
      invitations: 0,
      reminders: 0,
      approvals: 0,
      reports: 1,
    });
  });

  test('같은 멱등 키 재시도는 삭제 뒤에도 첫 응답을 그대로 돌려준다', async () => {
    const creator = await createUser(db, '대기삭제멱등');
    const promiseId = await createPromise(db, { creatorId: creator, status: 'PENDING' });
    const key = randomUUID();

    const first = await deletePending(creator, promiseId, key);
    const second = await deletePending(creator, promiseId, key);

    expect(second).toEqual(first);
  });

  test('비작성자와 PENDING이 아닌 상태는 삭제할 수 없고 클라이언트 역할은 RPC를 직접 못 부른다', async () => {
    const creator = await createUser(db, '대기삭제권한작성자');
    const outsider = await createUser(db, '대기삭제권한외부');
    const pendingId = await createPromise(db, { creatorId: creator, status: 'PENDING' });
    const activeId = await createPromise(db, { creatorId: creator, status: 'ACTIVE' });

    await expect(deletePending(outsider, pendingId)).rejects.toThrow('E_NOT_FOUND');
    await expect(deletePending(creator, activeId)).rejects.toThrow('E_STATE_CONFLICT');
    await expect(
      db.asUser(creator, DELETE_SQL, [randomUUID(), creator, pendingId]),
    ).rejects.toThrow(/permission denied/iu);

    const { rows } = await db.asAdmin(
      `select count(*)::int as count from public.promises where id in ($1, $2)`,
      [pendingId, activeId],
    );
    expect(rows[0]?.['count']).toBe(2);
  });

  test('상대 수락과 작성자 삭제가 동시에 오면 한쪽만 커밋된다', async () => {
    const creator = await createUser(db, '대기삭제경합작성자');
    const partner = await createUser(db, '대기삭제경합상대');
    const promiseId = await createPromise(db, { creatorId: creator, status: 'PENDING' });
    const tokenHash = await createInvitation(db, { promiseId, createdBy: creator });

    const results = await Promise.allSettled([
      db.asAdmin(DELETE_SQL, [randomUUID(), creator, promiseId]),
      db.asAdmin(
        `select public.lf_promise_approve($1::uuid, $2::char(64), $3::uuid,
                                          'WEB', null, null) as payload`,
        [randomUUID(), tokenHash, partner],
      ),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]?.reason)).toMatch(/E_NOT_FOUND|E_STATE_CONFLICT/u);

    const { rows } = await db.asAdmin(
      `select status::text as status from public.promises where id = $1`,
      [promiseId],
    );
    expect(rows.length === 0 || rows[0]?.['status'] === 'ACTIVE').toBe(true);
  });
});
