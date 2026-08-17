import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

const SUBMIT_SQL = `select public.lf_fulfillment_submit(
  $1::uuid, $2::uuid, $3::uuid, $4::public.fulfillment_answer,
  null::text, false, '{}'::uuid[], '{}'::uuid[], 'APP'::public.surface
) as payload`;
const CLAIM_SQL = `select public.lf_completion_celebration_claim(
  $1::uuid, $2::uuid, $3::uuid
) as payload`;
const SHOWN_SQL = `select public.lf_completion_celebration_shown(
  $1::uuid, $2::uuid, $3::uuid, $4::uuid
) as payload`;

let db: TestDb;

interface PartyFixture {
  creatorId: string;
  partnerId: string;
  promiseId: string;
}

interface CelebrationRow {
  user_id: string;
  participant_role: 'CREATOR' | 'PARTNER';
  keep_rate_before: number | null;
  keep_rate_after: number | null;
  claim_id: string | null;
  claimed_at: Date | null;
  shown_at: Date | null;
}

async function codeOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.asAdmin(sql, params);
  return rows[0] as T;
}

async function seedChecking(keeper: 'CREATOR' | 'PARTNER' | 'BOTH' = 'BOTH'):
Promise<PartyFixture> {
  const creatorId = await createUser(db, `mod03-creator-${randomUUID().slice(0, 8)}`);
  const partnerId = await createUser(db, `mod03-partner-${randomUUID().slice(0, 8)}`);
  const promiseId = await createPromise(db, { creatorId, partnerId, status: 'CHECKING' });
  await db.asAdmin(
    `update public.promise_versions
        set activated_at = now() - interval '8 days'
      where promise_id = $1`,
    [promiseId],
  );
  await db.asAdmin(
    `update public.promises
        set current_version_id = (
              select id from public.promise_versions where promise_id = $1 and version_no = 1
            ),
            keeper = $2::public.keeper,
            activated_at = now() - interval '8 days',
            checking_started_at = now() - interval '1 day',
            check_deadline_at = now() + interval '1 day',
            check_round_no = 1
      where id = $1`,
    [promiseId, keeper],
  );
  return { creatorId, partnerId, promiseId };
}

async function submit(
  fixture: PartyFixture,
  actorId: string,
  answer: 'KEPT' | 'NOT_KEPT',
  key = randomUUID(),
): Promise<Record<string, unknown>> {
  const { rows } = await db.asService<{ payload: Record<string, unknown> }>(SUBMIT_SQL, [
    key,
    actorId,
    fixture.promiseId,
    answer,
  ]);
  const row = rows[0];
  if (row === undefined) throw new Error('missing fulfillment response');
  return row.payload;
}

async function seedHistory(
  actorId: string,
  completedCount: number,
  brokenCount: number,
): Promise<void> {
  const otherId = await createUser(db, `history-other-${randomUUID().slice(0, 8)}`);
  for (let index = 0; index < completedCount + brokenCount; index += 1) {
    const promiseId = await createPromise(db, {
      creatorId: actorId,
      partnerId: otherId,
      status: index < completedCount ? 'COMPLETED' : 'BROKEN',
    });
    await db.asAdmin(
      `update public.promises
          set keeper = 'CREATOR', closed_at = now() - interval '1 day'
        where id = $1`,
      [promiseId],
    );
  }
  await db.asService(`select public.lf_recompute_trust_profile($1::uuid)`, [actorId]);
}

async function celebrationRows(promiseId: string): Promise<CelebrationRow[]> {
  const { rows } = await db.asAdmin(
    `select user_id, participant_role, keep_rate_before, keep_rate_after,
            claim_id, claimed_at, shown_at
       from public.completion_celebrations
      where promise_id = $1
      order by participant_role`,
    [promiseId],
  );
  return rows as unknown as CelebrationRow[];
}

async function seedCompletedCelebrations(): Promise<PartyFixture> {
  const creatorId = await createUser(db, `claim-creator-${randomUUID().slice(0, 8)}`);
  const partnerId = await createUser(db, `claim-partner-${randomUUID().slice(0, 8)}`);
  const promiseId = await createPromise(db, {
    creatorId,
    partnerId,
    status: 'COMPLETED',
  });
  await db.asAdmin(
    `insert into public.completion_celebrations (
       promise_id, user_id, participant_role, keep_rate_before, keep_rate_after
     ) values
       ($1, $2, 'CREATOR', 87, 89),
       ($1, $3, 'PARTNER', 75, 75)`,
    [promiseId, creatorId, partnerId],
  );
  return { creatorId, partnerId, promiseId };
}

async function claim(
  fixture: PartyFixture,
  actorId: string,
  key = randomUUID(),
): Promise<Record<string, unknown>> {
  const { rows } = await db.asService<{ payload: Record<string, unknown> }>(CLAIM_SQL, [
    key,
    actorId,
    fixture.promiseId,
  ]);
  const row = rows[0];
  if (row === undefined) throw new Error('missing claim response');
  return row.payload;
}

async function shown(
  fixture: PartyFixture,
  actorId: string,
  claimId: string,
  key = randomUUID(),
): Promise<Record<string, unknown>> {
  const { rows } = await db.asService<{ payload: Record<string, unknown> }>(SHOWN_SQL, [
    key,
    actorId,
    fixture.promiseId,
    claimId,
  ]);
  const row = rows[0];
  if (row === undefined) throw new Error('missing shown response');
  return row.payload;
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('MOD-03 T-12 completion snapshots', () => {
  test('KEPT plus KEPT stores literal rates before and after recomputation', async () => {
    const fixture = await seedChecking();
    await seedHistory(fixture.creatorId, 2, 1);
    await seedHistory(fixture.partnerId, 3, 1);

    await submit(fixture, fixture.creatorId, 'KEPT');
    await submit(fixture, fixture.partnerId, 'KEPT');

    expect(await celebrationRows(fixture.promiseId)).toEqual([
      expect.objectContaining({
        user_id: fixture.creatorId,
        participant_role: 'CREATOR',
        keep_rate_before: 67,
        keep_rate_after: 75,
      }),
      expect.objectContaining({
        user_id: fixture.partnerId,
        participant_role: 'PARTNER',
        keep_rate_before: 75,
        keep_rate_after: 80,
      }),
    ]);
  });

  test('crossing the sample threshold stores null then the first numeric rate', async () => {
    const fixture = await seedChecking();
    await seedHistory(fixture.creatorId, 2, 0);

    await submit(fixture, fixture.creatorId, 'KEPT');
    await submit(fixture, fixture.partnerId, 'KEPT');

    expect(await celebrationRows(fixture.promiseId)).toContainEqual(
      expect.objectContaining({
        user_id: fixture.creatorId,
        keep_rate_before: null,
        keep_rate_after: 100,
      }),
    );
  });

  test('a party not obligated by the completed promise stores an unchanged rate', async () => {
    const fixture = await seedChecking('CREATOR');
    await seedHistory(fixture.partnerId, 3, 1);

    await submit(fixture, fixture.creatorId, 'KEPT');
    await submit(fixture, fixture.partnerId, 'KEPT');

    expect(await celebrationRows(fixture.promiseId)).toContainEqual(
      expect.objectContaining({
        user_id: fixture.partnerId,
        keep_rate_before: 75,
        keep_rate_after: 75,
      }),
    );
  });

  test.each([
    ['NOT_KEPT', 'NOT_KEPT', 'BROKEN'],
    ['KEPT', 'NOT_KEPT', 'DISPUTED'],
  ] as const)('%s + %s produces %s without celebration rows', async (first, second, status) => {
    const fixture = await seedChecking();
    await submit(fixture, fixture.creatorId, first);
    await submit(fixture, fixture.partnerId, second);

    const promise = await one<{ status: string }>(
      `select status from public.promises where id = $1`,
      [fixture.promiseId],
    );
    expect(promise.status).toBe(status);
    expect(await celebrationRows(fixture.promiseId)).toEqual([]);
  });

  test('the first response that still waits creates no celebration row', async () => {
    const fixture = await seedChecking();
    const response = await submit(fixture, fixture.creatorId, 'KEPT');

    expect(response).toMatchObject({ status: 'CHECKING', waiting_for_partner: true });
    expect(await celebrationRows(fixture.promiseId)).toEqual([]);
  });

  test('parallel second responses create one row per party and one COMPLETED transition', async () => {
    const fixture = await seedChecking();
    const results = await Promise.all([
      submit(fixture, fixture.creatorId, 'KEPT'),
      submit(fixture, fixture.partnerId, 'KEPT'),
    ]);

    expect(results.map((result) => result['status'])).toContain('COMPLETED');
    expect(await celebrationRows(fixture.promiseId)).toHaveLength(2);
    const promise = await one<{ status: string; lock_version: number }>(
      `select status, lock_version from public.promises where id = $1`,
      [fixture.promiseId],
    );
    expect(promise).toMatchObject({ status: 'COMPLETED', lock_version: 1 });
  });

  test('fulfillment idempotency replay never overwrites original snapshots', async () => {
    const fixture = await seedChecking();
    const creatorKey = randomUUID();
    const first = await submit(fixture, fixture.creatorId, 'KEPT', creatorKey);
    await submit(fixture, fixture.partnerId, 'KEPT');
    const beforeReplay = await celebrationRows(fixture.promiseId);

    expect(await submit(fixture, fixture.creatorId, 'NOT_KEPT', creatorKey)).toEqual(first);
    expect(await celebrationRows(fixture.promiseId)).toEqual(beforeReplay);
  });
});

describe('MOD-03 claim and shown transactions', () => {
  test('creator and partner claim independently with their immutable payloads', async () => {
    const fixture = await seedCompletedCelebrations();

    const creator = await claim(fixture, fixture.creatorId);
    const partner = await claim(fixture, fixture.partnerId);

    expect(creator).toMatchObject({
      available: true,
      celebration: {
        promise_id: fixture.promiseId,
        title: '매일 걷기',
        counterpart_nickname: expect.stringContaining('claim-partner-'),
        keep_rate_before: 87,
        keep_rate_after: 89,
      },
    });
    expect(partner).toMatchObject({
      available: true,
      celebration: {
        counterpart_nickname: expect.stringContaining('claim-creator-'),
        keep_rate_before: 75,
        keep_rate_after: 75,
      },
    });
    expect((creator['celebration'] as { claim_id: string }).claim_id).not.toBe(
      (partner['celebration'] as { claim_id: string }).claim_id,
    );
  });

  test('same claim key replays exactly while another key is unavailable', async () => {
    const fixture = await seedCompletedCelebrations();
    const key = randomUUID();
    const first = await claim(fixture, fixture.creatorId, key);

    expect(await claim(fixture, fixture.creatorId, key)).toEqual(first);
    expect(await claim(fixture, fixture.creatorId, randomUUID())).toEqual({
      available: false,
      celebration: null,
    });
  });

  test('shown stores first exposure and both same-key replay and new-key retry preserve it', async () => {
    const fixture = await seedCompletedCelebrations();
    const claimed = await claim(fixture, fixture.creatorId);
    const claimId = (claimed['celebration'] as { claim_id: string }).claim_id;
    const key = randomUUID();
    const first = await shown(fixture, fixture.creatorId, claimId, key);

    expect(await shown(fixture, fixture.creatorId, claimId, key)).toEqual(first);
    expect(await shown(fixture, fixture.creatorId, claimId, randomUUID())).toEqual(first);
    const row = (await celebrationRows(fixture.promiseId)).find(
      (candidate) => candidate.user_id === fixture.creatorId,
    );
    expect(row?.shown_at).not.toBeNull();
  });

  test('wrong, other-party, and random claim IDs are hidden as not found', async () => {
    const fixture = await seedCompletedCelebrations();
    const creatorClaim = await claim(fixture, fixture.creatorId);
    const partnerClaim = await claim(fixture, fixture.partnerId);
    const creatorClaimId = (creatorClaim['celebration'] as { claim_id: string }).claim_id;
    const partnerClaimId = (partnerClaim['celebration'] as { claim_id: string }).claim_id;

    expect(await codeOf(() => shown(fixture, fixture.creatorId, partnerClaimId))).toBe(
      'E_NOT_FOUND',
    );
    expect(await codeOf(() => shown(fixture, fixture.partnerId, creatorClaimId))).toBe(
      'E_NOT_FOUND',
    );
    expect(await codeOf(() => shown(fixture, fixture.creatorId, randomUUID()))).toBe(
      'E_NOT_FOUND',
    );
  });

  test('eligible party on a legacy COMPLETED promise receives unavailable', async () => {
    const creatorId = await createUser(db, `legacy-creator-${randomUUID().slice(0, 8)}`);
    const partnerId = await createUser(db, `legacy-partner-${randomUUID().slice(0, 8)}`);
    const promiseId = await createPromise(db, { creatorId, partnerId, status: 'COMPLETED' });

    expect(await claim({ creatorId, partnerId, promiseId }, creatorId)).toEqual({
      available: false,
      celebration: null,
    });
  });

  test('witness, outsider, inactive user, and non-COMPLETED caller cannot claim', async () => {
    const fixture = await seedCompletedCelebrations();
    const witnessId = await createUser(db, `claim-witness-${randomUUID().slice(0, 8)}`);
    const outsiderId = await createUser(db, `claim-outsider-${randomUUID().slice(0, 8)}`);
    await db.asAdmin(
      `insert into public.promise_participants (promise_id, user_id, role, status)
       values ($1, $2, 'WITNESS', 'JOINED')`,
      [fixture.promiseId, witnessId],
    );

    expect(await codeOf(() => claim(fixture, witnessId))).toBe('E_NOT_FOUND');
    expect(await codeOf(() => claim(fixture, outsiderId))).toBe('E_NOT_FOUND');

    await db.asAdmin(`update public.users set status = 'SUSPENDED' where id = $1`, [
      fixture.creatorId,
    ]);
    expect(await codeOf(() => claim(fixture, fixture.creatorId))).toBe('E_FORBIDDEN');

    const checking = await seedChecking();
    expect(await codeOf(() => claim(checking, checking.creatorId))).toBe('E_STATE_CONFLICT');
  });

  test('parallel claim keys expose at most one available response', async () => {
    const fixture = await seedCompletedCelebrations();
    const responses = await Promise.all([
      claim(fixture, fixture.creatorId),
      claim(fixture, fixture.creatorId),
    ]);

    expect(responses.filter((response) => response['available'] === true)).toHaveLength(1);
    expect(responses.filter((response) => response['available'] === false)).toHaveLength(1);
  });

  test('claim and shown are empty-search-path SECURITY DEFINER service boundaries', async () => {
    const { rows } = await db.asAdmin(
      `select p.proname,
              p.prosecdef,
              p.proconfig,
              has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
              has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
            'lf_completion_celebration_claim',
            'lf_completion_celebration_shown'
          )
        order by p.proname`,
    );

    expect(rows).toHaveLength(2);
    expect(rows).toEqual([
      expect.objectContaining({
        proname: 'lf_completion_celebration_claim',
        prosecdef: true,
        proconfig: ['search_path=""'],
        anon: false,
        authenticated: false,
        service_role: true,
      }),
      expect.objectContaining({
        proname: 'lf_completion_celebration_shown',
        prosecdef: true,
        proconfig: ['search_path=""'],
        anon: false,
        authenticated: false,
        service_role: true,
      }),
    ]);
  });
});
