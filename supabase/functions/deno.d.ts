// Deno 런타임 표면 선언 — **tsc 를 위해서만** 존재한다.
//
// Edge Function 은 Deno 위에서 돌지만 이 저장소에는 Deno 가 설치돼 있지 않아 `deno check` 를
// 쓸 수 없다. 그렇다고 `supabase/functions` 를 타입 검사 밖에 두면 껍데기 네 개가 통째로
// 검사되지 않는다 — CLAUDE.md §1-4 가 커밋 전 타입 검사를 필수로 두는 이유가 바로 이것이다.
//
// 실제로 쓰는 것만 적는다. Deno 전체를 흉내내면 여기 적힌 것이 정본처럼 보이기 시작한다.

declare namespace Deno {
  /** Supabase Secrets 가 환경변수로 들어온다(04 §9). */
  export const env: {
    get(key: string): string | undefined;
  };

  /** 진입점. `index.ts` 한 줄에서만 쓴다. */
  export function serve(handler: (request: Request) => Promise<Response> | Response): void;
}

/**
 * Deno 는 npm 패키지를 `npm:` 지정자로 읽는다. tsc 는 그 형태를 모르므로 설치된 타입으로
 * 이어 준다. **버전은 두 곳이 같아야 한다** — 여기 타입과 런타임이 갈리면 tsc 는 통과하고
 * 배포된 함수만 틀린다.
 */
declare module 'npm:@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js';
}

declare module 'npm:@imagemagick/magick-wasm@0.0.39' {
  export * from '@imagemagick/magick-wasm';
}
