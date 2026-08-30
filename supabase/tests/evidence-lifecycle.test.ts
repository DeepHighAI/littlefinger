import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  createPromise,
  createTestDb,
  createUser,
  type TestDb,
} from './harness.ts';

interface CheckingFixture {
  creatorId: string;
  partnerId: string;
  witnessId: string;
  promiseId: string;
}

let db: TestDb;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const result = await db.asAdmin(sql, params);
  expect(result.rows).toHaveLength(1);
  return result.rows[0] as T;
}

async function errorCode(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return 'NO_ERROR';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return message.match(/E_[A-Z_]+/u)?.[0] ?? message;
  }
}

async function seedChecking(): Promise<CheckingFixture> {
  const suffix = randomUUID().slice(0, 8);
  const creatorId = await createUser(db, `evidence-creator-${suffix}`);
  const partnerId = await createUser(db, `evidence-partner-${suffix}`);
  const witnessId = await createUser(db, `evidence-witness-${suffix}`);
  const promiseId = await createPromise(db, {
    creatorId,
    partnerId,
    witnessId,
    status: 'CHECKING',
  });
  await db.asAdmin(
    `update public.promises p
        set current_version_id = (
              select pv.id
                from public.promise_versions pv
               where pv.promise_id = p.id
                 and pv.version_no = 1
            ),
            check_round_no = 1,
            checking_started_at = now() - interval '1 hour',
            check_deadline_at = now() + interval '7 days'
      where p.id = $1`,
    [promiseId],
  );
  return { creatorId, partnerId, witnessId, promiseId };
}

const RESERVE_SQL = `
  select public.lf_evidence_upload_reserve(
    $1::uuid, $2::uuid, $3::uuid, $4::int
  ) as payload
`;

const DISCARD_SQL = `
  select public.lf_evidence_upload_discard($1::uuid, $2::uuid) as payload
`;

const COMPLETE_SQL = `
  select public.lf_evidence_upload_complete(
    $1::uuid, $2::uuid, $3::text, $4::text, $5::int, $6::int, $7::int
  ) as payload
`;

const SUBMIT_SQL = `
  select public.lf_fulfillment_submit(
    $1::uuid,
    $2::uuid,
    $3::uuid,
    $4::public.fulfillment_answer,
    $5::text,
    $6::boolean,
    $7::uuid[],
    $8::uuid[],
    $9::public.surface
  ) as payload
`;

function uuidArray(values: readonly string[]): string {
  return `{${values.join(',')}}`;
}

async function reserve(
  fixture: CheckingFixture,
  actorId = fixture.creatorId,
): Promise<string> {
  const row = await one<{ payload: { upload_id: string } }>(RESERVE_SQL, [
    randomUUID(),
    actorId,
    fixture.promiseId,
    1,
  ]);
  return row.payload.upload_id;
}

async function complete(actorId: string, uploadId: string): Promise<void> {
  await db.asAdmin(COMPLETE_SQL, [
    actorId,
    uploadId,
    `promises/test/${uploadId}/full.jpg`,
    `promises/test/${uploadId}/thumb.jpg`,
    2048,
    1280,
    720,
  ]);
}

async function submit(
  fixture: CheckingFixture,
  actorId: string,
  answer: 'KEPT' | 'NOT_KEPT',
  uploads: readonly string[] = [],
): Promise<void> {
  await db.asAdmin(SUBMIT_SQL, [
    randomUUID(),
    actorId,
    fixture.promiseId,
    answer,
    null,
    false,
    uuidArray(uploads),
    uuidArray([]),
    actorId === fixture.creatorId ? 'APP' : 'WEB',
  ]);
}

async function bindOne(
  fixture: CheckingFixture,
): Promise<{ uploadId: string; evidenceId: string }> {
  const uploadId = await reserve(fixture);
  await complete(fixture.creatorId, uploadId);
  await submit(fixture, fixture.creatorId, 'KEPT', [uploadId]);
  const row = await one<{ evidence_id: string }>(
    `select id::text as evidence_id
       from public.fulfillment_evidences
      where upload_id = $1`,
    [uploadId],
  );
  return { uploadId, evidenceId: row.evidence_id };
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('증빙 임시 업로드 예약', () => {
  test('서버 전용 테이블과 세 수명주기 RPC가 존재한다', async () => {
    const row = await one<{
      table_name: string | null;
      reserve: string | null;
      complete: string | null;
      discard: string | null;
    }>(
      `select to_regclass('public.evidence_uploads')::text as table_name,
              to_regprocedure(
                'public.lf_evidence_upload_reserve(uuid,uuid,uuid,integer)'
              )::text as reserve,
              to_regprocedure(
                'public.lf_evidence_upload_complete(uuid,uuid,text,text,integer,integer,integer)'
              )::text as complete,
              to_regprocedure(
                'public.lf_evidence_upload_discard(uuid,uuid)'
              )::text as discard`,
    );

    expect(row).toEqual({
      table_name: 'evidence_uploads',
      reserve: 'lf_evidence_upload_reserve(uuid,uuid,uuid,integer)',
      complete:
        'lf_evidence_upload_complete(uuid,uuid,text,text,integer,integer,integer)',
      discard: 'lf_evidence_upload_discard(uuid,uuid)',
    });
  });

  test('당사자는 같은 키를 재시도해도 같은 업로드 하나만 예약한다', async () => {
    const fixture = await seedChecking();
    const key = randomUUID();
    const first = await one<{ payload: { upload_id: string; status: string } }>(
      RESERVE_SQL,
      [key, fixture.creatorId, fixture.promiseId, 1],
    );
    const replay = await one<{ payload: { upload_id: string; status: string } }>(
      RESERVE_SQL,
      [key, fixture.creatorId, fixture.promiseId, 1],
    );
    const count = await one<{ count: number }>(
      `select count(*)::int as count
         from public.evidence_uploads
        where uploaded_by = $1 and promise_id = $2 and round_no = 1`,
      [fixture.creatorId, fixture.promiseId],
    );

    expect(first.payload).toEqual(replay.payload);
    expect(first.payload.status).toBe('PENDING');
    expect(count.count).toBe(1);
  });

  test('READY가 된 키의 재시도는 저장된 JPEG 메타데이터를 복원한다', async () => {
    const fixture = await seedChecking();
    const key = randomUUID();
    const first = await one<{ payload: { upload_id: string } }>(RESERVE_SQL, [
      key,
      fixture.creatorId,
      fixture.promiseId,
      1,
    ]);
    await complete(fixture.creatorId, first.payload.upload_id);

    const replay = await one<{
      payload: {
        upload_id: string;
        status: string;
        mime: string;
        bytes: number;
        width: number;
        height: number;
      };
    }>(RESERVE_SQL, [key, fixture.creatorId, fixture.promiseId, 1]);

    expect(replay.payload).toEqual({
      upload_id: first.payload.upload_id,
      status: 'READY',
      mime: 'image/jpeg',
      bytes: 2048,
      width: 1280,
      height: 720,
    });
  });

  test('비참여자·증인·현재 라운드가 아닌 예약을 거부한다', async () => {
    const fixture = await seedChecking();
    const strangerId = await createUser(db, `evidence-stranger-${randomUUID().slice(0, 8)}`);

    expect(
      await errorCode(() =>
        db.asAdmin(RESERVE_SQL, [
          randomUUID(),
          strangerId,
          fixture.promiseId,
          1,
        ]),
      ),
    ).toBe('E_NOT_FOUND');
    expect(
      await errorCode(() =>
        db.asAdmin(RESERVE_SQL, [
          randomUUID(),
          fixture.witnessId,
          fixture.promiseId,
          1,
        ]),
      ),
    ).toBe('E_NOT_FOUND');
    expect(
      await errorCode(() =>
        db.asAdmin(RESERVE_SQL, [
          randomUUID(),
          fixture.partnerId,
          fixture.promiseId,
          2,
        ]),
      ),
    ).toBe('E_STATE_CONFLICT');
  });

  test('현재 라운드 세 장을 넘기지 않고 폐기하면 슬롯을 다시 쓸 수 있다', async () => {
    const fixture = await seedChecking();
    const uploads: string[] = [];

    for (let index = 0; index < 3; index += 1) {
      const reserved = await one<{ payload: { upload_id: string } }>(
        RESERVE_SQL,
        [randomUUID(), fixture.creatorId, fixture.promiseId, 1],
      );
      uploads.push(reserved.payload.upload_id);
    }

    expect(
      await errorCode(() =>
        db.asAdmin(RESERVE_SQL, [
          randomUUID(),
          fixture.creatorId,
          fixture.promiseId,
          1,
        ]),
      ),
    ).toBe('E_VALIDATION');

    const discarded = await one<{
      payload: { upload_id: string; status: string };
    }>(DISCARD_SQL, [fixture.creatorId, uploads[0]]);
    const replacement = await one<{
      payload: { upload_id: string; status: string };
    }>(RESERVE_SQL, [randomUUID(), fixture.creatorId, fixture.promiseId, 1]);

    expect(discarded.payload).toMatchObject({
      upload_id: uploads[0],
      status: 'DISCARDED',
    });
    expect(replacement.payload.status).toBe('PENDING');
  });
});

describe('서명 대상과 전략적 응답 보호', () => {
  test('미제출 상대는 현재 라운드 증빙을 서명할 수 없고 제출 뒤에는 600초 대상으로 받는다', async () => {
    const fixture = await seedChecking();
    const { evidenceId } = await bindOne(fixture);

    expect(
      await errorCode(() =>
        db.asAdmin(
          `select public.lf_evidence_sign_target(
             $1::uuid, $2::uuid, 'FULL'
           )`,
          [fixture.partnerId, evidenceId],
        ),
      ),
    ).toBe('E_NOT_FOUND');

    await submit(fixture, fixture.partnerId, 'KEPT');
    const target = await one<{
      payload: {
        evidence_id: string;
        bucket_id: string;
        object_key: string;
        variant: string;
        expires_in: number;
      };
    }>(
      `select public.lf_evidence_sign_target(
         $1::uuid, $2::uuid, 'THUMBNAIL'
       ) as payload`,
      [fixture.partnerId, evidenceId],
    );

    expect(target.payload).toMatchObject({
      evidence_id: evidenceId,
      bucket_id: 'fulfillment-evidences',
      variant: 'THUMBNAIL',
      expires_in: 600,
    });
    expect(target.payload.object_key).toMatch(/thumb\.jpg$/u);
  });

  test('JOINED 증인은 열람할 수 있지만 비참여자와 블라인드·만료·제거 증빙은 숨긴다', async () => {
    const fixture = await seedChecking();
    const strangerId = await createUser(db, `sign-stranger-${randomUUID().slice(0, 8)}`);
    const { evidenceId } = await bindOne(fixture);

    const witness = await one<{ payload: { evidence_id: string } }>(
      `select public.lf_evidence_sign_target(
         $1::uuid, $2::uuid, 'FULL'
       ) as payload`,
      [fixture.witnessId, evidenceId],
    );
    expect(witness.payload.evidence_id).toBe(evidenceId);

    expect(
      await errorCode(() =>
        db.asAdmin(
          `select public.lf_evidence_sign_target(
             $1::uuid, $2::uuid, 'FULL'
           )`,
          [strangerId, evidenceId],
        ),
      ),
    ).toBe('E_NOT_FOUND');

    for (const patch of [
      `blinded_at = now()`,
      `blinded_at = null, purged_at = now()`,
      `purged_at = null, removed_at = now()`,
    ]) {
      await db.asAdmin(
        `update public.fulfillment_evidences set ${patch} where id = $1`,
        [evidenceId],
      );
      expect(
        await errorCode(() =>
          db.asAdmin(
            `select public.lf_evidence_sign_target(
               $1::uuid, $2::uuid, 'FULL'
             )`,
            [fixture.witnessId, evidenceId],
          ),
        ),
      ).toBe('E_NOT_FOUND');
    }
  });
});

describe('보존 기한과 J-08 정리', () => {
  test('종결해도 purge_after 를 매기지 않는다 — 증빙은 기록과 함께 산다(PO 2026-08-29)', async () => {
    const fixture = await seedChecking();
    const { evidenceId } = await bindOne(fixture);
    await submit(fixture, fixture.partnerId, 'KEPT');

    const row = await one<{ status: string; purge_after: string | null }>(
      `select p.status::text, fe.purge_after::text
         from public.fulfillment_evidences fe
         join public.promises p on p.id = fe.promise_id
        where fe.id = $1`,
      [evidenceId],
    );
    expect(row).toEqual({ status: 'COMPLETED', purge_after: null });
  });
  test('J-03 UNRESOLVED 종결도 purge_after 를 매기지 않는다', async () => {
    const fixture = await seedChecking();
    const { evidenceId } = await bindOne(fixture);
    await db.asAdmin(
      `update public.promises
          set check_deadline_at = '2026-07-31T00:00:00Z'
        where id = $1`,
      [fixture.promiseId],
    );

    await db.asAdmin(
      `select public.lf_promises_close_due_checks(
         '2026-08-01T00:00:00Z'::timestamptz
       )`,
    );
    const row = await one<{ status: string; purge_after: string | null }>(
      `select p.status::text, fe.purge_after::text
         from public.promises p
         join public.fulfillment_evidences fe on fe.promise_id = p.id
        where fe.id = $1`,
      [evidenceId],
    );
    expect(row).toEqual({ status: 'UNRESOLVED', purge_after: null });
  });
  test('제거된 증빙과 만료 임시 업로드만 대상이고 지난 purge_after 는 무시한다', async () => {
    const fixture = await seedChecking();
    const first = await bindOne(fixture);
    const expiredUpload = await reserve(fixture, fixture.partnerId);
    await complete(fixture.partnerId, expiredUpload);
    await db.asAdmin(
      `update public.evidence_uploads
          set expires_at = '2026-07-01T00:00:00Z'
        where id = $1`,
      [expiredUpload],
    );

    const removedEvidence = await one<{ id: string }>(
      `insert into public.fulfillment_evidences (
         check_id, promise_id, uploaded_by, storage_key, thumb_key, mime, bytes, width, height,
         removed_at
       )
       select check_id, promise_id, uploaded_by,
              storage_key || '-removed', thumb_key || '-removed', mime, bytes, width, height,
              now()
         from public.fulfillment_evidences
        where id = $1
       returning id::text`,
      [first.evidenceId],
    );
    // 옛 규칙이 남긴 기한 — 이제 어떤 경로도 읽지 않는다.
    await db.asAdmin(
      `update public.fulfillment_evidences
          set purge_after = '2026-07-30'
        where id = $1`,
      [first.evidenceId],
    );

    const targets = await one<{
      payload: {
        evidences: Array<{ evidence_id: string }>;
        uploads: Array<{ upload_id: string }>;
      };
    }>(
      `select public.lf_evidence_purge_targets(
         '2026-08-01T00:00:00Z'::timestamptz, 100
       ) as payload`,
    );

    const evidenceIds = targets.payload.evidences.map((item) => item.evidence_id);
    expect(evidenceIds).not.toContain(first.evidenceId);
    expect(evidenceIds).toContain(removedEvidence.id);
    expect(targets.payload.uploads.map((item) => item.upload_id)).toContain(expiredUpload);
  });
  test('Storage 성공 대상으로 완료하기 전에는 purged_at을 기록하지 않고 완료 뒤에도 행을 보존한다', async () => {
    const fixture = await seedChecking();
    const { evidenceId } = await bindOne(fixture);
    await db.asAdmin(
      `update public.fulfillment_evidences
          set purge_after = '2026-07-30'
        where id = $1`,
      [evidenceId],
    );

    await db.asAdmin(
      `select public.lf_evidence_purge_targets(
         '2026-08-01T00:00:00Z'::timestamptz, 100
       )`,
    );
    expect(
      (
        await one<{ purged: boolean }>(
          `select purged_at is not null as purged
             from public.fulfillment_evidences where id = $1`,
          [evidenceId],
        )
      ).purged,
    ).toBe(false);

    await db.asAdmin(
      `select public.lf_evidence_purge_complete(
         $1::uuid[], '{}'::uuid[]
       )`,
      [uuidArray([evidenceId])],
    );
    const completed = await one<{ purged: boolean }>(
      `select purged_at is not null as purged
         from public.fulfillment_evidences where id = $1`,
      [evidenceId],
    );
    expect(completed.purged).toBe(true);
  });

  test('J-08은 일요일 05:00 KST에 한 건만 등록된다', async () => {
    await db.asAdmin(`select public.lf_schedule_evidence_purge()`);
    await db.asAdmin(`select public.lf_schedule_evidence_purge()`);
    const jobs = await db.asAdmin(
      `select jobname, schedule, command
         from cron.job
        where jobname = 'lf-evidence-purge'`,
    );

    expect(jobs.rows).toHaveLength(1);
    expect(jobs.rows[0]).toMatchObject({
      jobname: 'lf-evidence-purge',
      schedule: '0 20 * * 6',
    });
    expect(String(jobs.rows[0]?.['command'])).toContain('net.http_post');
    expect(String(jobs.rows[0]?.['command'])).toContain('vault.decrypted_secrets');
  });
});

describe('J-08 배포 전제', () => {
  test('pg_net을 활성화한 뒤 증빙 정리 잡을 다시 등록한다', async () => {
    const migrations = new URL('../migrations/', import.meta.url);
    const names = (await readdir(migrations)).filter((name) =>
      name.endsWith('_enable_evidence_purge_pg_net.sql'),
    );

    expect(names).toHaveLength(1);
    const sql = await readFile(new URL(names[0] as string, migrations), 'utf8');
    expect(sql).toMatch(/create extension if not exists pg_net/iu);
    expect(sql).toContain('public.lf_schedule_evidence_purge()');
  });

  test('pg_net을 extensions 스키마에 재설치하고 잡을 복원한다', async () => {
    const migrations = new URL('../migrations/', import.meta.url);
    const names = (await readdir(migrations)).filter((name) =>
      name.endsWith('_relocate_pg_net_extension.sql'),
    );

    expect(names).toHaveLength(1);
    const sql = await readFile(new URL(names[0] as string, migrations), 'utf8');
    expect(sql).toMatch(/drop extension if exists pg_net/iu);
    expect(sql).toMatch(/create extension pg_net\s+with\s+schema extensions/iu);
    expect(sql).toContain('public.lf_schedule_evidence_purge()');
  });
});

describe('증빙 서버 전용 권한', () => {
  test('두 증빙 테이블은 anon/authenticated 직접 접근이 없다', async () => {
    const row = await one<{
      uploads_anon: boolean;
      uploads_authenticated: boolean;
      evidences_anon: boolean;
      evidences_authenticated: boolean;
    }>(
      `select
         has_table_privilege('anon', 'public.evidence_uploads', 'SELECT')
           as uploads_anon,
         has_table_privilege('authenticated', 'public.evidence_uploads', 'SELECT')
           as uploads_authenticated,
         has_table_privilege('anon', 'public.fulfillment_evidences', 'SELECT')
           as evidences_anon,
         has_table_privilege('authenticated', 'public.fulfillment_evidences', 'SELECT')
           as evidences_authenticated`,
    );

    expect(row).toEqual({
      uploads_anon: false,
      uploads_authenticated: false,
      evidences_anon: false,
      evidences_authenticated: false,
    });
  });

  test.each([
    'public.lf_evidence_upload_reserve(uuid,uuid,uuid,integer)',
    'public.lf_evidence_upload_complete(uuid,uuid,text,text,integer,integer,integer)',
    'public.lf_evidence_upload_discard(uuid,uuid)',
    'public.lf_evidence_sign_target(uuid,uuid,text)',
    'public.lf_evidence_purge_targets(timestamp with time zone,integer)',
    'public.lf_evidence_purge_complete(uuid[],uuid[])',
    'public.lf_schedule_evidence_purge()',
    'public.lf_fulfillment_submit(uuid,uuid,uuid,public.fulfillment_answer,text,boolean,uuid[],uuid[],public.surface)',
  ])('%s는 anon/authenticated가 실행할 수 없다', async (functionName) => {
    const row = await one<{ anon: boolean; authenticated: boolean }>(
      `select has_function_privilege('anon', $1, 'EXECUTE') as anon,
              has_function_privilege('authenticated', $1, 'EXECUTE') as authenticated`,
      [functionName],
    );
    expect(row).toEqual({ anon: false, authenticated: false });
  });
});

describe('READY 업로드와 제출 결합', () => {
  test('완료는 소유자만 할 수 있고 같은 결과로 멱등 재시도된다', async () => {
    const fixture = await seedChecking();
    const uploadId = await reserve(fixture);

    expect(
      await errorCode(() =>
        db.asAdmin(COMPLETE_SQL, [
          fixture.partnerId,
          uploadId,
          'full.jpg',
          'thumb.jpg',
          1024,
          800,
          600,
        ]),
      ),
    ).toBe('E_NOT_FOUND');

    const first = await one<{
      payload: {
        upload_id: string;
        status: string;
        mime: string;
        bytes: number;
        width: number;
        height: number;
      };
    }>(COMPLETE_SQL, [
      fixture.creatorId,
      uploadId,
      `promises/test/${uploadId}/full.jpg`,
      `promises/test/${uploadId}/thumb.jpg`,
      2048,
      1280,
      720,
    ]);
    const replay = await one<{ payload: Record<string, unknown> }>(
      COMPLETE_SQL,
      [
        fixture.creatorId,
        uploadId,
        'ignored-full.jpg',
        'ignored-thumb.jpg',
        9999,
        1,
        1,
      ],
    );

    expect(first.payload).toEqual({
      upload_id: uploadId,
      status: 'READY',
      mime: 'image/jpeg',
      bytes: 2048,
      width: 1280,
      height: 720,
    });
    expect(replay.payload).toEqual(first.payload);
  });

  test('첫 제출은 READY 업로드를 응답과 같은 트랜잭션에서 결합한다', async () => {
    const fixture = await seedChecking();
    const uploadId = await reserve(fixture);
    await complete(fixture.creatorId, uploadId);

    await db.asAdmin(SUBMIT_SQL, [
      randomUUID(),
      fixture.creatorId,
      fixture.promiseId,
      'KEPT',
      '사진과 함께 확인해요',
      false,
      uuidArray([uploadId]),
      uuidArray([]),
      'APP',
    ]);

    const row = await one<{
      upload_status: string;
      evidence_count: number;
      evidence_id: string;
    }>(
      `select eu.status as upload_status,
              count(fe.id)::int as evidence_count,
              min(fe.id::text) as evidence_id
         from public.evidence_uploads eu
         left join public.fulfillment_evidences fe
           on fe.promise_id = eu.promise_id
          and fe.uploaded_by = eu.uploaded_by
        where eu.id = $1
        group by eu.status`,
      [uploadId],
    );

    expect(row.upload_status).toBe('BOUND');
    expect(row.evidence_count).toBe(1);
    expect(row.evidence_id).toMatch(/^[0-9a-f-]{36}$/u);
  });

  test('PENDING·타인·다른 약속 업로드는 결합하지 않는다', async () => {
    const fixture = await seedChecking();
    const pendingId = await reserve(fixture);
    const partnerUpload = await reserve(fixture, fixture.partnerId);
    await complete(fixture.partnerId, partnerUpload);
    const other = await seedChecking();
    const otherUpload = await reserve(other);
    await complete(other.creatorId, otherUpload);

    for (const uploadId of [pendingId, partnerUpload, otherUpload]) {
      expect(
        await errorCode(() =>
          db.asAdmin(SUBMIT_SQL, [
            randomUUID(),
            fixture.creatorId,
            fixture.promiseId,
            'KEPT',
            null,
            false,
            uuidArray([uploadId]),
            uuidArray([]),
            'APP',
          ]),
        ),
      ).toBe('E_STATE_CONFLICT');
    }

    const checks = await one<{ count: number }>(
      `select count(*)::int as count
         from public.fulfillment_checks
        where promise_id = $1 and user_id = $2`,
      [fixture.promiseId, fixture.creatorId],
    );
    expect(checks.count).toBe(0);
  });

  test('정정은 명시한 기존 증빙만 유지하고 제거·신규 추가를 함께 반영한다', async () => {
    const fixture = await seedChecking();
    const firstId = await reserve(fixture);
    const removedId = await reserve(fixture);
    await complete(fixture.creatorId, firstId);
    await complete(fixture.creatorId, removedId);

    await db.asAdmin(SUBMIT_SQL, [
      randomUUID(),
      fixture.creatorId,
      fixture.promiseId,
      'KEPT',
      null,
      false,
      uuidArray([firstId, removedId]),
      uuidArray([]),
      'APP',
    ]);

    const existing = await db.asAdmin(
      `select id::text
         from public.fulfillment_evidences
        where promise_id = $1 and uploaded_by = $2
        order by storage_key`,
      [fixture.promiseId, fixture.creatorId],
    );
    const retainedEvidenceId = String(existing.rows[0]?.['id']);
    const removedEvidenceId = String(existing.rows[1]?.['id']);
    const newUploadId = await reserve(fixture);
    await complete(fixture.creatorId, newUploadId);

    await db.asAdmin(SUBMIT_SQL, [
      randomUUID(),
      fixture.creatorId,
      fixture.promiseId,
      'KEPT',
      '정정했어요',
      true,
      uuidArray([newUploadId]),
      uuidArray([retainedEvidenceId]),
      'APP',
    ]);

    const rows = await db.asAdmin(
      `select id::text, removed_at is not null as removed
         from public.fulfillment_evidences
        where promise_id = $1 and uploaded_by = $2
        order by created_at, id`,
      [fixture.promiseId, fixture.creatorId],
    );
    const byId = new Map(
      rows.rows.map((row) => [String(row['id']), Boolean(row['removed'])]),
    );

    expect(rows.rows).toHaveLength(3);
    expect(byId.get(retainedEvidenceId)).toBe(false);
    expect(byId.get(removedEvidenceId)).toBe(true);
    expect([...byId.values()].filter((removed) => !removed)).toHaveLength(2);
  });

  test('정정 결과가 세 장을 넘으면 응답과 증빙 모두 바꾸지 않는다', async () => {
    const fixture = await seedChecking();
    const originalUpload = await reserve(fixture);
    await complete(fixture.creatorId, originalUpload);
    await db.asAdmin(SUBMIT_SQL, [
      randomUUID(),
      fixture.creatorId,
      fixture.promiseId,
      'KEPT',
      '원래 의견',
      false,
      uuidArray([originalUpload]),
      uuidArray([]),
      'APP',
    ]);
    const original = await one<{ id: string }>(
      `select id::text
         from public.fulfillment_evidences
        where promise_id = $1 and uploaded_by = $2`,
      [fixture.promiseId, fixture.creatorId],
    );
    const staged: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const uploadId = await reserve(fixture);
      await complete(fixture.creatorId, uploadId);
      staged.push(uploadId);
    }

    expect(
      await errorCode(() =>
        db.asAdmin(SUBMIT_SQL, [
          randomUUID(),
          fixture.creatorId,
          fixture.promiseId,
          'NOT_KEPT',
          '바뀌면 안 돼요',
          true,
          uuidArray(staged),
          uuidArray([original.id]),
          'APP',
        ]),
      ),
    ).toBe('E_VALIDATION');

    const check = await one<{ answer: string; comment: string; active: number }>(
      `select fc.answer, fc.comment,
              count(fe.id) filter (where fe.removed_at is null)::int as active
         from public.fulfillment_checks fc
         left join public.fulfillment_evidences fe on fe.check_id = fc.id
        where fc.promise_id = $1 and fc.user_id = $2
        group by fc.id`,
      [fixture.promiseId, fixture.creatorId],
    );
    expect(check).toEqual({
      answer: 'KEPT',
      comment: '원래 의견',
      active: 1,
    });
  });

  test('미제출 상대에게 증빙 메타데이터를 숨기고 제출 뒤 공개한다', async () => {
    const fixture = await seedChecking();
    const uploadId = await reserve(fixture);
    await complete(fixture.creatorId, uploadId);
    await db.asAdmin(SUBMIT_SQL, [
      randomUUID(),
      fixture.creatorId,
      fixture.promiseId,
      'KEPT',
      null,
      false,
      uuidArray([uploadId]),
      uuidArray([]),
      'APP',
    ]);

    const before = await one<{ payload: Record<string, unknown> }>(
      `select public.lf_promise_fulfillment_detail($1::uuid, $2::uuid) as payload`,
      [fixture.partnerId, fixture.promiseId],
    );
    expect(before.payload['partner_check']).toBeNull();
    expect(JSON.stringify(before.payload)).not.toContain(uploadId);

    await db.asAdmin(SUBMIT_SQL, [
      randomUUID(),
      fixture.partnerId,
      fixture.promiseId,
      'KEPT',
      null,
      false,
      uuidArray([]),
      uuidArray([]),
      'WEB',
    ]);
    const after = await one<{
      payload: {
        partner_check: { evidences: Array<{ availability: string }> };
      };
    }>(
      `select public.lf_promise_fulfillment_detail($1::uuid, $2::uuid) as payload`,
      [fixture.partnerId, fixture.promiseId],
    );

    expect(after.payload.partner_check.evidences).toEqual([
      expect.objectContaining({ availability: 'AVAILABLE' }),
    ]);
  });
});
