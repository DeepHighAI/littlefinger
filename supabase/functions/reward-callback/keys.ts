import type { SsvVerifierKey } from './ssv.ts';

const VERIFIER_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
/** Google 은 verifier-keys.json 을 최대 24시간만 캐시하라고 요구한다. */
const VERIFIER_KEYS_CACHE_MS = 24 * 60 * 60 * 1_000;
/**
 * 강제 재조회 사이의 최소 간격. 콜백은 인증 없는 공개 GET 이라, 모르는 key_id 마다 Google 로
 * 나가는 요청을 허용하면 누구나 우리를 통해 gstatic 을 두드리게 된다(아웃바운드 증폭).
 */
const FORCED_REFETCH_MIN_INTERVAL_MS = 60 * 1_000;

export interface VerifierKeyCache {
  /** 캐시가 있으면 그대로, 24시간이 지났으면 새로 받는다. */
  keys(): Promise<readonly SsvVerifierKey[]>;
  /**
   * 캐시에 없는 `key_id` 를 만났을 때의 재조회. Google 의 키 회전 직후에 오는 콜백을 위한
   * 길인데, 60초 안에 다시 오면 새로 받지 않고 지금 캐시를 돌려준다 — 모르는 키는 여전히
   * 모르는 키이고, 그것이 위조라면 401 이 정답이다.
   */
  refresh(): Promise<readonly SsvVerifierKey[]>;
}

export interface VerifierKeyCacheDeps {
  fetchJson(url: string): Promise<unknown>;
  /** epoch ms. 순수 코드가 시계를 직접 읽지 않아야 캐시 만료를 테스트할 수 있다. */
  now(): number;
}

function keysOf(value: unknown): readonly SsvVerifierKey[] {
  if (typeof value !== 'object' || value === null || !('keys' in value) || !Array.isArray(value.keys)) {
    throw new Error('INVALID_ADMOB_VERIFIER_KEYS');
  }
  const keys = value.keys.filter((item): item is SsvVerifierKey => {
    if (typeof item !== 'object' || item === null) return false;
    const row = item as Record<string, unknown>;
    return Number.isInteger(row['keyId']) && typeof row['pem'] === 'string';
  });
  if (keys.length === 0) throw new Error('INVALID_ADMOB_VERIFIER_KEYS');
  return keys;
}

export async function fetchVerifierKeysJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('ADMOB_VERIFIER_KEYS_UNAVAILABLE');
  return await response.json();
}

export function createVerifierKeyCache(deps: VerifierKeyCacheDeps): VerifierKeyCache {
  let cached: readonly SsvVerifierKey[] | null = null;
  let cachedAt = 0;
  let forcedAt: number | null = null;

  function within(since: number | null, now: number, interval: number): boolean {
    return since !== null && now >= since && now - since < interval;
  }

  async function load(now: number): Promise<readonly SsvVerifierKey[]> {
    cached = keysOf(await deps.fetchJson(VERIFIER_KEYS_URL));
    cachedAt = now;
    return cached;
  }

  return {
    keys: async () => {
      const now = deps.now();
      if (cached !== null && within(cachedAt, now, VERIFIER_KEYS_CACHE_MS)) return cached;
      return await load(now);
    },
    refresh: async () => {
      const now = deps.now();
      if (cached !== null && within(forcedAt, now, FORCED_REFETCH_MIN_INTERVAL_MS)) return cached;
      // 실패해도 간격은 소비한다. 받지 못한 순간에 재시도를 풀어 주면 장애 중에 증폭이 최대가 된다.
      forcedAt = now;
      return await load(now);
    },
  };
}
