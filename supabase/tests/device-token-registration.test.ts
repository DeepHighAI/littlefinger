import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { DEVICE_TOKEN_MAX } from '../../packages/shared/src/config.ts';
import { createTestDb, createUser, type TestDb } from './harness.ts';

let db: TestDb;

interface DeviceTokenRow {
  user_id: string;
  fcm_token: string;
  last_seen_at: string;
}

async function register(userId: string, token: string): Promise<void> {
  await db.asAdmin(`select public.lf_device_token_register($1, $2)`, [userId, token]);
}

async function rowsFor(userId: string): Promise<DeviceTokenRow[]> {
  const { rows } = await db.asAdmin(
    `select user_id, fcm_token, last_seen_at::text
       from public.device_tokens
      where user_id = $1
      order by last_seen_at desc, fcm_token`,
    [userId],
  );
  return rows as unknown as DeviceTokenRow[];
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

describe('lf_device_token_register — 앱 로그인 뒤 Expo 푸시 토큰 등록', () => {
  test('새 토큰을 ANDROID 기기로 등록한다', async () => {
    const userId = await createUser(db, '지우');

    await register(userId, 'ExponentPushToken[new-device]');

    expect(await rowsFor(userId)).toMatchObject([
      {
        user_id: userId,
        fcm_token: 'ExponentPushToken[new-device]',
      },
    ]);
  });

  test('같은 토큰을 다시 등록하면 행을 늘리지 않고 last_seen_at을 갱신한다', async () => {
    const userId = await createUser(db, '민준');
    await register(userId, 'ExponentPushToken[same-device]');
    await db.asAdmin(
      `update public.device_tokens
          set last_seen_at = '2026-07-01T00:00:00Z'
        where fcm_token = 'ExponentPushToken[same-device]'`,
    );

    await register(userId, 'ExponentPushToken[same-device]');

    const rows = await rowsFor(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.last_seen_at).not.toBe('2026-07-01 00:00:00+00');
  });

  test('같은 기기 토큰으로 다른 계정에 로그인하면 현재 계정으로 옮긴다', async () => {
    const first = await createUser(db, '첫계정');
    const second = await createUser(db, '둘째계정');
    const token = 'ExponentPushToken[shared-device]';
    await register(first, token);

    await register(second, token);

    expect(await rowsFor(first)).toEqual([]);
    expect(await rowsFor(second)).toMatchObject([{ user_id: second, fcm_token: token }]);
  });

  test(`네 번째 기기는 가장 오래된 토큰을 지우고 최신 ${DEVICE_TOKEN_MAX}개만 둔다`, async () => {
    const userId = await createUser(db, '다기기');
    for (const [index, token] of ['oldest', 'middle', 'newest'].entries()) {
      await register(userId, `ExponentPushToken[${token}]`);
      await db.asAdmin(
        `update public.device_tokens
            set last_seen_at = $2::timestamptz
          where user_id = $1 and fcm_token = $3`,
        [userId, `2026-07-0${index + 1}T00:00:00Z`, `ExponentPushToken[${token}]`],
      );
    }

    await register(userId, 'ExponentPushToken[fourth]');

    const tokens = (await rowsFor(userId)).map((row) => row.fcm_token).sort();
    expect(tokens).toEqual(
      [
        'ExponentPushToken[fourth]',
        'ExponentPushToken[middle]',
        'ExponentPushToken[newest]',
      ].sort(),
    );
  });

  test('ACTIVE가 아닌 사용자는 토큰을 등록하지 않는다', async () => {
    const userId = await createUser(db, '탈퇴');
    await db.asAdmin(`update public.users set status = 'WITHDRAWN' where id = $1`, [userId]);

    const message = await messageOf(() =>
      register(userId, 'ExponentPushToken[withdrawn-device]'),
    );

    expect(message).toContain('E_FORBIDDEN');
    expect(await rowsFor(userId)).toEqual([]);
  });

  test('클라이언트 역할은 RPC를 직접 호출할 수 없다', async () => {
    const userId = await createUser(db, '권한');

    const message = await messageOf(() =>
      db.asUser(
        userId,
        `select public.lf_device_token_register($1, 'ExponentPushToken[forged]')`,
        [userId],
      ),
    );

    expect(message).toContain('permission denied');
  });
});
