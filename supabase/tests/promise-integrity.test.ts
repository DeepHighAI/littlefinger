import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

let db: TestDb;
let creator: string;

interface VerificationResult {
  checked_count: number;
  failed_count: number;
  resolved_count: number;
}

async function createActivated(status = 'ACTIVE'): Promise<{ promiseId: string; versionId: string }> {
  const promiseId = await createPromise(db, { creatorId: creator, status });
  const version = await db.asAdmin(
    `update public.promise_versions
        set activated_at = '2026-08-01T00:00:00Z'
      where promise_id = $1
      returning id`,
    [promiseId],
  );
  const versionId = String((version.rows[0] as { id: string }).id);
  await db.asAdmin(
    `update public.promises
        set current_version_id = $2, activated_at = '2026-08-01T00:00:00Z'
      where id = $1`,
    [promiseId, versionId],
  );
  return { promiseId, versionId };
}

async function verify(at: string): Promise<VerificationResult> {
  const { rows } = await db.asService<{ result: VerificationResult }>(
    `select public.lf_verify_promise_integrity($1::timestamptz) as result`,
    [at],
  );
  return rows[0]?.result as VerificationResult;
}

async function incidentRows(promiseId: string): Promise<Record<string, unknown>[]> {
  const { rows } = await db.asAdmin(
    `select kind, mismatch_fields, first_detected_at, last_detected_at, resolved_at
       from public.integrity_incidents
      where promise_id = $1
      order by kind`,
    [promiseId],
  );
  return rows;
}

beforeAll(async () => {
  db = await createTestDb();
  creator = await createUser(db, 'integrity-creator');
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('J-09 record integrity', () => {
  test('checks activated current versions and skips never-activated promises', async () => {
    const active = await createActivated('ACTIVE');
    const pending = await createPromise(db, { creatorId: creator, status: 'PENDING' });

    const result = await verify('2026-08-16T20:30:00Z');

    expect(result).toEqual({ checked_count: 1, failed_count: 0, resolved_count: 0 });
    const stamps = await db.asAdmin(
      `select id, hash_verified_at from public.promises where id in ($1, $2) order by id`,
      [active.promiseId, pending],
    );
    expect(
      (stamps.rows.find((row) => row['id'] === active.promiseId)?.['hash_verified_at'] as Date)
        .toISOString(),
    ).toBe('2026-08-16T20:30:00.000Z');
    expect(stamps.rows.find((row) => row['id'] === pending)?.['hash_verified_at']).toBeNull();
  });

  test('all activated lifecycle statuses are checked in deterministic batches', async () => {
    const statuses = [
      'ACTIVE',
      'AMEND_PENDING',
      'CHECKING',
      'COMPLETED',
      'BROKEN',
      'DISPUTED',
      'UNRESOLVED',
      'CANCELED',
    ];
    const ids: string[] = [];
    for (const status of statuses) ids.push((await createActivated(status)).promiseId);
    const expected = await db.asAdmin(
      `select count(*)::int as count
         from public.promises p
        where exists (
          select 1 from public.promise_versions v
           where v.promise_id = p.id and v.activated_at is not null
        )`,
    );

    expect(await verify('2026-08-16T21:00:00Z')).toMatchObject({
      checked_count: expected.rows[0]?.['count'],
    });
    const checked = await db.asAdmin(
      `select count(*)::int as count from public.promises
        where id = any($1::uuid[]) and hash_verified_at is not null`,
      [ids],
    );
    expect(checked.rows[0]?.['count']).toBe(statuses.length);
  });

  test('detects a current-version pointer that does not name the latest activated version', async () => {
    const item = await createActivated('ACTIVE');
    const next = await db.asAdmin(
      `insert into public.promise_versions (
         promise_id, version_no, title, body, category, end_date, keeper, reward, penalty,
         content_hash, created_by, activated_at
       )
       select promise_id, 2, title, body, category, end_date, keeper, reward, penalty,
              public.lf_content_hash(title, body, category, end_date, keeper, reward, penalty, 2),
              created_by, '2026-08-02T00:00:00Z'
         from public.promise_versions where id = $1
       returning id`,
      [item.versionId],
    );
    expect(next.rows).toHaveLength(1);
    const nextVersionId = String((next.rows[0] as { id: string }).id);

    await verify('2026-08-16T21:30:00Z');
    expect(await incidentRows(item.promiseId)).toMatchObject([{
      kind: 'CACHE_MISMATCH',
      mismatch_fields: ['current_version_id'],
    }]);
    await db.asAdmin(`update public.promises set current_version_id = $2 where id = $1`, [
      item.promiseId,
      nextVersionId,
    ]);
    await verify('2026-08-16T21:31:00Z');
  });

  test('records hash and cache mismatch without repairing source records', async () => {
    const item = await createActivated('CHECKING');
    const before = await db.asAdmin(
      `select p.title as cache_title, v.title as version_title, v.content_hash
         from public.promises p join public.promise_versions v on v.id = p.current_version_id
        where p.id = $1`,
      [item.promiseId],
    );
    await db.asAdmin(`update public.promise_versions set body = body || ' 변조' where id = $1`, [item.versionId]);
    await db.asAdmin(`update public.promises set title = '캐시 변조' where id = $1`, [item.promiseId]);

    expect(await verify('2026-08-17T20:30:00Z')).toMatchObject({ failed_count: 1 });
    expect((await incidentRows(item.promiseId)).map((row) => row['kind'])).toEqual([
      'CACHE_MISMATCH',
      'HASH_MISMATCH',
    ]);
    expect((await incidentRows(item.promiseId))[0]?.['mismatch_fields']).toEqual(['title', 'body']);
    const after = await db.asAdmin(
      `select p.title as cache_title, v.title as version_title, v.content_hash
         from public.promises p join public.promise_versions v on v.id = p.current_version_id
        where p.id = $1`,
      [item.promiseId],
    );
    expect(after.rows[0]).toEqual({
      ...before.rows[0],
      cache_title: '캐시 변조',
    });
  });

  test('deduplicates, resolves, and reopens one cache incident lifecycle', async () => {
    const item = await createActivated('ACTIVE');
    await db.asAdmin(`update public.promises set title = '불일치' where id = $1`, [item.promiseId]);
    await verify('2026-08-18T20:30:00Z');
    await verify('2026-08-18T20:30:00Z');
    expect(await incidentRows(item.promiseId)).toHaveLength(1);

    await db.asAdmin(
      `update public.promises p set title = v.title
         from public.promise_versions v where p.id = $1 and v.id = p.current_version_id`,
      [item.promiseId],
    );
    expect(await verify('2026-08-19T20:30:00Z')).toMatchObject({ resolved_count: 1 });
    expect((await incidentRows(item.promiseId))[0]?.['resolved_at']).not.toBeNull();

    await db.asAdmin(`update public.promises set body = '다시 불일치' where id = $1`, [item.promiseId]);
    await verify('2026-08-20T20:30:00Z');
    const reopened = await incidentRows(item.promiseId);
    expect(reopened).toHaveLength(1);
    expect(reopened[0]?.['resolved_at']).toBeNull();
    expect(reopened[0]?.['mismatch_fields']).toEqual(['body']);
  });

  test('client roles cannot read incidents or execute the batch', async () => {
    await expect(db.asUser(creator, 'select * from public.integrity_incidents')).rejects.toThrow(
      /permission denied/iu,
    );
    await expect(db.asAnon('select public.lf_verify_promise_integrity()')).rejects.toThrow(
      /permission denied/iu,
    );
  });

  test('incident write failure rolls back the verification timestamp', async () => {
    const item = await createActivated('ACTIVE');
    await db.asAdmin(`update public.promises set title = '실패 주입' where id = $1`, [item.promiseId]);
    await db.execAdmin(`
      create function public.lf_j09_test_failure() returns trigger language plpgsql
      as $$ begin raise exception 'J09_TEST_FAILURE'; end $$;
      create trigger lf_j09_test_failure before insert or update on public.integrity_incidents
      for each row execute function public.lf_j09_test_failure();
    `);
    try {
      await expect(verify('2026-08-21T20:30:00Z')).rejects.toThrow(/J09_TEST_FAILURE/iu);
      const { rows } = await db.asAdmin(
        `select hash_verified_at from public.promises where id = $1`,
        [item.promiseId],
      );
      expect(rows[0]?.['hash_verified_at']).toBeNull();
    } finally {
      await db.execAdmin(`
        drop trigger lf_j09_test_failure on public.integrity_incidents;
        drop function public.lf_j09_test_failure();
      `);
    }
  });

  test('overlapping runs keep one lifecycle row and use a transaction advisory lock', async () => {
    const item = await createActivated('ACTIVE');
    await db.asAdmin(`update public.promises set title = '동시 불일치' where id = $1`, [item.promiseId]);
    await Promise.all([
      verify('2026-08-22T20:30:00Z'),
      verify('2026-08-22T20:30:00Z'),
    ]);
    expect(await incidentRows(item.promiseId)).toHaveLength(1);
    const { rows } = await db.asAdmin(
      `select pg_get_functiondef(
         'public.lf_verify_promise_integrity(timestamptz)'::regprocedure
       ) as definition`,
    );
    expect(String(rows[0]?.['definition'])).toContain('pg_advisory_xact_lock');
  });
});
