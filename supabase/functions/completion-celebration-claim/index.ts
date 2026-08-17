import { createDeps } from '../_shared/runtime.ts';
import { createCompletionCelebrationClaimHandler } from './handler.ts';

Deno.serve(createCompletionCelebrationClaimHandler(createDeps()));
