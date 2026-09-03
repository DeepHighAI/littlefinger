import { defineConfig } from 'vitest/config';

// packages/shared 는 플랫폼 API를 쓰지 않으므로 node 환경으로 충분하다.
// apps/mobile 은 jest-expo 를 쓰므로 여기서 제외한다 (RN 트랜스폼이 다르다).
export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/web/src/**/*.test.{ts,tsx}',
      'supabase/tests/**/*.test.ts',
      'tools/**/*.test.ts',
    ],
    environment: 'node',
    // PGlite 스위트가 워커를 점유하면 기본 5초 제한은 러너에서 무작위로 터진다.
    // fake timer 를 써도 testTimeout 은 실시간으로 재기 때문에 CPU 경합에 그대로 노출된다.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // 테스트가 하나도 수집되지 않으면 조용히 통과시키지 않고 실패시킨다.
    passWithNoTests: false,
  },
});
