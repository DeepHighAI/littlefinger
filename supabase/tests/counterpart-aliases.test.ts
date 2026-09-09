import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { asCounterpartAliasResponse } from '../../packages/shared/src/account-safety.ts';
import { asPromiseDetailResponse } from '../../packages/shared/src/promise-detail.ts';
import { asPromiseHomeListResponse } from '../../packages/shared/src/promise-home.ts';
import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

let db: TestDb;
let actor: string;
let partner: string;
let witness: string;
let outsider: string;
let promiseId: string;
let secondId: string;
beforeAll(async () => {
  db = await createTestDb();
  actor = await createUser(db, '작성자');
  partner = await createUser(db, '원래 이름');
  witness = await createUser(db, '증인');
  outsider = await createUser(db, '외부인');
  promiseId = await createPromise(db, { creatorId: actor, partnerId: partner, witnessId: witness, status: 'ACTIVE' });
  secondId = await createPromise(db, { creatorId: actor, partnerId: partner, status: 'ACTIVE' });
  await db.asAdmin(`update public.promises p set current_version_id = v.id, activated_at = now() from public.promise_versions v
    where v.promise_id = p.id and p.id in ($1,$2)`, [promiseId, secondId]);
  await db.asAdmin('update public.promise_versions set activated_at=now() where promise_id in ($1,$2)', [promiseId, secondId]);
  await db.asAdmin(`insert into public.approvals (promise_id, version_id, user_id, role, action, surface)
    select p.id,p.current_version_id,$2,'PARTNER','APPROVE','APP' from public.promises p where p.id=$1`, [promiseId, partner]);
}, 60_000);
afterAll(async () => { await db.close(); });

async function get(owner = actor, id = promiseId) {
  const { rows } = await db.asService('select public.lf_counterpart_alias_get($1,$2) as result', [owner, id]);
  return asCounterpartAliasResponse(rows[0]?.['result']);
}
async function update(alias: string | null, owner = actor, id = promiseId, key = randomUUID()) {
  const { rows } = await db.asService('select public.lf_counterpart_alias_update($1,$2,$3,$4) as result', [key, owner, id, alias]);
  return asCounterpartAliasResponse(rows[0]?.['result']);
}

function publicDetail(value: unknown) {
  const { integrity_status: _internal, ...view } = value as Record<string, unknown>;
  return asPromiseDetailResponse(view);
}

test('personal aliases normalize, synchronize across promises, and never change the profile or other viewer', async () => {
  expect(await get()).toEqual({ target_user_id: partner, nickname: '원래 이름', alias: null });
  const key = randomUUID();
  expect((await update('  가 친구  ', actor, promiseId, key))?.alias).toBe('가 친구');
  expect((await update('  가 친구  ', actor, promiseId, key))?.alias).toBe('가 친구');
  expect((await get(actor, secondId))?.alias).toBe('가 친구');
  expect((await get(partner))?.alias).toBeNull();
  expect((await db.asAdmin('select nickname from public.users where id=$1', [partner])).rows[0]?.['nickname']).toBe('원래 이름');
  expect((await db.asUser(actor, 'select alias from public.user_aliases')).rows).toEqual([{ alias: '가 친구' }]);
  expect((await db.asUser(partner, 'select alias from public.user_aliases')).rows).toEqual([]);
  expect((await db.asUser(outsider, 'select alias from public.user_aliases')).rows).toEqual([]);
});

test('current detail and list names change without breaking legacy exact-key response parsers', async () => {
  await update('내 친구');
  const { rows } = await db.asService('select public.lf_promise_detail($1,$2) as result', [actor, promiseId]);
  const detail = publicDetail(rows[0]?.['result']);
  expect(detail, JSON.stringify(rows[0]?.['result'])).not.toBeNull();
  expect(detail?.partner?.nickname).toBe('내 친구');
  const original = await db.asService('select public.lf_promise_detail_unfiltered($1,$2) as result', [actor, promiseId]);
  const originalView = original.rows[0]?.['result'] as Record<string, unknown>;
  expect((rows[0]?.['result'] as Record<string, unknown>)['approvals']).toEqual(originalView['approvals']);
  expect(detail?.approvals[0]?.actor.nickname).toBe('원래 이름');
  expect((rows[0]?.['result'] as Record<string, unknown>)['current_version']).toEqual(originalView['current_version']);
  const other = await db.asService('select public.lf_promise_detail($1,$2) as result', [partner, promiseId]);
  expect(publicDetail(other.rows[0]?.['result'])?.partner?.nickname).toBe('원래 이름');
  const home = await db.asService("select public.lf_promise_home_list($1,'ACTIVE') as result", [actor]);
  const page = asPromiseHomeListResponse(home.rows[0]?.['result'], 'ACTIVE');
  expect(page).not.toBeNull();
  expect(page?.items).toHaveLength(2);
  expect(page?.items.map((item) => item.promise_id).sort()).toEqual([promiseId, secondId].sort());
  expect(page?.items.every((item) => item.partner?.nickname === '내 친구')).toBe(true);
  await db.asAdmin("update public.promises set status='COMPLETED',closed_at=now() where id=$1", [secondId]);
  const history = await db.asService("select public.lf_promise_home_list($1,'DONE') as result", [actor]);
  expect(asPromiseHomeListResponse(history.rows[0]?.['result'], 'DONE')?.items[0]?.partner?.nickname).toBe('내 친구');
  await db.asAdmin("update public.promises set status='CHECKING',checking_started_at=now(),check_deadline_at=now()+interval '7 days' where id=$1", [promiseId]);
  const pinnedHome = await db.asService("select public.lf_promise_home_list($1,'ACTIVE') as result", [actor]);
  const pinnedPage = asPromiseHomeListResponse(pinnedHome.rows[0]?.['result'], 'ACTIVE');
  expect(pinnedPage?.pinned).toHaveLength(1);
  expect(pinnedPage?.pinned[0]).toMatchObject({ promise_id: promiseId, partner: { nickname: '내 친구' } });
  const partnerHome = await db.asService("select public.lf_promise_home_list($1,'ACTIVE') as result", [partner]);
  expect(asPromiseHomeListResponse(partnerHome.rows[0]?.['result'], 'ACTIVE')?.pinned[0])
    .toMatchObject({ promise_id: promiseId, partner: { nickname: '원래 이름' } });
  const check = await db.asService('select public.lf_promise_fulfillment_detail($1,$2) as result', [actor, promiseId]);
  expect((check.rows[0]?.['result'] as { partner: { nickname: string } }).partner.nickname).toBe('내 친구');
});

test('anonymous/direct writes, arbitrary identities, witness and nonparticipant access are rejected', async () => {
  for (const user of [outsider, witness]) {
    await expect(get(user)).rejects.toThrow('E_NOT_FOUND');
    await expect(update('침입', user)).rejects.toThrow('E_NOT_FOUND');
  }
  await expect(db.asUser(actor, 'select public.lf_counterpart_alias_get($1,$2)', [actor, promiseId])).rejects.toThrow('permission denied');
  await expect(db.asUser(actor, 'update public.user_aliases set alias=$1', ['침입'])).rejects.toThrow('permission denied');
  await expect(db.asAnon('select * from public.user_aliases')).rejects.toThrow('permission denied');
  for (const value of ['', '   ', '가'.repeat(41)]) await expect(update(value)).rejects.toThrow('E_VALIDATION');
});

test('expired and hidden records cannot be used to read or change aliases', async () => {
  await db.asAdmin("update public.promises set end_date=current_date-100,closed_at=now()-interval '100 days' where id=$1", [secondId]);
  await expect(get(actor, secondId)).rejects.toThrow('E_NOT_FOUND');
  await expect(update('만료', actor, secondId)).rejects.toThrow('E_NOT_FOUND');
  await db.asAdmin('update public.promises set hidden_by=jsonb_build_object($2::text,true) where id=$1', [promiseId, actor]);
  await expect(get()).rejects.toThrow('E_NOT_FOUND');
  await expect(update('숨김')).rejects.toThrow('E_NOT_FOUND');
  await db.asAdmin("update public.promises set hidden_by='{}'::jsonb where id=$1", [promiseId]);
  await db.asAdmin('update public.promises set end_date=current_date+7,closed_at=now() where id=$1', [secondId]);
});

test('reset removes alias and restores original across promises; withdrawn users remove both directions', async () => {
  await update(null);
  expect((await get(actor, secondId))?.alias).toBeNull();
  await update('친구');
  await update('나를 아는 이름', partner);
  await db.asAdmin("update public.users set status='WITHDRAWN' where id=$1", [partner]);
  expect((await db.asAdmin('select * from public.user_aliases')).rows).toEqual([]);
  await expect(get()).rejects.toThrow('E_NOT_FOUND');
  await expect(update('복원')).rejects.toThrow('E_NOT_FOUND');
  await expect(get(partner)).rejects.toThrow();
});
