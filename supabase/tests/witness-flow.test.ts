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

async function leave(input: {
  actor: string;
  promiseId: string;
  key?: string;
}): Promise<Record<string, unknown>> {
  const { rows } = await db.asService(
    `select public.lf_witness_leave($1, $2, $3) as result`,
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

  test('작성자 기본 슬롯과 상대방 보상 슬롯은 서로 독립적으로 발급된다', async () => {
    const creator = await createUser(db, '증인발급작성자');
    const partner = await createUser(db, '증인발급상대');
    const promiseId = await createPromise(db, { creatorId: creator, partnerId: partner, status: 'ACTIVE' });
    await activatePromise(promiseId);
    await db.asAdmin(
      `insert into public.promise_reward_grants (promise_id,user_id,action,source)
       values ($1,$2,'WITNESS_PARTNER','MIGRATION')`,
      [promiseId, partner],
    );
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

  test('EC-D04 허용 상태만 발급하고 종결 및 DISPUTED에서는 차단한다', async () => {
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

  test('EC-D01 참여·유효 초대 슬롯을 합산해 세 번째 증인을 차단한다', async () => {
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
    await db.asAdmin(
      `update public.promise_participants set invited_by_user_id=$2
        where promise_id=$1 and role='WITNESS'`,
      [promiseId, creator],
    );
    await db.asAdmin(
      `insert into public.promise_reward_grants (promise_id,user_id,action,source)
       values ($1,$2,'WITNESS_CREATOR','MIGRATION')`,
      [promiseId, creator],
    );
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

  test('EC-D02 작성자·상대·기존 증인은 다른 증인 역할을 가질 수 없다', async () => {
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

  test('joined witness leaves every promise status without changing the promise', async () => {
    const creator = await createUser(db, '증인나가기상태작성자');
    const witness = await createUser(db, '증인나가기상태증인');
    const statuses = [
      'DRAFT', 'PENDING', 'ACTIVE', 'AMEND_PENDING', 'CHECKING', 'COMPLETED',
      'BROKEN', 'DISPUTED', 'UNRESOLVED', 'DECLINED', 'CANCELED',
    ] as const;

    for (const status of statuses) {
      const promiseId = await createPromise(db, { creatorId: creator, witnessId: witness, status });
      await expect(leave({ actor: witness, promiseId })).resolves.toEqual({
        promise_id: promiseId,
        status: 'WITHDRAWN',
      });
      const { rows } = await db.asAdmin(
        `select p.status::text as promise_status, pp.status::text as participant_status
           from public.promises p
           join public.promise_participants pp on pp.promise_id = p.id
          where p.id = $1 and pp.user_id = $2`,
        [promiseId, witness],
      );
      expect(rows).toEqual([{ promise_status: status, participant_status: 'WITHDRAWN' }]);
    }
  });

  test('EC-D03 증인 나가기는 기존 append-only 서명을 그대로 보존한다', async () => {
    const creator = await createUser(db, '증인나가기로깅작성자');
    const partner = await createUser(db, '증인나가기로깅상대');
    const witness = await createUser(db, '증인나가기로깅증인');
    const promiseId = await createPromise(db, {
      creatorId: creator,
      partnerId: partner,
      witnessId: witness,
      status: 'ACTIVE',
    });
    await activatePromise(promiseId);
    await sign({ actor: witness, promiseId });
    const { rows: before } = await db.asAdmin(
      `select row_to_json(a)::text as value
         from public.approvals a
        where a.promise_id = $1 and a.user_id = $2 and a.action = 'WITNESS_SIGN'`,
      [promiseId, witness],
    );

    await leave({ actor: witness, promiseId });

    const { rows: after } = await db.asAdmin(
      `select row_to_json(a)::text as value
         from public.approvals a
        where a.promise_id = $1 and a.user_id = $2 and a.action = 'WITNESS_SIGN'`,
      [promiseId, witness],
    );
    expect(after).toEqual(before);
    expect(after).toHaveLength(1);
  });

  test('leave revokes detail and new evidence signed URLs', async () => {
    const creator = await createUser(db, '증인나가기열람작성자');
    const witness = await createUser(db, '증인나가기열람증인');
    const promiseId = await createPromise(db, {
      creatorId: creator,
      witnessId: witness,
      status: 'COMPLETED',
    });
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
    const { rows: evidenceRows } = await db.asAdmin(
      `insert into public.fulfillment_evidences
         (check_id, promise_id, uploaded_by, storage_key, thumb_key, mime, bytes, width, height)
       values ($1, $2, $3, 'leave/full.jpg', 'leave/thumb.jpg', 'image/jpeg', 100, 10, 10)
       returning id`,
      [checkRows[0]?.['id'], promiseId, creator],
    );
    const evidenceId = String(evidenceRows[0]?.['id']);
    await expect(detail(witness, promiseId)).resolves.toMatchObject({ promise_id: promiseId });
    await expect(
      db.asService(`select public.lf_evidence_sign_target($1, $2, 'FULL')`, [witness, evidenceId]),
    ).resolves.toBeDefined();

    await leave({ actor: witness, promiseId });

    await expect(detail(witness, promiseId)).rejects.toThrow('E_NOT_FOUND');
    await expect(
      db.asService(`select public.lf_evidence_sign_target($1, $2, 'FULL')`, [witness, evidenceId]),
    ).rejects.toThrow('E_NOT_FOUND');
  });

  test('leave releases capacity and same or new idempotency keys replay withdrawn state', async () => {
    const creator = await createUser(db, '증인나가기멱등작성자');
    const witness = await createUser(db, '증인나가기멱등증인');
    const promiseId = await createPromise(db, {
      creatorId: creator,
      witnessId: witness,
      status: 'ACTIVE',
    });
    const key = randomUUID();
    const first = await leave({ actor: witness, promiseId, key });
    expect(await leave({ actor: witness, promiseId, key })).toEqual(first);
    expect(await leave({ actor: witness, promiseId, key: randomUUID() })).toEqual(first);

    const { rows } = await db.asService(
      `select public.lf_witness_invite_list($1, $2) as result`,
      [creator, promiseId],
    );
    expect(rows[0]?.['result']).toMatchObject({ occupied_count: 0, witnesses: [] });
    await expect(issue({ actor: creator, promiseId, hash: newTokenHash() })).resolves.toMatchObject({
      promise_id: promiseId,
    });
  });

  test('non-witness inactive actor and client roles cannot perform leave', async () => {
    const creator = await createUser(db, '증인나가기권한작성자');
    const partner = await createUser(db, '증인나가기권한상대');
    const witness = await createUser(db, '증인나가기권한증인');
    const outsider = await createUser(db, '증인나가기권한외부');
    const promiseId = await createPromise(db, {
      creatorId: creator,
      partnerId: partner,
      witnessId: witness,
      status: 'ACTIVE',
    });
    await expect(leave({ actor: creator, promiseId })).rejects.toThrow('E_NOT_FOUND');
    await expect(leave({ actor: partner, promiseId })).rejects.toThrow('E_NOT_FOUND');
    await expect(leave({ actor: outsider, promiseId })).rejects.toThrow('E_NOT_FOUND');
    await db.asAdmin(`update public.users set status = 'SUSPENDED' where id = $1`, [witness]);
    await expect(leave({ actor: witness, promiseId })).rejects.toThrow('E_FORBIDDEN');
    await db.asAdmin(`update public.users set status = 'ACTIVE' where id = $1`, [witness]);
    await expect(
      db.asUser(witness, `select public.lf_witness_leave($1, $2, $3)`, [
        randomUUID(), witness, promiseId,
      ]),
    ).rejects.toThrow(/permission denied/iu);
    // 0004 가 UPDATE grant 를 회수해 RLS 의 0행이 아니라 권한 거절이다.
    await expect(
      db.asUser(
        witness,
        `update public.promise_participants
            set status = 'WITHDRAWN'
          where promise_id = $1 and user_id = $2 returning id`,
        [promiseId, witness],
      ),
    ).rejects.toThrow(/permission denied/iu);
  });

  test('withdrawn witness cannot redeem another invitation for the same promise', async () => {
    const creator = await createUser(db, '증인나가기재참여작성자');
    const witness = await createUser(db, '증인나가기재참여증인');
    const promiseId = await createPromise(db, {
      creatorId: creator,
      witnessId: witness,
      status: 'ACTIVE',
    });
    await leave({ actor: witness, promiseId });
    const tokenHash = newTokenHash();
    await issue({ actor: creator, promiseId, hash: tokenHash });
    await expect(join({ actor: witness, hash: tokenHash })).rejects.toThrow('E_DUPLICATE_ROLE');
  });

  test('parallel sign and leave serialize without deleting a committed signature', async () => {
    const creator = await createUser(db, '증인나가기경합작성자');
    const partner = await createUser(db, '증인나가기경합상대');
    const witness = await createUser(db, '증인나가기경합증인');
    const promiseId = await createPromise(db, {
      creatorId: creator,
      partnerId: partner,
      witnessId: witness,
      status: 'ACTIVE',
    });
    await activatePromise(promiseId);

    const results = await Promise.allSettled([
      sign({ actor: witness, promiseId }),
      leave({ actor: witness, promiseId }),
    ]);
    expect(results.some((result) => result.status === 'fulfilled')).toBe(true);
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected.every((result) => String(result.reason).includes('E_NOT_FOUND'))).toBe(true);

    const { rows } = await db.asAdmin(
      `select pp.status::text as participant_status,
              count(a.id)::int as signature_count
         from public.promise_participants pp
         left join public.approvals a
           on a.promise_id = pp.promise_id
          and a.user_id = pp.user_id
          and a.action = 'WITNESS_SIGN'
        where pp.promise_id = $1 and pp.user_id = $2
        group by pp.status`,
      [promiseId, witness],
    );
    expect(rows[0]?.['participant_status']).toBe('WITHDRAWN');
    expect([0, 1]).toContain(rows[0]?.['signature_count']);
  });
});
