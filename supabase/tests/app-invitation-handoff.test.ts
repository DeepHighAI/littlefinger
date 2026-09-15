import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, test, expect } from 'vitest';
import { createTestDb, createUser, createPromise, createInvitation, type TestDb } from './harness.ts';
let db: TestDb;
beforeAll(async () => { db = await createTestDb(); }, 60_000);
afterAll(async () => { await db?.close(); });
const decline = (hash: string) => db.asService('select public.lf_invite_decline_public($1, null, null) result', [hash]);
test('anonymous partner decline is final, idempotent and never invents an actor', async () => {
  const actor = await createUser(db, '작성자');
  const promise = await createPromise(db, { creatorId: actor, status: 'PENDING' });
  const hash = await createInvitation(db, { promiseId: promise, createdBy: actor });
  expect((await decline(hash)).rows[0]?.['result']).toEqual({ status: 'DECLINED', target_role: 'PARTNER' });
  await decline(hash);
  expect((await db.asAdmin('select status from promises where id=$1', [promise])).rows[0]?.['status']).toBe('DECLINED');
  expect((await db.asAdmin('select count(*)::int n from invitation_declines where promise_id=$1', [promise])).rows[0]?.['n']).toBe(1);
  expect((await db.asAdmin('select count(*)::int n from approvals where promise_id=$1', [promise])).rows[0]?.['n']).toBe(0);
  await expect(db.asService("select public.lf_promise_approve($1,$2,$3,'APP',null,null)", [randomUUID(), hash, await createUser(db, '상대')])).rejects.toThrow('E_INVITE_USED');
});
test.each(['REVOKED', 'USED', 'EXPIRED'] as const)('rejects %s invitation', async status => {
  const actor = await createUser(db, '만료작성자');
  const promise = await createPromise(db, { creatorId: actor, status: 'PENDING' });
  const hash = await createInvitation(db, { promiseId: promise, createdBy: actor, status });
  await expect(decline(hash)).rejects.toThrow(`E_INVITE_${status}`);
});
test('witness preview does not consume invitation; decline releases only witness slot', async () => {
  const creator = await createUser(db, '증인작성자');
  const witness = await createUser(db, '증인');
  const promise = await createPromise(db, { creatorId: creator, status: 'PENDING' });
  const hash = await createInvitation(db, { promiseId: promise, createdBy: creator, targetRole: 'WITNESS' });
  await db.asAdmin("insert into promise_participants(promise_id,role,status,invitation_id) select $1,'WITNESS','INVITED',id from invitations where token_hash=$2", [promise,hash]);
  const preview = await db.asService('select public.lf_witness_preview($1,$2) result',[witness,hash]);
  expect(preview.rows[0]?.['result']).toMatchObject({visibility:'LIMITED',content:null});
  expect((await db.asAdmin('select status from invitations where token_hash=$1',[hash])).rows[0]?.['status']).toBe('PENDING');
  await decline(hash);
  expect((await db.asAdmin('select status from promises where id=$1',[promise])).rows[0]?.['status']).toBe('PENDING');
  await expect(db.asService('select public.lf_witness_join($1,$2,$3)',[randomUUID(),witness,hash])).rejects.toThrow('E_INVITE_USED');
});
test('public database roles cannot bypass the Edge token gate', async () => {
  await expect(db.asAnon("select public.lf_invite_decline_public(repeat('a',64)::char(64),null,null)")).rejects.toThrow();
});

test('queued approve and anonymous decline commit exactly one terminal outcome', async () => {
  const actor = await createUser(db, '동시작성자'); const partner = await createUser(db, '동시상대');
  const promise = await createPromise(db, { creatorId: actor, status: 'PENDING' });
  const hash = await createInvitation(db, { promiseId: promise, createdBy: actor });
  const outcomes = await Promise.allSettled([
    db.asAdmin("select public.lf_promise_approve($1,$2,$3,'APP',null,null)", [randomUUID(),hash,partner]),
    db.asAdmin('select public.lf_invite_decline_public($1,null,null)',[hash]),
  ]);
  expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
  const result = (await db.asAdmin('select status from promises where id=$1',[promise])).rows[0]?.['status'];
  expect(['ACTIVE','DECLINED']).toContain(result);
});
test('an already joined witness cannot be anonymously declined', async () => {
  const actor = await createUser(db, '참여작성자'); const witness = await createUser(db, '참여증인');
  const promise = await createPromise(db, { creatorId: actor, status: 'PENDING' });
  const hash = await createInvitation(db, { promiseId: promise, createdBy: actor, targetRole: 'WITNESS' });
  await db.asAdmin("insert into promise_participants(promise_id,role,status,invitation_id) select $1,'WITNESS','INVITED',id from invitations where token_hash=$2",[promise,hash]);
  await db.asService('select public.lf_witness_join($1,$2,$3)',[randomUUID(),witness,hash]);
  await expect(decline(hash)).rejects.toThrow('E_INVITE_USED');
});
