import { createDeps } from '../_shared/runtime.ts';
import { createCompletionCelebrationShownHandler } from './handler.ts';

Deno.serve(createCompletionCelebrationShownHandler(createDeps()));
