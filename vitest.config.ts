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
    // 테스트가 하나도 수집되지 않으면 조용히 통과시키지 않고 실패시킨다.
    passWithNoTests: false,
  },
});
