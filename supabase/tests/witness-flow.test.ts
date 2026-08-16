import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join as joinPath } from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  createInvitation,
  createPromise,
  createTestDb,
  createUser,
  type TestDb,
} from './harness.ts';

let db: TestDb;

function newTokenHash(): string {
  return randomUUID().replaceAll('-', '').repeat(2);
}

async function activatePromise(promiseId: string): Promise<void> {
  await db.asAdmin(
    `update public.promise_versions
        set activated_at = '2026-08-16T00:00:00Z'
      where promise_id = $1`,
    [promiseId],
  );
  await db.asAdmin(
    `update public.promises p
        set current_version_id = v.id,
            activated_at = '2026-08-16T00:00:00Z'
       from public.promise_versions v
      where p.id = $1 and v.promise_id = p.id and v.version_no = 1`,
    [promiseId],
  );
}

async function issue(input: {
  actor: string;
  promiseId: string;
  hash: string;
  key?: string;
  participantId?: string | null;
}): Promise<Record<string, unknown>> {
  const { rows } = await db.asService(
    `select public.lf_witness_invite($1, $2, $3, $4, $5) as result`,
    [
      input.key ?? randomUUID(),
      input.actor,
      input.promiseId,
      input.hash,
      input.participantId ?? null,
    ],
  );
  return rows[0]?.['result'] as Record<string, unknown>;
}

async function join(input: {
  actor: string;
  hash: string;
  key?: string;
}): Promise<Record<string, unknown>> {
  const { rows } = await db.asService(
    `select public.lf_witness_join($1, $2, $3) as result`,
    [input.key ?? randomUUID(), input.actor, input.hash],
  );
  return rows[0]?.['result'] as Record<string, unknown>;
}

async function detail(actor: string, promiseId: string): Promise<Record<string, unknown>> {
  const { rows } = await db.asService(
    `select public.lf_witness_detail($1, $2) as result`,
    [actor, promiseId],
  );
  return rows[0]?.['result'] as Record<string, unknown>;
}

async function sign(input: {
  actor: string;
  promiseId: string;
  key?: string;
}): Promise<Record<string, unknown>> {
  const { rows } = await db.asService(
    `select public.lf_witness_sign($1, $2, $3, 'WEB', null, null) as result`,
    [input.key ?? randomUUID(), input.actor, input.promiseId],
  );
  return rows[0]?.['result'] as Record<string, unknown>;
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('F-05 witness invitation transactions', () => {
  test('witness invite serializes capacity checks on the promise row', () => {
    const migration = readFileSync(
      joinPath(process.cwd(), 'supabase/migrations/20260816000006_f05_witness_flow.sql'),
      'utf8',
    );
    const inviteBody = migration.split('create or replace function public.lf_witness_join')[0] ?? '';
    expect(inviteBody).toMatch(/from public\.promises[\s\S]*where id = p_promise_id[\s\S]*for update;/u);
  });

  test('joined creator and partner issue distinct slots and list them without raw tokens', async () => {
    const creator = await createUser(db, '증인발급작성자');
    const partner = await createUser(db, '증인발급상대');
    const promiseId = await createPromise(db, { creatorId: creator, partnerId: partner, status: 'ACTIVE' });
    await activatePromise(promiseId);
    const firstHash = newTokenHash();
    const secondHash = newTokenHash();

    const first = await issue({ actor: creator, promiseId, hash: firstHash });
    const second = await issue({ actor: partner, promiseId, hash: secondHash });
    expect(first).toMatchObject({ promise_id: promiseId, token_hash: firstHash });
    expect(second).toMatchObject({ promise_id: promiseId, token_hash: secondHash });

    const { rows } = await db.asService(
      `select public.lf_witness_invite_list($1, $2) as result`,
      [creator, promiseId],
    );
    expect(rows[0]?.['result']).toMatchObject({
      promise_id: promiseId,
      occupied_count: 2,
      capacity: 2,
    });
    expect(JSON.stringify(rows[0]?.['result'])).not.toMatch(/token|hash/u);
  });

  test('allowed states issue while terminal and DISPUTED states fail closed', async () => {
    const creator = await createUser(db, '증인상태작성자');
    for (const status of ['PENDING', 'ACTIVE', 'AMEND_PENDING', 'CHECKING'] as const) {
      const promiseId = await createPromise(db, { creatorId: creator, status });
      await expect(issue({ actor: creator, promiseId, hash: randomUUID().replaceAll('-', '').repeat(2) })).resolves.toMatchObject({ promise_id: promiseId });
    }
    for (const status of ['COMPLETED', 'BROKEN', 'DISPUTED', 'UNRESOLVED', 'DECLINED', 'CANCELED'] as const) {
      const promiseId = await createPromise(db, { creatorId: creator, status });
      await expect(issue({ actor: creator, promiseId, hash: randomUUID().replaceAll('-', '').repeat(2) })).rejects.toThrow('E_STATE_CONFLICT');
    }
  });

  test('capacity counts joined and valid invited slots and rejects a third slot', async () => {
    const creator = await createUser(db, '증인상한작성자');
    const partner = await createUser(db, '증인상한상대');
    const joinedWitness = await createUser(db, '기존증인');
    const promiseId = await createPromise(db, {
      creatorId: creator,
      partnerId: partner,
      witnessId: joinedWitness,
      status: 'ACTIVE',
    });
    await activatePromise(promiseId);
    await expect(issue({ actor: creator, promiseId, hash: newTokenHash() })).resolves.toMatchObject({
      promise_id: promiseId,
    });
    await expect(issue({ actor: partner, promiseId, hash: newTokenHash() })).rejects.toThrow(
      'E_WITNESS_LIMIT',
    );

    const { rows } = await db.asAdmin(
      `select count(*)::int as count
         from public.promise_participants
        where promise_id = $1 and role = 'WITNESS'
          and status in ('INVITED', 'JOINED')`,
      [promiseId],
    );
    expect(rows[0]?.['count']).toBe(2);
  });

  test('expired invited slot is omitted and can be reused by reissue', async () => {
    const creator = await createUser(db, '증인만료작성자');
    const promiseId = await createPromise(db, { creatorId: creator, status: 'PENDING' });
    const reissuedHash = newTokenHash();
    const created = await issue({ actor: creator, promiseId, hash: newTokenHash() });
    const participantId = String(created['participant_id']);
    await db.asAdmin(
      `update public.invitations set expires_at = now() - interval '1 minute'
        where id = $1`,
      [created['invitation_id']],
    );

    const { rows: before } = await db.asService(
      `select public.lf_witness_invite_list($1, $2) as result`,
      [creator, promiseId],
    );
    expect(before[0]?.['result']).toMatchObject({ occupied_count: 0, witnesses: [] });

    const reissued = await issue({
      actor: creator,
      promiseId,
      participantId,
      hash: reissuedHash,
    });
    expect(reissued).toMatchObject({ participant_id: participantId, token_hash: reissuedHash });
    const { rows: states } = await db.asAdmin(
      `select status::text from public.invitations where promise_id = $1 order by created_at, id`,
      [promiseId],
    );
    expect(states.map((row) => row['status'])).toEqual(['REVOKED', 'PENDING']);
  });

  test('same issue idempotency key returns one slot and its original stored hash', async () => {
    const creator = await createUser(db, '증인멱등작성자');
    const promiseId = await createPromise(db, { creatorId: creator, status: 'PENDING' });
    const key = randomUUID();
    const firstHash = newTokenHash();
    const first = await issue({ actor: creator, promiseId, hash: firstHash, key });
    const replay = await issue({ actor: creator, promiseId, hash: newTokenHash(), key });
    expect(replay).toEqual(first);
    expect(replay['token_hash']).toBe(firstHash);
  });

  test('one witness token joins one account and duplicate roles are rejected', async () => {
    const creator = await createUser(db, '증인참여작성자');
    const partner = await createUser(db, '증인참여상대');
    const witnessA = await createUser(db, '증인참여A');
    const witnessB = await createUser(db, '증인참여B');
    const promiseId = await createPromise(db, { creatorId: creator, partnerId: partner, status: 'ACTIVE' });
    await activatePromise(promiseId);
    const tokenHash = newTokenHash();
    await issue({ actor: creator, promiseId, hash: tokenHash });

    await expect(join({ actor: creator, hash: tokenHash })).rejects.toThrow('E_DUPLICATE_ROLE');
    const results = await Promise.allSettled([
      join({ actor: witnessA, hash: tokenHash }),
      join({ actor: witnessB, hash: tokenHash }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(String((results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason)).toContain('E_INVITE_USED');
  });

  test('creator partner and an existing witness cannot take another witness slot', async () => {
    const creator = await createUser(db, '증인중복작성자');
    const partner = await createUser(db, '증인중복상대');
    const existingWitness = await createUser(db, '증인중복기존');
    const promiseId = await createPromise(db, {
      creatorId: creator,
      partnerId: partner,
      witnessId: existingWitness,
      status: 'ACTIVE',
    });
    await activatePromise(promiseId);
    const tokenHash = newTokenHash();
    await issue({ actor: creator, promiseId, hash: tokenHash });

    await expect(join({ actor: creator, hash: tokenHash })).rejects.toThrow('E_DUPLICATE_ROLE');
    await expect(join({ actor: partner, hash: tokenHash })).rejects.toThrow('E_DUPLICATE_ROLE');
    await expect(join({ actor: existingWitness, hash: tokenHash })).rejects.toThrow('E_DUPLICATE_ROLE');
  });

  test('an unexpired witness invite remains redeemable after the promise closes', async () => {
    const creator = await createUser(db, '증인종결작성자');
    const witness = await createUser(db, '증인종결참여자');
    const promiseId = await createPromise(db, { creatorId: creator, status: 'ACTIVE' });
    await activatePromise(promiseId);
    const tokenHash = newTokenHash();
    await issue({ actor: creator, promiseId, hash: tokenHash });
    await db.asAdmin(`update public.promises set status = 'COMPLETED' where id = $1`, [promiseId]);

    await expect(join({ actor: witness, hash: tokenHash })).resolves.toMatchObject({
      promise_id: promiseId,
      status: 'JOINED',
    });
  });

  test('bidirectional block rejects join before revealing detail', async () => {
    const creator = await createUser(db, '증인차단작성자');
    const witness = await createUser(db, '증인차단대상');
    const promiseId = await createPromise(db, { creatorId: creator, status: 'PENDING' });
    const tokenHash = newTokenHash();
    await issue({ actor: creator, promiseId, hash: tokenHash });
    await db.asAdmin(`insert into public.blocks (blocker_id, blocked_user_id) values ($1, $2)`, [witness, creator]);
    await expect(join({ actor: witness, hash: tokenHash })).rejects.toThrow('E_BLOCKED');
  });

  test('joined witness sees LIMITED before activation and FULL content with evidence after result', async () => {
    const creator = await createUser(db, '증인상세작성자');
    const partner = await createUser(db, '증인상세상대');
    const witness = await createUser(db, '증인상세증인');
    const promiseId = await createPromise(db, { creatorId: creator, partnerId: partner, status: 'PENDING' });
    const tokenHash = newTokenHash();
    await issue({ actor: creator, promiseId, hash: tokenHash });
    await join({ actor: witness, hash: tokenHash });
    expect(await detail(witness, promiseId)).toMatchObject({
      promise_id: promiseId,
      visibility: 'LIMITED',
      content: null,
      fulfillment: null,
    });

    await db.asAdmin(`update public.promises set status = 'COMPLETED' where id = $1`, [promiseId]);
    await activatePromise(promiseId);
    const { rows: versionRows } = await db.asAdmin(
      `select id from public.promise_versions where promise_id = $1 and version_no = 1`,
      [promiseId],
    );
    const { rows: checkRows } = await db.asAdmin(
      `insert into public.fulfillment_checks
         (promise_id, version_id, user_id, round_no, answer, surface)
       values ($1, $2, $3, 1, 'KEPT', 'APP') returning id`,
      [promiseId, versionRows[0]?.['id'], creator],
    );
    await db.asAdmin(
      `insert into public.fulfillment_evidences
         (check_id, promise_id, uploaded_by, storage_key, thumb_key, mime, bytes, width, height)
       values ($1, $2, $3, 'secret/full.jpg', 'secret/thumb.jpg', 'image/jpeg', 1200, 320, 200)`,
      [checkRows[0]?.['id'], promiseId, creator],
    );

    const full = await detail(witness, promiseId);
    expect(full).toMatchObject({
      visibility: 'FULL',
      content: { body: '매일 30분 걷기로 했다' },
      fulfillment: { round_no: 1 },
    });
    expect(JSON.stringify(full)).not.toMatch(/storage_key|thumb_key/u);
  });

  test('outsider detail is hidden and direct RPC execution is not granted to client roles', async () => {
    const creator = await createUser(db, '증인권한작성자');
    const outsider = await createUser(db, '증인권한외부');
    const promiseId = await createPromise(db, { creatorId: creator, status: 'PENDING' });
    await expect(detail(outsider, promiseId)).rejects.toThrow('E_NOT_FOUND');
    await expect(
      db.asUser(creator, `select public.lf_witness_invite_list($1, $2)`, [creator, promiseId]),
    ).rejects.toThrow(/permission denied/u);
    await expect(
      db.asAnon(`select public.lf_witness_detail($1, $2)`, [outsider, promiseId]),
    ).rejects.toThrow(/permission denied/u);
  });

  test('parallel sign attempts create one append-only approval and one NT-18 intent per party', async () => {
    const creator = await createUser(db, '증인서명작성자');
    const partner = await createUser(db, '증인서명상대');
    const witness = await createUser(db, '증인서명증인');
    const promiseId = await createPromise(db, { creatorId: creator, partnerId: partner, status: 'ACTIVE' });
    await activatePromise(promiseId);
    const tokenHash = newTokenHash();
    await issue({ actor: creator, promiseId, hash: tokenHash });
    await join({ actor: witness, hash: tokenHash });

    const [first, second] = await Promise.all([
      sign({ actor: witness, promiseId }),
      sign({ actor: witness, promiseId }),
    ]);
    expect(first['signed_at']).toBe(second['signed_at']);

    const { rows: approvals } = await db.asAdmin(
      `select count(*)::int as count from public.approvals
        where promise_id = $1 and user_id = $2 and action = 'WITNESS_SIGN'`,
      [promiseId, witness],
    );
    const { rows: outbox } = await db.asAdmin(
      `select recipient_user_id from public.notification_outbox
        where promise_id = $1 and event = 'NT-18' order by recipient_user_id`,
      [promiseId],
    );
    expect(approvals[0]?.['count']).toBe(1);
    expect(outbox.map((row) => row['recipient_user_id']).sort()).toEqual([creator, partner].sort());
  });

  test('joined witness cannot approve decline amend or submit fulfillment', async () => {
    const creator = await createUser(db, '증인변경작성자');
    const witness = await createUser(db, '증인변경증인');
    const promiseId = await createPromise(db, { creatorId: creator, status: 'PENDING' });
    const witnessHash = newTokenHash();
    await issue({ actor: creator, promiseId, hash: witnessHash });
    await join({ actor: witness, hash: witnessHash });
    const partnerHash = await createInvitation(db, { promiseId, createdBy: creator });

    await expect(
      db.asService(`select public.lf_promise_approve($1, $2, $3, 'WEB', null, null)`, [
        randomUUID(), partnerHash, witness,
      ]),
    ).rejects.toThrow('E_DUPLICATE_ROLE');
    await expect(
      db.asService(`select public.lf_promise_decline($1, $2, $3, null, 'WEB', null, null)`, [
        randomUUID(), partnerHash, witness,
      ]),
    ).rejects.toThrow('E_DUPLICATE_ROLE');
    await expect(
      db.asService(`select public.lf_promise_amend_suggest($1, $2, $3, $4, 'WEB', null, null)`, [
        randomUUID(), partnerHash, witness, '종료일을 바꿔 주세요',
      ]),
    ).rejects.toThrow('E_DUPLICATE_ROLE');
    await expect(
      db.asService(
        `select public.lf_fulfillment_submit(
           $1, $2, $3, 'KEPT', null, false, '{}'::uuid[], '{}'::uuid[], 'WEB'
         )`,
        [randomUUID(), witness, promiseId],
      ),
    ).rejects.toThrow('E_NOT_FOUND');
  });
});
