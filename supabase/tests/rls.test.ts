import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

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
  test('작성자도 DRAFT 를 직접 고칠 수 없다 — 0009 가 UPDATE 정책을 회수했다', async () => {
    // T-01 이 RPC 가 되면서 클라이언트 쓰기 경로를 닫았다(PO 결정 2026-07-27). 열어 두면
    // EC-H05 한도를 우회할 수 있고, promise_versions 에는 UPDATE 정책이 없어 캐시만 바뀐
    // 반쪽 상태가 만들어진다 — 초대 랜딩은 캐시 제목을, 승인은 버전 내용을 읽는다.
    // §4-2-2.4 의 DRAFT 수정은 전용 RPC 가 생길 때 다시 열린다.
    const promiseId = await createPromise(db, { creatorId: creator, status: 'DRAFT' });
    const updated = await db.asUser(
      creator,
      `update public.promises set title = '고친 제목' where id = $1 returning id`,
      [promiseId],
    );
    // 정책이 없으면 에러가 아니라 **0행**이다. 조용히 실패하므로 행 수로 확인해야 한다.
    expect(updated.rows).toEqual([]);
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
    // UPDATE 정책이 아예 없으므로 0행이다. 예외를 기대하면 안 된다 — 정책이 하나라도 남아
    // 있을 때만 `with check` 위반이 에러가 되는데, 지금은 그 정책이 없다.
    const updated = await db.asUser(
      creator,
      `update public.promises set status = 'ACTIVE' where id = $1 returning id`,
      [promiseId],
    );
    expect(updated.rows).toEqual([]);

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

describe('생성 — 클라이언트는 약속을 직접 만들 수 없다', () => {
  test('작성자는 참여자 행이 아직 없어도 자기 약속을 읽는다', async () => {
    // SELECT 정책에 `creator_id = auth.uid()` 분기가 따로 있는 이유다. 참여 여부로만
    // 판정하면 참여자 행이 생기기 전 순간의 작성자가 자기 약속을 못 읽는다.
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

  test.each([
    ['자기 이름으로도', 'creator', 'DRAFT'],
    ['남을 작성자로 지정해서도', 'stranger', 'DRAFT'],
    ['처음부터 ACTIVE 로도', 'creator', 'ACTIVE'],
  ])('%s 만들 수 없다 — 생성은 lf_promise_create 뿐이다', async (_label, actor, status) => {
    // 0009 가 INSERT 정책을 회수했다(PO 결정 2026-07-27). 열려 있으면 EC-H05 의 사용자당
    // 한도를 셀 곳이 RPC 뿐이라 그냥 우회되고, content_hash 도 클라이언트가 심을 수 있다.
    await expect(
      db.asUser(
        actor === 'creator' ? creator : stranger,
        `insert into public.promises (creator_id, status)
         values ($1, $2::public.promise_status) returning id`,
        [creator, status],
      ),
    ).rejects.toThrow(/row-level security/u);
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

describe('fulfillment_checks — 답변 원문은 Edge RPC만 읽는다', () => {
  test('참여자도 테이블을 직접 SELECT할 수 없다', async () => {
    const promiseId = await createPromise(db, {
      creatorId: creator,
      partnerId: partner,
      status: 'CHECKING',
    });
    await db.asAdmin(
      `insert into public.fulfillment_checks
         (promise_id, version_id, user_id, answer, comment, surface)
       select p.id, pv.id, $2, 'KEPT', '숨겨야 하는 답변', 'APP'
         from public.promises p
         join public.promise_versions pv
           on pv.promise_id = p.id and pv.version_no = 1
        where p.id = $1`,
      [promiseId, partner],
    );

    await expect(
      db.asUser(
        creator,
        `select answer, comment
           from public.fulfillment_checks
          where promise_id = $1`,
        [promiseId],
      ),
    ).rejects.toThrow(/permission denied/iu);
  });

  test('anon/authenticated SELECT 권한은 없고 service_role만 유지한다', async () => {
    const { rows } = await db.asAdmin(
      `select has_table_privilege('anon', 'public.fulfillment_checks', 'SELECT') as anon,
              has_table_privilege(
                'authenticated', 'public.fulfillment_checks', 'SELECT'
              ) as authenticated,
              has_table_privilege(
                'service_role', 'public.fulfillment_checks', 'SELECT'
              ) as service_role`,
    );

    expect(rows[0]).toEqual({
      anon: false,
      authenticated: false,
      service_role: true,
    });
  });
});

describe('개인 데이터는 본인만', () => {
  test('약관 동의는 본인 읽기만 가능하고 클라이언트가 만들 수 없다', async () => {
    const own = await db.asUser(
      creator,
      'select terms_version, privacy_version from public.terms_agreements where user_id = $1',
      [creator],
    );
    expect(own.rows).toHaveLength(1);

    await expect(
      db.asUser(
        creator,
        `insert into public.terms_agreements (user_id, terms_version, privacy_version)
         values ($1, 'forged', 'forged')`,
        [creator],
      ),
    ).rejects.toThrow(/permission denied/iu);
    await expect(
      db.asAnon(
        `insert into public.terms_agreements (user_id, terms_version, privacy_version)
         values ($1, 'forged', 'forged')`,
        [creator],
      ),
    ).rejects.toThrow(/permission denied/iu);
  });

  test('알림 원본 테이블은 본인과 anon에게도 직접 공개하지 않는다', async () => {
    await db.asAdmin(
      `insert into public.notifications (user_id, type, channel, title, body, dedupe_key)
       values ($1, 'REMINDER', 'INAPP', '알림', '내용', $2)`,
      [creator, `dedupe-${Date.now()}-${Math.round(performance.now())}`],
    );

    await expect(db.asUser(creator, 'select * from public.notifications')).rejects.toThrow(
      /permission denied/iu,
    );
    await expect(db.asUser(stranger, 'select * from public.notifications')).rejects.toThrow(
      /permission denied/iu,
    );
    await expect(db.asAnon('select * from public.notifications')).rejects.toThrow(
      /permission denied/iu,
    );
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
