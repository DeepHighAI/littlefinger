import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createPromise, createTestDb, createUser, type TestDb } from './harness.js';

/**
 * RLS 동작 검증 — 실제 Postgres(PGlite) 위에서 정책을 돌린다.
 *
 * `schema.test.ts` 는 SQL 이 옳은 말을 하는지 보고, 여기서는 Postgres 가 옳게 **동작하는지** 본다.
 * 이 파일이 없으면 `using` 과 `with check` 를 바꿔 쓴 실수, 문법은 맞지만 도달 불가능한 정책 같은
 * 것들이 배포 후에야 드러난다.
 */

let db: TestDb;
let creator: string;
let partner: string;
let witness: string;
let stranger: string;

beforeAll(async () => {
  db = await createTestDb();
  creator = await createUser(db, 'creator');
  partner = await createUser(db, 'partner');
  witness = await createUser(db, 'witness');
  stranger = await createUser(db, 'stranger');
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('존재 은닉 — 원칙: 비참여자에게 약속의 존재 자체를 알리지 않는다', () => {
  test('비참여자에게는 에러가 아니라 빈 결과가 간다', async () => {
    // 04 §7-2: "권한 없음"이 아니라 빈 결과. 애플리케이션이 E_NOT_FOUND 로 답한다.
    // 에러를 주면 "그 약속은 존재한다"를 알려주는 셈이 된다.
    const promiseId = await createPromise(db, { creatorId: creator, partnerId: partner });

    const seen = await db.asUser(stranger, 'select id from public.promises where id = $1', [
      promiseId,
    ]);

    expect(seen.rows).toEqual([]);
  });

  test('로그인하지 않은 방문자도 아무것도 못 본다', async () => {
    await createPromise(db, { creatorId: creator });
    const seen = await db.asAnon('select id from public.promises');
    expect(seen.rows).toEqual([]);
  });

  test('작성자는 자기 약속을 본다', async () => {
    const promiseId = await createPromise(db, { creatorId: creator });
    const seen = await db.asUser(creator, 'select id from public.promises where id = $1', [
      promiseId,
    ]);
    expect(seen.rows).toHaveLength(1);
  });

  test('상대방은 참여한 약속을 본다', async () => {
    const promiseId = await createPromise(db, { creatorId: creator, partnerId: partner });
    const seen = await db.asUser(partner, 'select id from public.promises where id = $1', [
      promiseId,
    ]);
    expect(seen.rows).toHaveLength(1);
  });

  test('참여한 약속만 목록에 뜬다', async () => {
    const mine = await createPromise(db, { creatorId: partner });
    await createPromise(db, { creatorId: creator });

    const seen = await db.asUser<{ id: string }>(partner, 'select id from public.promises');
    const ids = seen.rows.map((r) => r.id);

    expect(ids).toContain(mine);
    // 남의 약속은 개수로도 새면 안 된다.
    expect(seen.rows.every((r) => r.id === mine || ids.includes(r.id))).toBe(true);
  });
});

describe('증인 — §9: 약속 전문은 ACTIVE 이후에만 보인다', () => {
  test('증인은 DRAFT 약속을 보지 못한다', async () => {
    const promiseId = await createPromise(db, {
      creatorId: creator,
      partnerId: partner,
      witnessId: witness,
      status: 'DRAFT',
    });
    const seen = await db.asUser(witness, 'select id from public.promises where id = $1', [
      promiseId,
    ]);
    expect(seen.rows).toEqual([]);
  });

  test('증인은 PENDING 약속도 보지 못한다', async () => {
    const promiseId = await createPromise(db, {
      creatorId: creator,
      witnessId: witness,
      status: 'PENDING',
    });
    const seen = await db.asUser(witness, 'select id from public.promises where id = $1', [
      promiseId,
    ]);
    expect(seen.rows).toEqual([]);
  });

  test('확정된 뒤에는 증인도 전문을 본다', async () => {
    const promiseId = await createPromise(db, {
      creatorId: creator,
      partnerId: partner,
      witnessId: witness,
      status: 'ACTIVE',
    });
    const seen = await db.asUser(witness, 'select id from public.promises where id = $1', [
      promiseId,
    ]);
    expect(seen.rows).toHaveLength(1);
  });
});

describe('확정 후 불변 — 원칙 P3', () => {
  test('작성자는 DRAFT 를 고칠 수 있다', async () => {
    const promiseId = await createPromise(db, { creatorId: creator, status: 'DRAFT' });
    const updated = await db.asUser(
      creator,
      `update public.promises set title = '고친 제목' where id = $1 returning id`,
      [promiseId],
    );
    expect(updated.rows).toHaveLength(1);
  });

  test('확정된 약속의 내용은 고칠 수 없다', async () => {
    // RLS 는 에러가 아니라 0행으로 막는다.
    const promiseId = await createPromise(db, { creatorId: creator, status: 'ACTIVE' });
    const updated = await db.asUser(
      creator,
      `update public.promises set title = '몰래 고침' where id = $1 returning id`,
      [promiseId],
    );
    expect(updated.rows).toEqual([]);

    const after = await db.asAdmin('select title from public.promises where id = $1', [promiseId]);
    expect(after.rows[0]?.title).toBe('매일 걷기');
  });

  test('상대방도 내용을 고칠 수 없다', async () => {
    const promiseId = await createPromise(db, {
      creatorId: creator,
      partnerId: partner,
      status: 'ACTIVE',
    });
    const updated = await db.asUser(
      partner,
      `update public.promises set title = '상대가 고침' where id = $1 returning id`,
      [promiseId],
    );
    expect(updated.rows).toEqual([]);
  });

  test('DRAFT 를 ACTIVE 로 혼자 올릴 수 없다 — 확정은 서버만 한다', async () => {
    const promiseId = await createPromise(db, { creatorId: creator, status: 'DRAFT' });
    // 막히는 방식이 두 가지라는 점이 중요하다.
    //   using 위반  → 행이 안 보여서 0행 (조용히 걸러짐)
    //   with check 위반 → 에러 (새 행이 정책을 어김)
    // 여기는 읽기는 되는데 쓰려는 값이 정책을 벗어나므로 에러다.
    await expect(
      db.asUser(creator, `update public.promises set status = 'ACTIVE' where id = $1`, [promiseId]),
    ).rejects.toThrow(/row-level security/u);

    const after = await db.asAdmin('select status from public.promises where id = $1', [promiseId]);
    expect(after.rows[0]?.status).toBe('DRAFT');
  });
});

describe('삭제 — §9: 기록 삭제는 모든 역할에게 금지', () => {
  test('작성자는 자기 DRAFT 를 지울 수 있다', async () => {
    const promiseId = await createPromise(db, { creatorId: creator, status: 'DRAFT' });
    const deleted = await db.asUser(
      creator,
      'delete from public.promises where id = $1 returning id',
      [promiseId],
    );
    expect(deleted.rows).toHaveLength(1);
  });

  test('확정된 약속은 지울 수 없다 — 상대방의 기록이기도 하다', async () => {
    const promiseId = await createPromise(db, {
      creatorId: creator,
      partnerId: partner,
      status: 'ACTIVE',
    });
    const deleted = await db.asUser(
      creator,
      'delete from public.promises where id = $1 returning id',
      [promiseId],
    );
    expect(deleted.rows).toEqual([]);

    const after = await db.asAdmin('select id from public.promises where id = $1', [promiseId]);
    expect(after.rows).toHaveLength(1);
  });

  test('비참여자는 남의 약속을 지울 수 없다', async () => {
    const promiseId = await createPromise(db, { creatorId: creator, status: 'DRAFT' });
    const deleted = await db.asUser(
      stranger,
      'delete from public.promises where id = $1 returning id',
      [promiseId],
    );
    expect(deleted.rows).toEqual([]);
  });
});

describe('생성 — 남의 이름으로 만들 수 없다', () => {
  test('작성자는 참여자 행이 아직 없어도 자기 약속을 읽는다', async () => {
    // insert ... returning 은 넣은 행을 곧바로 SELECT 한다. 그 순간에는
    // promise_participants 행이 아직 없으므로, 참여 여부로만 판정하면 여기서 막힌다.
    const { rows } = await db.asAdmin(
      `insert into public.promises (creator_id, status) values ($1, 'DRAFT') returning id`,
      [creator],
    );
    const promiseId = String((rows[0] as { id: string }).id);

    const seen = await db.asUser(creator, 'select id from public.promises where id = $1', [
      promiseId,
    ]);
    expect(seen.rows).toHaveLength(1);
  });

  test('자기 이름으로 DRAFT 를 만들고 id 를 돌려받는다', async () => {
    const created = await db.asUser(
      creator,
      `insert into public.promises (creator_id, status) values ($1, 'DRAFT') returning id`,
      [creator],
    );
    expect(created.rows).toHaveLength(1);
  });

  test('남을 작성자로 지정할 수 없다', async () => {
    await expect(
      db.asUser(
        stranger,
        `insert into public.promises (creator_id, status) values ($1, 'DRAFT') returning id`,
        [creator],
      ),
    ).rejects.toThrow();
  });

  test('처음부터 ACTIVE 로 만들 수 없다 — 확정은 상호 승인을 거쳐야 한다', async () => {
    await expect(
      db.asUser(
        creator,
        `insert into public.promises (creator_id, status) values ($1, 'ACTIVE') returning id`,
        [creator],
      ),
    ).rejects.toThrow();
  });
});

describe('append-only — 감사 로그는 고치거나 지울 수 없다', () => {
  async function seedApproval(promiseId: string): Promise<string> {
    const { rows } = await db.asAdmin(
      `insert into public.approvals (promise_id, user_id, role, action, surface)
       values ($1, $2, 'CREATOR', 'APPROVE', 'APP') returning id`,
      [promiseId, creator],
    );
    return String((rows[0] as { id: string }).id);
  }

  test('참여자는 감사 로그를 읽는다', async () => {
    const promiseId = await createPromise(db, { creatorId: creator, status: 'ACTIVE' });
    await seedApproval(promiseId);
    const seen = await db.asUser(creator, 'select id from public.approvals where promise_id = $1', [
      promiseId,
    ]);
    expect(seen.rows).toHaveLength(1);
  });

  test('비참여자는 감사 로그를 읽지 못한다', async () => {
    const promiseId = await createPromise(db, { creatorId: creator, status: 'ACTIVE' });
    await seedApproval(promiseId);
    const seen = await db.asUser(stranger, 'select id from public.approvals where promise_id = $1', [
      promiseId,
    ]);
    expect(seen.rows).toEqual([]);
  });

  test('본인이 남긴 승인 기록도 고칠 수 없다', async () => {
    const promiseId = await createPromise(db, { creatorId: creator, status: 'ACTIVE' });
    await seedApproval(promiseId);
    const updated = await db.asUser(
      creator,
      `update public.approvals set comment = '고침' where promise_id = $1 returning id`,
      [promiseId],
    );
    expect(updated.rows).toEqual([]);
  });

  test('승인 기록을 지울 수 없다', async () => {
    const promiseId = await createPromise(db, { creatorId: creator, status: 'ACTIVE' });
    await seedApproval(promiseId);
    const deleted = await db.asUser(
      creator,
      'delete from public.approvals where promise_id = $1 returning id',
      [promiseId],
    );
    expect(deleted.rows).toEqual([]);
  });

  test('클라이언트가 승인 기록을 직접 남길 수 없다 — 서버만 쓴다', async () => {
    const promiseId = await createPromise(db, { creatorId: creator, status: 'ACTIVE' });
    await expect(
      db.asUser(
        creator,
        `insert into public.approvals (promise_id, user_id, role, action, surface)
         values ($1, $2, 'CREATOR', 'APPROVE', 'APP') returning id`,
        [promiseId, creator],
      ),
    ).rejects.toThrow();
  });
});

describe('개인 데이터는 본인만', () => {
  test('알림함은 자기 것만 보인다', async () => {
    await db.asAdmin(
      `insert into public.notifications (user_id, type, channel, title, body, dedupe_key)
       values ($1, 'REMINDER', 'PUSH', '알림', '내용', $2)`,
      [creator, `dedupe-${Date.now()}-${Math.round(performance.now())}`],
    );

    const mine = await db.asUser(creator, 'select id from public.notifications');
    const theirs = await db.asUser(stranger, 'select id from public.notifications');

    expect(mine.rows.length).toBeGreaterThan(0);
    expect(theirs.rows).toEqual([]);
  });

  test('약속 지킴율은 남의 것을 볼 수 없다 — MVP 비노출(S-12)', async () => {
    await db.asAdmin(
      `insert into public.trust_profiles (user_id, completed_count, broken_count, keep_rate)
       values ($1, 5, 1, 83)`,
      [creator],
    );

    const mine = await db.asUser(creator, 'select keep_rate from public.trust_profiles');
    const theirs = await db.asUser(stranger, 'select keep_rate from public.trust_profiles');

    expect(mine.rows).toHaveLength(1);
    expect(theirs.rows).toEqual([]);
  });
});

describe('app_configs — 로그인 전에도 읽혀야 한다', () => {
  test('로그인하지 않아도 원격 설정을 읽는다', async () => {
    // keep-alive 워크플로가 anon 키로 찌르는 대상이고, ads_enabled 도 여기서 온다.
    await db.asAdmin(
      `insert into public.app_configs (key, value) values ('ads_enabled', 'false'::jsonb)
       on conflict (key) do nothing`,
    );
    const seen = await db.asAnon('select key from public.app_configs');
    expect(seen.rows.length).toBeGreaterThan(0);
  });

  test('클라이언트가 설정을 바꿀 수 없다', async () => {
    const updated = await db.asUser(
      creator,
      `update public.app_configs set value = 'true'::jsonb where key = 'ads_enabled' returning key`,
    );
    expect(updated.rows).toEqual([]);
  });
});
