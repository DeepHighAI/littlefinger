/// <reference types="vite/client" />

// Vite 기본 `ImportMetaEnv` 는 인덱스 시그니처가 `any` 라, 오타 난 변수명도 통과하고
// 값이 undefined 인 것도 타입에서는 보이지 않는다. 쓰는 것만 명시한다.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
