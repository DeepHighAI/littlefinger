import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { LEGAL_DOCUMENTS } from '../../packages/shared/src/legal.ts';
import { createTestDb, type TestDb } from './harness.ts';

/**
 * 사용자 프로비저닝 — 02 §165.
 *
 * 여기서 검사하는 것은 실제로 프로덕션을 세워 놓은 구멍이다: `public.users` 에 행을 만드는
 * 코드가 없어서 `lf_assert_actor` 가 로그인한 모든 사용자를 거부했고, 하니스가 그 행을
 * 만들어 주기 때문에 987개 테스트가 전부 통과했다. 그래서 이 파일은 `createUser` 를
 * 쓰지 않는다 — auth 쪽만 만들고 public 쪽은 트리거와 RPC 에게 맡긴다.
 */

let db: TestDb;

interface UserRow {
  provider_user_id: string;
  provider: string | null;
  nickname: string;
  primary_surface: string | null;
  profile_image_url: string | null;
  status: string;
}

interface AgreementRow {
  terms_version: string;
  privacy_version: string;
}

/** auth 쪽만 만든다. public.users 는 트리거가 만들어야 한다. */
async function createAuthUser(metadata: Record<string, unknown> = {}): Promise<string> {
  const { rows } = await db.asAdmin(
    `insert into auth.users (raw_user_meta_data) values ($1) returning id`,
    [JSON.stringify(metadata)],
  );
  return String((rows[0] as { id: string }).id);
}

async function linkIdentity(
  userId: string,
  provider: 'kakao' | 'google',
  providerId: string,
  identityData: Record<string, unknown> = {},
  lastSignInAt = 'now()',
): Promise<void> {
  await db.asAdmin(
    `insert into auth.identities (user_id, provider, provider_id, identity_data, last_sign_in_at)
     values ($1, $2, $3, $4, ${lastSignInAt})`,
    [userId, provider, providerId, JSON.stringify(identityData)],
  );
}

async function linkKakao(
  userId: string,
  providerId: string,
  identityData: Record<string, unknown> = {},
): Promise<void> {
  await linkIdentity(userId, 'kakao', providerId, identityData);
}

async function userRow(userId: string): Promise<UserRow | null> {
  const { rows } = await db.asAdmin(
    `select provider_user_id, provider, nickname, primary_surface, profile_image_url,
            status::text as status
     from public.users where id = $1`,
    [userId],
  );
  return (rows[0] as unknown as UserRow) ?? null;
}

async function agreements(userId: string): Promise<AgreementRow[]> {
  const { rows } = await db.asAdmin(
    `select terms_version, privacy_version
       from public.terms_agreements
      where user_id = $1
      order by agreed_at, id`,
    [userId],
  );
  return rows as unknown as AgreementRow[];
}

async function provision(
  userId: string,
  surface: 'APP' | 'WEB',
  nickname: string | null = null,
  profileImageUrl: string | null = null,
): Promise<void> {
  await db.asAdmin(`select public.lf_user_provision($1, $2::public.surface, $3, $4)`, [
    userId,
    surface,
    nickname,
    profileImageUrl,
  ]);
}

async function messageOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('트리거가 행의 존재를 보장한다', () => {
  test('신규 auth 사용자는 같은 트랜잭션에서 현재 약관 동의 한 건을 받는다', async () => {
    const id = await createAuthUser();
    expect(await agreements(id)).toEqual([{
      terms_version: LEGAL_DOCUMENTS.TERMS.version,
      privacy_version: LEGAL_DOCUMENTS.PRIVACY.version,
    }]);
  });

  test('auth.users INSERT 만으로 public.users 행이 생긴다', async () => {
    const id = await createAuthUser();
    const row = await userRow(id);

    expect(row).not.toBeNull();
    expect(row?.provider_user_id).toBe(`pending:${id}`);
    // 트리거 시점에는 어느 프로바이더로 왔는지 알 수 없다 — provision 이 확정한다.
    expect(row?.provider).toBeNull();
  });

  test('메타데이터가 비어도 INSERT 가 죽지 않는다', async () => {
    // 카카오 profile_nickname 은 [선택 동의](§6-1)라 거부하면 키가 아예 없다.
    // 트리거가 raise 하면 auth.users INSERT 가 롤백되어 로그인 자체가 실패한다.
    const message = await messageOf(() => createAuthUser({}));
    expect(message).toBeNull();
  });

  test('primary_surface 는 NULL 이다 — 트리거는 로그인 표면을 알 수 없다', async () => {
    const id = await createAuthUser();
    expect((await userRow(id))?.primary_surface).toBeNull();
  });

  test('행이 생기기만 해서는 lf_assert_actor 를 통과한다', async () => {
    // 이것이 라이브 401 의 정체였다. 행이 있으면 통과, 없으면 E_AUTH_REQUIRED.
    const id = await createAuthUser();
    expect(await messageOf(() => db.asAdmin(`select public.lf_assert_actor($1)`, [id]))).toBeNull();
  });

  test('행이 없으면 lf_assert_actor 는 E_AUTH_REQUIRED 다', async () => {
    const { rows } = await db.asAdmin(`select gen_random_uuid() as id`);
    const ghost = String((rows[0] as { id: string }).id);
    const message = await messageOf(() => db.asAdmin(`select public.lf_assert_actor($1)`, [ghost]));
    expect(message).toContain('E_AUTH_REQUIRED');
  });
});

describe('약관 동의 기록은 서버가 한 번만 만든다', () => {
  test('기존 동의가 없는 사용자는 provision 재시도에도 현재 버전 한 건만 받는다', async () => {
    const id = await createAuthUser();
    await db.asAdmin(`delete from public.terms_agreements where user_id = $1`, [id]);

    await provision(id, 'APP');
    await provision(id, 'WEB');

    expect(await agreements(id)).toEqual([{
      terms_version: LEGAL_DOCUMENTS.TERMS.version,
      privacy_version: LEGAL_DOCUMENTS.PRIVACY.version,
    }]);
  });

  test('과거 동의가 있으면 현재 초안 버전을 암묵적으로 추가하지 않는다', async () => {
    const id = await createAuthUser();
    await db.asAdmin(`delete from public.terms_agreements where user_id = $1`, [id]);
    await db.asAdmin(
      `insert into public.terms_agreements (user_id, terms_version, privacy_version)
       values ($1, '2025-legacy', '2025-legacy')`,
      [id],
    );

    await provision(id, 'APP');

    expect(await agreements(id)).toEqual([{
      terms_version: '2025-legacy',
      privacy_version: '2025-legacy',
    }]);
  });

  test('DB 현재 버전과 공유 계약 버전이 일치한다', async () => {
    const { rows } = await db.asAdmin(
      `select public.lf_current_terms_version() as terms_version,
              public.lf_current_privacy_version() as privacy_version`,
    );
    expect(rows[0]).toEqual({
      terms_version: LEGAL_DOCUMENTS.TERMS.version,
      privacy_version: LEGAL_DOCUMENTS.PRIVACY.version,
    });
  });

  test('같은 사용자와 버전 조합은 중복할 수 없다', async () => {
    const id = await createAuthUser();
    await expect(
      db.asAdmin(
        `insert into public.terms_agreements (user_id, terms_version, privacy_version)
         values ($1, $2, $3)`,
        [id, LEGAL_DOCUMENTS.TERMS.version, LEGAL_DOCUMENTS.PRIVACY.version],
      ),
    ).rejects.toThrow(/unique/iu);
  });

  test('약관 버전 기록 실패는 auth와 public 사용자까지 원자적으로 롤백한다', async () => {
    const { rows } = await db.asAdmin(`select gen_random_uuid() as id`);
    const id = String((rows[0] as { id: string }).id);

    await db.execAdmin(`
      create or replace function public.lf_current_terms_version()
      returns text language plpgsql immutable set search_path = ''
      as $$ begin raise exception 'F01_TEST_FAILURE'; end; $$;
    `);
    try {
      await expect(
        db.asAdmin(`insert into auth.users (id) values ($1)`, [id]),
      ).rejects.toThrow(/F01_TEST_FAILURE/iu);
      const remaining = await db.asAdmin(
        `select
           (select count(*)::int from auth.users where id = $1) as auth_count,
           (select count(*)::int from public.users where id = $1) as public_count,
           (select count(*)::int from public.terms_agreements where user_id = $1) as agreement_count`,
        [id],
      );
      expect(remaining.rows[0]).toEqual({ auth_count: 0, public_count: 0, agreement_count: 0 });
    } finally {
      // 마이그레이션 상태 그대로 되돌린다 — 현재 버전의 정본은 shared LEGAL_DOCUMENTS 다.
      await db.execAdmin(`
        create or replace function public.lf_current_terms_version()
        returns text language sql immutable set search_path = ''
        as $$ select '${LEGAL_DOCUMENTS.TERMS.version}'::text $$;
      `);
    }
  });
});

describe('lf_user_provision 이 대진값을 실값으로 보정한다', () => {
  test('provider_user_id 를 auth.identities.provider_id 에서 읽는다', async () => {
    const id = await createAuthUser();
    await linkKakao(id, '1234567890', { name: '지우' });

    await provision(id, 'WEB', '지우');

    const row = await userRow(id);
    expect(row?.provider_user_id).toBe('1234567890');
    expect(row?.provider).toBe('kakao');
  });

  test('Google 신원만 있어도 정체성이 확정된다 — pending 잔류 회귀 방지', async () => {
    // Google SSO 도입(PO 2026-08-20) 전에는 provider='kakao' 고정이라 Google 사용자의
    // 식별자가 영원히 pending 으로 남았다 — 탈퇴 해시·재가입 비승계가 무의미해지는 구멍.
    const id = await createAuthUser();
    await linkIdentity(id, 'google', 'google-sub-001', { name: '구글사용자' });

    await provision(id, 'APP', '구글사용자');

    const row = await userRow(id);
    expect(row?.provider_user_id).toBe('google-sub-001');
    expect(row?.provider).toBe('google');
  });

  test('카카오·구글 신원이 모두 있으면 가장 최근 로그인 쪽을 쓴다', async () => {
    const id = await createAuthUser();
    await linkIdentity(id, 'kakao', '1334567890', {}, `now() - interval '1 hour'`);
    await linkIdentity(id, 'google', 'google-sub-002', {}, 'now()');

    await provision(id, 'APP', '지우');

    const row = await userRow(id);
    expect(row?.provider_user_id).toBe('google-sub-002');
    expect(row?.provider).toBe('google');
  });

  test('닉네임과 프로필 이미지를 채운다', async () => {
    const id = await createAuthUser();
    await linkKakao(id, '2234567890');

    await provision(id, 'APP', '민준', 'https://example.test/a.jpg');

    const row = await userRow(id);
    expect(row?.nickname).toBe('민준');
    expect(row?.profile_image_url).toBe('https://example.test/a.jpg');
  });

  test('카카오 CDN 의 HTTP 프로필 이미지는 HTTPS 로 승격한다', async () => {
    const id = await createAuthUser();
    await linkKakao(id, '2734567890');

    await provision(id, 'APP', '민준', 'http://k.kakaocdn.net/a.jpg');

    expect((await userRow(id))?.profile_image_url).toBe('https://k.kakaocdn.net/a.jpg');
  });

  test('그 밖의 비HTTPS 프로필 이미지는 DB 경계에서도 거절한다', async () => {
    const id = await createAuthUser();
    await linkKakao(id, '2834567890');

    expect(await messageOf(() => provision(
      id,
      'APP',
      '민준',
      'http://example.test/a.jpg',
    ))).toContain('E_VALIDATION');
    expect((await userRow(id))?.profile_image_url).toBeNull();
  });

  test('닉네임이 없으면 대진값을 유지하고 죽지 않는다', async () => {
    const id = await createAuthUser();
    await linkKakao(id, '3234567890');

    await provision(id, 'WEB', null);

    expect((await userRow(id))?.nickname).toBe('사용자');
  });

  test('공백뿐인 닉네임은 없는 것으로 본다', async () => {
    const id = await createAuthUser();
    await linkKakao(id, '4234567890');

    await provision(id, 'WEB', '   ');

    expect((await userRow(id))?.nickname).toBe('사용자');
  });

  test('빈 문자열 프로필 이미지는 없는 것으로 본다 — 실값을 덮지 않는다', async () => {
    // coalesce('', 기존값) 은 '' 가 이긴다. nullif 없이는 사용자가 updateUser({data}) 로
    // avatar_url: '' 를 넣는 순간 실제 URL 이 빈 문자열로 덮인다(2026-07-30 리뷰에서 확정).
    // 같은 마이그레이션의 백필은 nullif 를 쓰고 있었다 — 누락이지 설계가 아니다.
    const id = await createAuthUser();
    await linkKakao(id, '4334567890');

    await provision(id, 'WEB', '지우', 'https://example.test/a.jpg');
    await provision(id, 'WEB', '지우', '');

    expect((await userRow(id))?.profile_image_url).toBe('https://example.test/a.jpg');
  });

  test('40 코드포인트를 넘는 닉네임은 잘라서 저장한다 — 보정 전체가 죽지 않는다', async () => {
    // users.nickname 은 varchar(40)이고 Postgres 는 초과 시 22001 을 raise 한다(절삭 없음).
    // 그 오류는 §2-3 표에 없어 500 이 되고, 문장 전체가 abort 라 provider_user_id 채움까지 같이
    // 막힌다 — user_metadata.name 은 사용자가 임의로 쓸 수 있는 자리라 실재하는 경로다.
    const id = await createAuthUser();
    await linkKakao(id, '4434567890');

    await provision(id, 'WEB', '가'.repeat(50));

    const row = await userRow(id);
    expect(row?.nickname).toBe('가'.repeat(40));
    expect(row?.provider_user_id).toBe('4434567890');
  });

  test('카카오 신원이 아직 없으면 provider_user_id 는 대진값으로 남는다', async () => {
    const id = await createAuthUser();

    await provision(id, 'APP', '아직');

    expect((await userRow(id))?.provider_user_id).toBe(`pending:${id}`);
  });

  test('행이 아예 없어도 만들어 낸다 — 트리거 이전 계정', async () => {
    const id = await createAuthUser();
    await db.asAdmin(`delete from public.users where id = $1`, [id]);
    await linkKakao(id, '5234567890', { name: '백필' });

    await provision(id, 'WEB', '백필');

    expect((await userRow(id))?.provider_user_id).toBe('5234567890');
  });
});

describe('primary_surface 는 최초 가입 표면이다 — 먼저 쓴 값이 이긴다', () => {
  test('첫 보정이 값을 정한다', async () => {
    const id = await createAuthUser();
    await linkKakao(id, '6234567890');

    await provision(id, 'WEB', '지우');

    expect((await userRow(id))?.primary_surface).toBe('WEB');
  });

  test('두 번째 보정은 표면을 움직이지 않는다', async () => {
    const id = await createAuthUser();
    await linkKakao(id, '7234567890');

    await provision(id, 'WEB', '지우');
    await provision(id, 'APP', '지우');

    expect((await userRow(id))?.primary_surface).toBe('WEB');
  });

  test('표면은 고정돼도 닉네임은 계속 갱신된다', async () => {
    const id = await createAuthUser();
    await linkKakao(id, '8234567890');

    await provision(id, 'APP', '옛이름');
    await provision(id, 'WEB', '새이름');

    const row = await userRow(id);
    expect(row?.primary_surface).toBe('APP');
    expect(row?.nickname).toBe('새이름');
  });
});

describe('provider_user_id 는 계정 동일성의 기준이라 덮이지 않는다', () => {
  test('EC-A05 실값이 들어간 뒤에는 다른 카카오 신원으로 바뀌지 않는다', async () => {
    const id = await createAuthUser();
    await linkKakao(id, '9234567890');
    await provision(id, 'APP', '지우');

    // 같은 사용자에 두 번째 카카오 신원이 붙고 그쪽이 더 최근이어도(EC-A05),
    // 이미 확정된 provider_user_id 는 움직이지 않는다.
    await linkKakao(id, '9999999999');
    await provision(id, 'APP', '지우');

    expect((await userRow(id))?.provider_user_id).toBe('9234567890');
  });

  test('확정된 정체성은 다른 프로바이더 로그인으로도 바뀌지 않는다', async () => {
    const id = await createAuthUser();
    await linkKakao(id, '9334567890');
    await provision(id, 'APP', '지우');

    await linkIdentity(id, 'google', 'google-sub-003');
    await provision(id, 'WEB', '지우');

    const row = await userRow(id);
    expect(row?.provider_user_id).toBe('9334567890');
    expect(row?.provider).toBe('kakao');
  });
});

describe('ACTIVE 가 아닌 계정은 손대지 않는다', () => {
  test('탈퇴 계정의 비식별화를 되돌리지 않는다', async () => {
    // §6-5 는 탈퇴 시 nickname → '탈퇴한 사용자', profile_image_url → NULL 을 요구한다.
    // 재로그인이 그것을 되살리면 비식별화가 무의미해진다.
    const id = await createAuthUser();
    await linkKakao(id, '1034567890');
    await provision(id, 'APP', '지우', 'https://example.test/a.jpg');

    await db.asAdmin(
      `update public.users
       set status = 'WITHDRAWN', nickname = '탈퇴한 사용자', profile_image_url = null
       where id = $1`,
      [id],
    );

    await provision(id, 'APP', '지우', 'https://example.test/a.jpg');

    const row = await userRow(id);
    expect(row?.nickname).toBe('탈퇴한 사용자');
    expect(row?.profile_image_url).toBeNull();
    expect(row?.status).toBe('WITHDRAWN');
  });
});

describe('서버 전용이다', () => {
  test('authenticated 는 lf_user_provision 을 부를 수 없다', async () => {
    const id = await createAuthUser();
    const message = await messageOf(() =>
      db.asUser(id, `select public.lf_user_provision($1, 'APP'::public.surface, '나')`, [id]),
    );
    expect(message).toContain('permission denied');
  });

  test('anon 도 부를 수 없다', async () => {
    const id = await createAuthUser();
    const message = await messageOf(() =>
      db.asAnon(`select public.lf_user_provision($1, 'WEB'::public.surface, '나')`, [id]),
    );
    expect(message).toContain('permission denied');
  });

  test('클라이언트는 자기 users 행도 UPDATE 할 수 없다', async () => {
    // "users update own" 은 컬럼 무제한 self-UPDATE 라 provider_user_id(EC-A05 계정 동일성 키)·
    // status·email_verified·primary_surface 를 PostgREST 로 직접 쓸 수 있게 한다 —
    // 이 파일이 지키는 규칙 전부(먼저 쓴 값이 이긴다, 실값은 덮이지 않는다, ACTIVE 만)를
    // 우회하는 구멍이다. 클라이언트 쓰기 경로는 user-provision 하나여야 하므로 정책째
    // 드랍한다(20260730000012). 계정 안전 경계는 테이블 권한도 회수하므로 명시적으로 거부돼야 한다.
    const id = await createAuthUser();
    await linkKakao(id, '4534567890');
    await provision(id, 'APP', '지우');

    const message = await messageOf(() =>
      db.asUser(id, `update public.users set provider_user_id = 'forged' where id = $1`, [id]),
    );

    expect(message).toContain('permission denied');
    expect((await userRow(id))?.provider_user_id).toBe('4534567890');
  });

  test('클라이언트는 users 에 직접 INSERT 할 수 없다', async () => {
    // 프로비저닝을 서버에 둔 이유가 이것이다 — INSERT 정책이 없어야 provider_user_id 를
    // 사용자가 정하지 못한다.
    const id = await createAuthUser();
    const message = await messageOf(() =>
      db.asUser(
        id,
        `insert into public.users (id, provider_user_id, nickname) values ($1, 'forged', '위조')`,
        [id],
      ),
    );
    expect(message).not.toBeNull();
  });
});
