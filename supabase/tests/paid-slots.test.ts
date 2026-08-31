import { randomBytes, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { FREE_PROMISE_SLOTS, SLOT_PRODUCT_ID } from '../../packages/shared/src/config.ts';
import { createTestDb, createUser, type TestDb } from './harness.ts';

/**
 * 유료 약속 슬롯 — PO 2026-08-24 (마이그레이션 20260824000001).
 *
 * 핵심 계약 셋: (1) 슬롯을 소모하는 전이는 DRAFT → PENDING 뿐이다 — DRAFT 저장과 재발송은
 * 만석에서도 되고, 종결은 슬롯을 되돌린다. (2) 부여는 주문당 한 번이고 남의 주문은 거부된다.
 * (3) 구매 이력은 본인만 읽는다.
 */

let db: TestDb;

async function codeOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** invitations.token_hash 는 unique 라 매 발송 새 값이어야 한다. */
function fakeTokenHash(): string {
  return randomBytes(32).toString('hex');
}

/** KST 오늘 + n 을 YYYY-MM-DD 로. */
function kstToday(offsetDays: number): string {
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  kstNow.setUTCDate(kstNow.getUTCDate() + offsetDays);
  return kstNow.toISOString().slice(0, 10);
}

const CREATE_SQL = `select public.lf_promise_create(
  $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::boolean, $11::char(64)) as payload`;

/** [상대에게 보내기] — T-01 + T-02 한 번에. 슬롯 1개를 소모한다. */
async function sendNew(userId: string, title = '매일 걷기'): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(CREATE_SQL, [
    randomUUID(), userId, title, '매일 30분 걷기로 했다', 'HABIT', kstToday(7),
    'BOTH', '커피 한 잔', '설거지 1주일', false, fakeTokenHash(),
  ]);
  return (rows[0] as { payload: Record<string, unknown> }).payload;
}

/** [임시저장] — DRAFT 만. 슬롯을 소모하지 않아야 한다. */
async function draftNew(userId: string): Promise<string> {
  const { rows } = await db.asAdmin(CREATE_SQL, [
    randomUUID(), userId, '임시 약속', '아직 보내지 않았다', 'HABIT', kstToday(7),
    'BOTH', null, null, false, null,
  ]);
  return String((rows[0] as { payload: Record<string, unknown> }).payload['promise_id']);
}

async function inviteDraft(userId: string, promiseId: string): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(
    `select public.lf_promise_invite($1::uuid, $2::uuid, $3::uuid, $4::char(64)) as payload`,
    [randomUUID(), userId, promiseId, fakeTokenHash()],
  );
  return (rows[0] as { payload: Record<string, unknown> }).payload;
}

async function slotStatus(userId: string): Promise<{ capacity: number; used: number }> {
  const { rows } = await db.asAdmin(`select public.lf_slot_status($1::uuid) as payload`, [userId]);
  return (rows[0] as { payload: { capacity: number; used: number } }).payload;
}

async function grant(
  userId: string,
  orderId: string,
  purchaseToken: string,
): Promise<{ capacity: number; used: number }> {
  const { rows } = await db.asAdmin(
    `select public.lf_slot_grant($1::uuid, $2, $3, $4, now()) as payload`,
    [userId, SLOT_PRODUCT_ID, orderId, purchaseToken],
  );
  return (rows[0] as { payload: { capacity: number; used: number } }).payload;
}

async function setStatus(promiseId: string, status: string): Promise<void> {
  await db.asAdmin(`update public.promises set status = $2 where id = $1`, [promiseId, status]);
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

// ══════════════════════════════════════════════════════════════
// 정책 수치 쌍 — SQL 은 config.ts 를 읽을 수 없다
// ══════════════════════════════════════════════════════════════

describe('정책 수치', () => {
  test('lf_free_promise_slots 는 FREE_PROMISE_SLOTS 와 같다', async () => {
    const { rows } = await db.asAdmin(`select public.lf_free_promise_slots() as v`);
    expect(Number((rows[0] as { v: number }).v)).toBe(FREE_PROMISE_SLOTS);
  });
});

// ══════════════════════════════════════════════════════════════
// 현황 — used 는 작성자 기준 '진행 중'만 센다
// ══════════════════════════════════════════════════════════════

describe('lf_slot_status', () => {
  test('신규 사용자는 무료 용량에 사용량 0 이다', async () => {
    const user = await createUser(db, '슬롯새내기');
    expect(await slotStatus(user)).toEqual({ capacity: FREE_PROMISE_SLOTS, used: 0 });
  });

  test('Edge Function의 service_role 경로에서도 현황 조회와 신규 발송이 된다', async () => {
    const user = await createUser(db, '슬롯서비스경로');
    const { rows: statusRows } = await db.asService(
      `select public.lf_slot_status($1::uuid) as payload`,
      [user],
    );
    expect(statusRows[0]?.['payload']).toEqual({ capacity: FREE_PROMISE_SLOTS, used: 0 });

    const { rows: createRows } = await db.asService(CREATE_SQL, [
      randomUUID(), user, '서비스 경로 약속', '권한 회귀를 검증한다', 'HABIT', kstToday(7),
      'BOTH', null, null, false, fakeTokenHash(),
    ]);
    expect((createRows[0]?.['payload'] as Record<string, unknown>)['status']).toBe('PENDING');
  });

  test('발송은 사용량을 올리고 DRAFT 저장은 올리지 않는다', async () => {
    const user = await createUser(db, '슬롯카운트');
    await sendNew(user);
    await draftNew(user);
    expect((await slotStatus(user)).used).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════
// 발송 가드 — 소모 전이는 DRAFT → PENDING 뿐
// ══════════════════════════════════════════════════════════════

describe('슬롯 한도', () => {
  test('용량을 채우면 여섯 번째 발송이 E_SLOT_LIMIT 다 (create 경로)', async () => {
    const user = await createUser(db, '슬롯만석a');
    for (let i = 0; i < FREE_PROMISE_SLOTS; i += 1) await sendNew(user, `약속 ${i}`);

    expect(await codeOf(async () => sendNew(user, '넘치는 약속'))).toBe('E_SLOT_LIMIT');
    // 실패한 발송은 약속을 남기지 않는다 — T-01 과 T-02 가 한 트랜잭션이다.
    expect((await slotStatus(user)).used).toBe(FREE_PROMISE_SLOTS);
  });

  test('만석에서 DRAFT 발송도 E_SLOT_LIMIT 다 (invite 경로)', async () => {
    const user = await createUser(db, '슬롯만석b');
    const draftId = await draftNew(user);
    for (let i = 0; i < FREE_PROMISE_SLOTS; i += 1) await sendNew(user, `약속 ${i}`);

    expect(await codeOf(async () => inviteDraft(user, draftId))).toBe('E_SLOT_LIMIT');
  });

  test('만석에서도 DRAFT 저장은 된다 — DRAFT 는 별도 한도(20건)를 쓴다', async () => {
    const user = await createUser(db, '슬롯드래프트');
    for (let i = 0; i < FREE_PROMISE_SLOTS; i += 1) await sendNew(user, `약속 ${i}`);

    await expect(draftNew(user)).resolves.toBeTruthy();
  });

  test('만석에서도 재발송은 된다 — 이미 자기 슬롯 위에 서 있다', async () => {
    const user = await createUser(db, '슬롯재발송');
    const first = await sendNew(user, '재발송 대상');
    for (let i = 1; i < FREE_PROMISE_SLOTS; i += 1) await sendNew(user, `약속 ${i}`);

    const resent = await inviteDraft(user, String(first['promise_id']));
    expect(resent['resend_count']).toBe(1);
  });

  test('오류 우선순위: 내용·종료일 검증이 슬롯 한도보다 먼저다 (PO 2026-08-25)', async () => {
    // 슬롯을 먼저 물으면 "결제했는데 여전히 못 보내는" 약속에 결제 시트가 뜬다.
    const user = await createUser(db, '슬롯우선순위');
    const draftId = await draftNew(user);
    for (let i = 0; i < FREE_PROMISE_SLOTS; i += 1) await sendNew(user, `약속 ${i}`);

    // 저장된 DRAFT 의 종료일이 그 사이 지나간 상황을 만든다.
    await db.asAdmin(
      `update public.promise_versions set end_date = current_date - 1
        where promise_id = $1 and version_no = 1`,
      [draftId],
    );

    expect(await codeOf(async () => inviteDraft(user, draftId))).toBe('E_VALIDATION');

    // 날짜를 고치면 그제서야 슬롯 한도가 답이다.
    await db.asAdmin(
      `update public.promise_versions set end_date = current_date + 7
        where promise_id = $1 and version_no = 1`,
      [draftId],
    );
    expect(await codeOf(async () => inviteDraft(user, draftId))).toBe('E_SLOT_LIMIT');
  });

  test('종료일 상한은 슬롯 한도 뒤에 판정된다 — 만석이면 E_SLOT_LIMIT, 자리가 나면 E_END_DATE_RANGE', async () => {
    // 슬롯 가드는 lf_invite_issue_row 안에서, 종료일 상한(보상형 광고 전 30일)은 DRAFT → PENDING
    // 상태 전이 트리거에서 걸린다. 결제해도 여전히 못 보내는 약속이 있다는 것을 문서로 남긴다.
    const user = await createUser(db, '슬롯상한순서');
    const draftId = await draftNew(user);
    // 상한 트리거는 promises.end_date 를, 경과 검사는 버전 행을 읽는다 — 둘 다 같은 날짜로 둔다.
    await db.asAdmin(
      `update public.promise_versions set end_date = current_date + 60
        where promise_id = $1 and version_no = 1`,
      [draftId],
    );
    await db.asAdmin(`update public.promises set end_date = current_date + 60 where id = $1`, [draftId]);
    for (let i = 0; i < FREE_PROMISE_SLOTS; i += 1) await sendNew(user, `약속 ${i}`);
    expect(await codeOf(async () => inviteDraft(user, draftId))).toBe('E_SLOT_LIMIT');

    const { rows } = await db.asAdmin(
      `select promise_id from public.invitations where created_by = $1 limit 1`,
      [user],
    );
    await setStatus(String(rows[0]?.['promise_id']), 'COMPLETED');
    expect(await codeOf(async () => inviteDraft(user, draftId))).toBe('E_END_DATE_RANGE');
  });

  test('draft-update 의 발송 분기도 같은 한도에 걸린다 (잠금 선취득 경로)', async () => {
    const user = await createUser(db, '슬롯수정발송');
    const draftId = await draftNew(user);
    for (let i = 0; i < FREE_PROMISE_SLOTS; i += 1) await sendNew(user, `약속 ${i}`);

    const send = async () =>
      db.asAdmin(
        `select public.lf_promise_draft_update(
           $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11::boolean, $12::char(64)
         ) as payload`,
        [
          randomUUID(), user, draftId, '수정한 약속', '내용도 고쳤다', 'HABIT', kstToday(7),
          'BOTH', null, null, false, fakeTokenHash(),
        ],
      );

    expect(await codeOf(send)).toBe('E_SLOT_LIMIT');
  });

  test('종결은 슬롯을 되돌린다', async () => {
    const user = await createUser(db, '슬롯반환');
    const first = await sendNew(user, '거절될 약속');
    for (let i = 1; i < FREE_PROMISE_SLOTS; i += 1) await sendNew(user, `약속 ${i}`);

    await setStatus(String(first['promise_id']), 'DECLINED');

    const sixth = await sendNew(user, '반환 후 새 약속');
    expect(sixth['status']).toBe('PENDING');
  });
});

// ══════════════════════════════════════════════════════════════
// 부여 — 주문당 한 번, 남의 주문 거부
// ══════════════════════════════════════════════════════════════

describe('lf_slot_grant', () => {
  test('부여는 용량을 영구 +1 하고, 만석 발송이 다시 열린다', async () => {
    const user = await createUser(db, '슬롯구매');
    for (let i = 0; i < FREE_PROMISE_SLOTS; i += 1) await sendNew(user, `약속 ${i}`);

    const after = await grant(user, `order-${randomUUID()}`, `token-${randomUUID()}`);
    expect(after.capacity).toBe(FREE_PROMISE_SLOTS + 1);

    const sixth = await sendNew(user, '구매 후 약속');
    expect(sixth['status']).toBe('PENDING');
  });

  test('같은 주문의 재검증은 멱등이다 — 부여는 한 번, 응답은 정상', async () => {
    const user = await createUser(db, '슬롯멱등');
    const orderId = `order-${randomUUID()}`;
    const token = `token-${randomUUID()}`;

    await grant(user, orderId, token);
    const second = await grant(user, orderId, token);

    expect(second.capacity).toBe(FREE_PROMISE_SLOTS + 1);
    const { rows } = await db.asAdmin(
      `select count(*)::int as n from public.slot_purchases where order_id = $1`,
      [orderId],
    );
    expect((rows[0] as { n: number }).n).toBe(1);
  });

  test('남의 주문 재사용은 E_VALIDATION 이다', async () => {
    const buyer = await createUser(db, '슬롯원구매자');
    const thief = await createUser(db, '슬롯재사용자');
    const orderId = `order-${randomUUID()}`;

    await grant(buyer, orderId, `token-${randomUUID()}`);

    expect(await codeOf(async () => grant(thief, orderId, `token-${randomUUID()}`))).toBe(
      'E_VALIDATION',
    );
    expect((await slotStatus(thief)).capacity).toBe(FREE_PROMISE_SLOTS);
  });

  test('같은 토큰을 다른 주문으로 들고 오면 unique 가 막는다', async () => {
    const buyer = await createUser(db, '슬롯토큰중복');
    const token = `token-${randomUUID()}`;

    await grant(buyer, `order-${randomUUID()}`, token);

    const code = await codeOf(async () => grant(buyer, `order-${randomUUID()}`, token));
    expect(code).not.toBeNull();
    expect(code).not.toBe('E_SLOT_LIMIT');
  });
});

describe('lf_slot_revoke', () => {
  test('환불·차지백은 구매 행을 보존하면서 슬롯 권리만 멱등 회수한다', async () => {
    const buyer = await createUser(db, '슬롯환불');
    const token = `token-${randomUUID()}`;
    await grant(buyer, `order-${randomUUID()}`, token);
    expect((await slotStatus(buyer)).capacity).toBe(FREE_PROMISE_SLOTS + 1);

    const first = await db.asService(
      `select public.lf_slot_revoke($1, now(), 1, 1) as revoked`,
      [token],
    );
    const second = await db.asService(
      `select public.lf_slot_revoke($1, now(), 1, 1) as revoked`,
      [token],
    );

    expect(first.rows[0]?.['revoked']).toBe(true);
    expect(second.rows[0]?.['revoked']).toBe(false);
    expect((await slotStatus(buyer)).capacity).toBe(FREE_PROMISE_SLOTS);
    expect((await db.asAdmin(
      `select count(*)::int as n from public.slot_purchases where purchase_token = $1`,
      [token],
    )).rows[0]?.['n']).toBe(1);
  });

  test('다른 앱의 알 수 없는 토큰은 아무 권리도 바꾸지 않는다', async () => {
    const result = await db.asService(
      `select public.lf_slot_revoke('unknown-token', now(), 0, 0) as revoked`,
    );
    expect(result.rows[0]?.['revoked']).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// RLS — 구매 이력은 본인만
// ══════════════════════════════════════════════════════════════

describe('slot_purchases RLS', () => {
  test('본인 행만 보이고 남의 행은 0행이다', async () => {
    const buyer = await createUser(db, '슬롯본인');
    const other = await createUser(db, '슬롯타인');
    await grant(buyer, `order-${randomUUID()}`, `token-${randomUUID()}`);

    const mine = await db.asUser(buyer, `select count(*)::int as n from public.slot_purchases`);
    const theirs = await db.asUser(other, `select count(*)::int as n from public.slot_purchases`);

    expect((mine.rows[0] as { n: number }).n).toBe(1);
    expect((theirs.rows[0] as { n: number }).n).toBe(0);
  });

  test('탈퇴 계정은 자기 구매 이력도 0행이다 (활성 계정 경계)', async () => {
    const buyer = await createUser(db, '슬롯탈퇴');
    await grant(buyer, `order-${randomUUID()}`, `token-${randomUUID()}`);
    await db.asAdmin(`update public.users set status = 'WITHDRAWN' where id = $1`, [buyer]);

    const mine = await db.asUser(buyer, `select count(*)::int as n from public.slot_purchases`);
    expect((mine.rows[0] as { n: number }).n).toBe(0);
  });

  test('클라이언트 역할의 직접 쓰기는 거부된다 — 부여는 서버 RPC 뿐이다', async () => {
    const user = await createUser(db, '슬롯직접쓰기');

    const code = await codeOf(async () =>
      db.asUser(
        user,
        `insert into public.slot_purchases
           (user_id, provider, product_id, order_id, purchase_token, purchase_time)
         values ($1, 'google_play', 'promise_slot_plus1', 'forged-order', 'forged-token', now())`,
        [user],
      ),
    );
    expect(code).toContain('permission denied');
  });
});

// ══════════════════════════════════════════════════════════════
// 권한 기준선 — ACL 을 테스트로 고정한다 (Codex 2026-08-25)
// ══════════════════════════════════════════════════════════════

describe('슬롯 권한 기준선', () => {
  test('slot_purchases 표 권한: authenticated 는 SELECT 뿐, anon·PUBLIC 은 없다', async () => {
    const { rows } = await db.asAdmin(
      `select grantee, privilege_type
         from information_schema.role_table_grants
        where table_schema = 'public' and table_name = 'slot_purchases'
          and grantee in ('anon', 'authenticated', 'PUBLIC')
        order by grantee, privilege_type`,
    );
    expect(
      rows.map((row) => `${String(row['grantee'])}:${String(row['privilege_type'])}`),
    ).toEqual(['authenticated:SELECT']);
  });

  test('슬롯 함수는 전부 서버 전용이다 — anon·authenticated 실행 불가, service_role 만 가능', async () => {
    const signatures = [
      'public.lf_free_promise_slots()',
      'public.lf_slot_lock(uuid)',
      'public.lf_slot_used(uuid)',
      'public.lf_slot_capacity(uuid)',
      'public.lf_slot_status(uuid)',
      'public.lf_slot_grant(uuid, text, text, text, timestamptz)',
      'public.lf_slot_revoke(text, timestamptz, integer, integer)',
      'public.lf_assert_slot_available(uuid)',
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

  test('취소 구매 원장은 Data API 역할에서 직접 읽거나 쓸 수 없다', async () => {
    const buyer = await createUser(db, '회수원장권한');
    await expect(
      db.asUser(buyer, `select * from public.slot_purchase_revocations`),
    ).rejects.toThrow(/permission denied/u);
    await expect(
      db.asService(`select * from public.slot_purchase_revocations`),
    ).rejects.toThrow(/permission denied/u);
  });

  test('lf_slot_capacity만 취소 원장을 소유자 권한으로 집계한다', async () => {
    const { rows } = await db.asAdmin(
      `select p.prosecdef as security_definer,
              p.proconfig as config
         from pg_catalog.pg_proc p
        where p.oid = 'public.lf_slot_capacity(uuid)'::regprocedure`,
    );
    expect(rows).toEqual([{ security_definer: true, config: ['search_path=""'] }]);
  });

  test('내부 대사 스케줄은 재적용해도 정확히 두 작업만 한 건씩 남긴다', async () => {
    await db.asService(`select public.lf_schedule_reconciliation_workers()`);
    await db.asService(`select public.lf_schedule_reconciliation_workers()`);
    const { rows } = await db.asAdmin(
      `select jobname, count(*)::int as count, min(schedule) as schedule
         from cron.job
        where jobname in ('lf-purchase-reconcile', 'lf-account-delete-retry')
        group by jobname
        order by jobname`,
    );
    expect(rows).toEqual([
      { jobname: 'lf-account-delete-retry', count: 1, schedule: '*/15 * * * *' },
      { jobname: 'lf-purchase-reconcile', count: 1, schedule: '17 3 * * *' },
    ]);
  });
});
