import { createDeps } from '../_shared/runtime.ts';
import { createRewardIntentHandler } from './handler.ts';

Deno.serve(createRewardIntentHandler(createDeps()));
