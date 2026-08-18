import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

let db: TestDb;

interface Fixture {
  creator: string;
  partner: string;
  witness: string;
  outsider: string;
  promiseId: string;
  versionId: string;
}

interface Proposal {
  title: string;
  body: string;
  category: string;
  end_date: string;
  keeper: string;
  reward: string | null;
  penalty: string | null;
}

function migrationSource(): string {
  const directory = join(__dirname, '../migrations');
  return readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(join(directory, file), 'utf8'))
    .join('\n');
}

async function seed(status = 'ACTIVE'): Promise<Fixture> {
  const creator = await createUser(db, `변경작성자-${randomUUID().slice(0, 6)}`);
  const partner = await createUser(db, `변경상대-${randomUUID().slice(0, 6)}`);
  const witness = await createUser(db, `변경증인-${randomUUID().slice(0, 6)}`);
  const outsider = await createUser(db, `변경외부-${randomUUID().slice(0, 6)}`);
  const promiseId = await createPromise(db, {
    creatorId: creator,
    partnerId: partner,
    witnessId: witness,
    status,
    endDateOffsetDays: 30,
  });
  const { rows } = await db.asAdmin(
    `update public.promise_versions
        set activated_at = now()
      where promise_id = $1 and version_no = 1
      returning id`,
    [promiseId],
  );
  const versionId = String(rows[0]?.['id']);
  await db.asAdmin(
    `update public.promises
        set current_version_id = $1,
            activated_at = now()
      where id = $2`,
    [versionId, promiseId],
  );
  return { creator, partner, witness, outsider, promiseId, versionId };
}

async function currentProposal(promiseId: string): Promise<Proposal> {
  const { rows } = await db.asAdmin(
    `select title, body, category::text, end_date::text, keeper::text, reward, penalty
       from public.promise_versions
      where promise_id = $1 and activated_at is not null
      order by version_no desc
      limit 1`,
    [promiseId],
  );
  return rows[0] as unknown as Proposal;
}

async function changedProposal(promiseId: string): Promise<Proposal> {
  const current = await currentProposal(promiseId);
  return { ...current, title: '  저녁 산책 약속  ' };
}

async function request(input: {
  actor: string;
  promiseId: string;
  type?: 'AMEND' | 'CANCEL';
  proposal?: Proposal | null;
  reason?: string | null;
  key?: string;
}): Promise<Record<string, unknown>> {
  const { rows } = await db.asService(
    `select public.lf_promise_amend_request(
       $1, $2, $3, $4, $5::jsonb, $6, 'APP'::public.surface, $7, $8
     ) as result`,
    [
      input.key ?? randomUUID(),
      input.actor,
      input.promiseId,
      input.type ?? 'AMEND',
      input.proposal === undefined ? null : JSON.stringify(input.proposal),
      input.reason ?? null,
      'a'.repeat(64),
      'b'.repeat(64),
    ],
  );
  return rows[0]?.['result'] as Record<string, unknown>;
}

async function respond(input: {
  actor: string;
  promiseId: string;
  requestId: string;
  decision: 'APPROVE' | 'DECLINE';
  key?: string;
}): Promise<Record<string, unknown>> {
  const { rows } = await db.asService(
    `select public.lf_promise_amend_respond(
       $1, $2, $3, $4, $5, 'APP'::public.surface, $6, $7
     ) as result`,
    [
      input.key ?? randomUUID(),
      input.actor,
      input.promiseId,
      input.requestId,
      input.decision,
      'c'.repeat(64),
      'd'.repeat(64),
    ],
  );
  return rows[0]?.['result'] as Record<string, unknown>;
}

async function withdraw(input: {
  actor: string;
  promiseId: string;
  requestId: string;
  key?: string;
}): Promise<Record<string, unknown>> {
  const { rows } = await db.asService(
    `select public.lf_promise_amend_withdraw(
       $1, $2, $3, $4, 'APP'::public.surface, $5, $6
     ) as result`,
    [
      input.key ?? randomUUID(),
      input.actor,
      input.promiseId,
      input.requestId,
      'e'.repeat(64),
      'f'.repeat(64),
    ],
  );
  return rows[0]?.['result'] as Record<string, unknown>;
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('F-11 amend agreement schema boundary', () => {
  test('proposal versions are nullable only while inactive and all mutations use fenced locks', () => {
    const source = migrationSource().toLowerCase();
    expect(source).toMatch(/alter table public\.promise_versions alter column version_no drop not null/u);
    expect(source).toMatch(
      /create unique index promise_versions_numbered_unique[\s\S]*where version_no is not null/u,
    );
    expect(source).toMatch(
      /add constraint promise_versions_proposal_number_check[\s\S]*version_no is null[\s\S]*activated_at is null/u,
    );
    for (const name of [
      'lf_promise_amend_request',
      'lf_promise_amend_respond',
      'lf_promise_amend_withdraw',
    ]) {
      const body = source.split(`create or replace function public.${name}`)[1]?.split('$$;')[0] ?? '';
      expect(body).toMatch(/from public\.promises[\s\S]*for update/u);
      expect(body).toContain('lf_idempotency_begin');
      expect(body).toContain('lf_idempotency_finish');
    }
  });

  test('mutation RPCs and append-only tables deny direct authenticated writes', async () => {
    const fixture = await seed();
    await expect(
      db.asUser(
        fixture.creator,
        `select public.lf_promise_amend_request(
           $1, $2, $3, 'CANCEL', null, null, 'APP'::public.surface, null, null
         )`,
        [randomUUID(), fixture.creator, fixture.promiseId],
      ),
    ).rejects.toThrow(/permission denied/u);
    await expect(
      db.asUser(
        fixture.creator,
        `insert into public.amend_requests
           (promise_id, requester_id, type, expires_at)
         values ($1, $2, 'CANCEL', now() + interval '7 days')`,
        [fixture.promiseId, fixture.creator],
      ),
    ).rejects.toThrow();
  });
});

describe('T-07 request', () => {
  test('creator AMEND normalizes an immutable proposal and exact retries replay one response', async () => {
    const fixture = await seed();
    const key = randomUUID();
    const proposal = await changedProposal(fixture.promiseId);
    const first = await request({
      actor: fixture.creator,
      promiseId: fixture.promiseId,
      proposal,
      reason: '  같이 걷는 시간을 바꿔요  ',
      key,
    });
    const replay = await request({
      actor: fixture.creator,
      promiseId: fixture.promiseId,
      proposal: { ...proposal, title: '재시도 본문은 무시' },
      key,
    });
    expect(replay).toEqual(first);
    expect(first).toMatchObject({
      promise_id: fixture.promiseId,
      status: 'AMEND_PENDING',
      type: 'AMEND',
    });

    const { rows } = await db.asAdmin(
      `select p.status, ar.reason, ar.proposed_version_id, v.version_no, v.title,
              v.activated_at, v.change_reason, a.action, a.version_id
         from public.promises p
         join public.amend_requests ar on ar.promise_id = p.id and ar.status = 'PENDING'
         join public.promise_versions v on v.id = ar.proposed_version_id
         join public.approvals a on a.promise_id = p.id and a.action = 'AMEND_REQUEST'
        where p.id = $1`,
      [fixture.promiseId],
    );
    expect(rows[0]).toMatchObject({
      status: 'AMEND_PENDING',
      reason: '같이 걷는 시간을 바꿔요',
      version_no: null,
      title: '저녁 산책 약속',
      activated_at: null,
      change_reason: '같이 걷는 시간을 바꿔요',
      action: 'AMEND_REQUEST',
    });
    expect(rows[0]?.['version_id']).toBe(rows[0]?.['proposed_version_id']);
  });

  test('partner can request CANCEL without a proposal while CANCEL with content is rejected', async () => {
    const fixture = await seed();
    const payload = await request({
      actor: fixture.partner,
      promiseId: fixture.promiseId,
      type: 'CANCEL',
      reason: '  서로 일정이 달라졌어요  ',
    });
    expect(payload).toMatchObject({ type: 'CANCEL', status: 'AMEND_PENDING' });
    const { rows } = await db.asAdmin(
      `select proposed_version_id, reason from public.amend_requests where id = $1`,
      [payload['request_id']],
    );
    expect(rows[0]).toMatchObject({ proposed_version_id: null, reason: '서로 일정이 달라졌어요' });

    const next = await seed();
    await expect(
      request({
        actor: next.partner,
        promiseId: next.promiseId,
        type: 'CANCEL',
        proposal: await changedProposal(next.promiseId),
      }),
    ).rejects.toThrow('E_VALIDATION');
  });

  test('EC-E02·EC-E05 진행 요청 또는 CHECKING이면 새 변경·파기를 차단한다', async () => {
    const fixture = await seed();
    const proposal = await changedProposal(fixture.promiseId);
    await expect(
      request({ actor: fixture.witness, promiseId: fixture.promiseId, proposal }),
    ).rejects.toThrow('E_NOT_FOUND');
    await expect(
      request({ actor: fixture.outsider, promiseId: fixture.promiseId, proposal }),
    ).rejects.toThrow('E_NOT_FOUND');
    await request({ actor: fixture.creator, promiseId: fixture.promiseId, proposal });
    await expect(
      request({ actor: fixture.partner, promiseId: fixture.promiseId, type: 'CANCEL' }),
    ).rejects.toThrow('E_STATE_CONFLICT');

    const checking = await seed('CHECKING');
    await expect(
      request({ actor: checking.creator, promiseId: checking.promiseId, type: 'CANCEL' }),
    ).rejects.toThrow('E_STATE_CONFLICT');
  });

  test('EC-E03 변경 종료일이 과거이면 제안을 저장하지 않는다', async () => {
    const noChange = await seed();
    await expect(
      request({
        actor: noChange.creator,
        promiseId: noChange.promiseId,
        proposal: await currentProposal(noChange.promiseId),
      }),
    ).rejects.toThrow('E_VALIDATION');

    const invalid = await seed();
    const proposal = await changedProposal(invalid.promiseId);
    await expect(
      db.asService(
        `select public.lf_promise_amend_request(
           $1, $2, $3, null, null, null, 'APP'::public.surface, null, null
         )`,
        [randomUUID(), invalid.creator, invalid.promiseId],
      ),
    ).rejects.toThrow('E_VALIDATION');
    await expect(
      request({
        actor: invalid.creator,
        promiseId: invalid.promiseId,
        proposal: { ...proposal, title: '한' },
      }),
    ).rejects.toThrow('E_VALIDATION');
    await expect(
      request({
        actor: invalid.creator,
        promiseId: invalid.promiseId,
        proposal: { ...proposal, end_date: '2000-01-01' },
      }),
    ).rejects.toThrow('E_VALIDATION');
    await expect(
      request({
        actor: invalid.creator,
        promiseId: invalid.promiseId,
        proposal,
        reason: '가'.repeat(201),
      }),
    ).rejects.toThrow('E_VALIDATION');
  });

  test('EC-E01 양측 병렬 변경 요청은 PENDING 한 건만 남긴다', async () => {
    const fixture = await seed();
    const proposal = await changedProposal(fixture.promiseId);
    const run = (actor: string, type: 'AMEND' | 'CANCEL', proposed: Proposal | null) =>
      db.asAdmin(
        `select public.lf_promise_amend_request(
           $1, $2, $3, $4, $5::jsonb, null, 'APP'::public.surface, null, null
         )`,
        [randomUUID(), actor, fixture.promiseId, type, proposed === null ? null : JSON.stringify(proposed)],
      );
    const results = await Promise.allSettled([
      run(fixture.creator, 'AMEND', proposal),
      run(fixture.partner, 'CANCEL', null),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const { rows } = await db.asAdmin(
      `select count(*)::int as count from public.amend_requests
        where promise_id = $1 and status = 'PENDING'`,
      [fixture.promiseId],
    );
    expect(rows[0]?.['count']).toBe(1);
  });
});

describe('T-08 through T-10 response and withdrawal', () => {
  test('null decisions and elapsed response deadlines fail closed', async () => {
    const nullDecision = await seed();
    const first = await request({
      actor: nullDecision.creator,
      promiseId: nullDecision.promiseId,
      type: 'CANCEL',
    });
    await expect(
      db.asService(
        `select public.lf_promise_amend_respond(
           $1, $2, $3, $4, null, 'APP'::public.surface, null, null
         )`,
        [randomUUID(), nullDecision.partner, nullDecision.promiseId, first['request_id']],
      ),
    ).rejects.toThrow('E_VALIDATION');

    const elapsed = await seed();
    const second = await request({
      actor: elapsed.creator,
      promiseId: elapsed.promiseId,
      type: 'CANCEL',
    });
    await db.asAdmin(
      `update public.amend_requests set expires_at = now() - interval '1 second' where id = $1`,
      [second['request_id']],
    );
    await expect(
      respond({
        actor: elapsed.partner,
        promiseId: elapsed.promiseId,
        requestId: String(second['request_id']),
        decision: 'APPROVE',
      }),
    ).rejects.toThrow('E_STATE_CONFLICT');
    await expect(
      withdraw({
        actor: elapsed.creator,
        promiseId: elapsed.promiseId,
        requestId: String(second['request_id']),
      }),
    ).rejects.toThrow('E_STATE_CONFLICT');
  });

  test('the counterpart approves AMEND as contiguous v2 and atomically refreshes cache and reminders', async () => {
    const fixture = await seed();
    await db.asAdmin(
      `insert into public.reminder_schedules (promise_id, user_id, kind, fire_at)
       values ($1, $2, 'D3', now() + interval '2 days'),
              ($1, $3, 'D1', now() + interval '3 days')`,
      [fixture.promiseId, fixture.creator, fixture.partner],
    );
    const created = await request({
      actor: fixture.creator,
      promiseId: fixture.promiseId,
      proposal: await changedProposal(fixture.promiseId),
      reason: '저녁으로 바꿔요',
    });
    await expect(
      respond({
        actor: fixture.creator,
        promiseId: fixture.promiseId,
        requestId: String(created['request_id']),
        decision: 'APPROVE',
      }),
    ).rejects.toThrow('E_FORBIDDEN');
    const approved = await respond({
      actor: fixture.partner,
      promiseId: fixture.promiseId,
      requestId: String(created['request_id']),
      decision: 'APPROVE',
    });
    expect(approved).toMatchObject({
      promise_id: fixture.promiseId,
      status: 'ACTIVE',
      request_status: 'APPROVED',
      version_no: 2,
    });

    const { rows } = await db.asAdmin(
      `select p.status, p.title, v.version_no, v.activated_at, old.superseded_at,
              ar.status as request_status,
              (select count(*)::int from public.reminder_schedules rs
                where rs.promise_id = p.id and rs.status = 'PENDING'
                  and rs.kind in ('D7', 'D3', 'D1', 'DDAY')) as pending_reminders,
              (select count(*)::int from public.approvals a
                where a.promise_id = p.id and a.action = 'AMEND_APPROVE') as approvals
         from public.promises p
         join public.promise_versions v on v.id = p.current_version_id
         join public.promise_versions old on old.id = $2
         join public.amend_requests ar on ar.id = $3
        where p.id = $1`,
      [fixture.promiseId, fixture.versionId, created['request_id']],
    );
    expect(rows[0]).toMatchObject({
      status: 'ACTIVE',
      title: '저녁 산책 약속',
      version_no: 2,
      request_status: 'APPROVED',
      approvals: 1,
    });
    expect(rows[0]?.['activated_at']).not.toBeNull();
    expect(rows[0]?.['superseded_at']).not.toBeNull();
    expect(Number(rows[0]?.['pending_reminders'])).toBeGreaterThan(0);

    const { rows: historyRows } = await db.asService(
      `select public.lf_promise_version_list($1, $2) as result`,
      [fixture.creator, fixture.promiseId],
    );
    const history = historyRows[0]?.['result'] as { versions: Array<Record<string, unknown>> };
    expect(history.versions.map((item) => (item['version'] as { version_no: number }).version_no)).toEqual([2, 1]);
    expect(history.versions[0]).toMatchObject({ change_reason: '저녁으로 바꿔요' });
  });

  test('approval revalidates a proposal end date that elapsed while pending', async () => {
    const fixture = await seed();
    const proposal = await changedProposal(fixture.promiseId);
    const created = await request({
      actor: fixture.creator,
      promiseId: fixture.promiseId,
      proposal,
    });
    await db.asAdmin(
      `update public.promise_versions set end_date = '2000-01-01'
        where id = (select proposed_version_id from public.amend_requests where id = $1)`,
      [created['request_id']],
    );
    await expect(
      respond({
        actor: fixture.partner,
        promiseId: fixture.promiseId,
        requestId: String(created['request_id']),
        decision: 'APPROVE',
      }),
    ).rejects.toThrow('E_VALIDATION');
  });

  test('decline preserves an inactive unnumbered proposal and returns ACTIVE', async () => {
    const fixture = await seed();
    const created = await request({
      actor: fixture.partner,
      promiseId: fixture.promiseId,
      proposal: await changedProposal(fixture.promiseId),
    });
    const declined = await respond({
      actor: fixture.creator,
      promiseId: fixture.promiseId,
      requestId: String(created['request_id']),
      decision: 'DECLINE',
    });
    expect(declined).toMatchObject({
      status: 'ACTIVE',
      request_status: 'DECLINED',
      version_no: null,
    });
    const { rows } = await db.asAdmin(
      `select ar.status, v.version_no, v.activated_at, p.current_version_id,
              (select count(*)::int from public.approvals a
                where a.promise_id = p.id and a.action = 'AMEND_DECLINE') as approvals
         from public.amend_requests ar
         join public.promise_versions v on v.id = ar.proposed_version_id
         join public.promises p on p.id = ar.promise_id
        where ar.id = $1`,
      [created['request_id']],
    );
    expect(rows[0]).toMatchObject({
      status: 'DECLINED',
      version_no: null,
      activated_at: null,
      current_version_id: fixture.versionId,
      approvals: 1,
    });
  });

  test('only the requester withdraws and stale request IDs cannot affect a newer request', async () => {
    const fixture = await seed();
    const created = await request({
      actor: fixture.creator,
      promiseId: fixture.promiseId,
      type: 'CANCEL',
    });
    await expect(
      withdraw({
        actor: fixture.partner,
        promiseId: fixture.promiseId,
        requestId: String(created['request_id']),
      }),
    ).rejects.toThrow('E_FORBIDDEN');
    const withdrawn = await withdraw({
      actor: fixture.creator,
      promiseId: fixture.promiseId,
      requestId: String(created['request_id']),
    });
    expect(withdrawn).toMatchObject({ status: 'ACTIVE', request_status: 'WITHDRAWN' });

    const newer = await request({
      actor: fixture.partner,
      promiseId: fixture.promiseId,
      type: 'CANCEL',
    });
    await expect(
      respond({
        actor: fixture.partner,
        promiseId: fixture.promiseId,
        requestId: String(created['request_id']),
        decision: 'DECLINE',
      }),
    ).rejects.toThrow('E_STATE_CONFLICT');
    expect(newer['request_id']).not.toBe(created['request_id']);
  });

  test('counterpart approval of CANCEL closes the promise and cancels every pending reminder', async () => {
    const fixture = await seed();
    await db.asAdmin(
      `insert into public.reminder_schedules (promise_id, user_id, kind, fire_at)
       values ($1, $2, 'D7', now() + interval '1 day'),
              ($1, $3, 'CHECK_REQ', now() + interval '2 days')`,
      [fixture.promiseId, fixture.creator, fixture.partner],
    );
    const created = await request({
      actor: fixture.partner,
      promiseId: fixture.promiseId,
      type: 'CANCEL',
      reason: '함께 파기하기로 했어요',
    });
    const canceled = await respond({
      actor: fixture.creator,
      promiseId: fixture.promiseId,
      requestId: String(created['request_id']),
      decision: 'APPROVE',
    });
    expect(canceled).toMatchObject({
      status: 'CANCELED',
      request_status: 'APPROVED',
      version_no: null,
    });
    const { rows } = await db.asAdmin(
      `select p.status, p.closed_at, ar.status as request_status,
              count(rs.id) filter (where rs.status = 'PENDING')::int as pending,
              count(a.id) filter (where a.action = 'CANCEL_APPROVE')::int as approvals
         from public.promises p
         join public.amend_requests ar on ar.promise_id = p.id
         left join public.reminder_schedules rs on rs.promise_id = p.id
         left join public.approvals a on a.promise_id = p.id
        where p.id = $1
        group by p.status, p.closed_at, ar.status`,
      [fixture.promiseId],
    );
    expect(rows[0]).toMatchObject({
      status: 'CANCELED',
      request_status: 'APPROVED',
      pending: 0,
    });
    expect(rows[0]?.['closed_at']).not.toBeNull();
    expect(Number(rows[0]?.['approvals'])).toBeGreaterThan(0);
  });

  test('detail projects pending proposal as next version and hides version history from outsiders', async () => {
    const fixture = await seed();
    const created = await request({
      actor: fixture.creator,
      promiseId: fixture.promiseId,
      proposal: await changedProposal(fixture.promiseId),
    });
    const { rows } = await db.asService(
      `select public.lf_promise_detail($1, $2) as result`,
      [fixture.partner, fixture.promiseId],
    );
    expect(rows[0]?.['result']).toMatchObject({
      status: 'AMEND_PENDING',
      amend_request: {
        request_id: created['request_id'],
        proposed_version: { version_no: 2, title: '저녁 산책 약속' },
      },
    });
    await expect(
      db.asService(`select public.lf_promise_version_list($1, $2)`, [
        fixture.outsider,
        fixture.promiseId,
      ]),
    ).rejects.toThrow('E_NOT_FOUND');
  });
});
