import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { PROMISE_HOME_PAGE_SIZE } from '../../packages/shared/src/config.ts';
import {
  asPromiseHomeListResponse,
  type PromiseHomeCursor,
  type PromiseHomeListResponse,
  type PromiseHomeTab,
} from '../../packages/shared/src/index.ts';
import { createTestDb, createUser, type TestDb } from './harness.ts';

let db: TestDb;

interface PromiseFixture {
  id: string;
  creatorId: string;
  partnerId?: string;
  witnessId?: string;
  status: string;
  title: string;
  endDate?: string;
  updatedAt?: string;
  closedAt?: string | null;
}

async function insertPromise(input: PromiseFixture): Promise<void> {
  const versionEndDate = input.endDate ?? '2026-08-30';
  await db.asAdmin(
    `insert into public.promises
       (id, creator_id, status, title, body, category, end_date, keeper,
        reward, penalty, updated_at, closed_at)
     values ($1, $2, $3::public.promise_status, $4, '본문', 'HABIT', $5::date, 'BOTH',
             null, null, $6::timestamptz, $7::timestamptz)`,
    [
      input.id,
      input.creatorId,
      input.status,
      input.title,
      input.endDate ?? null,
      input.updatedAt ?? '2026-08-16T00:00:00Z',
      input.closedAt ?? null,
    ],
  );
  await db.asAdmin(
    `insert into public.promise_versions
       (promise_id, version_no, title, body, category, end_date, keeper,
        content_hash, created_by)
     values ($1, 1, $2::text, '본문', 'HABIT', $3::date, 'BOTH',
             public.lf_content_hash($2::text, '본문', 'HABIT', $3::date, 'BOTH', null, null, 1), $4)`,
    [input.id, input.title, versionEndDate, input.creatorId],
  );
  await db.asAdmin(
    `update public.promises p
        set current_version_id = v.id
       from public.promise_versions v
      where p.id = $1 and v.promise_id = p.id and v.version_no = 1`,
    [input.id],
  );
  await db.asAdmin(
    `insert into public.promise_participants (promise_id, user_id, role, status)
     values ($1, $2, 'CREATOR', 'JOINED')`,
    [input.id, input.creatorId],
  );
  if (input.partnerId !== undefined) {
    await db.asAdmin(
      `insert into public.promise_participants (promise_id, user_id, role, status)
       values ($1, $2, 'PARTNER', 'JOINED')`,
      [input.id, input.partnerId],
    );
  }
  if (input.witnessId !== undefined) {
    await db.asAdmin(
      `insert into public.promise_participants (promise_id, user_id, role, status)
       values ($1, $2, 'WITNESS', 'JOINED')`,
      [input.id, input.witnessId],
    );
  }
}

async function listHome(input: {
  actor: string;
  tab: PromiseHomeTab;
  cursor?: PromiseHomeCursor | null;
  now?: string;
}): Promise<PromiseHomeListResponse> {
  const { rows } = await db.asAdmin(
    `select public.lf_promise_home_list($1, $2, $3::jsonb, $4::timestamptz) as result`,
    [
      input.actor,
      input.tab,
      input.cursor === undefined || input.cursor === null
        ? null
        : JSON.stringify(input.cursor),
      input.now ?? '2026-08-16T00:00:00Z',
    ],
  );
  const result = asPromiseHomeListResponse(rows[0]?.['result'], input.tab);
  if (result === null) throw new Error('INVALID_HOME_RESPONSE');
  return result;
}

function fixedId(prefix: string, index: number): string {
  return `${prefix}0000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('lf_promise_home_list — F-10 account home', () => {
  test('joined 역할만 보며 작성자·상대방·증인 메타데이터와 전체 탭 count를 반환한다', async () => {
    const creator = await createUser(db, '홈작성자');
    const partner = await createUser(db, '홈상대방');
    const witness = await createUser(db, '홈증인');
    const outsider = await createUser(db, '홈외부인');
    await db.asAdmin(
      `update public.users set profile_image_url = 'https://example.com/partner.jpg' where id = $1`,
      [partner],
    );
    const activeId = 'a1000000-0000-4000-8000-000000000001';
    await insertPromise({
      id: activeId,
      creatorId: creator,
      partnerId: partner,
      witnessId: witness,
      status: 'ACTIVE',
      title: '함께 걷기',
      endDate: '2026-08-30',
    });
    await insertPromise({
      id: 'a1000000-0000-4000-8000-000000000002',
      creatorId: creator,
      status: 'DRAFT',
      title: '작성 중 약속',
    });
    await insertPromise({
      id: 'a1000000-0000-4000-8000-000000000003',
      creatorId: creator,
      partnerId: partner,
      status: 'COMPLETED',
      title: '끝난 약속',
      endDate: '2026-08-01',
      closedAt: '2026-08-15T00:00:00Z',
    });

    const creatorView = await listHome({ actor: creator, tab: 'ACTIVE' });
    const witnessView = await listHome({ actor: witness, tab: 'ACTIVE' });
    const outsiderView = await listHome({ actor: outsider, tab: 'ACTIVE' });

    expect(creatorView.counts).toEqual({ ACTIVE: 1, WAITING: 1, COMPLETED: 1 });
    expect(creatorView.items[0]).toMatchObject({
      promise_id: activeId,
      my_role: 'CREATOR',
      creator: { nickname: '홈작성자', profile_image_url: null },
      partner: {
        nickname: '홈상대방',
        profile_image_url: 'https://example.com/partner.jpg',
      },
      has_witness: true,
    });
    expect(witnessView.items[0]).toMatchObject({ promise_id: activeId, my_role: 'WITNESS' });
    expect(outsiderView).toMatchObject({
      items: [],
      pinned: [],
      counts: { ACTIVE: 0, WAITING: 0, COMPLETED: 0 },
    });

    await db.asAdmin(`update public.promises set hidden_by = jsonb_build_array($1::text) where id = $2`, [
      creator,
      activeId,
    ]);
    expect((await listHome({ actor: creator, tab: 'ACTIVE' })).items).toEqual([]);
  });

  test('WAITING은 작성자에게만 보이고 nullable DRAFT 날짜와 updated_at 최신순을 지킨다', async () => {
    const creator = await createUser(db, '대기작성자');
    const partner = await createUser(db, '대기상대방');
    const olderId = 'b1000000-0000-4000-8000-000000000001';
    const newerId = 'b1000000-0000-4000-8000-000000000002';
    await insertPromise({
      id: olderId,
      creatorId: creator,
      partnerId: partner,
      status: 'PENDING',
      title: '이전 승인 대기',
      endDate: '2026-08-30',
      updatedAt: '2026-08-15T00:00:00Z',
    });
    await insertPromise({
      id: newerId,
      creatorId: creator,
      status: 'DRAFT',
      title: '최근 초안',
      updatedAt: '2026-08-16T00:00:00Z',
    });

    const creatorView = await listHome({ actor: creator, tab: 'WAITING' });
    const partnerView = await listHome({ actor: partner, tab: 'WAITING' });

    expect(creatorView.items.map((item) => item.promise_id)).toEqual([newerId, olderId]);
    expect(creatorView.items[0]).toMatchObject({ status: 'DRAFT', end_date: null, partner: null });
    expect(partnerView.items).toEqual([]);
  });

  test('ACTIVE 임박은 KST D-0..D-3와 모든 CHECKING만 고정하고 일반 목록과 중복하지 않는다', async () => {
    const actor = await createUser(db, '임박작성자');
    const rows = [
      ['c1000000-0000-4000-8000-000000000001', 'ACTIVE', '2026-08-16'],
      ['c1000000-0000-4000-8000-000000000002', 'ACTIVE', '2026-08-19'],
      ['c1000000-0000-4000-8000-000000000003', 'ACTIVE', '2026-08-20'],
      ['c1000000-0000-4000-8000-000000000004', 'CHECKING', '2026-08-15'],
      ['c1000000-0000-4000-8000-000000000005', 'AMEND_PENDING', '2026-08-17'],
    ] as const;
    for (const [id, status, endDate] of rows) {
      await insertPromise({ id, creatorId: actor, status, title: id, endDate });
    }

    const beforeMidnight = await listHome({
      actor,
      tab: 'ACTIVE',
      now: '2026-08-16T14:59:59Z',
    });
    const afterMidnight = await listHome({
      actor,
      tab: 'ACTIVE',
      now: '2026-08-16T15:00:00Z',
    });

    expect(beforeMidnight.counts.ACTIVE).toBe(5);
    expect(beforeMidnight.pinned.map((item) => item.promise_id)).toEqual([
      rows[3][0],
      rows[0][0],
      rows[1][0],
    ]);
    expect(beforeMidnight.items.map((item) => item.promise_id)).toEqual([
      rows[4][0],
      rows[2][0],
    ]);
    expect(afterMidnight.pinned.map((item) => item.promise_id)).toEqual([
      rows[3][0],
      rows[1][0],
      rows[2][0],
    ]);
    expect(afterMidnight.items.map((item) => item.promise_id)).toContain(rows[0][0]);
  });

  test('ACTIVE 일반 목록은 20건 cursor 뒤 남은 한 건을 중복·누락 없이 반환한다', async () => {
    const actor = await createUser(db, '활성페이지작성자');
    const ids = Array.from({ length: PROMISE_HOME_PAGE_SIZE + 1 }, (_, index) =>
      fixedId('d', index + 1),
    );
    for (const id of ids) {
      await insertPromise({
        id,
        creatorId: actor,
        status: 'ACTIVE',
        title: id,
        endDate: '2026-09-30',
      });
    }

    const first = await listHome({ actor, tab: 'ACTIVE' });
    const second = await listHome({ actor, tab: 'ACTIVE', cursor: first.next_cursor });

    expect(first.items.map((item) => item.promise_id)).toEqual(ids.slice(0, 20));
    expect(first.next_cursor).toEqual({
      tab: 'ACTIVE',
      status_rank: 1,
      end_date: '2026-09-30',
      promise_id: ids[19],
    });
    expect(second.items.map((item) => item.promise_id)).toEqual(ids.slice(20));
    expect(second.next_cursor).toBeNull();
  });

  test('WAITING cursor는 같은 updated_at에서도 UUID 내림차순을 이어간다', async () => {
    const actor = await createUser(db, '대기페이지작성자');
    const ids = [
      'e1000000-0000-4000-8000-000000000003',
      'e1000000-0000-4000-8000-000000000002',
      'e1000000-0000-4000-8000-000000000001',
    ];
    for (const id of ids) {
      await insertPromise({
        id,
        creatorId: actor,
        status: 'DRAFT',
        title: id,
        updatedAt: '2026-08-16T00:00:00Z',
      });
    }
    for (let index = 4; index <= 21; index += 1) {
      await insertPromise({
        id: fixedId('e', index),
        creatorId: actor,
        status: 'DRAFT',
        title: `이전 ${index}`,
        updatedAt: '2026-08-15T00:00:00Z',
      });
    }

    const first = await listHome({ actor, tab: 'WAITING' });
    const second = await listHome({ actor, tab: 'WAITING', cursor: first.next_cursor });
    const combined = [...first.items, ...second.items].map((item) => item.promise_id);

    expect(first.items.slice(0, 3).map((item) => item.promise_id)).toEqual(ids);
    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(1);
    expect(new Set(combined).size).toBe(21);
  });

  test('COMPLETED는 closed_at 최신순·null 마지막·updated_at·UUID 순으로 page를 잇는다', async () => {
    const actor = await createUser(db, '완료페이지작성자');
    const ids = [
      'f1000000-0000-4000-8000-000000000003',
      'f1000000-0000-4000-8000-000000000002',
      'f1000000-0000-4000-8000-000000000001',
    ];
    const fixtures = [
      { id: ids[0]!, closedAt: '2026-08-16T00:00:00Z', updatedAt: '2026-08-16T00:00:00Z' },
      { id: ids[1]!, closedAt: '2026-08-15T00:00:00Z', updatedAt: '2026-08-16T00:00:00Z' },
      { id: ids[2]!, closedAt: null, updatedAt: '2026-08-17T00:00:00Z' },
    ];
    for (const fixture of fixtures) {
      await insertPromise({
        ...fixture,
        creatorId: actor,
        status: 'DISPUTED',
        title: fixture.id,
        endDate: '2026-08-01',
      });
    }

    const result = await listHome({ actor, tab: 'COMPLETED' });
    expect(result.items.map((item) => item.promise_id)).toEqual(ids);
  });

  test('CHECKING 응답 필요는 작성자·상대방에게만 계산하고 증인은 false다', async () => {
    const creator = await createUser(db, '응답작성자');
    const partner = await createUser(db, '응답상대방');
    const witness = await createUser(db, '응답증인');
    const promiseId = '01000000-0000-4000-8000-000000000001';
    await insertPromise({
      id: promiseId,
      creatorId: creator,
      partnerId: partner,
      witnessId: witness,
      status: 'CHECKING',
      title: '응답 약속',
      endDate: '2026-08-15',
    });
    await db.asAdmin(
      `insert into public.fulfillment_checks
         (promise_id, version_id, user_id, round_no, answer, surface, submitted_at)
       select p.id, p.current_version_id, $2, 1, 'KEPT', 'APP', '2026-08-16T00:00:00Z'
         from public.promises p
        where p.id = $1`,
      [promiseId, creator],
    );

    expect((await listHome({ actor: creator, tab: 'ACTIVE' })).pinned[0]?.needs_response).toBe(false);
    expect((await listHome({ actor: partner, tab: 'ACTIVE' })).pinned[0]?.needs_response).toBe(true);
    expect((await listHome({ actor: witness, tab: 'ACTIVE' })).pinned[0]?.needs_response).toBe(false);
  });

  test('히스토리 4탭은 종결 상태를 판정 없이 분류하고 레거시 COMPLETED 탭은 그대로다 (ADR 0011)', async () => {
    const creator = await createUser(db, '히스토리작성자');
    const statuses: readonly [string, string][] = [
      ['COMPLETED', 'h1'],
      ['BROKEN', 'h2'],
      ['DISPUTED', 'h3'],
      ['UNRESOLVED', 'h4'],
      ['DECLINED', 'h5'],
      ['CANCELED', 'h6'],
    ];
    for (const [index, [status]] of statuses.entries()) {
      await insertPromise({
        id: fixedId('9', index + 1),
        creatorId: creator,
        status,
        title: `종결 ${status}`,
        endDate: '2026-08-10',
        closedAt: `2026-08-1${index}T00:00:00Z`,
      });
    }
    await insertPromise({
      id: fixedId('9', 7),
      creatorId: creator,
      status: 'ACTIVE',
      title: '진행 중',
      endDate: '2026-08-30',
    });

    const done = await listHome({ actor: creator, tab: 'DONE' });
    const broken = await listHome({ actor: creator, tab: 'BROKEN' });
    const unsettled = await listHome({ actor: creator, tab: 'UNSETTLED' });
    const declined = await listHome({ actor: creator, tab: 'DECLINED' });

    expect(done.items.map((item) => item.status)).toEqual(['COMPLETED']);
    expect(broken.items.map((item) => item.status)).toEqual(['BROKEN']);
    // P1: 의견 불일치는 불이행이 아니라 미확정과 함께 중립 탭이다.
    expect(unsettled.items.map((item) => item.status).sort()).toEqual(['DISPUTED', 'UNRESOLVED']);
    expect(declined.items.map((item) => item.status).sort()).toEqual(['CANCELED', 'DECLINED']);
    // 히스토리 counts 는 4키 정확 일치 — 파서(asPromiseHomeListResponse)가 이미 강제했다.
    expect(done.counts).toEqual({ DONE: 1, BROKEN: 1, UNSETTLED: 2, DECLINED: 2 });
    expect(done.pinned).toEqual([]);

    // 레거시 탭은 구버전 설치 빌드의 계약 그대로: 전 종결 6건 + 3키 counts.
    const legacy = await listHome({ actor: creator, tab: 'COMPLETED' });
    expect(legacy.items).toHaveLength(6);
    expect(legacy.counts).toEqual({ ACTIVE: 1, WAITING: 0, COMPLETED: 6 });
  });

  test('히스토리 탭도 숨긴 약속을 제외하고 종결 cursor 로 page 를 잇는다', async () => {
    const creator = await createUser(db, '히스토리페이지');
    for (let index = 1; index <= PROMISE_HOME_PAGE_SIZE + 1; index += 1) {
      await insertPromise({
        id: fixedId('8', index),
        creatorId: creator,
        status: 'COMPLETED',
        title: `완료 ${index}`,
        endDate: '2026-08-10',
        closedAt: `2026-07-${String((index % 28) + 1).padStart(2, '0')}T00:00:00Z`,
      });
    }
    // 한 건을 숨긴다 — 홈과 같은 hidden_by 술어를 히스토리도 쓴다.
    await db.asAdmin(
      `update public.promises set hidden_by = jsonb_build_object($2::text, true)
        where id = $1`,
      [fixedId('8', 1), creator],
    );

    const first = await listHome({ actor: creator, tab: 'DONE' });
    expect(first.items).toHaveLength(PROMISE_HOME_PAGE_SIZE);
    expect(first.next_cursor).toBeNull();
    expect(first.counts['DONE']).toBe(PROMISE_HOME_PAGE_SIZE);
    expect(first.items.map((item) => item.promise_id)).not.toContain(fixedId('8', 1));
  });

  test('RPC는 빈 search_path SECURITY DEFINER이며 service_role만 실행한다', async () => {
    const metadata = await db.asAdmin(
      `select p.prosecdef, p.proconfig
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'lf_promise_home_list'`,
    );
    expect(metadata.rows).toEqual([{ prosecdef: true, proconfig: ['search_path=""'] }]);

    const privileges = await db.asAdmin(
      `select has_function_privilege(
                'anon',
                'public.lf_promise_home_list(uuid,text,jsonb,timestamp with time zone)',
                'EXECUTE'
              ) as anon,
              has_function_privilege(
                'authenticated',
                'public.lf_promise_home_list(uuid,text,jsonb,timestamp with time zone)',
                'EXECUTE'
              ) as authenticated,
              has_function_privilege(
                'service_role',
                'public.lf_promise_home_list(uuid,text,jsonb,timestamp with time zone)',
                'EXECUTE'
              ) as service_role`,
    );
    expect(privileges.rows[0]).toEqual({ anon: false, authenticated: false, service_role: true });
  });
});
