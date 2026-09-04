import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  END_DATE_FREE_DAYS,
  PERMANENT_ACCESS_PRODUCT_ID,
  END_DATE_EXTENSION_DAYS,
  RETENTION_EXTENSION_DAYS,
  RETENTION_FREE_DAYS,
  RETENTION_WARNING_DAYS,
  REWARD_INTENT_TTL_MIN,
} from '../../packages/shared/src/config.ts';
import {
  createInvitation,
  createPromise,
  createTestDb,
  createUser,
  type TestDb,
} from './harness.ts';

/**
 * 보상형 광고·개인 보존·영구보존 — 마이그레이션 20260829103504.
 *
 * 지급 출처는 AdMob SSV 하나뿐이다(광고 미노출 대체 지급은 PO 2026-08-29 에 제거). 보존 만료
 * 판정·정리(purge)·종료 합의의 서버 경계를 여기서 본다.
 */

const MIGRATION_PATH = join(
  __dirname,
  '../migrations/20260829103504_rewarded_ads_retention_bm.sql',
);

let db: TestDb;

interface Intent {
  intent_id: string;
  opaque_user_id: string;
  expires_at: string;
}

interface HomeCard {
  promise_id: string;
  end_date: string | null;
}

async function codeOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function tokenHash(): string {
  return randomBytes(32).toString('hex');
}

/** KST 오늘 + n 을 YYYY-MM-DD 로. */
function kstToday(offsetDays: number): string {
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  kstNow.setUTCDate(kstNow.getUTCDate() + offsetDays);
  return kstNow.toISOString().slice(0, 10);
}

function isoAfter(base: Date, ms: number): string {
  return new Date(base.getTime() + ms).toISOString();
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

async function activate(
  creator: string,
  partner: string,
  endDateOffsetDays = 10,
): Promise<string> {
  const promiseId = await createPromise(db, {
    creatorId: creator,
    partnerId: partner,
    status: 'ACTIVE',
    endDateOffsetDays,
  });
  const { rows } = await db.asAdmin(
    `update public.promise_versions
        set activated_at=now()
      where promise_id=$1 and version_no=1
      returning id`,
    [promiseId],
  );
  await db.asAdmin(
    `update public.promises
        set current_version_id=$2, activated_at=now()
      where id=$1`,
    [promiseId, rows[0]?.['id']],
  );
  return promiseId;
}

/** 상대가 이미 승인한 '종료일 없음'을 흉내낸다 — 버전과 약속 행 둘 다 비운다. */
async function makeNoEnd(promiseId: string): Promise<void> {
  await db.asAdmin(`update public.promise_versions set end_date=null where promise_id=$1`, [promiseId]);
  await db.asAdmin(`update public.promises set end_date=null where id=$1`, [promiseId]);
}

async function createIntent(
  actor: string,
  promiseId: string,
  action: 'DURATION_30D' | 'RETENTION_30D',
): Promise<Intent> {
  const { rows } = await db.asService(
    `select public.lf_reward_intent_create($1,$2,$3) as value`,
    [actor, promiseId, action],
  );
  return rows[0]?.['value'] as Intent;
}

async function grant(
  intent: Intent,
  options: { source?: string; rewardedAt?: string; transactionId?: string } = {},
): Promise<{ granted: boolean }> {
  const { rows } = await db.asService(
    `select public.lf_reward_grant($1,$2,$3,$4,$5,$6::timestamptz) as value`,
    [
      intent.intent_id,
      intent.opaque_user_id,
      options.source ?? 'ADMOB_SSV',
      options.transactionId ?? randomUUID(),
      'ca-app-pub-1234567890123456/1234567890',
      options.rewardedAt ?? new Date().toISOString(),
    ],
  );
  return rows[0]?.['value'] as { granted: boolean };
}

async function reward(
  actor: string,
  promiseId: string,
  action: 'DURATION_30D' | 'RETENTION_30D',
): Promise<void> {
  const result = await grant(await createIntent(actor, promiseId, action));
  expect(result).toEqual({ granted: true });
}

async function intentStatus(intentId: string): Promise<string> {
  const { rows } = await db.asAdmin(
    `select status from public.reward_intents where id=$1`,
    [intentId],
  );
  return String(rows[0]?.['status']);
}

async function entitlements(actor: string, promiseId: string): Promise<Record<string, unknown>> {
  const { rows } = await db.asService(
    `select public.lf_promise_entitlements($1,$2) as value`,
    [actor, promiseId],
  );
  return rows[0]?.['value'] as Record<string, unknown>;
}

/** 영구보존 구매. 환불(lf_slot_revoke)에 쓰라고 구매 토큰을 돌려준다. */
async function buyPermanent(user: string, promiseId: string): Promise<string> {
  const token = randomUUID();
  await db.asService(
    `select public.lf_permanent_access_grant($1,$2,$3,$4,$5,now())`,
    [user, promiseId, PERMANENT_ACCESS_PRODUCT_ID, `order-${randomUUID()}`, token],
  );
  return token;
}

async function refund(token: string): Promise<void> {
  const { rows } = await db.asService(
    `select public.lf_slot_revoke($1,now(),1,1) as value`,
    [token],
  );
  expect(rows[0]?.['value']).toBe(true);
}

async function maintenance(now: string): Promise<{ warned: number; queued: number }> {
  const { rows } = await db.asService(
    `select public.lf_retention_maintenance($1::timestamptz) value`,
    [now],
  );
  return rows[0]?.['value'] as { warned: number; queued: number };
}

async function claimLease(promiseId: string, now: string): Promise<string> {
  const { rows } = await db.asService(
    `select public.lf_purge_job_claim($1::timestamptz,100) value`,
    [now],
  );
  const item = (rows[0]?.['value'] as {
    items: { promise_id: string; lease_id: string }[];
  }).items.find((candidate) => candidate.promise_id === promiseId);
  expect(item, '정리 대기열에 올라야 한다').toBeDefined();
  return String(item?.lease_id);
}

async function finalize(promiseId: string, leaseId: string, now: string): Promise<boolean> {
  const { rows } = await db.asService(
    `select public.lf_purge_job_finalize($1,$2,$3::timestamptz) value`,
    [promiseId, leaseId, now],
  );
  return Boolean(rows[0]?.['value']);
}

async function promiseExists(promiseId: string): Promise<boolean> {
  const { rows } = await db.asAdmin(
    `select count(*)::int value from public.promises where id=$1`,
    [promiseId],
  );
  return Number(rows[0]?.['value']) === 1;
}

async function finishRequest(actor: string, promiseId: string): Promise<string> {
  const { rows } = await db.asService(
    `select public.lf_promise_finish_request($1,$2,$3,null,'APP',null,null) as value`,
    [randomUUID(), actor, promiseId],
  );
  return (rows[0]?.['value'] as { request_id: string }).request_id;
}

async function finishRespond(
  actor: string,
  promiseId: string,
  requestId: string,
  decision: 'APPROVE' | 'DECLINE',
): Promise<Record<string, unknown>> {
  const { rows } = await db.asService(
    `select public.lf_promise_finish_respond($1,$2,$3,$4,$5,'APP',null,null) as value`,
    [randomUUID(), actor, promiseId, requestId, decision],
  );
  return rows[0]?.['value'] as Record<string, unknown>;
}

async function outbox(
  promiseId: string,
  event: string,
): Promise<{ recipient_user_id: string; template_args: Record<string, unknown> }[]> {
  const { rows } = await db.asAdmin(
    `select recipient_user_id, template_args from public.notification_outbox
      where promise_id=$1 and event=$2 order by created_at, id`,
    [promiseId, event],
  );
  return rows as { recipient_user_id: string; template_args: Record<string, unknown> }[];
}

async function amendReminders(promiseId: string): Promise<{ user_id: string; status: string }[]> {
  const { rows } = await db.asAdmin(
    `select user_id, status::text from public.reminder_schedules
      where promise_id=$1 and kind='AMEND_REMIND' order by created_at, id`,
    [promiseId],
  );
  return rows as { user_id: string; status: string }[];
}

async function amendRequest(
  actor: string,
  promiseId: string,
  proposal: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { rows } = await db.asService(
    `select public.lf_promise_amend_request(
       $1,$2,$3,'AMEND',$4::jsonb,null,'APP'::public.surface,null,null
     ) as value`,
    [randomUUID(), actor, promiseId, JSON.stringify(proposal)],
  );
  return rows[0]?.['value'] as Record<string, unknown>;
}

async function currentProposal(promiseId: string): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(
    `select title, body, category::text, end_date::text, keeper::text, reward, penalty
       from public.promise_versions
      where promise_id=$1 and activated_at is not null
      order by version_no desc limit 1`,
    [promiseId],
  );
  return rows[0] as Record<string, unknown>;
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('보상형 광고 권한', () => {
  test('작성일 +30일에서 시작하고 광고마다 종료일 상한을 30일씩 누적한다', async () => {
    const creator = await createUser(db, '기간작성자');
    const partner = await createUser(db, '기간상대');
    const promiseId = await activate(creator, partner);
    const { rows: baselineRows } = await db.asAdmin(
      `select ceiling_date::text value from public.promise_duration_baselines where promise_id=$1`,
      [promiseId],
    );
    const baseline = String(baselineRows[0]?.['value']);

    expect((await entitlements(creator, promiseId))['duration']).toEqual({
      ceiling_date: baseline,
      unlimited: false,
    });
    await reward(creator, promiseId, 'DURATION_30D');
    await reward(creator, promiseId, 'DURATION_30D');
    const { rows } = await db.asAdmin(
      `select (ceiling_date + $2::int)::text value
         from public.promise_duration_baselines where promise_id=$1`,
      [promiseId, END_DATE_EXTENSION_DAYS * 2],
    );
    expect((await entitlements(creator, promiseId))['duration']).toEqual({
      ceiling_date: rows[0]?.['value'],
      unlimited: false,
    });
    expect(END_DATE_FREE_DAYS).toBe(END_DATE_EXTENSION_DAYS);
  });

  test('지급 출처는 ADMOB_SSV 뿐이다 — 다른 출처는 E_VALIDATION 으로 실패한다', async () => {
    const creator = await createUser(db, '출처작성자');
    const partner = await createUser(db, '출처상대');
    const promiseId = await activate(creator, partner);
    const intent = await createIntent(creator, promiseId, 'DURATION_30D');

    for (const source of ['NO_FILL_FALLBACK', 'MIGRATION', 'CLIENT']) {
      expect(await codeOf(async () => grant(intent, { source }))).toBe('E_VALIDATION');
    }
    expect(await intentStatus(intent.intent_id)).toBe('PENDING');
    expect(await grant(intent)).toEqual({ granted: true });
  });

  test('잠금 순서는 두 경로 모두 약속 advisory lock → intent 행이다 (ABBA 교착 방지)', async () => {
    // PGlite 는 연결이 하나라 교착을 재현할 수 없다. 대신 정의된 본문에서 순서를 고정한다.
    for (const name of ['lf_reward_intent_create', 'lf_reward_grant']) {
      const { rows } = await db.asAdmin(
        `select pg_catalog.pg_get_functiondef(('public.' || $1)::regproc) value`,
        [name],
      );
      const body = String(rows[0]?.['value']);
      const advisory = body.indexOf('pg_advisory_xact_lock');
      const rowLock = body.indexOf('for update');
      expect(advisory, `${name} 의 advisory lock`).toBeGreaterThan(-1);
      expect(rowLock, `${name} 의 행 잠금`).toBeGreaterThan(-1);
      expect(advisory, `${name}: advisory lock 이 행 잠금보다 먼저`).toBeLessThan(rowLock);
    }
  });

  test('SSV TTL 은 서명된 시청 시각으로 판정하고, 놓친 콜백은 intent 를 바꾸지 않는다', async () => {
    const creator = await createUser(db, 'TTL작성자');
    const partner = await createUser(db, 'TTL상대');
    const promiseId = await activate(creator, partner);
    const intent = await createIntent(creator, promiseId, 'DURATION_30D');
    const expiresAt = new Date(intent.expires_at);

    // 서명 시각이 TTL 밖 — 미지급이지만 intent 는 PENDING 그대로다.
    expect(await grant(intent, { rewardedAt: isoAfter(expiresAt, 5 * MINUTE_MS) })).toEqual({
      granted: false,
    });
    expect(await intentStatus(intent.intent_id)).toBe('PENDING');

    // 콜백이 TTL 뒤에 도착했지만(AdMob 재시도) 서명 시각은 TTL 안 — 지급한다.
    await db.asAdmin(
      `update public.reward_intents set expires_at = now() - interval '5 minutes' where id=$1`,
      [intent.intent_id],
    );
    expect(
      await grant(intent, { rewardedAt: isoAfter(new Date(), -10 * MINUTE_MS) }),
    ).toEqual({ granted: true });
    expect(await intentStatus(intent.intent_id)).toBe('GRANTED');
  });
});

describe('개인 영구보존', () => {
  test('상대방 구매는 본인 보존만 영구화하고 공유 무기한 권한은 작성자 구매만 연다', async () => {
    const creator = await createUser(db, '영구작성자');
    const partner = await createUser(db, '영구상대');
    const promiseId = await activate(creator, partner);
    await buyPermanent(partner, promiseId);
    expect((await entitlements(partner, promiseId))['retention']).toMatchObject({
      permanent: true,
      expires_at: null,
    });
    expect((await entitlements(creator, promiseId))['duration']).toMatchObject({
      unlimited: false,
    });

    await buyPermanent(creator, promiseId);
    expect((await entitlements(partner, promiseId))['duration']).toEqual({
      ceiling_date: null,
      unlimited: true,
    });
  });

  test('유예가 더 긴 기록에서도 RETENTION_30D 한 번은 만료를 정확히 30일 미룬다', async () => {
    const creator = await createUser(db, '유예작성자');
    const partner = await createUser(db, '유예상대');
    const promiseId = await activate(creator, partner);
    await db.asAdmin(
      `insert into public.promise_access_graces (promise_id, user_id, expires_at)
       values ($1, $2, now() + interval '200 days')`,
      [promiseId, partner],
    );
    await reward(partner, promiseId, 'RETENTION_30D');
    const { rows } = await db.asAdmin(
      `select public.lf_access_expires_at($1,$2)
              = pag.expires_at + pg_catalog.make_interval(days => $3::int) as moved
         from public.promise_access_graces pag
        where pag.promise_id=$1 and pag.user_id=$2`,
      [promiseId, partner, RETENTION_EXTENSION_DAYS],
    );
    expect(rows[0]).toEqual({ moved: true });
  });

  test('영구보존 원장이 달린 DRAFT 도 작성자가 지울 수 있고 원장은 promise_id 없이 남는다', async () => {
    const creator = await createUser(db, '초안삭제작성자');
    const draftId = await createPromise(db, { creatorId: creator, status: 'DRAFT' });
    const token = await buyPermanent(creator, draftId);

    const { rows: deleted } = await db.asUser(
      creator,
      `delete from public.promises where id=$1 returning id`,
      [draftId],
    );
    expect(deleted).toHaveLength(1);
    const { rows } = await db.asAdmin(
      `select promise_id, product_id from public.slot_purchases where purchase_token=$1`,
      [token],
    );
    expect(rows).toEqual([{ promise_id: null, product_id: PERMANENT_ACCESS_PRODUCT_ID }]);
  });

  test('환불된 뒤 만료된 기록은 정리가 끝까지 가고 구매·환불 원장은 남는다', async () => {
    const creator = await createUser(db, '환불정리작성자');
    const partner = await createUser(db, '환불정리상대');
    const promiseId = await activate(creator, partner);
    const token = await buyPermanent(partner, promiseId);
    await refund(token);
    await db.asAdmin(
      `update public.promises
          set end_date = (now() at time zone 'Asia/Seoul')::date - 100,
              status='COMPLETED', closed_at=now()
        where id=$1`,
      [promiseId],
    );
    const now = new Date().toISOString();
    await maintenance(now);
    const lease = await claimLease(promiseId, now);
    expect(await finalize(promiseId, lease, now)).toBe(true);
    expect(await promiseExists(promiseId)).toBe(false);
    const { rows } = await db.asAdmin(
      `select sp.promise_id, exists (
          select 1 from public.slot_purchase_revocations r where r.purchase_id = sp.id
        ) revoked
         from public.slot_purchases sp where sp.purchase_token=$1`,
      [token],
    );
    expect(rows).toEqual([{ promise_id: null, revoked: true }]);
  });

  test('마지막 개인 접근이 끝난 기록은 세부 데이터를 지우고 지킴율 집계를 보존한다', async () => {
    const creator = await createUser(db, '삭제집계작성자');
    const partner = await createUser(db, '삭제집계상대');
    const promiseId = await activate(creator, partner, -100);
    await db.asAdmin(
      `update public.promises set status='COMPLETED', closed_at=now() where id=$1`,
      [promiseId],
    );
    const now = new Date().toISOString();
    expect((await maintenance(now)).queued).toBeGreaterThanOrEqual(1);
    const lease = await claimLease(promiseId, now);
    expect(await finalize(promiseId, lease, now)).toBe(true);
    const { rows } = await db.asAdmin(
      `select
         (select count(*)::int from public.promises where id=$1) promise_count,
         (select completed_count from public.user_keep_rate_aggregates where user_id=$2) creator_kept,
         (select completed_count from public.user_keep_rate_aggregates where user_id=$3) partner_kept,
         (select count(*)::int from public.purged_promise_receipts
           where promise_digest = encode(sha256(convert_to($1::text,'UTF8')),'hex')) receipt_count`,
      [promiseId, creator, partner],
    );
    expect(rows[0]).toMatchObject({
      promise_count: 0,
      creator_kept: 1,
      partner_kept: 1,
      receipt_count: 1,
    });
  });

  test('증빙을 가리키는 신고가 있어도 정리가 끝나고 신고는 참조만 비운 채 남는다', async () => {
    const creator = await createUser(db, '신고정리작성자');
    const partner = await createUser(db, '신고정리상대');
    const promiseId = await activate(creator, partner, -100);
    await db.asAdmin(
      `update public.promises set status='COMPLETED', closed_at=now() where id=$1`,
      [promiseId],
    );
    const { rows: evidenceRows } = await db.asAdmin(
      `with check_row as (
         insert into public.fulfillment_checks (promise_id, version_id, user_id, answer, surface)
         select p.id, p.current_version_id, $2, 'KEPT', 'APP' from public.promises p where p.id=$1
         returning id
       )
       insert into public.fulfillment_evidences (check_id, promise_id, uploaded_by, storage_key, mime, bytes)
       select id, $1, $2, 'evidence/' || $1 || '.jpg', 'image/jpeg', 1024 from check_row
       returning id`,
      [promiseId, creator],
    );
    const evidenceId = String(evidenceRows[0]?.['id']);
    const { rows: reportRows } = await db.asAdmin(
      `insert into public.reports (reporter_id, target_user_id, promise_id, evidence_id, reason)
       values ($1, $2, $3, $4, 'ABUSE') returning id`,
      [partner, creator, promiseId, evidenceId],
    );
    const reportId = String(reportRows[0]?.['id']);

    const now = new Date().toISOString();
    await maintenance(now);
    const lease = await claimLease(promiseId, now);
    expect(await finalize(promiseId, lease, now)).toBe(true);
    expect(await promiseExists(promiseId)).toBe(false);
    const { rows } = await db.asAdmin(
      `select promise_id, evidence_id, reporter_id from public.reports where id=$1`,
      [reportId],
    );
    expect(rows).toEqual([{ promise_id: null, evidence_id: null, reporter_id: partner }]);
  });

  test('정리 대기 중 영구보존을 산 참여자가 있으면 지우지 않고 AVAILABLE 로 되돌린다', async () => {
    const creator = await createUser(db, '경합정리작성자');
    const partner = await createUser(db, '경합정리상대');
    const promiseId = await activate(creator, partner, -100);
    await db.asAdmin(
      `update public.promises set status='COMPLETED', closed_at=now() where id=$1`,
      [promiseId],
    );
    const now = new Date().toISOString();
    await maintenance(now);
    // 대기열 판정 뒤 커밋된 구매. PURGING 에서는 RPC 가 막히므로 원장에 직접 쓴다 —
    // 이 경합이 바로 finalize 가 다시 판정해야 하는 이유다.
    await db.asAdmin(
      `insert into public.slot_purchases
         (user_id, provider, product_id, order_id, purchase_token, purchase_time, granted_slots, promise_id)
       values ($1, 'google_play', $2, $3, $4, now(), 0, $5)`,
      [partner, PERMANENT_ACCESS_PRODUCT_ID, `order-${randomUUID()}`, randomUUID(), promiseId],
    );
    const lease = await claimLease(promiseId, now);
    expect(await finalize(promiseId, lease, now)).toBe(false);
    const { rows } = await db.asAdmin(
      `select p.purge_state,
              (select count(*)::int from public.promise_purge_jobs j where j.promise_id=p.id) jobs
         from public.promises p where p.id=$1`,
      [promiseId],
    );
    expect(rows).toEqual([{ purge_state: 'AVAILABLE', jobs: 0 }]);
    expect((await entitlements(partner, promiseId))['retention']).toMatchObject({ permanent: true });
  });

  test('작성자 영구보존이 환불돼도 종료일을 그대로 둔 변경은 상한에 걸리지 않는다', async () => {
    const creator = await createUser(db, '환불변경작성자');
    const partner = await createUser(db, '환불변경상대');
    const promiseId = await activate(creator, partner);
    const token = await buyPermanent(creator, promiseId);
    await makeNoEnd(promiseId);
    await refund(token);
    expect((await entitlements(creator, promiseId))['duration']).toMatchObject({ unlimited: false });

    const current = await currentProposal(promiseId);
    // 상한이 되살아났으니 더 먼 종료일 제안은 여전히 막힌다.
    expect(
      await codeOf(async () => amendRequest(creator, promiseId, { ...current, end_date: kstToday(400) })),
    ).toBe('E_END_DATE_RANGE');
    // 이미 합의된 '종료일 없음'을 그대로 둔 제목 변경은 통과한다.
    expect(
      await amendRequest(creator, promiseId, { ...current, title: '제목만 바꾼 약속' }),
    ).toMatchObject({ status: 'AMEND_PENDING' });
  });
});

describe('보존 만료 경고와 배포 유예', () => {
  test('만료 6.5일 전 실행은 D-7 을 한 번만 보내고 한 시간 뒤 재실행은 더 보내지 않는다', async () => {
    const creator = await createUser(db, '경고작성자');
    const partner = await createUser(db, '경고상대');
    const promiseId = await activate(creator, partner, -100);
    const base = new Date();
    await db.asAdmin(
      `insert into public.promise_access_graces (promise_id, user_id, expires_at)
       values ($1, $2, $3::timestamptz)`,
      [promiseId, partner, isoAfter(base, 6.5 * DAY_MS)],
    );
    await maintenance(base.toISOString());
    expect((await outbox(promiseId, 'NT-22')).map((row) => row.recipient_user_id)).toEqual([partner]);
    await maintenance(isoAfter(base, HOUR_MS));
    expect(await outbox(promiseId, 'NT-22')).toHaveLength(1);
    expect(await outbox(promiseId, 'NT-23')).toHaveLength(0);
  });

  test('만료 하루 안이면 D-1 을 보낸다', async () => {
    const creator = await createUser(db, 'D1작성자');
    const partner = await createUser(db, 'D1상대');
    const promiseId = await activate(creator, partner, -100);
    const base = new Date();
    await db.asAdmin(
      `insert into public.promise_access_graces (promise_id, user_id, expires_at)
       values ($1, $2, $3::timestamptz)`,
      [promiseId, creator, isoAfter(base, 12 * HOUR_MS)],
    );
    await maintenance(base.toISOString());
    await maintenance(isoAfter(base, HOUR_MS));
    expect((await outbox(promiseId, 'NT-23')).map((row) => row.recipient_user_id)).toEqual([creator]);
  });
});

describe('증인 슬롯 사용량', () => {
  test('만료된 증인 초대 자리는 사용량에 들어가지 않는다', async () => {
    const creator = await createUser(db, '증인만료작성자');
    const partner = await createUser(db, '증인만료상대');
    const promiseId = await activate(creator, partner);
    const invite = async () =>
      db.asService(`select public.lf_witness_invite($1,$2,$3,$4::char(64))`, [
        randomUUID(), creator, promiseId, tokenHash(),
      ]);
    await invite();
    expect((await entitlements(creator, promiseId))['witness']).toMatchObject({ creator_used: 1 });
    expect(await codeOf(invite)).toBe('E_WITNESS_LIMIT');

    await db.asAdmin(
      `update public.invitations set expires_at = now() - interval '1 hour'
        where promise_id=$1 and target_role='WITNESS'`,
      [promiseId],
    );
    const { rows } = await db.asAdmin(`select public.lf_witness_used($1,$2) value`, [promiseId, creator]);
    expect(rows[0]?.['value']).toBe(0);
    expect((await entitlements(creator, promiseId))['witness']).toMatchObject({ creator_used: 0 });
    expect(await codeOf(invite)).toBeNull();
  });
});

describe('종료일 없는 약속의 종료 합의', () => {
  test('종료일 없는 ACTIVE 약속도 20건 뒤 커서로 다음 페이지를 잇는다', async () => {
    const creator = await createUser(db, '무기한목록작성자');
    const partner = await createUser(db, '무기한목록상대');
    for (let index = 0; index < 21; index += 1) {
      await makeNoEnd(await activate(creator, partner));
    }
    const { rows: firstRows } = await db.asService(
      `select public.lf_promise_home_list($1,'ACTIVE',null,now()) value`,
      [creator],
    );
    const first = firstRows[0]?.['value'] as { items: unknown[]; next_cursor: Record<string, unknown> };
    expect(first.items).toHaveLength(20);
    expect(first.next_cursor['end_date']).toBeNull();
    const { rows: secondRows } = await db.asService(
      `select public.lf_promise_home_list($1,'ACTIVE',$2::jsonb,now()) value`,
      [creator, JSON.stringify(first.next_cursor)],
    );
    const second = secondRows[0]?.['value'] as { items: unknown[]; next_cursor: unknown };
    expect(second.items).toHaveLength(1);
    expect(second.next_cursor).toBeNull();
  });

  test('종료일 있는 3건과 없는 2건은 중복 없이 5장이고 종료일 없는 카드가 뒤에 온다', async () => {
    const creator = await createUser(db, '혼합목록작성자');
    const partner = await createUser(db, '혼합목록상대');
    const finite = [
      await activate(creator, partner, 10),
      await activate(creator, partner, 20),
      await activate(creator, partner, 30),
    ];
    const noEnd = [await activate(creator, partner), await activate(creator, partner)];
    for (const promiseId of noEnd) await makeNoEnd(promiseId);

    const { rows } = await db.asService(
      `select public.lf_promise_home_list($1,'ACTIVE',null,now()) value`,
      [creator],
    );
    const page = rows[0]?.['value'] as { items: HomeCard[]; next_cursor: unknown };
    expect(page.items).toHaveLength(5);
    expect(new Set(page.items.map((card) => card.promise_id)).size).toBe(5);
    expect(page.items.slice(0, 3).map((card) => card.promise_id)).toEqual(finite);
    expect(page.items.slice(3).map((card) => card.end_date)).toEqual([null, null]);
    expect(page.items.slice(3).map((card) => card.promise_id).sort()).toEqual([...noEnd].sort());
    expect(page.next_cursor).toBeNull();
  });

  test('한 사람이 요청하고 상대가 승인한 시각부터 CHECKING과 개인 보존 기준을 시작한다', async () => {
    const creator = await createUser(db, '무기한작성자');
    const partner = await createUser(db, '무기한상대');
    const promiseId = await activate(creator, partner);
    await makeNoEnd(promiseId);
    const requestId = await finishRequest(creator, promiseId);
    expect(await finishRespond(partner, promiseId, requestId, 'APPROVE')).toMatchObject({
      status: 'CHECKING',
    });
    const { rows } = await db.asAdmin(
      `select status::text, retention_anchor_at is not null anchored,
              checking_started_at=retention_anchor_at same_anchor,
              (select count(*)::int from public.reminder_schedules r
                where r.promise_id=p.id and r.kind in ('CHECK_REQ','CHECK_R1','CHECK_R2')) reminders
         from public.promises p where id=$1`,
      [promiseId],
    );
    expect(rows[0]).toMatchObject({
      status: 'CHECKING',
      anchored: true,
      same_anchor: true,
      reminders: 6,
    });
  });

  test('종료 요청은 상대에게 NT-15 와 3일 리마인드를, 승인은 요청자에게 NT-16 을 보낸다', async () => {
    const creator = await createUser(db, '종료알림작성자');
    const partner = await createUser(db, '종료알림상대');
    const promiseId = await activate(creator, partner);
    await makeNoEnd(promiseId);
    const requestId = await finishRequest(creator, promiseId);

    expect(await outbox(promiseId, 'NT-15')).toEqual([
      {
        recipient_user_id: partner,
        template_args: {
          partnerNickname: '종료알림작성자',
          promiseTitle: '매일 걷기',
          amendType: 'FINISH',
        },
      },
    ]);
    expect(await amendReminders(promiseId)).toEqual([{ user_id: partner, status: 'PENDING' }]);

    await finishRespond(partner, promiseId, requestId, 'APPROVE');
    expect(await outbox(promiseId, 'NT-16')).toEqual([
      {
        recipient_user_id: creator,
        template_args: { promiseTitle: '매일 걷기', amendDecision: 'APPROVE' },
      },
    ]);
    expect(await amendReminders(promiseId)).toEqual([{ user_id: partner, status: 'CANCELED' }]);
  });

  test('종료 거절도 요청자에게 NT-16 을 보내고 리마인드를 취소한다', async () => {
    const creator = await createUser(db, '종료거절작성자');
    const partner = await createUser(db, '종료거절상대');
    const promiseId = await activate(creator, partner);
    await makeNoEnd(promiseId);
    const requestId = await finishRequest(partner, promiseId);
    expect((await outbox(promiseId, 'NT-15')).map((row) => row.recipient_user_id)).toEqual([creator]);

    expect(await finishRespond(creator, promiseId, requestId, 'DECLINE')).toMatchObject({
      status: 'ACTIVE',
    });
    expect(await outbox(promiseId, 'NT-16')).toEqual([
      {
        recipient_user_id: partner,
        template_args: { promiseTitle: '매일 걷기', amendDecision: 'DECLINE' },
      },
    ]);
    expect(await amendReminders(promiseId)).toEqual([{ user_id: creator, status: 'CANCELED' }]);
  });

  test('종료 요청 철회는 FINISH_WITHDRAW 행위로 남고 리마인드를 취소한다', async () => {
    const creator = await createUser(db, '철회작성자');
    const partner = await createUser(db, '철회상대');
    const promiseId = await activate(creator, partner);
    await makeNoEnd(promiseId);
    const requestId = await finishRequest(creator, promiseId);
    await db.asService(
      `select public.lf_promise_amend_withdraw($1,$2,$3,$4,'APP',null,null)`,
      [randomUUID(), creator, promiseId, requestId],
    );
    const { rows: approvalRows } = await db.asAdmin(
      `select action::text from public.approvals
        where promise_id=$1 order by acted_at desc,id desc limit 1`,
      [promiseId],
    );
    expect(approvalRows[0]?.['action']).toBe('FINISH_WITHDRAW');
    expect(await amendReminders(promiseId)).toEqual([{ user_id: partner, status: 'CANCELED' }]);
  });
});

describe('서버 전용 경계와 배포 설정', () => {
  test('마이그레이션의 함수는 전부 서버 전용이다 — anon·authenticated 실행 불가, service_role 만 가능', async () => {
    const signatures = [
      'public.lf_witness_max()',
      'public.lf_witness_creator_free()',
      'public.lf_end_date_free_days()',
      'public.lf_extension_days()',
      'public.lf_retention_free_days()',
      'public.lf_reward_intent_ttl_minutes()',
      'public.lf_permanent_access_product_id()',
      'public.lf_end_date_max_days()',
      'public.lf_rewarded_ads_enabled()',
      'public.lf_permanent_access_effective(uuid, uuid)',
      'public.lf_reward_grant_count(uuid, uuid, text)',
      'public.lf_retention_anchor_of(uuid)',
      'public.lf_access_expires_at(uuid, uuid)',
      'public.lf_has_record_access(uuid, uuid, timestamptz)',
      'public.lf_duration_ceiling_date(uuid)',
      'public.lf_promise_entitlements(uuid, uuid)',
      'public.lf_duration_baseline_insert()',
      'public.lf_assert_duration_entitlement()',
      'public.lf_assert_amend_duration_entitlement()',
      'public.lf_reward_action_allowed(uuid, uuid, text)',
      'public.lf_reward_intent_create(uuid, uuid, text)',
      'public.lf_reward_grant(uuid, text, text, text, text, timestamptz)',
      'public.lf_reward_status(uuid, uuid)',
      'public.lf_witness_used(uuid, uuid)',
      'public.lf_witness_invite_list(uuid, uuid)',
      'public.lf_witness_invite(uuid, uuid, uuid, character, uuid)',
      'public.lf_permanent_access_grant(uuid, uuid, text, text, text, timestamptz)',
      'public.lf_slot_revoke(text, timestamptz, integer, integer)',
      'public.lf_retention_maintenance(timestamptz)',
      'public.lf_purge_job_claim(timestamptz, integer)',
      'public.lf_purge_job_finalize(uuid, uuid, timestamptz)',
      'public.lf_recompute_trust_profile(uuid)',
      'public.lf_promise_finish_request(uuid, uuid, uuid, text, public.surface, text, text)',
      'public.lf_promise_finish_respond(uuid, uuid, uuid, uuid, text, public.surface, text, text)',
      'public.lf_promise_amend_respond_v2(uuid, uuid, uuid, uuid, text, public.surface, text, text)',
      'public.lf_approval_notification_outbox()',
      'public.lf_promise_detail_unfiltered(uuid, uuid)',
      'public.lf_promise_detail(uuid, uuid)',
      'public.lf_witness_detail_unfiltered(uuid, uuid)',
      'public.lf_witness_detail(uuid, uuid)',
      'public.lf_promise_fulfillment_detail_unfiltered(uuid, uuid)',
      'public.lf_promise_fulfillment_detail(uuid, uuid)',
      'public.lf_fulfillment_submit_unfiltered(uuid, uuid, uuid, public.fulfillment_answer, text, boolean, uuid[], uuid[], public.surface)',
      'public.lf_fulfillment_submit(uuid, uuid, uuid, public.fulfillment_answer, text, boolean, uuid[], uuid[], public.surface)',
      'public.lf_fulfillment_reopen_unfiltered(uuid, uuid, uuid, public.surface)',
      'public.lf_fulfillment_reopen(uuid, uuid, uuid, public.surface)',
      'public.lf_promise_amend_request_unfiltered(uuid, uuid, uuid, text, jsonb, text, public.surface, text, text)',
      'public.lf_promise_amend_request(uuid, uuid, uuid, text, jsonb, text, public.surface, text, text)',
      'public.lf_promise_amend_respond_unfiltered(uuid, uuid, uuid, uuid, text, public.surface, text, text)',
      'public.lf_promise_amend_respond(uuid, uuid, uuid, uuid, text, public.surface, text, text)',
      'public.lf_promise_amend_withdraw_unfiltered(uuid, uuid, uuid, uuid, public.surface, text, text)',
      'public.lf_promise_amend_withdraw(uuid, uuid, uuid, uuid, public.surface, text, text)',
      'public.lf_schedule_retention_worker()',
      'public.lf_no_end_home_cards(uuid, uuid, timestamptz, integer)',
      'public.lf_promise_home_list_unfiltered(uuid, text, jsonb, timestamptz)',
      'public.lf_promise_home_list(uuid, text, jsonb, timestamptz)',
      'public.lf_participant_promise_list_unfiltered(uuid)',
      'public.lf_participant_promise_list(uuid)',
    ];
    for (const signature of signatures) {
      const { rows } = await db.asAdmin(
        `select pg_catalog.has_function_privilege('anon', $1, 'execute') as anon_ok,
                pg_catalog.has_function_privilege('authenticated', $1, 'execute') as auth_ok,
                pg_catalog.has_function_privilege('service_role', $1, 'execute') as service_ok`,
        [signature],
      );
      const row = rows[0] as { anon_ok: boolean; auth_ok: boolean; service_ok: boolean };
      expect(row.anon_ok, `${signature} 의 anon 실행 권한`).toBe(false);
      expect(row.auth_ok, `${signature} 의 authenticated 실행 권한`).toBe(false);
      expect(row.service_ok, `${signature} 의 service_role 실행 권한`).toBe(true);
    }
  });

  test('can_read_promise 는 RLS 가 부르므로 authenticated 에게 열려 있어야 한다', async () => {
    const { rows } = await db.asAdmin(
      `select pg_catalog.has_function_privilege('authenticated', 'private.can_read_promise(uuid)', 'execute') ok`,
    );
    expect(rows[0]).toEqual({ ok: true });
  });

  test('응답 모양이 바뀌었으므로 min_app_version 은 0.2.0 이다', async () => {
    const { rows } = await db.asAdmin(
      `select value from public.app_configs where key='min_app_version'`,
    );
    expect(rows[0]?.['value']).toBe('0.2.0');
  });

  test('배포 유예는 성립한 모든 기록에 붙고 만료가 더 먼 기록은 바꾸지 않는다', async () => {
    const creator = await createUser(db, '배포유예작성자');
    const partner = await createUser(db, '배포유예상대');
    const expired = await activate(creator, partner, -100);
    const distant = await activate(creator, partner, 100);
    const unformed = await createPromise(db, {
      creatorId: creator,
      partnerId: partner,
      status: 'PENDING',
    });

    // 마이그레이션의 유예 삽입문을 그대로 다시 실행한다 — 픽스처는 마이그레이션 뒤에 만들어지므로.
    const backfill = readFileSync(MIGRATION_PATH, 'utf8').match(
      /insert into public\.promise_access_graces[\s\S]*?;/u,
    )?.[0];
    expect(backfill).toBeDefined();
    await db.execAdmin(String(backfill));

    const { rows } = await db.asAdmin(
      `select
         (select count(*)::int from public.promise_access_graces where promise_id=$1) expired_graces,
         (select count(*)::int from public.promise_access_graces where promise_id=$2) distant_graces,
         (select count(*)::int from public.promise_access_graces where promise_id=$3) unformed_graces,
         (select public.lf_access_expires_at($1,$4)
            = (select expires_at from public.promise_access_graces
                where promise_id=$1 and user_id=$4)) expired_uses_grace,
         (select public.lf_access_expires_at($2,$4)
            = ((p.end_date + 1)::timestamp at time zone 'Asia/Seoul')
              + pg_catalog.make_interval(days => $5::int)
            from public.promises p where p.id=$2) distant_unchanged,
         (select expires_at > now() + pg_catalog.make_interval(days => $5::int) - interval '1 minute'
            from public.promise_access_graces where promise_id=$1 and user_id=$4) grace_is_free_period`,
      [expired, distant, unformed, creator, RETENTION_FREE_DAYS],
    );
    expect(rows[0]).toEqual({
      expired_graces: 2,
      distant_graces: 2,
      unformed_graces: 0,
      expired_uses_grace: true,
      distant_unchanged: true,
      grace_is_free_period: true,
    });
  });
});

describe('설정값 쌍둥이 — SQL 은 shared 를 import 할 수 없으므로 여기서 대조한다', () => {
  test('lf_retention_warning_days 는 RETENTION_WARNING_DAYS 와 같다', async () => {
    const { rows } = await db.asAdmin(`select public.lf_retention_warning_days() value`);
    const value = rows[0]?.['value'];
    const days = Array.isArray(value)
      ? value.map(Number)
      : String(value).replace(/[{}]/gu, '').split(',').map(Number);
    expect(days).toEqual([...RETENTION_WARNING_DAYS]);
  });

  test('lf_reward_intent_ttl_minutes 는 REWARD_INTENT_TTL_MIN 과 같다', async () => {
    const { rows } = await db.asAdmin(`select public.lf_reward_intent_ttl_minutes() value`);
    expect(Number(rows[0]?.['value'])).toBe(REWARD_INTENT_TTL_MIN);
  });
});

describe('종료일 없는 약속의 수명주기 — NULL end_date 는 암묵이 아니라 계약이다', () => {
  test('종료일 없는 PENDING 을 승인하면 ACTIVE 가 되고 D-7/D-3/D-1/D-Day 리마인드는 없다', async () => {
    const creator = await createUser(db, '무기한승인작성자');
    const partner = await createUser(db, '무기한승인상대');
    const promiseId = await createPromise(db, { creatorId: creator, status: 'PENDING' });
    await makeNoEnd(promiseId);
    const tokenHash = await createInvitation(db, { promiseId, createdBy: creator });

    const { rows } = await db.asAdmin(
      `select public.lf_promise_approve($1,$2,$3,'WEB'::public.surface,$4,$5) as r`,
      [randomUUID(), tokenHash, partner, 'a'.repeat(64), 'b'.repeat(64)],
    );
    expect(rows[0]?.['r']).toMatchObject({ status: 'ACTIVE' });

    const reminders = await db.asAdmin(
      `select kind::text from public.reminder_schedules
        where promise_id=$1 and kind in ('D7','D3','D1','DDAY')`,
      [promiseId],
    );
    expect(reminders.rows).toEqual([]);
  });

  test('J-02 는 종료일 없는 ACTIVE 약속을 CHECKING 으로 옮기지 않는다', async () => {
    const creator = await createUser(db, '무기한J02작성자');
    const partner = await createUser(db, '무기한J02상대');
    const promiseId = await activate(creator, partner);
    await makeNoEnd(promiseId);

    await db.asService(
      `select public.lf_promises_enter_checking($1::timestamptz)`,
      [isoAfter(new Date(), 400 * DAY_MS)],
    );
    const { rows } = await db.asAdmin(`select status::text from public.promises where id=$1`, [promiseId]);
    expect(rows[0]).toEqual({ status: 'ACTIVE' });
  });
});

describe('§10 EC-J 보상형 광고·혜택', () => {
  test('EC-J01 PENDING 의도가 살아 있으면 같은 의도를 돌려주고 새 행을 만들지 않는다', async () => {
    const creator = await createUser(db, 'J01작성자');
    const partner = await createUser(db, 'J01상대');
    const promiseId = await activate(creator, partner);
    const first = await createIntent(creator, promiseId, 'DURATION_30D');
    const second = await createIntent(creator, promiseId, 'DURATION_30D');
    expect(second.intent_id).toBe(first.intent_id);

    const { rows } = await db.asAdmin(
      `select count(*)::int value from public.reward_intents where promise_id=$1 and user_id=$2`,
      [promiseId, creator],
    );
    expect(Number(rows[0]?.['value'])).toBe(1);
  });

  test('EC-J02 같은 transaction_id 의 SSV 콜백은 두 번째부터 지급하지 않는다', async () => {
    const creator = await createUser(db, 'J02작성자');
    const partner = await createUser(db, 'J02상대');
    const promiseId = await activate(creator, partner);
    const intent = await createIntent(creator, promiseId, 'DURATION_30D');
    const transactionId = randomUUID();
    expect(await grant(intent, { transactionId })).toEqual({ granted: true });
    // 같은 의도의 재전송은 멱등 확인(200)으로 답하되 지급 행은 늘지 않는다.
    expect(await grant(intent, { transactionId })).toEqual({ granted: true });
    // 다른 의도가 같은 transaction_id 를 들고 오면 지급하지 않는다 — 재생 차단.
    const next = await createIntent(creator, promiseId, 'DURATION_30D');
    expect(next.intent_id).not.toBe(intent.intent_id);
    expect(await grant(next, { transactionId })).toEqual({ granted: false });

    const { rows } = await db.asAdmin(
      `select count(*)::int value from public.promise_reward_grants where promise_id=$1`,
      [promiseId],
    );
    expect(Number(rows[0]?.['value'])).toBe(1);
  });

  test('EC-J03 상대방이 작성자 상한 밖 종료일을 변경 요청하면 E_END_DATE_RANGE 다', async () => {
    const creator = await createUser(db, 'J03작성자');
    const partner = await createUser(db, 'J03상대');
    const promiseId = await activate(creator, partner);
    const current = await currentProposal(promiseId);
    expect(
      await codeOf(async () => amendRequest(partner, promiseId, { ...current, end_date: kstToday(400) })),
    ).toBe('E_END_DATE_RANGE');
  });

  test('EC-J04 참여하지 않은 약속의 영구보존 구매 검증은 E_NOT_FOUND 다 — 존재조차 알리지 않는다', async () => {
    const creator = await createUser(db, 'J04작성자');
    const partner = await createUser(db, 'J04상대');
    const stranger = await createUser(db, 'J04비참여자');
    const promiseId = await activate(creator, partner);
    expect(await codeOf(async () => buyPermanent(stranger, promiseId))).toBe('E_NOT_FOUND');
  });
});

describe('§10 EC-K 개인 보관·정리', () => {
  test('EC-K01 본인 열람권이 만료되면 광고 연장도 영구보존 구매도 되살리지 못한다', async () => {
    const creator = await createUser(db, 'K01작성자');
    const partner = await createUser(db, 'K01상대');
    const promiseId = await activate(creator, partner);
    // 종료일을 과거로 보내 anchor 를 만들고 무료 30일도 지나게 한다.
    await db.asAdmin(
      `update public.promises
          set end_date = (now() at time zone 'Asia/Seoul')::date - 60,
              retention_anchor_at = now() - interval '59 days'
        where id=$1`,
      [promiseId],
    );
    expect(
      await codeOf(async () => createIntent(partner, promiseId, 'RETENTION_30D')),
    ).toBe('E_REWARD_NOT_ELIGIBLE');
    expect(await codeOf(async () => buyPermanent(partner, promiseId))).toBe('E_NOT_FOUND');
  });

  test('EC-K02 마무리 요청이 대기 중인 종료일 없는 약속은 J-11 의 경고·정리 대상이 아니다', async () => {
    const creator = await createUser(db, 'K02작성자');
    const partner = await createUser(db, 'K02상대');
    const promiseId = await activate(creator, partner);
    await makeNoEnd(promiseId);
    await finishRequest(creator, promiseId);

    await maintenance(isoAfter(new Date(), 400 * DAY_MS));
    const { rows } = await db.asAdmin(
      `select p.purge_state::text,
              (select count(*)::int from public.promise_purge_jobs j where j.promise_id=p.id) jobs,
              (select count(*)::int from public.notification_outbox o
                where o.promise_id=p.id and o.event in ('NT-22','NT-23')) warnings
         from public.promises p where p.id=$1`,
      [promiseId],
    );
    expect(rows[0]).toEqual({ purge_state: 'AVAILABLE', jobs: 0, warnings: 0 });
  });
});

describe('§10 EC-L 종료일 없는 약속·마무리', () => {
  test('EC-L01 종료일이 있는 약속의 마무리 요청은 E_STATE_CONFLICT 다', async () => {
    const creator = await createUser(db, 'L01작성자');
    const partner = await createUser(db, 'L01상대');
    const promiseId = await activate(creator, partner);
    expect(await codeOf(async () => finishRequest(creator, promiseId))).toBe('E_STATE_CONFLICT');
  });

  test('EC-L02 다른 변경 요청이 대기 중이면 마무리 요청은 E_STATE_CONFLICT 다', async () => {
    const creator = await createUser(db, 'L02작성자');
    const partner = await createUser(db, 'L02상대');
    const promiseId = await activate(creator, partner);
    await makeNoEnd(promiseId);
    const current = await currentProposal(promiseId);
    expect(
      await amendRequest(creator, promiseId, { ...current, title: '제목만 바꾼 약속' }),
    ).toMatchObject({ status: 'AMEND_PENDING' });
    expect(await codeOf(async () => finishRequest(partner, promiseId))).toBe('E_STATE_CONFLICT');
  });

  test('EC-L03 종료일 없는 ACTIVE 약속에도 증인을 초대할 수 있다', async () => {
    const creator = await createUser(db, 'L03작성자');
    const partner = await createUser(db, 'L03상대');
    const promiseId = await activate(creator, partner);
    await makeNoEnd(promiseId);
    expect(
      await codeOf(async () =>
        db.asService(`select public.lf_witness_invite($1,$2,$3,$4::char(64))`, [
          randomUUID(), creator, promiseId, tokenHash(),
        ]),
      ),
    ).toBeNull();
    expect((await entitlements(creator, promiseId))['witness']).toMatchObject({ creator_used: 1 });
  });
});
