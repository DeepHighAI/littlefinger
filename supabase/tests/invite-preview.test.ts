import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { InvitePreviewResponse } from '../../packages/shared/src/api.ts';
import { ERROR_CODES } from '../../packages/shared/src/errors.ts';
import {
  createInvitation,
  createPromise,
  createTestDb,
  createUser,
  type TestDb,
} from './harness.ts';

/**
 * `lf_invite_preview` — 02 §4-3-4 (SCR-W02 약속 검토, 로그인 후).
 *
 * 승인의 **읽기 쌍둥이**다. 그래서 이 파일이 붙들어야 하는 것은 두 가지다.
 *
 * 1. **가드가 내용보다 먼저 돈다.** 승인이 거부할 사람에게 전문을 보여 주면 그것이 곧
 *    읽기 경로의 유출이다. 판정 순서가 `lf_invite_resolve` · `lf_promise_approve` 와
 *    한 칸이라도 어긋나면 링크는 열리는데 승인이 안 되는(또는 그 반대의) 상태가 생긴다.
 * 2. **읽기가 초대를 소모하지 않는다.** 검토 화면은 새로고침·뒤로가기로 몇 번이든 다시
 *    열린다(EC-A01). 한 번 본 것이 소모라면 사용자는 자기가 방금 읽은 약속을 승인할 수 없다.
 *
 * 순서 테스트는 **가드를 두 개씩 겹쳐서** 건다. 하나만 위반하는 픽스처로는 순서가 바뀌어도
 * 전부 통과하기 때문에 그건 순서를 검사하지 않는 것이나 같다.
 */

let db: TestDb;

const MIGRATION = join(__dirname, '../migrations/20260727000010_invite_preview.sql');

/**
 * §4-3-4 표시 요소. 목록이 아니라 **전부**다 — 하나라도 더 있으면 실패한다.
 *
 * 손으로 적지 않고 계약 타입에서 뽑는다. 같은 목록이 마이그레이션의 `jsonb_build_object` ·
 * `InvitePreviewResponse` · 이 파일 세 곳에 있는데, 셋 다 손으로 유지하면 갈라져도 아무도
 * 못 잡는다 — 실제로 `InvitePreviewResponse` 는 어디에서도 참조되지 않아 필드를 지워도
 * 깨지는 것이 없었다. `Record<keyof …>` 는 타입에서 필드가 사라지거나 늘면 타입 검사에서
 * 깨지고, 아래 동등 비교는 SQL 이 갈라지면 깨진다. 두 방향이 다 막힌다.
 */
const RESPONSE_SHAPE: Record<keyof InvitePreviewResponse, true> = {
  body: true,
  category: true,
  creator: true,
  end_date: true,
  keeper: true,
  penalty: true,
  reward: true,
  title: true,
  witness_enabled: true,
};

const ALLOWED_KEYS = Object.keys(RESPONSE_SHAPE).sort();

interface Fixture {
  creatorId: string;
  partnerId: string;
  promiseId: string;
  tokenHash: string;
}

async function seed(
  options: {
    targetRole?: 'PARTNER' | 'WITNESS';
    status?: 'PENDING' | 'USED' | 'EXPIRED' | 'REVOKED';
    expiresInSeconds?: number;
    promiseStatus?: string;
    endDateOffsetDays?: number;
  } = {},
): Promise<Fixture> {
  const creatorId = await createUser(db, `c${randomUUID().slice(0, 8)}`);
  const partnerId = await createUser(db, `p${randomUUID().slice(0, 8)}`);
  const promiseId = await createPromise(db, {
    creatorId,
    status: options.promiseStatus ?? 'PENDING',
    ...(options.endDateOffsetDays !== undefined
      ? { endDateOffsetDays: options.endDateOffsetDays }
      : {}),
  });
  const tokenHash = await createInvitation(db, {
    promiseId,
    createdBy: creatorId,
    ...(options.targetRole !== undefined ? { targetRole: options.targetRole } : {}),
    ...(options.status !== undefined ? { status: options.status } : {}),
    ...(options.expiresInSeconds !== undefined
      ? { expiresInSeconds: options.expiresInSeconds }
      : {}),
  });
  return { creatorId, partnerId, promiseId, tokenHash };
}

async function preview(tokenHash: string, userId: string): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(`select public.lf_invite_preview($1, $2) as r`, [
    tokenHash,
    userId,
  ]);
  return (rows[0] as { r: Record<string, unknown> }).r;
}

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.asAdmin(sql, params);
  return rows[0] as T;
}

function fakeHash(seedText: string): string {
  return createHash('sha256').update(seedText).digest('hex');
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('성공 경로 — §4-3-4 표시 요소', () => {
  test('전문·종료일·보상/벌칙·지킬 사람·작성자 프로필·증인 여부를 돌려준다', async () => {
    const f = await seed();
    const creator = await one<{ nickname: string }>(
      `select nickname from public.users where id = $1`,
      [f.creatorId],
    );

    const result = await preview(f.tokenHash, f.partnerId);

    expect(result).toMatchObject({
      title: '매일 걷기',
      body: '매일 30분 걷기로 했다',
      category: 'HABIT',
      keeper: 'BOTH',
      reward: '커피 한 잔',
      penalty: '설거지 1주일',
      witness_enabled: false,
      creator: { nickname: creator.nickname, profile_image_url: null },
    });
  });

  test('응답 키 집합이 화이트리스트와 정확히 일치한다', async () => {
    // 부분집합이 아니라 **동등** 비교다. select 목록에 컬럼이 하나라도 늘면 여기서 깨진다.
    const f = await seed();
    expect(Object.keys(await preview(f.tokenHash, f.partnerId)).sort()).toEqual(ALLOWED_KEYS);
  });

  test('버전 이력을 담지 않는다 — 별도 PO 항목이다', async () => {
    const f = await seed();
    const keys = Object.keys(await preview(f.tokenHash, f.partnerId));

    for (const forbidden of ['versions', 'version_no', 'history', 'promise_id', 'content_hash']) {
      expect(keys).not.toContain(forbidden);
    }
  });

  test('종료일은 날짜 그대로 보낸다 — D-Day 는 클라이언트가 KST 로 센다', async () => {
    // 서버가 미리 계산해 문자열로 내려보내면 자정을 넘긴 화면이 갱신되지 않는다.
    const f = await seed({ endDateOffsetDays: 7 });
    const result = await preview(f.tokenHash, f.partnerId);

    expect(result['end_date']).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(Object.keys(result)).not.toContain('d_day');
  });

  test('증인 사용 예정이면 witness_enabled 가 true 다', async () => {
    const f = await seed();
    await db.asAdmin(`update public.promises set witness_enabled = true where id = $1`, [
      f.promiseId,
    ]);
    expect((await preview(f.tokenHash, f.partnerId))['witness_enabled']).toBe(true);
  });

  test('내용은 promises 캐시가 아니라 promise_versions 에서 읽는다 — EC-C04', async () => {
    // 둘이 어긋나면 버전 테이블이 정답이다(§4-2-2.1). 캐시를 읽고 있으면 여기서 걸린다.
    const f = await seed();
    await db.asAdmin(`update public.promises set title = 'CACHE_TITLE', body = 'CACHE_BODY' where id = $1`, [
      f.promiseId,
    ]);
    await db.asAdmin(
      `update public.promise_versions set title = 'VERSION_TITLE', body = 'VERSION_BODY'
        where promise_id = $1`,
      [f.promiseId],
    );

    const result = await preview(f.tokenHash, f.partnerId);

    expect(result['title']).toBe('VERSION_TITLE');
    expect(result['body']).toBe('VERSION_BODY');
  });

  test('보상·벌칙이 비어 있으면 null 이다', async () => {
    const f = await seed();
    await db.asAdmin(
      `update public.promise_versions set reward = null, penalty = null where promise_id = $1`,
      [f.promiseId],
    );

    const result = await preview(f.tokenHash, f.partnerId);

    expect(result['reward']).toBeNull();
    expect(result['penalty']).toBeNull();
  });

  test('T-05 가 남긴 자기 PARTNER 행이 있어도 열람할 수 있다', async () => {
    // 수정 제안이 상대 user_id 를 미리 남긴다. 막으면 재발송 후 검토가 영구히 불가능해진다.
    const f = await seed();
    await db.asAdmin(
      `insert into public.promise_participants (promise_id, user_id, role, status)
       values ($1, $2, 'PARTNER', 'INVITED')`,
      [f.promiseId, f.partnerId],
    );

    expect(await preview(f.tokenHash, f.partnerId)).toMatchObject({ title: '매일 걷기' });
  });
});

describe('불변식 위반은 조용히 넘기지 않는다', () => {
  test('확정 전 버전 행이 없으면 null 본문의 200 이 아니라 예외다', async () => {
    // `into strict` 를 `into` 로 되돌리면 v_ver 가 전부 NULL 인 채로 payload 가 만들어지고,
    // 껍데기는 그것을 **200** 으로 내보낸다. 화면은 빈 검토 화면을 그리고 사용자는 내용이
    // 없는 약속을 승인하게 된다 — 실패보다 나쁜 답이다. 예외는 ERROR_CODES 밖이라
    // 껍데기가 500 으로 뭉갠다(EC-C02).
    const f = await seed();
    await db.asAdmin(`delete from public.promise_versions where promise_id = $1`, [f.promiseId]);

    await expect(preview(f.tokenHash, f.partnerId)).rejects.toThrow(/no rows/iu);
  });
});

describe('종료일이 지나도 응답한다 — EC-B10', () => {
  test('승인은 막히지만 검토 화면은 전문을 받는다', async () => {
    // §4-3-4 는 종료일 경과 시 버튼만 비활성화하고 [종료일 변경 요청하기]를 띄우라고 한다.
    // 여기서 E_VALIDATION 을 던지면 그 출구가 통째로 사라져 약속이 PENDING 에 갇힌다.
    const f = await seed({ endDateOffsetDays: -3 });

    const result = await preview(f.tokenHash, f.partnerId);

    expect(result['title']).toBe('매일 걷기');
    // 같은 토큰으로 승인하면 그쪽은 EC-B10 으로 거절돼야 한다 — 두 판정이 짝을 이룬다.
    await expect(
      db.asAdmin(
        `select public.lf_promise_approve($1, $2, $3, 'WEB'::public.surface, $4, $5)`,
        [randomUUID(), f.tokenHash, f.partnerId, 'a'.repeat(64), 'b'.repeat(64)],
      ),
    ).rejects.toThrow('E_VALIDATION');
  });
});

describe('토큰 판정 — lf_invite_resolve 와 같은 순서', () => {
  test('없는 토큰은 E_NOT_FOUND', async () => {
    const f = await seed();
    await expect(preview(fakeHash('nobody'), f.partnerId)).rejects.toThrow('E_NOT_FOUND');
  });

  test.each([
    ['REVOKED', 'E_INVITE_REVOKED'],
    ['USED', 'E_INVITE_USED'],
    ['EXPIRED', 'E_INVITE_EXPIRED'],
  ] as const)('%s 토큰은 %s', async (status, code) => {
    const f = await seed({ status });
    await expect(preview(f.tokenHash, f.partnerId)).rejects.toThrow(code);
  });

  test('PENDING 이라도 만료 시각이 지났으면 E_INVITE_EXPIRED — J-04 지연 구간', async () => {
    const f = await seed({ status: 'PENDING', expiresInSeconds: -60 });
    await expect(preview(f.tokenHash, f.partnerId)).rejects.toThrow('E_INVITE_EXPIRED');
  });

  test('저장된 status 가 시계보다 우선한다', async () => {
    const used = await seed({ status: 'USED', expiresInSeconds: -3600 });
    await expect(preview(used.tokenHash, used.partnerId)).rejects.toThrow('E_INVITE_USED');

    const revoked = await seed({ status: 'REVOKED', expiresInSeconds: -3600 });
    await expect(preview(revoked.tokenHash, revoked.partnerId)).rejects.toThrow(
      'E_INVITE_REVOKED',
    );
  });
});

describe('resolve 와 preview 는 같은 토큰에 같은 답을 낸다 — ADR 0004', () => {
  /**
   * 두 함수는 **같은 토큰에 대한 같은 질문**을 서로 다른 순간에 받는다(SCR-W01 / SCR-W02).
   * 각각을 따로 검사하면 둘이 갈라지는 것을 아무도 못 잡는다 — 그러면 사용자는 열리는
   * 링크를 승인할 수 없거나, 열리지 않는 링크의 내용을 이미 읽은 상태가 된다.
   * 그래서 각 함수를 단독으로 보지 않고 **맞대어** 본다.
   */
  async function codeOf(run: Promise<unknown>): Promise<string> {
    return await run.then(
      () => 'OK',
      (error: Error) => error.message.trim(),
    );
  }

  test.each([
    ['없는 토큰', { missing: true }],
    ['무효화', { status: 'REVOKED' as const }],
    ['사용됨', { status: 'USED' as const }],
    ['배치 만료', { status: 'EXPIRED' as const }],
    ['시계 만료', { status: 'PENDING' as const, expiresInSeconds: -60 }],
    ['정상', {}],
  ])('%s — 두 함수의 판정이 같다', async (_label, options) => {
    const { missing, ...seedOptions } = options as {
      missing?: boolean;
      status?: 'PENDING' | 'USED' | 'EXPIRED' | 'REVOKED';
      expiresInSeconds?: number;
    };
    const f = await seed(seedOptions);
    const tokenHash = missing === true ? fakeHash('gone') : f.tokenHash;

    expect(await codeOf(preview(tokenHash, f.partnerId))).toBe(
      await codeOf(db.asAdmin(`select public.lf_invite_resolve($1)`, [tokenHash])),
    );
  });
});

describe('열람자 판정 — lf_promise_approve 와 같은 순서', () => {
  test('증인 링크는 E_FORBIDDEN — 확정 전 증인은 제목·작성자까지다(EC-D05)', async () => {
    const f = await seed({ targetRole: 'WITNESS' });
    const witnessId = await createUser(db, `w${randomUUID().slice(0, 8)}`);
    await expect(preview(f.tokenHash, witnessId)).rejects.toThrow('E_FORBIDDEN');
  });

  test('작성자가 자기 링크를 열면 E_SELF_INVITE — 내용이 아니다', async () => {
    // PO 결정 2026-07-27. 여기서 내용이 보이면 링크가 엉뚱한 사람에게 갔는지 알 길이 없어진다.
    const f = await seed();
    await expect(preview(f.tokenHash, f.creatorId)).rejects.toThrow('E_SELF_INVITE');
  });

  test('이미 다른 역할로 참여 중이면 E_DUPLICATE_ROLE', async () => {
    const f = await seed();
    const witnessId = await createUser(db, `w${randomUUID().slice(0, 8)}`);
    await db.asAdmin(
      `insert into public.promise_participants (promise_id, user_id, role, status)
       values ($1, $2, 'WITNESS', 'JOINED')`,
      [f.promiseId, witnessId],
    );

    await expect(preview(f.tokenHash, witnessId)).rejects.toThrow('E_DUPLICATE_ROLE');
  });

  test('다른 사람이 이미 PARTNER 자리를 차지했으면 E_DUPLICATE_ROLE', async () => {
    const f = await seed();
    const other = await createUser(db, `o${randomUUID().slice(0, 8)}`);
    await db.asAdmin(
      `insert into public.promise_participants (promise_id, user_id, role, status)
       values ($1, $2, 'PARTNER', 'JOINED')`,
      [f.promiseId, other],
    );

    await expect(preview(f.tokenHash, f.partnerId)).rejects.toThrow('E_DUPLICATE_ROLE');
  });

  test.each([
    ['작성자가 열람자를 차단', 'creator'],
    ['열람자가 작성자를 차단', 'viewer'],
  ] as const)('%s 해도 E_BLOCKED — 차단은 양방향이다', async (_label, direction) => {
    const f = await seed();
    const [blocker, blocked] =
      direction === 'creator' ? [f.creatorId, f.partnerId] : [f.partnerId, f.creatorId];
    await db.asAdmin(
      `insert into public.blocks (blocker_id, blocked_user_id) values ($1, $2)`,
      [blocker, blocked],
    );

    await expect(preview(f.tokenHash, f.partnerId)).rejects.toThrow('E_BLOCKED');
  });

  test('없는 사용자는 E_AUTH_REQUIRED', async () => {
    const f = await seed();
    await expect(preview(f.tokenHash, randomUUID())).rejects.toThrow('E_AUTH_REQUIRED');
  });

  test('정지된 계정은 E_FORBIDDEN', async () => {
    const f = await seed();
    await db.asAdmin(`update public.users set status = 'SUSPENDED' where id = $1`, [f.partnerId]);
    await expect(preview(f.tokenHash, f.partnerId)).rejects.toThrow('E_FORBIDDEN');
  });

  test('PENDING 이 아닌 약속은 E_STATE_CONFLICT — 승인할 수 없는 전문은 보이지 않는다', async () => {
    const f = await seed({ promiseStatus: 'DECLINED' });
    await expect(preview(f.tokenHash, f.partnerId)).rejects.toThrow('E_STATE_CONFLICT');
  });
});

describe('판정 순서 — 가드를 겹쳐서 건다', () => {
  /**
   * 하나만 위반하는 픽스처는 순서를 검사하지 못한다. 두 개를 동시에 위반시켜서
   * **먼저 나와야 하는 코드**가 나오는지 본다. 순서를 뒤집으면 여기서만 깨진다.
   */
  test('행위자 검증이 토큰 조회보다 먼저다', async () => {
    // 없는 사용자 + 없는 토큰 → 토큰의 존재 여부를 알려 줄 이유가 없다.
    await expect(preview(fakeHash('nothing'), randomUUID())).rejects.toThrow('E_AUTH_REQUIRED');
  });

  test('토큰 상태가 열람자 판정보다 먼저다', async () => {
    // 무효화된 증인 링크를 작성자가 연다 — 세 가드를 동시에 위반한다.
    const f = await seed({ targetRole: 'WITNESS', status: 'REVOKED' });
    await expect(preview(f.tokenHash, f.creatorId)).rejects.toThrow('E_INVITE_REVOKED');
  });

  test('대상 역할이 자기 초대 검사보다 먼저다', async () => {
    const f = await seed({ targetRole: 'WITNESS' });
    await expect(preview(f.tokenHash, f.creatorId)).rejects.toThrow('E_FORBIDDEN');
  });

  test('자기 초대 검사가 중복 역할 검사보다 먼저다', async () => {
    // 작성자는 **항상** CREATOR 참여자 행을 갖는다. 순서가 바뀌면 모든 자기 열람이
    // E_DUPLICATE_ROLE 로 잘못 보고되고, 사용자는 "이미 참여 중"이라는 틀린 안내를 받는다.
    const f = await seed();
    await expect(preview(f.tokenHash, f.creatorId)).rejects.toThrow('E_SELF_INVITE');
  });

  test('중복 역할 검사가 차단 검사보다 먼저다', async () => {
    const f = await seed();
    const witnessId = await createUser(db, `w${randomUUID().slice(0, 8)}`);
    await db.asAdmin(
      `insert into public.promise_participants (promise_id, user_id, role, status)
       values ($1, $2, 'WITNESS', 'JOINED')`,
      [f.promiseId, witnessId],
    );
    await db.asAdmin(`insert into public.blocks (blocker_id, blocked_user_id) values ($1, $2)`, [
      f.creatorId,
      witnessId,
    ]);

    await expect(preview(f.tokenHash, witnessId)).rejects.toThrow('E_DUPLICATE_ROLE');
  });

  test('열람자 판정이 상태 판정보다 먼저다', async () => {
    // 종결된 약속이라도 작성자 본인에게는 E_SELF_INVITE 가 먼저다 — 상태를 먼저 보면
    // 비참여자에게 "그 약속은 상태가 바뀌었다"고 알려 주는 셈이 된다(§9).
    const f = await seed({ promiseStatus: 'DECLINED' });
    await expect(preview(f.tokenHash, f.creatorId)).rejects.toThrow('E_SELF_INVITE');
  });
});

describe('실패 응답은 아무것도 흘리지 않는다 — EC-B01·B11', () => {
  test.each(['USED', 'EXPIRED', 'REVOKED'] as const)(
    '%s 토큰의 에러에 약속 내용이 섞이지 않는다',
    async (status) => {
      const f = await seed({ status });
      await db.asAdmin(
        `update public.promise_versions
            set title = 'SENTINEL_TITLE', body = 'SENTINEL_BODY', reward = 'SENTINEL_REWARD'
          where promise_id = $1`,
        [f.promiseId],
      );

      await expect(preview(f.tokenHash, f.partnerId)).rejects.toThrow(
        expect.not.stringContaining('SENTINEL') as unknown as string,
      );
    },
  );

  test('차단된 사람의 에러에도 내용이 없다', async () => {
    const f = await seed();
    await db.asAdmin(`insert into public.blocks (blocker_id, blocked_user_id) values ($1, $2)`, [
      f.creatorId,
      f.partnerId,
    ]);
    await db.asAdmin(`update public.promise_versions set body = 'SENTINEL_BODY' where promise_id = $1`, [
      f.promiseId,
    ]);

    await expect(preview(f.tokenHash, f.partnerId)).rejects.toThrow(
      expect.not.stringContaining('SENTINEL') as unknown as string,
    );
  });

  test('예외 메시지에 토큰 해시가 실려 나가지 않는다', async () => {
    const f = await seed({ status: 'REVOKED' });
    await expect(preview(f.tokenHash, f.partnerId)).rejects.toThrow(
      expect.not.stringContaining(f.tokenHash.slice(0, 16)) as unknown as string,
    );
  });

  test('던지는 코드가 전부 ERROR_CODES 의 원소다', async () => {
    const thrown: string[] = [];
    const cases: (() => Promise<unknown>)[] = [
      async () => await preview(fakeHash('nope'), (await seed()).partnerId),
      async () => {
        const f = await seed({ status: 'USED' });
        return await preview(f.tokenHash, f.partnerId);
      },
      async () => {
        const f = await seed({ status: 'EXPIRED' });
        return await preview(f.tokenHash, f.partnerId);
      },
      async () => {
        const f = await seed({ status: 'REVOKED' });
        return await preview(f.tokenHash, f.partnerId);
      },
      async () => {
        const f = await seed({ status: 'PENDING', expiresInSeconds: -60 });
        return await preview(f.tokenHash, f.partnerId);
      },
      async () => {
        const f = await seed({ targetRole: 'WITNESS' });
        return await preview(f.tokenHash, f.partnerId);
      },
      async () => {
        const f = await seed();
        return await preview(f.tokenHash, f.creatorId);
      },
      async () => {
        const f = await seed({ promiseStatus: 'CANCELED' });
        return await preview(f.tokenHash, f.partnerId);
      },
      async () => await preview(fakeHash('x'), randomUUID()),
    ];

    for (const run of cases) {
      await run().catch((error: Error) => thrown.push(error.message.trim()));
    }

    expect(thrown).toHaveLength(cases.length);
    for (const code of thrown) {
      expect(ERROR_CODES as readonly string[]).toContain(code);
    }
  });
});

describe('preview 는 순수한 읽기다 — EC-A01', () => {
  test('여러 번 열어도 초대가 소모되지 않고 그 뒤에도 조회된다', async () => {
    const f = await seed();
    const first = await preview(f.tokenHash, f.partnerId);

    for (let i = 0; i < 5; i += 1) {
      expect(await preview(f.tokenHash, f.partnerId)).toEqual(first);
    }

    const invitation = await one<{ status: string; used_at: Date | null; used_by: string | null }>(
      `select status, used_at, used_by from public.invitations where token_hash = $1`,
      [f.tokenHash],
    );
    expect(invitation).toMatchObject({ status: 'PENDING', used_at: null, used_by: null });

    // 랜딩 화면(SCR-W01)도 그대로 열려야 한다 — 같은 토큰이다.
    await expect(
      db.asAdmin(`select public.lf_invite_resolve($1)`, [f.tokenHash]),
    ).resolves.toBeTruthy();
  });

  test('검토한 뒤에도 승인이 정상 동작한다', async () => {
    const f = await seed();
    await preview(f.tokenHash, f.partnerId);
    await preview(f.tokenHash, f.partnerId);

    await db.asAdmin(
      `select public.lf_promise_approve($1, $2, $3, 'WEB'::public.surface, $4, $5)`,
      [randomUUID(), f.tokenHash, f.partnerId, 'a'.repeat(64), 'b'.repeat(64)],
    );

    const row = await one<{ status: string }>(`select status from public.promises where id = $1`, [
      f.promiseId,
    ]);
    expect(row.status).toBe('ACTIVE');
  });

  test('약속 상태도 참여자도 바꾸지 않는다', async () => {
    const f = await seed();
    await preview(f.tokenHash, f.partnerId);

    const row = await one<{ status: string; participants: number }>(
      `select p.status,
              (select count(*)::int from public.promise_participants where promise_id = p.id)
                as participants
         from public.promises p where p.id = $1`,
      [f.promiseId],
    );
    expect(row).toMatchObject({ status: 'PENDING', participants: 1 });
  });

  test('알림도 리마인드도 만들지 않는다', async () => {
    const before = await countQueues();
    const f = await seed();
    await preview(f.tokenHash, f.partnerId);
    await preview((await seed({ status: 'USED' })).tokenHash, f.partnerId).catch(() => undefined);

    expect(await countQueues()).toEqual(before);
  });

  test('빈도 제한 카운터도 건드리지 않는다', async () => {
    // 이 함수에는 빈도 제한이 없다(껍데기 주석 참고). 여기 카운터가 늘면 `stable` 이
    // 풀렸다는 뜻이다 — 그 순간 위의 "초대를 소모하지 않는다"가 문법 보장에서 관행으로 내려간다.
    const before = await one<{ n: number }>(
      `select count(*)::int as n from public.rate_limit_counters`,
    );
    const f = await seed();
    await preview(f.tokenHash, f.partnerId);

    expect(
      await one<{ n: number }>(`select count(*)::int as n from public.rate_limit_counters`),
    ).toEqual(before);
  });

  test('함수가 stable 로 선언돼 있다', async () => {
    // 위의 행위 테스트들은 "지금은 쓰지 않는다"까지만 보증한다. `stable` 은 나중에 누가
    // UPDATE 나 `select … for update` 를 넣는 것 자체를 Postgres 가 거부하게 만드는 장치다.
    const row = await one<{ provolatile: string }>(
      `select provolatile from pg_proc
        where oid = 'public.lf_invite_preview(char(64), uuid)'::regprocedure`,
    );
    expect(row.provolatile).toBe('s');
  });
});

describe('서버 전용 — 04 §7-2', () => {
  const SIGNATURE = 'public.lf_invite_preview(char(64), uuid)';

  test.each(['anon', 'authenticated'] as const)('%s 는 execute 권한이 없다', async (role) => {
    // `from public` 만 회수하면 이 검사가 `authenticated` 에서 깨진다 — Supabase 가
    // public 스키마 기본 권한으로 두 역할에 직접 grant 해 두기 때문이다.
    const row = await one<{ allowed: boolean }>(
      `select has_function_privilege($1, $2, 'execute') as allowed`,
      [role, SIGNATURE],
    );
    expect(row.allowed).toBe(false);
  });

  test('service_role 만 부를 수 있다', async () => {
    const row = await one<{ allowed: boolean }>(
      `select has_function_privilege('service_role', $1, 'execute') as allowed`,
      [SIGNATURE],
    );
    expect(row.allowed).toBe(true);
  });

  /**
   * 거부한 **함수 이름까지** 본다. `/permission denied/` 로만 보면 이 함수가 열려 있어도
   * 안쪽의 `lf_assert_actor` 가 대신 거부하면서 테스트가 통과한다 — 변이 테스트로 확인한
   * 구멍이다. 그 상태는 실제로 위험하다: `lf_assert_actor` 는 언젠가 열릴 수도 있고,
   * 그러면 이 함수의 revoke 가 사라진 것을 아무도 모른 채 전문이 anon 에게 나간다.
   */
  const DENIED = /permission denied for function lf_invite_preview/iu;

  test('로그인한 사용자가 직접 부르면 거절된다', async () => {
    const f = await seed();
    await expect(
      db.asUser(f.partnerId, `select public.lf_invite_preview($1, $2)`, [
        f.tokenHash,
        f.partnerId,
      ]),
    ).rejects.toThrow(DENIED);
  });

  test('비로그인 방문자가 직접 불러도 거절된다', async () => {
    const f = await seed();
    await expect(
      db.asAnon(`select public.lf_invite_preview($1, $2)`, [f.tokenHash, f.partnerId]),
    ).rejects.toThrow(DENIED);
  });
});

describe('정책 수치를 코드에 박지 않는다 — CLAUDE.md §5-3', () => {
  test('만료는 expires_at 에서만 나온다 — 72 가 마이그레이션에 없다', async () => {
    const statements = readFileSync(MIGRATION, 'utf8')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    expect(statements).not.toMatch(/\b72\b/u);
  });
});

async function countQueues(): Promise<{ notifications: number; reminders: number }> {
  return await one<{ notifications: number; reminders: number }>(
    `select (select count(*) from public.notifications)::int as notifications,
            (select count(*) from public.reminder_schedules)::int as reminders`,
  );
}
