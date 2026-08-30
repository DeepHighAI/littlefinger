import { createDeps } from '../_shared/runtime.ts';
import { createRewardStatusHandler } from './handler.ts';

Deno.serve(createRewardStatusHandler(createDeps()));
