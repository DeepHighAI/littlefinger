// Deno 진입점. **이 파일에는 로직을 두지 않는다** — 여기 한 줄이라도 넣으면 그 줄만
// 테스트 밖에 남는다. 로직은 전부 handler.ts 에 있고 vitest 가 그대로 부른다.

import { createDeps } from '../_shared/runtime.ts';
import { createDeclineHandler } from './handler.ts';

Deno.serve(createDeclineHandler(createDeps()));
