import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, test } from 'vitest';

import { asPromiseFeaturedPresets, PROMISE_PRESETS_CONFIG_KEY } from '../../packages/shared/src/promise-presets.ts';
import { createTestDb, createUser, type TestDb } from './harness.ts';

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); }, 60_000);
afterAll(async () => { await db.close(); });

test('clients can read bilingual featured suggestions but cannot change them', async () => {
  const user = await createUser(db, 'preset-reader');
  const query = 'select value from public.app_configs where key = $1';
  const anonymous = await db.asAnon(query, [PROMISE_PRESETS_CONFIG_KEY]);
  const authenticated = await db.asUser(user, query, [PROMISE_PRESETS_CONFIG_KEY]);
  const config = asPromiseFeaturedPresets(anonymous.rows[0]?.['value']);
  expect(config?.reward.ko).toEqual(['다음 메뉴 선택권', '주말 계획 결정권', '칭찬 세 가지']);
  expect(config?.penalty.ko).toEqual(['설거지 1주일', '소원권 1장 주기', '노래방 한 곡']);
  expect(authenticated.rows).toEqual(anonymous.rows);
  const update = 'update public.app_configs set value = $1 where key = $2 returning key';
  await expect(db.asUser(user, update, [{}, PROMISE_PRESETS_CONFIG_KEY])).rejects.toThrow('permission denied');
  await expect(db.asAnon(update, [{}, PROMISE_PRESETS_CONFIG_KEY])).rejects.toThrow('permission denied');
  expect((await db.asAnon(query, [PROMISE_PRESETS_CONFIG_KEY])).rows).toEqual(anonymous.rows);
});

test('reapplying the seed preserves operator changes', async () => {
  await db.asAdmin("update public.app_configs set value = jsonb_set(value, '{reward,ko,0}', '\"운영자가 바꾼 보상\"') where key = $1", [PROMISE_PRESETS_CONFIG_KEY]);
  await db.execAdmin(readFileSync(new URL('../migrations/20260909072842_remote_promise_presets.sql', import.meta.url), 'utf8'));
  const result = await db.asAnon('select value from public.app_configs where key = $1', [PROMISE_PRESETS_CONFIG_KEY]);
  expect(asPromiseFeaturedPresets(result.rows[0]?.['value'])?.reward.ko[0]).toBe('운영자가 바꾼 보상');
});
